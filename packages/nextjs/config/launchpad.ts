import deployedContracts from "~~/contracts/deployedContracts";

// Centralized configuration for TokenLaunchpad contract
export const LAUNCHPAD_CONFIG = {
  address: deployedContracts[4801].TokenLaunchpad.address as `0x${string}`,
  abi: deployedContracts[4801].TokenLaunchpad.abi,
} as const;

// Export individual values for convenience
export const LAUNCHPAD_ADDRESS = LAUNCHPAD_CONFIG.address;
export const LAUNCHPAD_ABI = LAUNCHPAD_CONFIG.abi;
