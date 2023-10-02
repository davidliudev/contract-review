const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("CrossSpace additional test", function () {
  it("when enabled author cannot sell last share for content", async function () {
    // Get the ContractFactory and Signers here.
    const contentConstructor = await ethers.getContractFactory(
      "CrossSpaceShareContentV2"
    );
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    contract = await contentConstructor.deploy(32000, false);

    // set the protocol fee and subject fee
    await contract.connect(owner).setProtocolFeePercent(500);
    await contract.connect(owner).setSubjectFeePercent(500);

    // Set protocol wallet
    await contract.connect(owner).setFeeDestination(addr1.address);

    // buy shares from self
    // Set parent protocol address
    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await contract
      .connect(addr2)
      .buyShares(addr2.address, "subject1", addr2.address, 1, {
        value: (11 * 1e18) / 320000,
      });

    // sell
    await expect(
      contract
        .connect(addr2)
        .sellShares(addr2.address, "subject1", addr2.address, 1)
    ).to.be.revertedWith("Author cannot sell the last share");
  });

  it("when enabled author cannot sell last share for user", async function () {
    // Get the ContractFactory and Signers here.
    const contentConstructor = await ethers.getContractFactory(
      "CrossSpaceShareUserV2"
    );
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    contract = await contentConstructor.deploy(32000, false);

    // set the protocol fee and subject fee
    await contract.connect(owner).setProtocolFeePercent(500);
    await contract.connect(owner).setSubjectFeePercent(500);

    // Set protocol wallet
    await contract.connect(owner).setFeeDestination(addr1.address);

    // buy shares from self
    const firstSharePrice = BigNumber.from("10").pow(18).div(96000);
    const firstShareProtocolFee = firstSharePrice.mul(500).div(10000);
    const firstShareSubjectFee = firstSharePrice.mul(500).div(10000);
    const firstSharePayment = firstSharePrice
      .add(firstShareProtocolFee)
      .add(firstShareSubjectFee);

    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await contract
      .connect(addr2)
      .buyShares(addr2.address, addr2.address, BigNumber.from("10").pow(18), {
        value: firstSharePayment,
      });
    // sell

    // Sell the shares from addr2
    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await expect(
      contract
        .connect(addr2)
        .sellShares(addr2.address, addr2.address, BigNumber.from("10").pow(18))
    ).to.be.revertedWith("Author cannot sell the last share");
  });
});
