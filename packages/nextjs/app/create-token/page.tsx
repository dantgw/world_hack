"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IDKitWidget, ISuccessResult, VerificationLevel } from "@worldcoin/idkit";
import { toast } from "react-hot-toast";
import { decodeAbiParameters, formatEther } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ArrowLeftIcon, InformationCircleIcon, PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
// Import the centralized launchpad configuration
import { LAUNCHPAD_ABI, LAUNCHPAD_ADDRESS } from "~~/config/launchpad";
// Import World ID configuration
import { WORLD_ID_APP_ID, WORLD_ID_CREATE_TOKEN_ACTION } from "~~/config/worldId";
import { getParsedError } from "~~/utils/scaffold-eth/getParsedError";

export default function CreateTokenPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [description, setDescription] = useState("");

  // World ID states
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
  const [isWorldIdVerified, setIsWorldIdVerified] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<{ canCreateNow: boolean; nextCreationTime: number } | null>(null);

  const { writeContract: createToken, data: createHash, error: createError } = useWriteContract();

  const { isLoading: isCreateLoading, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  // World ID success handler
  const onWorldIdSuccess = (result: ISuccessResult) => {
    console.log("World ID verification successful:", result);
    setWorldIdProof(result);
    setIsWorldIdVerified(true);
    toast.success("World ID verification successful!");

    // Check cooldown after successful verification
    checkCooldown(result.nullifier_hash);
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

  // Check token creation cooldown
  const checkCooldown = async (nullifierHash: string) => {
    try {
      const result = await fetch("/api/token-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          functionName: "getTokenCreationCooldown",
          args: [nullifierHash],
        }),
      });

      if (result.ok) {
        const data = await result.json();
        setCooldownInfo(data);
      }
    } catch (error) {
      console.error("Error checking cooldown:", error);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (tokenSymbol.length > 10) {
      toast.error("Token symbol must be 10 characters or less");
      return;
    }

    if (!isWorldIdVerified || !worldIdProof) {
      toast.error("Please verify with World ID first");
      return;
    }

    if (cooldownInfo && !cooldownInfo.canCreateNow) {
      toast.error("You can only create 1 token per day. Please wait before creating another token.");
      return;
    }

    try {
      setIsLoading(true);
      await createToken({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "createToken",
        args: [
          tokenName.trim(),
          tokenSymbol.trim().toUpperCase(),
          metadataURI.trim(),
          BigInt(worldIdProof.merkle_root),
          BigInt(worldIdProof.nullifier_hash),
          decodeProof(worldIdProof.proof),
        ],
      });
      toast.success("Token creation initiated!");
    } catch (error) {
      console.error("Error creating token:", error);
      const errorMessage = getParsedError(error);
      toast.error(`Failed to create token: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect to home page after successful creation
  if (createHash && !isCreateLoading) {
    router.push("/");
  }

  // Handle transaction errors
  useEffect(() => {
    if (createError) {
      console.error("Create transaction error:", createError);
      const errorMessage = getParsedError(createError);
      toast.error(`Transaction failed: ${errorMessage}`);
    }
  }, [createError]);

  // Reset World ID verification after successful creation
  useEffect(() => {
    if (isCreateSuccess) {
      console.log("Resetting World ID after successful token creation");
      setWorldIdProof(null);
      setIsWorldIdVerified(false);
      setCooldownInfo(null);
      toast.success("Token created successfully! Please verify with World ID again for next creation.");
    }
  }, [isCreateSuccess]);

  // Format time remaining for cooldown
  const formatTimeRemaining = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = timestamp - now;

    if (remaining <= 0) return "Now";

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <RocketLaunchIcon className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-base-content/70">Please connect your wallet to create a token</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="bg-base-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link href="/" className="btn btn-ghost btn-sm">
              <ArrowLeftIcon className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-primary">Create New Token</h1>
              <p className="text-xs sm:text-sm text-base-content/70">Launch your token with bonding curve pricing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          {/* Info Card */}
          <div className="bg-info/10 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex items-start">
              <RocketLaunchIcon className="h-5 w-5 sm:h-6 sm:w-6 text-info mr-2 sm:mr-3 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-info mb-2 text-sm sm:text-base">How Token Creation Works</h3>
                <ul className="text-xs sm:text-sm space-y-1 text-base-content/70">
                  <li>• Your token uses bonding curve pricing for automatic price discovery</li>
                  <li>• Early buyers get better prices as supply increases</li>
                  <li>• You earn 1% fees from all trades</li>
                  <li>• No complex setup or external dependencies required</li>
                  <li>• Tokens are immediately tradeable after creation</li>
                  <li>
                    • <strong>Daily Limit:</strong> Each user can create maximum 1 token per day
                  </li>
                  <li>• World ID verification required to prevent spam and ensure fair distribution</li>
                </ul>
              </div>
            </div>
          </div>

          {/* World ID Verification */}
          <div className="bg-base-200 rounded-lg p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">World ID Verification</h2>

            <div className="mb-4 p-3 rounded-lg bg-info/10 border border-info/20">
              <div className="flex items-center gap-2 mb-2">
                <InformationCircleIcon className="h-5 w-5 text-info" />
                <span className="text-sm font-medium text-info">Daily Token Creation Limit</span>
              </div>
              <p className="text-xs text-base-content/70 mb-3">
                Each user can create a maximum of 1 token per day. World ID verification is required to prevent spam and
                ensure fair distribution.
              </p>

              {cooldownInfo && !cooldownInfo.canCreateNow && (
                <div className="bg-warning/10 rounded-lg p-3 mb-3">
                  <p className="text-sm text-warning">
                    <strong>Cooldown Active:</strong> You can create your next token in{" "}
                    <span className="font-bold">{formatTimeRemaining(cooldownInfo.nextCreationTime)}</span>
                  </p>
                </div>
              )}

              {!isWorldIdVerified ? (
                <IDKitWidget
                  app_id={WORLD_ID_APP_ID}
                  action={WORLD_ID_CREATE_TOKEN_ACTION}
                  signal={address}
                  onSuccess={onWorldIdSuccess}
                  verification_level={VerificationLevel.Orb}
                >
                  {({ open }) => (
                    <button
                      onClick={open}
                      className="btn btn-info btn-sm w-full"
                      disabled={cooldownInfo ? !cooldownInfo.canCreateNow : false}
                    >
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
                      setCooldownInfo(null);
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
          </div>

          {/* Creation Form */}
          <div className="bg-base-200 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Token Details</h2>

            <form onSubmit={handleCreateToken} className="space-y-4 sm:space-y-6">
              {/* Token Name */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Token Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full text-sm sm:text-base"
                  placeholder="My Awesome Token"
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  maxLength={50}
                  required
                />
                <div className="label">
                  <span className="label-text-alt text-base-content/50">{tokenName.length}/50 characters</span>
                </div>
              </div>

              {/* Token Symbol */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Token Symbol *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full text-sm sm:text-base"
                  placeholder="MAT"
                  value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value.toUpperCase())}
                  maxLength={10}
                  required
                />
                <div className="label">
                  <span className="label-text-alt text-base-content/50">
                    {tokenSymbol.length}/10 characters (will be converted to uppercase)
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full h-20 sm:h-24 text-sm sm:text-base"
                  placeholder="Describe your token, its purpose, and what makes it unique..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={500}
                />
                <div className="label">
                  <span className="label-text-alt text-base-content/50">{description.length}/500 characters</span>
                </div>
              </div>

              {/* Metadata URI */}
              <div>
                <label className="label">
                  <span className="label-text font-medium">Metadata URI (Optional)</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered w-full text-sm sm:text-base"
                  placeholder="https://example.com/metadata.json"
                  value={metadataURI}
                  onChange={e => setMetadataURI(e.target.value)}
                />
                <div className="label">
                  <span className="label-text-alt text-base-content/50">
                    Link to JSON metadata with token image, description, etc.
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 sm:pt-4">
                <button
                  type="submit"
                  className="btn btn-primary w-full btn-sm sm:btn-md"
                  disabled={
                    isLoading ||
                    isCreateLoading ||
                    !isWorldIdVerified ||
                    (cooldownInfo ? !cooldownInfo.canCreateNow : false)
                  }
                >
                  {isLoading || isCreateLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      <span className="hidden sm:inline">Creating Token...</span>
                      <span className="sm:hidden">Creating...</span>
                    </>
                  ) : !isWorldIdVerified ? (
                    <>
                      <InformationCircleIcon className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Verify World ID First</span>
                      <span className="sm:hidden">Verify First</span>
                    </>
                  ) : cooldownInfo && !cooldownInfo.canCreateNow ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      <span className="hidden sm:inline">Daily Limit Reached</span>
                      <span className="sm:hidden">Limit Reached</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Create Token</span>
                      <span className="sm:hidden">Create</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Terms */}
          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-xs text-base-content/50 px-4">
              By creating a token, you agree to the platform terms and understand that tokens are created with bonding
              curve pricing. Each user is limited to creating 1 token per day to ensure fair distribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
