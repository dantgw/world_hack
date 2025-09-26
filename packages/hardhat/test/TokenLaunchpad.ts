import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenLaunchpad } from "../typechain-types";

describe("TokenLaunchpad", function () {
  let launchpad: TokenLaunchpad;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer: SignerWithAddress;

  const VIRTUAL_ETH_RESERVES = ethers.parseEther("200000");
  const VIRTUAL_TOKEN_RESERVES = ethers.parseEther("1000000000");

  // Mock World ID proof parameters
  const mockRoot = ethers.parseUnits("1234567890123456789012345678901234567890123456789012345678901234", 0);
  const mockProof = [
    ethers.parseUnits("1", 0),
    ethers.parseUnits("2", 0),
    ethers.parseUnits("3", 0),
    ethers.parseUnits("4", 0),
    ethers.parseUnits("5", 0),
    ethers.parseUnits("6", 0),
    ethers.parseUnits("7", 0),
    ethers.parseUnits("8", 0),
  ];

  // Helper function to generate unique nullifier hash for each test
  function getMockNullifierHash(testIndex: number): bigint {
    return ethers.parseUnits(
      (9876543210987654321098765432109876543210987654321098765432109876n + BigInt(testIndex)).toString(),
      0,
    );
  }

  beforeEach(async function () {
    [owner, creator, buyer] = await ethers.getSigners();

    // Mock World ID contract for testing
    const MockWorldID = await ethers.getContractFactory("MockWorldID");
    const mockWorldID = await MockWorldID.deploy();

    // Deploy TokenLaunchpad with World ID parameters
    const TokenLaunchpad = await ethers.getContractFactory("TokenLaunchpad");
    launchpad = await TokenLaunchpad.deploy(await mockWorldID.getAddress(), "app_test_1234567890abcdef", "mint_tokens");
  });

  describe("Token Creation", function () {
    it("Should create a new token", async function () {
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";
      const metadataURI = "https://example.com/metadata.json";

      const tx = await launchpad.connect(creator).createToken(tokenName, tokenSymbol, metadataURI);
      const receipt = await tx.wait();

      // Find the token address from events
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
      expect(event).to.not.be.null;

      const tokenAddress = launchpad.interface.parseLog(event as any).args.token;
      expect(await launchpad.isToken(tokenAddress)).to.be.true;

      const tokenInfo = await launchpad.tokens(tokenAddress);
      expect(tokenInfo.creator).to.equal(creator.address);
      expect(tokenInfo.name).to.equal(tokenName);
      expect(tokenInfo.symbol).to.equal(tokenSymbol);
      expect(tokenInfo.metadataURI).to.equal(metadataURI);
      expect(tokenInfo.virtualEthReserves).to.equal(VIRTUAL_ETH_RESERVES);
      expect(tokenInfo.virtualTokenReserves).to.equal(VIRTUAL_TOKEN_RESERVES);
    });

    it("Should emit TokenCreated event", async function () {
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";
      const metadataURI = "https://example.com/metadata.json";

      const tx = await launchpad.connect(creator).createToken(tokenName, tokenSymbol, metadataURI);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
      expect(event).to.not.be.null;

      const eventArgs = launchpad.interface.parseLog(event as any).args;
      expect(eventArgs.creator).to.equal(creator.address);
      expect(eventArgs.name).to.equal(tokenName);
      expect(eventArgs.symbol).to.equal(tokenSymbol);
      expect(eventArgs.metadataURI).to.equal(metadataURI);
    });
  });

  describe("Token Trading", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      const tx = await launchpad.connect(creator).createToken("Test Token", "TEST", "");
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any).args.token;
    });

    it("Should buy tokens with ETH", async function () {
      const ethAmount = ethers.parseEther("1");

      const tx = await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(1), mockProof, { value: ethAmount });
      const receipt = await tx.wait();

      // Check token balance
      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const tokenBalance = await token.balanceOf(buyer.address);
      expect(tokenBalance).to.be.gt(0);

      // Check event emission
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokensBought").topicHash,
      );
      expect(event).to.not.be.undefined;

      const eventArgs = launchpad.interface.parseLog(event as any).args;
      expect(eventArgs.token).to.equal(tokenAddress);
      expect(eventArgs.buyer).to.equal(buyer.address);
      expect(eventArgs.ethAmount).to.equal(ethAmount);
    });

    it("Should sell tokens for ETH", async function () {
      // First buy some tokens
      const buyAmount = ethers.parseEther("1");
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(2), mockProof, { value: buyAmount });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const tokenBalance = await token.balanceOf(buyer.address);
      const sellAmount = tokenBalance / 2n; // Sell half

      const tx = await launchpad.connect(buyer).sellTokens(tokenAddress, sellAmount);
      const receipt = await tx.wait();

      // Check token balance decreased
      const newTokenBalance = await token.balanceOf(buyer.address);
      expect(newTokenBalance).to.equal(tokenBalance - sellAmount);

      // Check event emission
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokensSold").topicHash,
      );
      expect(event).to.not.be.undefined;

      const eventArgs = launchpad.interface.parseLog(event as any).args;
      expect(eventArgs.token).to.equal(tokenAddress);
      expect(eventArgs.seller).to.equal(buyer.address);
      expect(eventArgs.tokenAmount).to.equal(sellAmount);
    });

    it("Should calculate correct token amounts", async function () {
      const ethAmount = ethers.parseEther("1");

      // Calculate the fee (1% = 100/10000)
      const feeAmount = (ethAmount * 100n) / 10000n;
      const ethAfterFee = ethAmount - feeAmount;

      const expectedTokenAmount = await launchpad.calculateTokenAmount(
        VIRTUAL_ETH_RESERVES,
        VIRTUAL_TOKEN_RESERVES,
        ethAfterFee,
      );

      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(7), mockProof, { value: ethAmount });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const actualTokenAmount = await token.balanceOf(buyer.address);

      // Allow for small rounding differences (increased tolerance for bonding curve calculations)
      expect(actualTokenAmount).to.be.closeTo(expectedTokenAmount, ethers.parseEther("1"));
    });

    it("Should prevent buying tokens that don't exist", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;

      await expect(
        launchpad
          .connect(buyer)
          .buyTokens(fakeTokenAddress, mockRoot, getMockNullifierHash(4), mockProof, { value: ethers.parseEther("1") }),
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should prevent selling more tokens than balance", async function () {
      await expect(launchpad.connect(buyer).sellTokens(tokenAddress, ethers.parseEther("1000"))).to.be.revertedWith(
        "Insufficient token balance",
      );
    });
  });

  describe("Fee Distribution", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      const tx = await launchpad.connect(creator).createToken("Test Token", "TEST", "");
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any).args.token;
    });

    it("Should distribute creator fees correctly", async function () {
      const ethAmount = ethers.parseEther("1");
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(7), mockProof, { value: ethAmount });

      const tokenInfo = await launchpad.tokens(tokenAddress);
      expect(tokenInfo.creatorFees).to.be.gt(0);

      const initialBalance = await ethers.provider.getBalance(creator.address);

      const tx = await launchpad.connect(creator).withdrawCreatorFees(tokenAddress);
      const receipt = await tx.wait();

      const finalBalance = await ethers.provider.getBalance(creator.address);
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      expect(finalBalance).to.be.closeTo(initialBalance + tokenInfo.creatorFees - gasUsed, ethers.parseEther("0.001"));
    });

    it("Should accumulate platform fees", async function () {
      const ethAmount = ethers.parseEther("1");
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(7), mockProof, { value: ethAmount });

      const platformFees = await launchpad.platformFees();
      expect(platformFees).to.be.gt(0);
    });

    it("Should allow owner to withdraw platform fees", async function () {
      const ethAmount = ethers.parseEther("1");
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(7), mockProof, { value: ethAmount });

      const platformFees = await launchpad.platformFees();
      const initialBalance = await ethers.provider.getBalance(owner.address);

      const tx = await launchpad.connect(owner).withdrawPlatformFees();
      const receipt = await tx.wait();

      const finalBalance = await ethers.provider.getBalance(owner.address);
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      expect(finalBalance).to.be.closeTo(initialBalance + platformFees - gasUsed, ethers.parseEther("0.001"));

      expect(await launchpad.platformFees()).to.equal(0);
    });

    it("Should prevent non-creator from withdrawing creator fees", async function () {
      const ethAmount = ethers.parseEther("1");
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(7), mockProof, { value: ethAmount });

      await expect(launchpad.connect(buyer).withdrawCreatorFees(tokenAddress)).to.be.revertedWith(
        "Only creator can withdraw",
      );
    });
  });

  describe("View Functions", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      const tx = await launchpad.connect(creator).createToken("Test Token", "TEST", "");
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any).args.token;
    });

    it("Should return correct token price", async function () {
      const price = await launchpad.getTokenPrice(tokenAddress);
      expect(price).to.be.gt(0);
    });

    it("Should return all tokens", async function () {
      const allTokens = await launchpad.getAllTokens();
      expect(allTokens).to.include(tokenAddress);
    });

    it("Should return correct token count", async function () {
      const count = await launchpad.getTokenCount();
      expect(count).to.equal(1);
    });
  });

  describe("World ID Integration", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      // Create a token for testing
      const tx = await launchpad
        .connect(creator)
        .createToken("Test Token", "TEST", "https://example.com/metadata.json");
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any).args.token;
    });

    it("Should verify World ID proof when buying tokens", async function () {
      const ethAmount = ethers.parseEther("1");

      const tx = await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(5), mockProof, { value: ethAmount });
      const receipt = await tx.wait();

      // Check that WorldIDVerified event was emitted
      const worldIDEvent = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("WorldIDVerified").topicHash,
      );
      expect(worldIDEvent).to.not.be.undefined;
    });

    it("Should prevent reusing the same nullifier hash", async function () {
      const ethAmount = ethers.parseEther("1");
      const sameNullifier = getMockNullifierHash(100);

      // First call should succeed
      await launchpad.connect(buyer).buyTokens(tokenAddress, mockRoot, sameNullifier, mockProof, { value: ethAmount });

      // Second call with same nullifier should fail
      await expect(
        launchpad.connect(buyer).buyTokens(tokenAddress, mockRoot, sameNullifier, mockProof, { value: ethAmount }),
      ).to.be.reverted;
    });
  });

  describe("Daily Mint Limits", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      // Create a token for testing
      const tx = await launchpad
        .connect(creator)
        .createToken("Test Token", "TEST", "https://example.com/metadata.json");
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any).args.token;
    });

    it("Should track daily minted amount", async function () {
      const ethAmount = ethers.parseEther("1");

      // First purchase
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(8), mockProof, { value: ethAmount });

      const dailyMinted = await launchpad.getDailyMintedAmount(buyer.address);
      expect(dailyMinted).to.be.gt(0);

      const remainingLimit = await launchpad.getRemainingDailyLimit(buyer.address);
      expect(remainingLimit).to.be.lt(ethers.parseEther("100"));
    });

    it("Should reset daily limit after 24 hours", async function () {
      const ethAmount = ethers.parseEther("1");

      // First purchase
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(9), mockProof, { value: ethAmount });

      // Simulate time passing (24 hours + 1 second)
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      const dailyMinted = await launchpad.getDailyMintedAmount(buyer.address);
      expect(dailyMinted).to.equal(0);

      const remainingLimit = await launchpad.getRemainingDailyLimit(buyer.address);
      expect(remainingLimit).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Exact Token Purchase", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      // Create a token for testing
      const tx = await launchpad
        .connect(creator)
        .createToken("Test Token", "TEST", "https://example.com/metadata.json");
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
      expect(event).to.not.be.null;
      tokenAddress = launchpad.interface.parseLog(event as any).args.token;
    });

    it("Should buy exact amount of tokens", async function () {
      const tokenAmount = ethers.parseEther("1000"); // Buy exactly 1000 tokens

      // Get required ETH amount
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      // Buy tokens with exact amount
      const tx = await launchpad
        .connect(buyer)
        .buyTokensExact(tokenAddress, tokenAmount, mockRoot, getMockNullifierHash(10), mockProof, {
          value: requiredEth,
        });
      const receipt = await tx.wait();

      // Check token balance
      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const tokenBalance = await token.balanceOf(buyer.address);
      expect(tokenBalance).to.equal(tokenAmount);
    });

    it("Should refund excess ETH when buying exact tokens", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);
      const excessEth = requiredEth + ethers.parseEther("0.1"); // Send extra ETH

      const initialBalance = await ethers.provider.getBalance(buyer.address);

      // Buy tokens with excess ETH
      const tx = await launchpad
        .connect(buyer)
        .buyTokensExact(tokenAddress, tokenAmount, mockRoot, getMockNullifierHash(11), mockProof, { value: excessEth });
      const receipt = await tx.wait();

      const finalBalance = await ethers.provider.getBalance(buyer.address);
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      // Check that excess ETH was refunded
      const expectedBalance = initialBalance - requiredEth - gasUsed;
      expect(finalBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
    });

    it("Should fail when insufficient ETH is sent for exact tokens", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);
      const insufficientEth = requiredEth - ethers.parseEther("0.1"); // Send less ETH

      await expect(
        launchpad
          .connect(buyer)
          .buyTokensExact(tokenAddress, tokenAmount, mockRoot, getMockNullifierHash(12), mockProof, {
            value: insufficientEth,
          }),
      ).to.be.revertedWith("Insufficient ETH sent");
    });

    it("Should calculate correct ETH requirement for tokens", async function () {
      const tokenAmount = ethers.parseEther("1000");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      expect(requiredEth).to.be.gt(0);

      // The required ETH should be greater than the base amount due to fees
      const baseEth = await launchpad.calculateEthAmount(
        (await launchpad.tokens(tokenAddress)).virtualEthReserves,
        (await launchpad.tokens(tokenAddress)).virtualTokenReserves,
        tokenAmount,
      );

      expect(requiredEth).to.be.gt(baseEth);
    });
  });
});
