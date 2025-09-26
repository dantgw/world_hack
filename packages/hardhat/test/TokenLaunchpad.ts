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

  beforeEach(async function () {
    [owner, creator, buyer] = await ethers.getSigners();

    // Deploy TokenLaunchpad
    const TokenLaunchpad = await ethers.getContractFactory("TokenLaunchpad");
    launchpad = await TokenLaunchpad.deploy();
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
      tokenAddress = launchpad.interface.parseLog(event!).args.token;
    });

    it("Should buy tokens with ETH", async function () {
      const ethAmount = ethers.parseEther("1");

      const tx = await launchpad.connect(buyer).buyTokens(tokenAddress, { value: ethAmount });
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
      await launchpad.connect(buyer).buyTokens(tokenAddress, { value: buyAmount });

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

      await launchpad.connect(buyer).buyTokens(tokenAddress, { value: ethAmount });

      const token = await ethers.getContractAt("LaunchpadToken", tokenAddress);
      const actualTokenAmount = await token.balanceOf(buyer.address);

      // Allow for small rounding differences (increased tolerance for bonding curve calculations)
      expect(actualTokenAmount).to.be.closeTo(expectedTokenAmount, ethers.parseEther("1"));
    });

    it("Should prevent buying tokens that don't exist", async function () {
      const fakeTokenAddress = ethers.Wallet.createRandom().address;

      await expect(
        launchpad.connect(buyer).buyTokens(fakeTokenAddress, { value: ethers.parseEther("1") }),
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
      tokenAddress = launchpad.interface.parseLog(event!).args.token;
    });

    it("Should distribute creator fees correctly", async function () {
      const ethAmount = ethers.parseEther("1");
      await launchpad.connect(buyer).buyTokens(tokenAddress, { value: ethAmount });

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
      await launchpad.connect(buyer).buyTokens(tokenAddress, { value: ethAmount });

      const platformFees = await launchpad.platformFees();
      expect(platformFees).to.be.gt(0);
    });

    it("Should allow owner to withdraw platform fees", async function () {
      const ethAmount = ethers.parseEther("1");
      await launchpad.connect(buyer).buyTokens(tokenAddress, { value: ethAmount });

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
      await launchpad.connect(buyer).buyTokens(tokenAddress, { value: ethAmount });

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
      tokenAddress = launchpad.interface.parseLog(event!).args.token;
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
});
