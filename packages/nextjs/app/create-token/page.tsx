"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ArrowLeftIcon, PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
// Import the deployed contract
import deployedContracts from "~~/contracts/deployedContracts";

const LAUNCHPAD_ADDRESS = deployedContracts[84532].TokenLaunchpad.address;
const LAUNCHPAD_ABI = deployedContracts[84532].TokenLaunchpad.abi;

export default function CreateTokenPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [description, setDescription] = useState("");

  const { writeContract: createToken, data: createHash } = useWriteContract();

  const { isLoading: isCreateLoading } = useWaitForTransactionReceipt({
    hash: createHash,
  });

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

    try {
      setIsLoading(true);
      await createToken({
        address: LAUNCHPAD_ADDRESS,
        abi: LAUNCHPAD_ABI,
        functionName: "createToken",
        args: [tokenName.trim(), tokenSymbol.trim().toUpperCase(), metadataURI.trim()],
      });
      toast.success("Token creation initiated!");
    } catch (error) {
      console.error("Error creating token:", error);
      toast.error("Failed to create token");
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect to home page after successful creation
  if (createHash && !isCreateLoading) {
    router.push("/");
  }

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
                </ul>
              </div>
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
                  disabled={isLoading || isCreateLoading}
                >
                  {isLoading || isCreateLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      <span className="hidden sm:inline">Creating Token...</span>
                      <span className="sm:hidden">Creating...</span>
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
              curve pricing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
