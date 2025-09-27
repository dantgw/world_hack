"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { CurrencyDollarIcon, PlusIcon } from "@heroicons/react/24/outline";
// Import the centralized launchpad configuration
import { LAUNCHPAD_ABI, LAUNCHPAD_ADDRESS } from "~~/config/launchpad";

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  price: string;
  marketCap: string;
  totalSupply: string;
  virtualEthReserves: string;
  virtualTokenReserves: string;
}

// Component to fetch individual token data
const TokenCard = ({ tokenAddress }: { tokenAddress: string }) => {
  const { data: tokenData } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: LAUNCHPAD_ABI,
    functionName: "tokens",
    args: [tokenAddress as `0x${string}`],
  });

  const { data: tokenPrice } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: LAUNCHPAD_ABI,
    functionName: "getTokenPrice",
    args: [tokenAddress as `0x${string}`],
  });

  if (!tokenData || !tokenPrice) {
    return (
      <div className="bg-base-200 rounded-lg p-3 sm:p-4 animate-pulse">
        <div className="h-4 bg-base-300 rounded mb-2"></div>
        <div className="h-3 bg-base-300 rounded mb-3"></div>
        <div className="h-3 bg-base-300 rounded mb-2"></div>
        <div className="h-3 bg-base-300 rounded mb-3"></div>
        <div className="h-8 bg-base-300 rounded"></div>
      </div>
    );
  }

  const [
    creator,
    name,
    symbol,
    metadataURI,
    virtualEthReserves,
    virtualTokenReserves,
    totalSupply,
    creatorFees,
    createdAt,
  ] = tokenData as [string, string, string, string, bigint, bigint, bigint, bigint, bigint];

  // Calculate price from reserves
  const price = Number(formatEther(virtualEthReserves)) / Number(formatEther(virtualTokenReserves));

  // Calculate market cap: price * totalSupply
  const marketCap = price * Number(formatEther(totalSupply));

  return (
    <div className="bg-base-200 rounded-lg p-3 hover-lift card-gradient border-2 border-primary/20">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm sm:text-lg truncate text-gradient">{name}</h3>
          <p className="text-xs text-base-content/70 font-semibold">{symbol}</p>
        </div>
        <div className="text-right ml-2">
          <p className="text-xs font-mono text-accent font-bold">{price.toFixed(6)} ETH</p>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-base-content/70 font-medium">Market Cap:</span>
          <span className="font-mono text-right font-bold text-success">{marketCap.toFixed(2)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70 font-medium">Supply:</span>
          <span className="font-mono text-right font-bold text-info">
            {parseInt(formatEther(totalSupply)).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-primary/30">
        <Link href={`/trade/${tokenAddress}`} className="btn btn-xs btn-primary w-full hover:animate-wiggle">
          🚀 Trade
        </Link>
      </div>
    </div>
  );
};

const Home = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(true);

  const { data: allTokensAddresses } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    abi: LAUNCHPAD_ABI,
    functionName: "getAllTokens",
  });

  useEffect(() => {
    if (allTokensAddresses !== undefined) {
      setIsLoading(false);
    }
  }, [allTokensAddresses]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <CurrencyDollarIcon className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-base-content/70">Please connect your wallet to view tokens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 to-secondary/20 shadow-lg border-b-2 border-accent/30">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-4xl font-bold text-gradient animate-glow mb-2">🚀 Coins of Humanity</h1>
            <p className="text-sm sm:text-lg text-base-content/70 font-medium mb-6">
              💎 Create and trade meme tokens that bring people together • 🌍 Built on World Chain Sepolia
            </p>

            {/* Primary Action */}
            <Link href="/create-token" className="btn btn-primary btn-lg hover:animate-bounce-gentle shadow-lg">
              <PlusIcon className="h-5 w-5 mr-2" />
              🎯 Create Your Meme Token
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-3 py-8 sm:px-4 sm:py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : !allTokensAddresses || allTokensAddresses.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gradient-to-r from-accent/20 to-primary/20 rounded-2xl p-8 border-2 border-accent/30 max-w-lg mx-auto">
              <CurrencyDollarIcon className="h-20 w-20 mx-auto text-accent mb-6 animate-bounce-gentle" />
              <h3 className="text-2xl font-bold mb-3 text-gradient">🎉 Be the First Creator!</h3>
              <p className="text-base-content/70 mb-6 font-medium text-lg">
                🚀 Start the meme token revolution! Create tokens that bring communities together.
              </p>
              <div className="space-y-3">
                <Link href="/create-token" className="btn btn-primary btn-lg w-full hover:animate-wiggle shadow-lg">
                  <PlusIcon className="h-5 w-5 mr-2" />
                  🎯 Create First Token
                </Link>
                <p className="text-xs text-base-content/50">✨ Your token will be the foundation of this ecosystem!</p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Section Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gradient mb-3">💎 Discover Tokens</h2>
              <p className="text-base-content/70 font-medium mb-6">
                🎯 Explore meme tokens created by the community and find your next trade
              </p>
              <Link href="/create-token" className="btn btn-secondary hover:animate-bounce-gentle">
                <PlusIcon className="h-4 w-4 mr-2" />
                🚀 Create Your Own Token
              </Link>
            </div>

            {/* Tokens Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allTokensAddresses.map((tokenAddress: string) => (
                <TokenCard key={tokenAddress} tokenAddress={tokenAddress} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
