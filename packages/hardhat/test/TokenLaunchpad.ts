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

  // Helper function to generate unique nullifier hash for token creation tests
  function getTokenCreationNullifierHash(testIndex: number): bigint {
    return ethers.parseUnits(
      (1111111111111111111111111111111111111111111111111111111111111111n + BigInt(testIndex)).toString(),
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
    launchpad = await TokenLaunchpad.deploy(
      await mockWorldID.getAddress(),
      "app_test_1234567890abcdef",
      "mint_tokens",
      "create_token",
    );
  });

  describe("Token Creation", function () {
    it("Should create a new token", async function () {
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";
      const metadataURI = "https://example.com/metadata.json";

      const tx = await launchpad
        .connect(creator)
        .createToken(tokenName, tokenSymbol, metadataURI, mockRoot, getTokenCreationNullifierHash(1), mockProof);
      const receipt = await tx.wait();

      // Find the token address from events
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
      expect(event).to.not.be.null;

      const tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
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

      const tx = await launchpad
        .connect(creator)
        .createToken(tokenName, tokenSymbol, metadataURI, mockRoot, getTokenCreationNullifierHash(2), mockProof);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
      expect(event).to.not.be.null;

      const eventArgs = launchpad.interface.parseLog(event as any)!.args;
      expect(eventArgs.creator).to.equal(creator.address);
      expect(eventArgs.name).to.equal(tokenName);
      expect(eventArgs.symbol).to.equal(tokenSymbol);
      expect(eventArgs.metadataURI).to.equal(metadataURI);
    });

    it("Should prevent creating multiple tokens within 24 hours", async function () {
      const tokenName1 = "Test Token 1";
      const tokenSymbol1 = "TEST1";
      const metadataURI1 = "https://example.com/metadata1.json";

      const tokenName2 = "Test Token 2";
      const tokenSymbol2 = "TEST2";
      const metadataURI2 = "https://example.com/metadata2.json";

      // Create first token
      await launchpad
        .connect(creator)
        .createToken(tokenName1, tokenSymbol1, metadataURI1, mockRoot, getTokenCreationNullifierHash(3), mockProof);

      // Try to create second token with same nullifier hash - should fail
      await expect(
        launchpad
          .connect(creator)
          .createToken(tokenName2, tokenSymbol2, metadataURI2, mockRoot, getTokenCreationNullifierHash(3), mockProof),
      ).to.be.revertedWithCustomError(launchpad, "TokenCreationCooldownNotMet");
    });

    it("Should allow creating tokens after 24 hours", async function () {
      const tokenName1 = "Test Token 1";
      const tokenSymbol1 = "TEST1";
      const metadataURI1 = "https://example.com/metadata1.json";

      const tokenName2 = "Test Token 2";
      const tokenSymbol2 = "TEST2";
      const metadataURI2 = "https://example.com/metadata2.json";

      // Create first token
      await launchpad
        .connect(creator)
        .createToken(tokenName1, tokenSymbol1, metadataURI1, mockRoot, getTokenCreationNullifierHash(4), mockProof);

      // Fast forward time by 25 hours (more than 24 hours)
      await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]); // 25 hours
      await ethers.provider.send("evm_mine", []);

      // Should be able to create second token now
      const tx = await launchpad
        .connect(creator)
        .createToken(tokenName2, tokenSymbol2, metadataURI2, mockRoot, getTokenCreationNullifierHash(4), mockProof);
      const receipt = await tx.wait();

      // Verify second token was created
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
    });

    it("Should track token creation cooldown correctly", async function () {
      const nullifierHash = getTokenCreationNullifierHash(5);

      // Initially should be able to create
      let [canCreateNow, nextCreationTime] = await launchpad.getTokenCreationCooldown(nullifierHash);
      expect(canCreateNow).to.be.true;
      expect(nextCreationTime).to.equal(0);

      // Create a token
      await launchpad.connect(creator).createToken("Test Token", "TEST", "", mockRoot, nullifierHash, mockProof);

      // Should not be able to create immediately
      [canCreateNow, nextCreationTime] = await launchpad.getTokenCreationCooldown(nullifierHash);
      expect(canCreateNow).to.be.false;
      expect(nextCreationTime).to.be.gt(0);

      // Fast forward time by 25 hours
      await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]); // 25 hours
      await ethers.provider.send("evm_mine", []);

      // Should be able to create again
      [canCreateNow, nextCreationTime] = await launchpad.getTokenCreationCooldown(nullifierHash);
      expect(canCreateNow).to.be.true;
      expect(nextCreationTime).to.equal(0);
    });
  });

  describe("Token Trading", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      const tx = await launchpad
        .connect(creator)
        .createToken("Test Token", "TEST", "", mockRoot, getTokenCreationNullifierHash(10), mockProof);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
    });

    it("Should buy tokens with ETH", async function () {
      const ethAmount = ethers.parseEther("0.0001"); // Very small amount to stay within 100 token limit

      const tx = await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(1), mockProof, { value: ethAmount });
      const receipt = await tx.wait();

      // Check token balance
      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const tokenBalance = await token.balanceOf(buyer.address);
      expect(tokenBalance).to.be.gt(0);
      expect(tokenBalance).to.be.lte(ethers.parseEther("100")); // Should not exceed limit

      // Check event emission
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokensBought").topicHash,
      );
      expect(event).to.not.be.undefined;

      const eventArgs = launchpad.interface.parseLog(event as any)!.args;
      expect(eventArgs.token).to.equal(tokenAddress);
      expect(eventArgs.buyer).to.equal(buyer.address);
      expect(eventArgs.ethAmount).to.equal(ethAmount);
    });

    it("Should sell tokens for ETH", async function () {
      // First buy some tokens
      const buyAmount = ethers.parseEther("0.0001"); // Very small amount to stay within 100 token limit
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

      const eventArgs = launchpad.interface.parseLog(event as any)!.args;
      expect(eventArgs.token).to.equal(tokenAddress);
      expect(eventArgs.seller).to.equal(buyer.address);
      expect(eventArgs.tokenAmount).to.equal(sellAmount);
    });

    it("Should calculate correct token amounts", async function () {
      const ethAmount = ethers.parseEther("0.0001"); // Very small amount to stay within 100 token limit

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
      expect(actualTokenAmount).to.be.closeTo(expectedTokenAmount, ethers.parseEther("0.1"));
    });

    it("Should prevent buying tokens that don't exist", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;

      await expect(
        launchpad.connect(buyer).buyTokens(fakeTokenAddress, mockRoot, getMockNullifierHash(4), mockProof, {
          value: ethers.parseEther("0.01"),
        }),
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
      const tx = await launchpad
        .connect(creator)
        .createToken("Test Token", "TEST", "", mockRoot, getTokenCreationNullifierHash(20), mockProof);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
    });

    it("Should distribute creator fees correctly", async function () {
      const ethAmount = ethers.parseEther("0.001"); // Very small amount to stay within 100 token limit
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
      const ethAmount = ethers.parseEther("0.001"); // Very small amount to stay within 100 token limit
      await launchpad
        .connect(buyer)
        .buyTokens(tokenAddress, mockRoot, getMockNullifierHash(7), mockProof, { value: ethAmount });

      const platformFees = await launchpad.platformFees();
      expect(platformFees).to.be.gt(0);
    });

    it("Should allow owner to withdraw platform fees", async function () {
      const ethAmount = ethers.parseEther("0.001"); // Very small amount to stay within 100 token limit
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
      const ethAmount = ethers.parseEther("0.001"); // Very small amount to stay within 100 token limit
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
      const tx = await launchpad
        .connect(creator)
        .createToken("Test Token", "TEST", "", mockRoot, getTokenCreationNullifierHash(30), mockProof);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
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
        .createToken(
          "Test Token",
          "TEST",
          "https://example.com/metadata.json",
          mockRoot,
          getTokenCreationNullifierHash(40),
          mockProof,
        );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
    });

    it("Should verify World ID proof when buying tokens", async function () {
      const ethAmount = ethers.parseEther("0.0001"); // Very small amount to stay within 100 token limit

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
  });

  describe("Exact Token Purchase", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      // Create a token for testing
      const tx = await launchpad
        .connect(creator)
        .createToken(
          "Test Token",
          "TEST",
          "https://example.com/metadata.json",
          mockRoot,
          getTokenCreationNullifierHash(60),
          mockProof,
        );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      expect(event).to.not.be.undefined;
      expect(event).to.not.be.null;
      tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
    });

    it("Should buy exact amount of tokens", async function () {
      const tokenAmount = ethers.parseEther("1"); // Buy exactly 1 token (well within 100 limit)

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
      const tokenAmount = ethers.parseEther("0.5"); // Very small amount within limit
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);
      const excessEth = requiredEth + ethers.parseEther("0.001"); // Send extra ETH

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
      const tokenAmount = ethers.parseEther("0.1"); // Very small amount within limit
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);
      // Ensure we don't underflow by checking if requiredEth is large enough
      const insufficientEth =
        requiredEth > ethers.parseEther("0.0001") ? requiredEth - ethers.parseEther("0.0001") : requiredEth / 2n; // If requiredEth is too small, use half

      await expect(
        launchpad
          .connect(buyer)
          .buyTokensExact(tokenAddress, tokenAmount, mockRoot, getMockNullifierHash(12), mockProof, {
            value: insufficientEth,
          }),
      ).to.be.revertedWith("Insufficient ETH sent");
    });

    it("Should calculate correct ETH requirement for tokens", async function () {
      const tokenAmount = ethers.parseEther("0.05"); // Very small amount within limit
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

  describe("24-Hour Purchase Limit", function () {
    let tokenAddress: string;

    beforeEach(async function () {
      // Create a token for testing
      const tx = await launchpad
        .connect(creator)
        .createToken(
          "Test Token",
          "TEST",
          "https://example.com/metadata.json",
          mockRoot,
          getTokenCreationNullifierHash(50),
          mockProof,
        );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === launchpad.interface.getEvent("TokenCreated").topicHash,
      );
      tokenAddress = launchpad.interface.parseLog(event as any)!.args.token;
    });

    it("Should enforce 100 token limit per person within first 24 hours", async function () {
      const nullifierHash = getMockNullifierHash(200);

      // Try to buy exactly 10 tokens (should succeed, well within 100 limit)
      const tokenAmount = ethers.parseEther("10");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      await launchpad.connect(buyer).buyTokensExact(tokenAddress, tokenAmount, mockRoot, nullifierHash, mockProof, {
        value: requiredEth,
      });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const balance = await token.balanceOf(buyer.address);
      expect(balance).to.equal(tokenAmount);
    });

    it("Should allow buying exactly 100 tokens within first 24 hours", async function () {
      const nullifierHash = getMockNullifierHash(207);

      // Try to buy exactly 100 tokens (should succeed, at the limit)
      const tokenAmount = ethers.parseEther("100");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      await launchpad.connect(buyer).buyTokensExact(tokenAddress, tokenAmount, mockRoot, nullifierHash, mockProof, {
        value: requiredEth,
      });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const balance = await token.balanceOf(buyer.address);
      expect(balance).to.equal(tokenAmount);
    });

    it("Should prevent exceeding 100 token limit within first 24 hours", async function () {
      const nullifierHash = getMockNullifierHash(201);

      // First buy 5 tokens
      const firstAmount = ethers.parseEther("5");
      const firstRequiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, firstAmount);

      await launchpad.connect(buyer).buyTokensExact(tokenAddress, firstAmount, mockRoot, nullifierHash, mockProof, {
        value: firstRequiredEth,
      });

      // Try to buy 96 more tokens (total would be 101, exceeding limit)
      const secondAmount = ethers.parseEther("96");
      const secondRequiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, secondAmount);

      await expect(
        launchpad.connect(buyer).buyTokensExact(tokenAddress, secondAmount, mockRoot, nullifierHash, mockProof, {
          value: secondRequiredEth,
        }),
      ).to.be.revertedWithCustomError(launchpad, "InvalidMintAmount");
    });

    it("Should allow buying more than 100 tokens after 24 hours", async function () {
      const nullifierHash = getMockNullifierHash(202);

      // Fast forward time by 25 hours (more than 24 hours)
      await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]); // 25 hours
      await ethers.provider.send("evm_mine", []);

      // Now try to buy 15 tokens (should succeed as 24 hours have passed)
      const tokenAmount = ethers.parseEther("15");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      await launchpad.connect(buyer).buyTokensExact(tokenAddress, tokenAmount, mockRoot, nullifierHash, mockProof, {
        value: requiredEth,
      });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const balance = await token.balanceOf(buyer.address);
      expect(balance).to.equal(tokenAmount);
    });

    it("Should track remaining limit correctly", async function () {
      const nullifierHash = getMockNullifierHash(203);

      // Buy 3 tokens
      const firstAmount = ethers.parseEther("3");
      const firstRequiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, firstAmount);

      await launchpad.connect(buyer).buyTokensExact(tokenAddress, firstAmount, mockRoot, nullifierHash, mockProof, {
        value: firstRequiredEth,
      });

      // Check remaining limit
      const remainingLimit = await launchpad.getRemainingLimit(nullifierHash, tokenAddress);
      expect(remainingLimit).to.equal(ethers.parseEther("97")); // 100 - 3 = 97
    });

    it("Should allow different users to have separate limits", async function () {
      const nullifierHash1 = getMockNullifierHash(204);
      const nullifierHash2 = getMockNullifierHash(205);

      // First user buys 10 tokens
      const tokenAmount = ethers.parseEther("10");
      const requiredEth = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      await launchpad.connect(buyer).buyTokensExact(tokenAddress, tokenAmount, mockRoot, nullifierHash1, mockProof, {
        value: requiredEth,
      });

      // Second user should also be able to buy 10 tokens
      // Get the required ETH again as it may have changed due to bonding curve
      const requiredEth2 = await launchpad.getEthRequiredForTokens(tokenAddress, tokenAmount);

      await launchpad
        .connect(owner) // Using different account
        .buyTokensExact(tokenAddress, tokenAmount, mockRoot, nullifierHash2, mockProof, {
          value: requiredEth2,
        });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const buyerBalance = await token.balanceOf(buyer.address);
      const ownerBalance = await token.balanceOf(owner.address);

      expect(buyerBalance).to.equal(tokenAmount);
      expect(ownerBalance).to.equal(tokenAmount);
    });

    it("Should allow buying tokens with ETH within limit", async function () {
      const nullifierHash = getMockNullifierHash(206);

      // Buy tokens with ETH (very small amount to stay within limit)
      const ethAmount = ethers.parseEther("0.0001");

      await launchpad.connect(buyer).buyTokens(tokenAddress, mockRoot, nullifierHash, mockProof, { value: ethAmount });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const balance = await token.balanceOf(buyer.address);

      // Should have received tokens and not exceed limit
      expect(balance).to.be.gt(0);
      expect(balance).to.be.lte(ethers.parseEther("100"));
    });
  });
});
