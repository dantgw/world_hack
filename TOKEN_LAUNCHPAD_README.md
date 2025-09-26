# Token Launchpad - Pump.fun Style

A decentralized token launchpad built on Ethereum that allows users to create and trade tokens using a bonding curve mechanism, similar to pump.fun.

## Features

### 🚀 Token Creation
- Create new ERC20 tokens with custom names, symbols, and metadata
- No upfront costs or complex deployment process
- Automatic bonding curve pricing

### 📈 Bonding Curve Trading
- Buy tokens with ETH at increasing prices
- Sell tokens back to the curve for ETH
- Early buyers get better prices as supply increases
- Automatic price discovery through the bonding curve

### 🎯 Pure Bonding Curve
- Simple bonding curve mechanism without external dependencies
- Continuous price discovery through buy/sell pressure
- No complex migration or external integrations

### 💰 Fee Structure
- 1% fee on all trades
- 0.5% goes to token creators
- 0.5% goes to the platform
- Creators can withdraw their accumulated fees

## Smart Contracts

### TokenLaunchpad.sol
Main contract that handles:
- Token creation and management
- Bonding curve pricing calculations
- Buy/sell operations
- Fee distribution

### LaunchpadToken.sol
ERC20 token contract for tokens created through the launchpad:
- Standard ERC20 functionality
- Mintable/burnable by the launchpad contract
- Creator ownership

## Bonding Curve Mechanism

The bonding curve uses a constant product formula:
- Virtual ETH reserves: 200,000 ETH
- Virtual token reserves: 1,000,000,000 tokens
- Price increases as more tokens are bought
- Price decreases as tokens are sold
- No external dependencies or migrations

### Price Calculation
```
New Token Reserves = (Virtual ETH Reserves * Virtual Token Reserves) / (Virtual ETH Reserves + ETH Amount)
Token Amount = Virtual Token Reserves - New Token Reserves
```

## Frontend Interface

### Token Creation
- Simple form to create new tokens
- Name, symbol, and metadata URI inputs
- One-click token deployment

### Trading Interface
- Buy tokens with ETH
- Sell tokens for ETH
- Real-time price updates
- Token selection and amount inputs

### Token List
- View all created tokens
- See current prices and market caps
- Monitor bonding curve status

## Getting Started

### Prerequisites
- Node.js 16+ 
- Yarn
- Hardhat
- MetaMask or compatible wallet

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd world_hack
```

2. Install dependencies:
```bash
yarn install
```

3. Start local blockchain:
```bash
cd packages/hardhat
yarn chain
```

4. Deploy contracts:
```bash
yarn deploy
```

5. Start frontend:
```bash
cd packages/nextjs
yarn dev
```

### Usage

1. **Create a Token**:
   - Navigate to the launchpad
   - Fill in token name, symbol, and metadata
   - Click "Create Token"

2. **Buy Tokens**:
   - Select a token from the list
   - Enter ETH amount to spend
   - Click "Buy Tokens"

3. **Sell Tokens**:
   - Select a token you own
   - Enter token amount to sell
   - Click "Sell Tokens"

4. **Withdraw Creator Fees**:
   - If you created a token, you can withdraw accumulated fees
   - Click "Withdraw Creator Fees"

## Testing

Run the test suite:
```bash
cd packages/hardhat
yarn test
```

Tests cover:
- Token creation
- Buy/sell operations
- Fee distribution
- Migration logic
- Edge cases and security

## Security Considerations

- All contracts use OpenZeppelin's battle-tested implementations
- Reentrancy protection on all external functions
- Proper access controls for sensitive operations
- Comprehensive test coverage

## Deployment

### Local Development
- Simple deployment with no external dependencies
- Deploy with: `yarn deploy`

### Mainnet/Testnet
- Deploy with: `yarn deploy --network <network>`
- Verify contracts: `yarn hardhat-verify`

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Frontend      │    │  TokenLaunchpad  │
│   (Next.js)     │◄──►│   Contract       │
└─────────────────┘    └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ LaunchpadToken   │
                       │   Contracts      │
                       └──────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or support, please open an issue on GitHub.

---

**Disclaimer**: This is a demonstration project. Use at your own risk. Always audit smart contracts before using them with real funds.
