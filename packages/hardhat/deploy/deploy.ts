import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEEncryptedDrop = await deploy("FHEEncryptedDrop", {
    from: deployer,
    log: true,
  });

  console.log(`FHEEncryptedDrop contract: `, deployedFHEEncryptedDrop.address);
};
export default func;
func.id = "deploy_FHEEncryptedDrop"; // id required to prevent reexecution
func.tags = ["FHEEncryptedDrop"];
