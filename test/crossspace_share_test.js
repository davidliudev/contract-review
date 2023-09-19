const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossSpace share contract operations", function () {
  let constructor, contract;
  let owner, addr1, addr2;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    constructor = await ethers.getContractFactory("CrossSpaceShareV1");
    [owner, addr1, addr2] = await ethers.getSigners();
    contract = await constructor.deploy();
  });

  it("buy first share", async function () {
    let addr1Address = ethers.utils.getAddress(addr1.address);
    await expect(
      contract.connect(addr1).buyShares(addr1Address + ":123", 1)
    ).to.emit(contract, "Trade");
  });

  it("get price", async function () {
    await contract.connect(addr1).getPrice(0, 2);
  });
});
