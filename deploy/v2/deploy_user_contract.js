const { ethers } = require("hardhat");
const core = require("@actions/core");

async function main() {
  const cspShare = await ethers.getContractFactory("CrossSpaceShareUserV2");

  const contract = await cspShare.deploy();

  core.info("Contract address:", contract.address);
  console.log("Contract address:", contract.address);
  console.log("Transaction hash:", contract.deployTransaction.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
