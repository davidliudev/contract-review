const { ethers } = require("hardhat");
const core = require('@actions/core');

async function main() {
  const cspShare = await ethers.getContractFactory("CrossSpaceShareV1");

  const contract = await cspShare.deploy();

  core.info("Contract address:", contract.address);
  console.log("Contract address:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
