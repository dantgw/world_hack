"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { CurrencyDollarIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
// Import the deployed contract
import deployedContracts from "~~/contracts/deployedContracts";

const LAUNCHPAD_ADDRESS = deployedContracts[84532].TokenLaunchpad.address;
const LAUNCHPAD_ABI = deployedContracts[84532].TokenLaunchpad.abi;

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
    <div className="bg-base-200 rounded-lg p-3 sm:p-4 hover:bg-base-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-base sm:text-lg truncate">{name}</h3>
          <p className="text-xs sm:text-sm text-base-content/70">{symbol}</p>
        </div>
        <div className="text-right ml-2">
          <p className="text-xs sm:text-sm font-mono text-primary">{price.toFixed(8)} ETH</p>
        </div>
      </div>

      <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
        <div className="flex justify-between">
          <span className="text-base-content/70">Market Cap:</span>
          <span className="font-mono text-right">{marketCap.toFixed(4)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-content/70">Total Supply:</span>
          <span className="font-mono text-right">{parseInt(formatEther(totalSupply)).toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-base-300">
        <Link href={`/trade/${tokenAddress}`} className="btn btn-xs sm:btn-sm btn-outline w-full">
          Trade
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
      <div className="bg-base-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary">Token Launchpad</h1>
              <p className="text-xs sm:text-sm text-base-content/70">
                Discover and trade tokens • 1 token per day per user
              </p>
            </div>
            <Link href="/create-token" className="btn btn-primary btn-sm sm:btn-md w-full sm:w-auto">
              <PlusIcon className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Create Token</span>
              <span className="xs:hidden">Create</span>
            </Link>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-base-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-base-content/70">Connected Address:</span>
            <Address address={connectedAddress} />
          </div>
        </div>
      </div>

      {/* Tokens Grid */}
      <div className="container mx-auto px-4 pb-8">
        {/* Daily Limit Info */}
        <div className="bg-info/10 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <CurrencyDollarIcon className="h-5 w-5 text-info mr-2 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-info mb-2 text-sm sm:text-base">Daily Creation Limits</h3>
              <ul className="text-xs sm:text-sm space-y-1 text-base-content/70">
                <li>• Each user can create a maximum of 1 token per day</li>
                <li>• World ID verification required for token creation</li>
                <li>• 24-hour cooldown between token creations</li>
                <li>• This ensures fair distribution and prevents spam</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold mb-2">All Tokens</h2>
          <p className="text-sm sm:text-base text-base-content/70">Browse all available tokens and their market caps</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : !allTokensAddresses || allTokensAddresses.length === 0 ? (
          <div className="text-center py-12">
            <CurrencyDollarIcon className="h-16 w-16 mx-auto text-base-content/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tokens found</h3>
            <p className="text-base-content/70 mb-4">Be the first to create a token!</p>
            <Link href="/create-token" className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create First Token
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {allTokensAddresses.map((tokenAddress: string) => (
              <TokenCard key={tokenAddress} tokenAddress={tokenAddress} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
