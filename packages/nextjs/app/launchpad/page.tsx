"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CurrencyDollarIcon, InformationCircleIcon, PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";

// Mock contract addresses - replace with actual deployed addresses
const LAUNCHPAD_ADDRESS = "0x0000000000000000000000000000000000000000";
const LAUNCHPAD_ABI = [
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "symbol", type: "string" },
      { internalType: "string", name: "metadataURI", type: "string" },
    ],
    name: "createToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "tokenAddress", type: "address" }],
    name: "buyTokens",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "tokenAddress", type: "address" },
      { internalType: "uint256", name: "tokenAmount", type: "uint256" },
    ],
    name: "sellTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllTokens",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "tokenAddress", type: "address" }],
    name: "getTokenPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  price: string;
  totalSupply: string;
  marketCap: string;
}

export default function LaunchpadPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"create" | "trade">("create");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Form states for token creation
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [metadataURI, setMetadataURI] = useState("");

  const { data: userBalance } = useBalance({
    address: address,
  });

  const { data: allTokensAddresses } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: LAUNCHPAD_ABI,
    functionName: "getAllTokens",
  });

  const { writeContract: createToken, data: createHash } = useWriteContract();
  const { writeContract: buyTokens, data: buyHash } = useWriteContract();
  const { writeContract: sellTokens, data: sellHash } = useWriteContract();

  const { isLoading: isCreateLoading } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  const { isLoading: isBuyLoading } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const { isLoading: isSellLoading } = useWaitForTransactionReceipt({
    hash: sellHash,
  });

  useEffect(() => {
    if (allTokensAddresses) {
      // In a real implementation, you would fetch token details for each address
      // For now, we'll use mock data
      const mockTokens: TokenInfo[] = allTokensAddresses.map((addr, index) => ({
        address: addr,
        name: `Token ${index + 1}`,
        symbol: `TK${index + 1}`,
        price: "0.000001",
        totalSupply: "1000000",
        marketCap: "1000",
      }));
      setTokens(mockTokens);
    }
  }, [allTokensAddresses]);

  const handleCreateToken = async () => {
    if (!tokenName || !tokenSymbol) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsLoading(true);
      await createToken({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "createToken",
        args: [tokenName, tokenSymbol, metadataURI],
      });
      toast.success("Token creation initiated!");
    } catch (error) {
      console.error("Error creating token:", error);
      toast.error("Failed to create token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyTokens = async () => {
    if (!selectedToken || !ethAmount) {
      toast.error("Please select a token and enter ETH amount");
      return;
    }

    try {
      setIsLoading(true);
      await buyTokens({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "buyTokens",
        args: [selectedToken],
        value: parseEther(ethAmount),
      });
      toast.success("Token purchase initiated!");
    } catch (error) {
      console.error("Error buying tokens:", error);
      toast.error("Failed to buy tokens");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellTokens = async () => {
    if (!selectedToken || !tokenAmount) {
      toast.error("Please select a token and enter token amount");
      return;
    }

    try {
      setIsLoading(true);
      await sellTokens({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "sellTokens",
        args: [selectedToken, parseEther(tokenAmount)],
      });
      toast.success("Token sale initiated!");
    } catch (error) {
      console.error("Error selling tokens:", error);
      toast.error("Failed to sell tokens");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <RocketLaunchIcon className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-base-content/70">Please connect your wallet to access the token launchpad</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Token Launchpad</h1>
          <p className="text-base-content/70">Create and trade tokens with bonding curve pricing</p>
        </div>

        {/* Balance Display */}
        <div className="bg-base-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-base-content/70">Your Balance:</span>
            <span className="font-mono">{userBalance ? formatEther(userBalance.value) : "0"} ETH</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tabs tabs-boxed mb-6">
          <button
            className={`tab ${activeTab === "create" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Token
          </button>
          <button className={`tab ${activeTab === "trade" ? "tab-active" : ""}`} onClick={() => setActiveTab("trade")}>
            <CurrencyDollarIcon className="h-4 w-4 mr-2" />
            Trade Tokens
          </button>
        </div>

        {/* Create Token Tab */}
        {activeTab === "create" && (
          <div className="bg-base-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Create New Token</h2>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Token Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="My Awesome Token"
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Token Symbol *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="MAT"
                  value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Metadata URI (Optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="https://example.com/metadata.json"
                  value={metadataURI}
                  onChange={e => setMetadataURI(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={handleCreateToken}
                disabled={isLoading || isCreateLoading}
              >
                {isLoading || isCreateLoading ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create Token
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Trade Tokens Tab */}
        {activeTab === "trade" && (
          <div className="space-y-6">
            {/* Token Selection */}
            <div className="bg-base-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Select Token</h2>
              <select
                className="select select-bordered w-full"
                value={selectedToken}
                onChange={e => setSelectedToken(e.target.value)}
              >
                <option value="">Choose a token...</option>
                {tokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.name} ({token.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Buy/Sell Interface */}
            {selectedToken && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Buy Tokens */}
                <div className="bg-base-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-success">Buy Tokens</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">
                        <span className="label-text">ETH Amount</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        placeholder="0.1"
                        value={ethAmount}
                        onChange={e => setEthAmount(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn btn-success w-full"
                      onClick={handleBuyTokens}
                      disabled={isLoading || isBuyLoading}
                    >
                      {isLoading || isBuyLoading ? <span className="loading loading-spinner"></span> : "Buy Tokens"}
                    </button>
                  </div>
                </div>

                {/* Sell Tokens */}
                <div className="bg-base-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4 text-error">Sell Tokens</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">
                        <span className="label-text">Token Amount</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        placeholder="1000"
                        value={tokenAmount}
                        onChange={e => setTokenAmount(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn btn-error w-full"
                      onClick={handleSellTokens}
                      disabled={isLoading || isSellLoading}
                    >
                      {isLoading || isSellLoading ? <span className="loading loading-spinner"></span> : "Sell Tokens"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Token List */}
            <div className="bg-base-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Available Tokens</h2>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Symbol</th>
                      <th>Price (ETH)</th>
                      <th>Market Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map(token => (
                      <tr key={token.address}>
                        <td>{token.name}</td>
                        <td>{token.symbol}</td>
                        <td>{token.price}</td>
                        <td>{token.marketCap} ETH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-info/10 rounded-lg p-6 mt-6">
          <div className="flex items-start">
            <InformationCircleIcon className="h-6 w-6 text-info mr-3 mt-1" />
            <div>
              <h3 className="font-bold text-info mb-2">How It Works</h3>
              <ul className="text-sm space-y-1 text-base-content/70">
                <li>• Create tokens with bonding curve pricing</li>
                <li>• Early buyers get better prices as supply increases</li>
                <li>• 1% fee goes to creators, 1% to platform</li>
                <li>• Simple buy/sell mechanism with automatic price discovery</li>
                <li>• No complex migration or external dependencies</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
