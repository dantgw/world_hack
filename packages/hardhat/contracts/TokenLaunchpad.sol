//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IWorldID.sol";
import "./helpers/ByteHasher.sol";

contract TokenLaunchpad is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using ByteHasher for bytes;

    // Constants
    uint256 public constant VIRTUAL_ETH_RESERVES = 200_000 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVES = 1_000_000_000 ether;
    uint256 public constant FEE_RATE = 100; // 1% (100/10000)
    uint256 public constant CREATOR_FEE_RATE = 100; // 1% (100/10000)
    uint256 public constant PLATFORM_FEE_RATE = 100; // 1% (100/10000)
    uint256 public constant DAILY_MINT_LIMIT = 100 ether; // 100 tokens per person per day
    uint256 public constant SECONDS_IN_DAY = 86400; // 24 hours
    
    // State variables
    mapping(address => TokenInfo) public tokens;
    mapping(address => bool) public isToken;
    address[] public allTokens;
    
    // Platform fees
    uint256 public platformFees;
    
    // World ID variables
    IWorldID internal immutable worldId;
    uint256 internal immutable externalNullifierHash;
    uint256 internal immutable groupId = 1; // Orb-verified users only
    
    // Sybil resistance and daily limits
    mapping(uint256 => bool) internal nullifierHashes;
    mapping(address => uint256) internal dailyMintedAmount;
    mapping(address => uint256) internal lastMintDay;
    
    // Events
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI
    );
    
    event TokensBought(
        address indexed token,
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 newVirtualEthReserves,
        uint256 newVirtualTokenReserves
    );
    
    event TokensSold(
        address indexed token,
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 newVirtualEthReserves,
        uint256 newVirtualTokenReserves
    );
    
    
    event CreatorFeesWithdrawn(
        address indexed token,
        address indexed creator,
        uint256 amount
    );
    
    event WorldIDVerified(
        address indexed user,
        uint256 nullifierHash
    );
    
    event DailyLimitExceeded(
        address indexed user,
        uint256 attemptedAmount,
        uint256 dailyLimit
    );
    
    // Structs
    struct TokenInfo {
        address creator;
        string name;
        string symbol;
        string metadataURI;
        uint256 virtualEthReserves;
        uint256 virtualTokenReserves;
        uint256 totalSupply;
        uint256 creatorFees;
        uint256 createdAt;
    }
    
    /// @notice Thrown when attempting to reuse a nullifier
    error InvalidNullifier();
    
    /// @notice Thrown when daily mint limit is exceeded
    error DailyLimitExceededError();
    
    /// @param _worldId The address of the WorldIDRouter that will verify the proofs
    /// @param _appId The World ID App ID (from Developer Portal)
    /// @param _action The World ID Action (from Developer Portal)
    constructor(
        IWorldID _worldId,
        string memory _appId,
        string memory _action
    ) Ownable() {
        worldId = _worldId;
        externalNullifierHash = abi
            .encodePacked(abi.encodePacked(_appId).hashToField(), _action)
            .hashToField();
    }
    
    /**
     * @dev Create a new token with bonding curve
     * @param name Token name
     * @param symbol Token symbol
     * @param metadataURI Token metadata URI
     */
    function createToken(
        string memory name,
        string memory symbol,
        string memory metadataURI
    ) external nonReentrant returns (address) {
        // Deploy new ERC20 token
        LaunchpadToken token = new LaunchpadToken(name, symbol, msg.sender);
        address tokenAddress = address(token);
        
        // Initialize token info
        tokens[tokenAddress] = TokenInfo({
            creator: msg.sender,
            name: name,
            symbol: symbol,
            metadataURI: metadataURI,
            virtualEthReserves: VIRTUAL_ETH_RESERVES,
            virtualTokenReserves: VIRTUAL_TOKEN_RESERVES,
            totalSupply: 0,
            creatorFees: 0,
            createdAt: block.timestamp
        });
        
        isToken[tokenAddress] = true;
        allTokens.push(tokenAddress);
        
        emit TokenCreated(tokenAddress, msg.sender, name, symbol, metadataURI);
        
        return tokenAddress;
    }
    
    /**
     * @dev Buy tokens using ETH with World ID verification
     * @param tokenAddress Address of the token to buy
     * @param root The World ID root to verify against
     * @param nullifierHash The nullifier hash for this proof
     * @param proof The zero-knowledge proof
     */
    function buyTokens(
        address tokenAddress,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external payable nonReentrant {
        require(isToken[tokenAddress], "Token does not exist");
        require(msg.value > 0, "Must send ETH");
        
        // Verify World ID proof
        _verifyWorldIDProof(msg.sender, root, nullifierHash, proof);
        
        TokenInfo storage tokenInfo = tokens[tokenAddress];
        
        uint256 ethAmount = msg.value;
        uint256 feeAmount = ethAmount.mul(FEE_RATE).div(10000);
        uint256 ethAfterFee = ethAmount.sub(feeAmount);
        
        // Calculate token amount using bonding curve
        uint256 tokenAmount = calculateTokenAmount(
            tokenInfo.virtualEthReserves,
            tokenInfo.virtualTokenReserves,
            ethAfterFee
        );
        
        // Check daily mint limit
        _checkDailyMintLimit(msg.sender, tokenAmount);
        
        // Update virtual reserves
        tokenInfo.virtualEthReserves = tokenInfo.virtualEthReserves.add(ethAfterFee);
        tokenInfo.virtualTokenReserves = tokenInfo.virtualTokenReserves.sub(tokenAmount);
        tokenInfo.totalSupply = tokenInfo.totalSupply.add(tokenAmount);
        
        // Mint tokens to buyer
        LaunchpadToken(tokenAddress).mint(msg.sender, tokenAmount);
        
        // Update daily mint tracking
        _updateDailyMintTracking(msg.sender, tokenAmount);
        
        // Distribute fees
        uint256 creatorFee = feeAmount.mul(CREATOR_FEE_RATE).div(10000);
        uint256 platformFee = feeAmount.sub(creatorFee);
        
        tokenInfo.creatorFees = tokenInfo.creatorFees.add(creatorFee);
        platformFees = platformFees.add(platformFee);
        
        emit TokensBought(
            tokenAddress,
            msg.sender,
            ethAmount,
            tokenAmount,
            tokenInfo.virtualEthReserves,
            tokenInfo.virtualTokenReserves
        );
    }
    
    /**
     * @dev Sell tokens for ETH
     * @param tokenAddress Address of the token to sell
     * @param tokenAmount Amount of tokens to sell
     */
    function sellTokens(address tokenAddress, uint256 tokenAmount) external nonReentrant {
        require(isToken[tokenAddress], "Token does not exist");
        require(tokenAmount > 0, "Must sell tokens");
        
        TokenInfo storage tokenInfo = tokens[tokenAddress];
        
        // Check user balance
        require(
            LaunchpadToken(tokenAddress).balanceOf(msg.sender) >= tokenAmount,
            "Insufficient token balance"
        );
        
        // Calculate ETH amount using bonding curve
        uint256 ethAmount = calculateEthAmount(
            tokenInfo.virtualEthReserves,
            tokenInfo.virtualTokenReserves,
            tokenAmount
        );
        
        uint256 feeAmount = ethAmount.mul(FEE_RATE).div(10000);
        uint256 ethAfterFee = ethAmount.sub(feeAmount);
        
        // Update virtual reserves
        tokenInfo.virtualEthReserves = tokenInfo.virtualEthReserves.sub(ethAmount);
        tokenInfo.virtualTokenReserves = tokenInfo.virtualTokenReserves.add(tokenAmount);
        tokenInfo.totalSupply = tokenInfo.totalSupply.sub(tokenAmount);
        
        // Burn tokens from seller
        LaunchpadToken(tokenAddress).burn(msg.sender, tokenAmount);
        
        // Distribute fees
        uint256 creatorFee = feeAmount.mul(CREATOR_FEE_RATE).div(10000);
        uint256 platformFee = feeAmount.sub(creatorFee);
        
        tokenInfo.creatorFees = tokenInfo.creatorFees.add(creatorFee);
        platformFees = platformFees.add(platformFee);
        
        // Send ETH to seller
        (bool success, ) = msg.sender.call{value: ethAfterFee}("");
        require(success, "ETH transfer failed");
        
        emit TokensSold(
            tokenAddress,
            msg.sender,
            tokenAmount,
            ethAmount,
            tokenInfo.virtualEthReserves,
            tokenInfo.virtualTokenReserves
        );
    }
    
    /**
     * @dev Withdraw creator fees
     * @param tokenAddress Address of the token
     */
    function withdrawCreatorFees(address tokenAddress) external nonReentrant {
        require(isToken[tokenAddress], "Token does not exist");
        
        TokenInfo storage tokenInfo = tokens[tokenAddress];
        require(msg.sender == tokenInfo.creator, "Only creator can withdraw");
        require(tokenInfo.creatorFees > 0, "No fees to withdraw");
        
        uint256 amount = tokenInfo.creatorFees;
        tokenInfo.creatorFees = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");
        
        emit CreatorFeesWithdrawn(tokenAddress, msg.sender, amount);
    }
    
    /**
     * @dev Withdraw platform fees (owner only)
     */
    function withdrawPlatformFees() external onlyOwner nonReentrant {
        require(platformFees > 0, "No platform fees to withdraw");
        
        uint256 amount = platformFees;
        platformFees = 0;
        
        (bool success, ) = owner().call{value: amount}("");
        require(success, "ETH transfer failed");
    }
    
    /**
     * @dev Calculate token amount for given ETH using bonding curve
     */
    function calculateTokenAmount(
        uint256 virtualEthReserves,
        uint256 virtualTokenReserves,
        uint256 ethAmount
    ) public pure returns (uint256) {
        uint256 newVirtualEthReserves = virtualEthReserves.add(ethAmount);
        uint256 newVirtualTokenReserves = virtualEthReserves.mul(virtualTokenReserves).div(newVirtualEthReserves);
        return virtualTokenReserves.sub(newVirtualTokenReserves);
    }
    
    /**
     * @dev Calculate ETH amount for given tokens using bonding curve
     */
    function calculateEthAmount(
        uint256 virtualEthReserves,
        uint256 virtualTokenReserves,
        uint256 tokenAmount
    ) public pure returns (uint256) {
        uint256 newVirtualTokenReserves = virtualTokenReserves.add(tokenAmount);
        uint256 newVirtualEthReserves = virtualEthReserves.mul(virtualTokenReserves).div(newVirtualTokenReserves);
        return virtualEthReserves.sub(newVirtualEthReserves);
    }
    
    /**
     * @dev Get token price in ETH
     */
    function getTokenPrice(address tokenAddress) external view returns (uint256) {
        require(isToken[tokenAddress], "Token does not exist");
        
        TokenInfo memory tokenInfo = tokens[tokenAddress];
        return tokenInfo.virtualEthReserves.mul(1e18).div(tokenInfo.virtualTokenReserves);
    }
    
    /**
     * @dev Get all tokens
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
    
    /**
     * @dev Get token count
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }
    
    /**
     * @dev Get user's daily minted amount
     */
    function getDailyMintedAmount(address user) external view returns (uint256) {
        uint256 currentDay = block.timestamp / SECONDS_IN_DAY;
        if (lastMintDay[user] == currentDay) {
            return dailyMintedAmount[user];
        }
        return 0;
    }
    
    /**
     * @dev Get user's remaining daily mint limit
     */
    function getRemainingDailyLimit(address user) external view returns (uint256) {
        uint256 currentDay = block.timestamp / SECONDS_IN_DAY;
        if (lastMintDay[user] == currentDay) {
            if (dailyMintedAmount[user] >= DAILY_MINT_LIMIT) {
                return 0;
            }
            return DAILY_MINT_LIMIT.sub(dailyMintedAmount[user]);
        }
        return DAILY_MINT_LIMIT;
    }
    
    /**
     * @dev Internal function to verify World ID proof
     */
    function _verifyWorldIDProof(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) internal {
        // Check if nullifier has been used before
        if (nullifierHashes[nullifierHash]) revert InvalidNullifier();
        
        // Verify the World ID proof
        worldId.verifyProof(
            root,
            groupId,
            abi.encodePacked(signal).hashToField(),
            nullifierHash,
            externalNullifierHash,
            proof
        );
        
        // Mark nullifier as used
        nullifierHashes[nullifierHash] = true;
        
        emit WorldIDVerified(signal, nullifierHash);
    }
    
    /**
     * @dev Internal function to check daily mint limit
     */
    function _checkDailyMintLimit(address user, uint256 tokenAmount) internal {
        uint256 currentDay = block.timestamp / SECONDS_IN_DAY;
        uint256 userDailyMinted = 0;
        
        if (lastMintDay[user] == currentDay) {
            userDailyMinted = dailyMintedAmount[user];
        }
        
        // Only check limit if user has already minted something today
        if (userDailyMinted > 0 && userDailyMinted.add(tokenAmount) > DAILY_MINT_LIMIT) {
            emit DailyLimitExceeded(user, userDailyMinted.add(tokenAmount), DAILY_MINT_LIMIT);
            revert("Daily limit exceeded");
        }
    }
    
    /**
     * @dev Internal function to update daily mint tracking
     */
    function _updateDailyMintTracking(address user, uint256 tokenAmount) internal {
        uint256 currentDay = block.timestamp / SECONDS_IN_DAY;
        
        if (lastMintDay[user] == currentDay) {
            dailyMintedAmount[user] = dailyMintedAmount[user].add(tokenAmount);
        } else {
            dailyMintedAmount[user] = tokenAmount;
            lastMintDay[user] = currentDay;
        }
    }
    
    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}

/**
 * @title LaunchpadToken
 * @dev ERC20 token for the launchpad
 */
contract LaunchpadToken is ERC20, Ownable {
    address public immutable launchpad;
    
    constructor(
        string memory name,
        string memory symbol,
        address creator
    ) ERC20(name, symbol) Ownable() {
        launchpad = msg.sender;
        _transferOwnership(creator);
    }
    
    /**
     * @dev Mint tokens (only launchpad can call)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == launchpad, "Only launchpad can mint");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens (only launchpad can call)
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == launchpad, "Only launchpad can burn");
        _burn(from, amount);
    }
}
