import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployTokenLaunchpad: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // World ID configuration
  // These addresses are for Base Sepolia testnet - update for your target network
  // const worldIdAddress = "0x42FF98C4E85212a5D31358ACbFe76a621b50fC02"; // Base Sepolia World ID Router
  const worldIdAddress = "0x57f928158C3EE7CDad1e4D8642503c4D0201f611"; // World Sepolia World ID Router
  // const action = "mint_tokens"; // Replace with your action name
  const appId = "app_staging_63bdbf24a4508f0f971c7311107ffa1c";
  const action = "buy-token"; // Action for buying tokens
  const tokenCreationAction = "create-token"; // Action for creating tokens

  // Deploy TokenLaunchpad
  const tokenLaunchpad = await deploy("TokenLaunchpad", {
    from: deployer,
    args: [worldIdAddress, appId, action, tokenCreationAction],
    log: true,
  });

  console.log("TokenLaunchpad deployed to:", tokenLaunchpad.address);
  console.log("World ID Router:", worldIdAddress);
  console.log("App ID:", appId);
  console.log("Buy Action:", action);
  console.log("Create Action:", tokenCreationAction);

  // Verify contract on Etherscan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: tokenLaunchpad.address,
        constructorArguments: [worldIdAddress, appId, action, tokenCreationAction],
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

export default deployTokenLaunchpad;
deployTokenLaunchpad.tags = ["TokenLaunchpad"];
deployTokenLaunchpad.dependencies = [];
