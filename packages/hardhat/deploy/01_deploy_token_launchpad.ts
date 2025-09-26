import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployTokenLaunchpad: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // World ID configuration
  // These addresses are for Base Sepolia testnet - update for your target network
  const worldIdAddress = "0x515f06B36E6D3b707eAecBdeD18d8B384944c87f"; // Base Sepolia World ID Router
  const appId = "app_staging_1234567890abcdef"; // Replace with your World ID App ID
  const action = "mint_tokens"; // Replace with your action name

  // Deploy TokenLaunchpad
  const tokenLaunchpad = await deploy("TokenLaunchpad", {
    from: deployer,
    args: [worldIdAddress, appId, action],
    log: true,
  });

  console.log("TokenLaunchpad deployed to:", tokenLaunchpad.address);
  console.log("World ID Router:", worldIdAddress);
  console.log("App ID:", appId);
  console.log("Action:", action);

  // Verify contract on Etherscan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: tokenLaunchpad.address,
        constructorArguments: [worldIdAddress, appId, action],
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

export default deployTokenLaunchpad;
deployTokenLaunchpad.tags = ["TokenLaunchpad"];
deployTokenLaunchpad.dependencies = [];
