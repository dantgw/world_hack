//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TokenLaunchpad is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Constants
    uint256 public constant VIRTUAL_ETH_RESERVES = 200_000 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVES = 1_000_000_000 ether;
    uint256 public constant FEE_RATE = 100; // 1% (100/10000)
    uint256 public constant CREATOR_FEE_RATE = 100; // 1% (100/10000)
    uint256 public constant PLATFORM_FEE_RATE = 100; // 1% (100/10000)
    
    // State variables
    mapping(address => TokenInfo) public tokens;
    mapping(address => mapping(address => uint256)) public userBalances;
    mapping(address => bool) public isToken;
    address[] public allTokens;
    
    // Platform fees
    uint256 public platformFees;
    
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
    
    constructor() Ownable() {}
    
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
     * @dev Buy tokens using ETH
     * @param tokenAddress Address of the token to buy
     */
    function buyTokens(address tokenAddress) external payable nonReentrant {
        require(isToken[tokenAddress], "Token does not exist");
        require(msg.value > 0, "Must send ETH");
        
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
        
        // Update virtual reserves
        tokenInfo.virtualEthReserves = tokenInfo.virtualEthReserves.add(ethAfterFee);
        tokenInfo.virtualTokenReserves = tokenInfo.virtualTokenReserves.sub(tokenAmount);
        tokenInfo.totalSupply = tokenInfo.totalSupply.add(tokenAmount);
        
        // Mint tokens to buyer
        LaunchpadToken(tokenAddress).mint(msg.sender, tokenAmount);
        
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
