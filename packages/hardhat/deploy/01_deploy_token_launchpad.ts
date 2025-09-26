import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployTokenLaunchpad: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy TokenLaunchpad
  const tokenLaunchpad = await deploy("TokenLaunchpad", {
    from: deployer,
    log: true,
  });

  console.log("TokenLaunchpad deployed to:", tokenLaunchpad.address);

  // Verify contract on Etherscan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: tokenLaunchpad.address,
        constructorArguments: [],
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

export default deployTokenLaunchpad;
deployTokenLaunchpad.tags = ["TokenLaunchpad"];
deployTokenLaunchpad.dependencies = [];
