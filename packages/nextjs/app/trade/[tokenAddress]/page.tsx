"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IDKitWidget, ISuccessResult, VerificationLevel } from "@worldcoin/idkit";
import { toast } from "react-hot-toast";
import { decodeAbiParameters, formatEther, parseEther } from "viem";
import { useAccount, useBalance, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ArrowLeftIcon, InformationCircleIcon, PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
// Import the centralized launchpad configuration
import { LAUNCHPAD_ABI, LAUNCHPAD_ADDRESS } from "~~/config/launchpad";
// Import World ID configuration
import { WORLD_ID_APP_ID, WORLD_ID_BUY_TOKEN_ACTION } from "~~/config/worldId";
import { getParsedError } from "~~/utils/scaffold-eth/getParsedError";

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
  const [ethAmount, setEthAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [buyTokenAmount, setBuyTokenAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
  const [isWorldIdVerified, setIsWorldIdVerified] = useState(false);

  const tokenAddress = params.tokenAddress as string;

  // Read token data directly from contract
  const {
    data: tokenData,
    isLoading: isLoadingToken,
    error: tokenError,
  } = useReadContract({
    address: LAUNCHPAD_ADDRESS as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: "tokens",
    args: tokenAddress ? [tokenAddress as `0x${string}`] : undefined,
  });

  const { data: tokenPrice } = useReadContract({
    address: LAUNCHPAD_ADDRESS as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: "getTokenPrice",
    args: tokenAddress ? [tokenAddress as `0x${string}`] : undefined,
  });

  const { data: userBalance } = useBalance({
    address: address,
  });

  // Read user's token balance directly from contract
  const { data: userTokenBalanceRaw } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Read required ETH for exact token purchase
  const {
    data: requiredEthRaw,
    error: requiredEthError,
    isLoading: isCalculatingCost,
  } = useReadContract({
    address: LAUNCHPAD_ADDRESS as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: "getEthRequiredForTokens",
    args: buyTokenAmount ? [tokenAddress, parseEther(buyTokenAmount)] : undefined,
  });

  // World ID success handler
  const onWorldIdSuccess = (result: ISuccessResult) => {
    console.log("World ID verification successful:", result);
    setWorldIdProof(result);
    setIsWorldIdVerified(true);
    toast.success("World ID verification successful!");
  };

  // Helper function to decode proof string to uint256[8] array
  const decodeProof = (proofString: string) => {
    try {
      const unpackedProof = decodeAbiParameters([{ type: "uint256[8]" }], proofString as `0x${string}`)[0];
      return unpackedProof;
    } catch (error) {
      console.error("Error decoding proof:", error);
      throw new Error("Invalid proof format");
    }
  };

  // Debug logging
  useEffect(() => {
    if (buyTokenAmount && parseFloat(buyTokenAmount) > 0) {
      console.log("Debug - buyTokenAmount:", buyTokenAmount);
      console.log("Debug - requiredEthRaw:", requiredEthRaw);
      console.log("Debug - requiredEthError:", requiredEthError);
      console.log("Debug - isCalculatingCost:", isCalculatingCost);
    }
  }, [buyTokenAmount, requiredEthRaw, requiredEthError, isCalculatingCost]);

  const { writeContract: buyTokens, data: buyHash, error: buyError, isPending: isBuyPending } = useWriteContract();
  const {
    writeContract: buyTokensExact,
    data: buyExactHash,
    error: buyExactError,
    isPending: isBuyExactPending,
  } = useWriteContract();
  const { writeContract: sellTokens, data: sellHash, error: sellError, isPending: isSellPending } = useWriteContract();

  const {
    isLoading: isBuyLoading,
    isSuccess: isBuySuccess,
    error: buyReceiptError,
  } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const {
    isLoading: isBuyExactLoading,
    isSuccess: isBuyExactSuccess,
    error: buyExactReceiptError,
  } = useWaitForTransactionReceipt({
    hash: buyExactHash,
  });

  const { isLoading: isSellLoading, error: sellReceiptError } = useWaitForTransactionReceipt({
    hash: sellHash,
  });

  // Handle transaction errors
  useEffect(() => {
    if (buyError) {
      console.error("Buy transaction error:", buyError);
      const errorMessage = getParsedError(buyError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [buyError]);

  useEffect(() => {
    if (buyExactError) {
      console.error("Buy exact transaction error:", buyExactError);
      const errorMessage = getParsedError(buyExactError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [buyExactError]);

  useEffect(() => {
    if (sellError) {
      console.error("Sell transaction error:", sellError);
      const errorMessage = getParsedError(sellError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [sellError]);

  useEffect(() => {
    if (buyReceiptError) {
      console.error("Buy receipt error:", buyReceiptError);
      const errorMessage = getParsedError(buyReceiptError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [buyReceiptError]);

  useEffect(() => {
    if (buyExactReceiptError) {
      console.error("Buy exact receipt error:", buyExactReceiptError);
      const errorMessage = getParsedError(buyExactReceiptError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [buyExactReceiptError]);

  useEffect(() => {
    if (sellReceiptError) {
      console.error("Sell receipt error:", sellReceiptError);
      const errorMessage = getParsedError(sellReceiptError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [sellReceiptError]);

  // Show success message after successful transactions (without resetting WorldID)
  useEffect(() => {
    console.log("Debug - isBuySuccess:", isBuySuccess, "buyHash:", buyHash);
    if (isBuySuccess) {
      console.log("Buy transaction successful");
      toast.success("Transaction successful!");
    }
  }, [isBuySuccess, buyHash]);

  useEffect(() => {
    console.log("Debug - isBuyExactSuccess:", isBuyExactSuccess, "buyExactHash:", buyExactHash);
    if (isBuyExactSuccess) {
      console.log("Buy exact transaction successful");
      toast.success("Transaction successful!");
    }
  }, [isBuyExactSuccess, buyExactHash]);

  // Compute token info from contract data
  const tokenInfo =
    tokenData && tokenPrice
      ? (() => {
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

          return {
            address: tokenAddress,
            name,
            symbol,
            price: price.toFixed(8),
            totalSupply: formatEther(totalSupply),
            marketCap: marketCap.toFixed(4),
            virtualEthReserves: formatEther(virtualEthReserves),
            virtualTokenReserves: formatEther(virtualTokenReserves),
          };
        })()
      : null;

  // Handle token not found error
  useEffect(() => {
    if (tokenError) {
      console.error("Failed to fetch token info for:", tokenAddress);
      toast.error("Token not found");
      router.push("/");
    }
  }, [tokenError, tokenAddress, router]);

  const handleBuyTokens = async () => {
    if (!ethAmount) {
      toast.error("Please enter ETH amount");
      return;
    }

    if (!isWorldIdVerified || !worldIdProof) {
      toast.error("Please verify with World ID first");
      return;
    }

    try {
      setIsLoading(true);
      buyTokens({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "buyTokens",
        args: [
          tokenAddress,
          BigInt(worldIdProof.merkle_root),
          BigInt(worldIdProof.nullifier_hash),
          decodeProof(worldIdProof.proof),
        ],
        value: parseEther(ethAmount),
      });
      toast.success("Token purchase initiated!");
      setEthAmount("");
    } catch (error) {
      console.error("Error buying tokens:", error);
      const errorMessage = getParsedError(error);
      toast.error(`Failed to buy tokens: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyTokensExact = async () => {
    if (!buyTokenAmount || !requiredEthRaw) {
      toast.error("Please enter token amount");
      return;
    }

    if (!isWorldIdVerified || !worldIdProof) {
      toast.error("Please verify with World ID first");
      return;
    }

    try {
      setIsLoading(true);

      buyTokensExact({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "buyTokensExact",
        args: [
          tokenAddress,
          parseEther(buyTokenAmount),
          BigInt(worldIdProof.merkle_root),
          BigInt(worldIdProof.nullifier_hash),
          decodeProof(worldIdProof.proof),
        ],
        value: requiredEthRaw,
      });
      toast.success("Exact token purchase initiated!");
      setBuyTokenAmount("");
    } catch (error) {
      console.error("Error buying exact tokens:", error);
      const errorMessage = getParsedError(error);
      toast.error(`Failed to buy tokens: ${errorMessage}`);
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
      sellTokens({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "sellTokens",
        args: [tokenAddress, parseEther(tokenAmount)],
      });
      toast.success("Token sale initiated!");
      setTokenAmount("");
    } catch (error) {
      console.error("Error selling tokens:", error);
      const errorMessage = getParsedError(error);
      toast.error(`Failed to sell tokens: ${errorMessage}`);
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
              <p className="text-xs sm:text-sm text-base-content/70">Your ETH Balance</p>
              <p className="text-lg sm:text-xl font-bold">{userBalance ? formatEther(userBalance.value) : "0"} ETH</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-base-content/70">Your {tokenInfo.symbol} Balance</p>
              <p className="text-lg sm:text-xl font-bold">
                {userTokenBalanceRaw ? formatEther(userTokenBalanceRaw) : "0"} {tokenInfo.symbol}
              </p>
            </div>
          </div>
        </div>

        {/* Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buy Tokens */}
          <div className="bg-base-200 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-success">Buy {tokenInfo.symbol}</h3>

            {/* World ID Verification */}
            <div className="mb-4 p-3 rounded-lg bg-info/10 border border-info/20">
              <div className="flex items-center gap-2 mb-2">
                <InformationCircleIcon className="h-5 w-5 text-info" />
                <span className="text-sm font-medium text-info">World ID Verification Required</span>
              </div>
              <p className="text-xs text-base-content/70 mb-3">
                World ID verification is required once per session to prevent duplicate transactions.
              </p>
              {!isWorldIdVerified ? (
                <IDKitWidget
                  app_id={WORLD_ID_APP_ID}
                  action={WORLD_ID_BUY_TOKEN_ACTION}
                  signal={address}
                  onSuccess={onWorldIdSuccess}
                  verification_level={VerificationLevel.Orb}
                >
                  {({ open }) => (
                    <button onClick={open} className="btn btn-info btn-sm w-full">
                      Verify with World ID
                    </button>
                  )}
                </IDKitWidget>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-success">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm">Verified with World ID</span>
                  </div>
                  <button
                    onClick={() => {
                      setWorldIdProof(null);
                      setIsWorldIdVerified(false);
                      toast.success("World ID verification reset");
                    }}
                    className="btn btn-xs btn-ghost"
                    title="Reset World ID verification"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Buy with ETH Amount */}
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
                disabled={
                  isLoading ||
                  isBuyLoading ||
                  isBuyPending ||
                  !ethAmount ||
                  parseFloat(ethAmount) <= 0 ||
                  !isWorldIdVerified
                }
              >
                {isLoading || isBuyLoading || isBuyPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  `Buy with ETH`
                )}
              </button>

              <div className="divider">OR</div>

              {/* Buy Exact Token Amount */}
              <div>
                <label className="label">
                  <span className="label-text text-sm sm:text-base">Token Amount</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full text-sm sm:text-base"
                  placeholder="1000"
                  value={buyTokenAmount}
                  onChange={e => setBuyTokenAmount(e.target.value)}
                  step="1"
                  min="0"
                />
              </div>
              {buyTokenAmount && parseFloat(buyTokenAmount) > 0 && (
                <div className="bg-success/10 rounded-lg p-3">
                  <p className="text-sm text-success">
                    {requiredEthError ? (
                      <>Error calculating cost: {requiredEthError.message}</>
                    ) : requiredEthRaw ? (
                      <>
                        Cost: <span className="font-bold">{formatEther(requiredEthRaw)} ETH</span>
                      </>
                    ) : isCalculatingCost ? (
                      <>Calculating cost...</>
                    ) : (
                      <>Enter token amount to see cost</>
                    )}
                  </p>
                </div>
              )}
              <button
                className="btn btn-success w-full btn-sm sm:btn-md"
                onClick={handleBuyTokensExact}
                disabled={
                  isLoading ||
                  isBuyExactLoading ||
                  isBuyExactPending ||
                  !buyTokenAmount ||
                  parseFloat(buyTokenAmount) <= 0 ||
                  !requiredEthRaw ||
                  !!requiredEthError ||
                  !isWorldIdVerified
                }
              >
                {isLoading || isBuyExactLoading || isBuyExactPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  `Buy Exact ${tokenInfo.symbol}`
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
                disabled={isLoading || isSellLoading || isSellPending || !tokenAmount || parseFloat(tokenAmount) <= 0}
              >
                {isLoading || isSellLoading || isSellPending ? (
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
                <li>• World ID verification required for each purchase (prevents duplicate transactions)</li>
                <li>• Daily limit: 100 tokens per person per day</li>
                <li>• Token creation limit: 1 token per person per day</li>
                <li>• All calculations are estimates and may vary slightly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
