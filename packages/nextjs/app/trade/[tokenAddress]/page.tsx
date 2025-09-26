"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ArrowLeftIcon, InformationCircleIcon, PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
// Import the deployed contract
import deployedContracts from "~~/contracts/deployedContracts";

const LAUNCHPAD_ADDRESS = deployedContracts[31337].TokenLaunchpad.address;
const LAUNCHPAD_ABI = deployedContracts[31337].TokenLaunchpad.abi;

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  price: string;
  totalSupply: string;
  marketCap: string;
  virtualEthReserves: string;
  virtualTokenReserves: string;
}

export default function TradePage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(true);

  const tokenAddress = params.tokenAddress as string;

  const { data: userBalance } = useBalance({
    address: address,
  });

  const { writeContract: buyTokens, data: buyHash } = useWriteContract();
  const { writeContract: sellTokens, data: sellHash } = useWriteContract();

  const { isLoading: isBuyLoading } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const { isLoading: isSellLoading } = useWaitForTransactionReceipt({
    hash: sellHash,
  });

  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!tokenAddress) {
        setIsLoadingToken(false);
        return;
      }

      try {
        setIsLoadingToken(true);
        const response = await fetch(`/api/token-info?address=${tokenAddress}`);
        const tokenInfo = await response.json();

        if (!tokenInfo.success) {
          console.error("Failed to fetch token info for:", tokenAddress);
          toast.error("Token not found");
          router.push("/");
          return;
        }

        const { name, symbol, virtualEthReserves, virtualTokenReserves, totalSupply } = tokenInfo.data;

        // Calculate price: virtualEthReserves / virtualTokenReserves
        const price =
          Number(formatEther(BigInt(virtualEthReserves))) / Number(formatEther(BigInt(virtualTokenReserves)));

        // Calculate market cap: price * totalSupply
        const marketCap = price * Number(formatEther(BigInt(totalSupply)));

        setTokenInfo({
          address: tokenAddress,
          name,
          symbol,
          price: price.toFixed(8),
          totalSupply: formatEther(BigInt(totalSupply)),
          marketCap: marketCap.toFixed(4),
          virtualEthReserves: formatEther(BigInt(virtualEthReserves)),
          virtualTokenReserves: formatEther(BigInt(virtualTokenReserves)),
        });
      } catch (error) {
        console.error("Error fetching token details:", error);
        toast.error("Failed to load token information");
        router.push("/");
      } finally {
        setIsLoadingToken(false);
      }
    };

    fetchTokenDetails();
  }, [tokenAddress, router]);

  const handleBuyTokens = async () => {
    if (!ethAmount) {
      toast.error("Please enter ETH amount");
      return;
    }

    try {
      setIsLoading(true);
      await buyTokens({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "buyTokens",
        args: [tokenAddress],
        value: parseEther(ethAmount),
      });
      toast.success("Token purchase initiated!");
      setEthAmount("");
    } catch (error) {
      console.error("Error buying tokens:", error);
      toast.error("Failed to buy tokens");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellTokens = async () => {
    if (!tokenAmount) {
      toast.error("Please enter token amount");
      return;
    }

    try {
      setIsLoading(true);
      await sellTokens({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "sellTokens",
        args: [tokenAddress, parseEther(tokenAmount)],
      });
      toast.success("Token sale initiated!");
      setTokenAmount("");
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
          <p className="text-base-content/70">Please connect your wallet to trade tokens</p>
        </div>
      </div>
    );
  }

  if (isLoadingToken) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading token information...</p>
        </div>
      </div>
    );
  }

  if (!tokenInfo) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <RocketLaunchIcon className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-4">Token Not Found</h1>
          <p className="text-base-content/70 mb-4">The requested token could not be found</p>
          <Link href="/" className="btn btn-primary">
            Back to Home
          </Link>
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
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link href="/" className="btn btn-ghost btn-sm">
                <ArrowLeftIcon className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Link>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-primary">
                  Trade {tokenInfo.name} ({tokenInfo.symbol})
                </h1>
                <p className="text-xs sm:text-sm text-base-content/70">Bonding curve pricing</p>
              </div>
            </div>
            <Link href="/create-token" className="btn btn-primary btn-sm sm:btn-md w-full sm:w-auto">
              <PlusIcon className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Create Token</span>
              <span className="xs:hidden">Create</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Token Info Card */}
        <div className="bg-base-200 rounded-lg p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-base-content/70">Current Price</p>
              <p className="text-lg sm:text-xl font-bold text-primary">{tokenInfo.price} ETH</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-base-content/70">Market Cap</p>
              <p className="text-lg sm:text-xl font-bold">{tokenInfo.marketCap} ETH</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-base-content/70">Total Supply</p>
              <p className="text-lg sm:text-xl font-bold">{parseFloat(tokenInfo.totalSupply).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-base-content/70">Your Balance</p>
              <p className="text-lg sm:text-xl font-bold">{userBalance ? formatEther(userBalance.value) : "0"} ETH</p>
            </div>
          </div>
        </div>

        {/* Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buy Tokens */}
          <div className="bg-base-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-success">Buy {tokenInfo.symbol}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text text-sm sm:text-base">ETH Amount</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full text-sm sm:text-base"
                  placeholder="0.1"
                  value={ethAmount}
                  onChange={e => setEthAmount(e.target.value)}
                  step="0.001"
                  min="0"
                />
              </div>
              {ethAmount && parseFloat(ethAmount) > 0 && (
                <div className="bg-success/10 rounded-lg p-3">
                  <p className="text-sm text-success">
                    You will receive approximately{" "}
                    <span className="font-bold">
                      {(
                        (parseFloat(ethAmount) * 0.99 * parseFloat(tokenInfo.virtualTokenReserves)) /
                        (parseFloat(tokenInfo.virtualEthReserves) + parseFloat(ethAmount) * 0.99)
                      ).toFixed(2)}{" "}
                      {tokenInfo.symbol}
                    </span>
                  </p>
                </div>
              )}
              <button
                className="btn btn-success w-full btn-sm sm:btn-md"
                onClick={handleBuyTokens}
                disabled={isLoading || isBuyLoading || !ethAmount || parseFloat(ethAmount) <= 0}
              >
                {isLoading || isBuyLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  `Buy ${tokenInfo.symbol}`
                )}
              </button>
            </div>
          </div>

          {/* Sell Tokens */}
          <div className="bg-base-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-error">Sell {tokenInfo.symbol}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text text-sm sm:text-base">Token Amount</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full text-sm sm:text-base"
                  placeholder="1000"
                  value={tokenAmount}
                  onChange={e => setTokenAmount(e.target.value)}
                  step="1"
                  min="0"
                />
              </div>
              {tokenAmount && parseFloat(tokenAmount) > 0 && (
                <div className="bg-error/10 rounded-lg p-3">
                  <p className="text-sm text-error">
                    You will receive approximately{" "}
                    <span className="font-bold">
                      {(
                        ((parseFloat(tokenAmount) * parseFloat(tokenInfo.virtualEthReserves)) /
                          (parseFloat(tokenInfo.virtualTokenReserves) + parseFloat(tokenAmount))) *
                        0.99
                      ).toFixed(6)}{" "}
                      ETH
                    </span>
                  </p>
                </div>
              )}
              <button
                className="btn btn-error w-full btn-sm sm:btn-md"
                onClick={handleSellTokens}
                disabled={isLoading || isSellLoading || !tokenAmount || parseFloat(tokenAmount) <= 0}
              >
                {isLoading || isSellLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  `Sell ${tokenInfo.symbol}`
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-info/10 rounded-lg p-4 sm:p-6 mt-6">
          <div className="flex items-start">
            <InformationCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-info mr-2 sm:mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-info mb-2 text-sm sm:text-base">Trading Information</h3>
              <ul className="text-xs sm:text-sm space-y-1 text-base-content/70">
                <li>• Price updates automatically based on supply and demand</li>
                <li>• 1% trading fee is applied to all transactions</li>
                <li>• Early buyers get better prices as supply increases</li>
                <li>• Token creator earns 1% of all trading fees</li>
                <li>• All calculations are estimates and may vary slightly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
