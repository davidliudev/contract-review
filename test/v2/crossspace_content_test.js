const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("CrossSpace content contract v2 operations", function () {
  let constructor, contract;
  let owner, addr1, addr2, addr3;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    constructor = await ethers.getContractFactory("CrossSpaceShareContentV2");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    contract = await constructor.deploy();
  });

  it("get price expect success", async function () {
    const testData = [
      // supply, amount ,price
      [0, 1, 1e18 / 32000],
      [1, 1, 4e18 / 32000],
    ];
    for (let i = 0; i < testData.length; i++) {
      const [supply, amount, expectedPrice] = testData[i];
      const price = await contract.connect(addr1).getPrice(supply, amount);
      // log the price
      expect(price).to.equal(expectedPrice);
    }
  });

  it("get price expect revert", async function () {
    await expect(contract.connect(addr1).getPrice(-1, -1)).to.be.reverted;
  });

  it("should buy/sell with success", async function () {
    // Record the initial balance of the owner, addr1, addr2, addr3
    const ownerInitialBalance = await ethers.provider.getBalance(owner.address);
    const addr1InitialBalance = await ethers.provider.getBalance(addr1.address);
    const addr2InitialBalance = await ethers.provider.getBalance(addr2.address);
    const addr3InitialBalance = await ethers.provider.getBalance(addr3.address);

    // set the protocol fee and subject fee
    await contract.connect(owner).setProtocolFeePercent(500);
    await contract.connect(owner).setSubjectFeePercent(500);

    // Set parent protocol address
    await contract.connect(owner).setParentProtocolAddress(owner.address);

    // Set protocol wallet
    await contract.connect(owner).setFeeDestination(addr1.address);

    // buy shares from self
    await contract
      .connect(owner)
      .buyShares(addr2.address, "subject1", addr2.address, 1, {
        value: (11 * 1e18) / 320000,
      });

    // buy shares from others
    await contract
      .connect(owner)
      .buyShares(addr2.address, "subject1", addr3.address, 1, {
        value: (11 * 4e18) / 320000,
      });

    // Validate the shares balances
    const shareBalanceFromAddr2 = await contract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr2.address);
    const shareBalanceFromAddr3 = await contract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr3.address);

    expect(shareBalanceFromAddr2).to.equal(1);
    expect(shareBalanceFromAddr3).to.equal(1);

    // Validate the share supply
    const shareSupply = await contract
      .connect(owner)
      .sharesSupply(addr2.address, "subject1");

    expect(shareSupply).to.equal(2);

    // Validate the values in the contract
    const lockedInValue = await ethers.provider.getBalance(contract.address);
    expect(lockedInValue).to.equal(1e18 / 32000 + 4e18 / 32000);

    // Validate the protocol fee collected
    const currentBalanceAddr1 = await ethers.provider.getBalance(addr1.address);
    const protocolFeeCollected = currentBalanceAddr1.sub(addr1InitialBalance);
    expect(protocolFeeCollected).to.equal(
      ((1e18 / 32000) * 500) / 10000 + ((4e18 / 32000) * 500) / 10000
    );

    // Validate te subject fee collected
    const currentBalanceAddr2 = await ethers.provider.getBalance(addr2.address);
    const subjectFeeCollected = currentBalanceAddr2.sub(addr2InitialBalance);
    expect(subjectFeeCollected).to.equal(
      ((1e18 / 32000) * 500) / 10000 + ((4e18 / 32000) * 500) / 10000
    );

    // Now sell the shares fro addr3
    await contract
      .connect(owner)
      .sellShares(addr2.address, "subject1", addr3.address, 1);

    // Sell the shares from addr2
    await contract
      .connect(owner)
      .sellShares(addr2.address, "subject1", addr2.address, 1);

    // Validate the shares balances
    const shareBalanceFromAddr2AfterSell = await contract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr2.address);
    const shareBalanceFromAddr3AfterSell = await contract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr3.address);

    expect(shareBalanceFromAddr2AfterSell).to.equal(0);
    expect(shareBalanceFromAddr3AfterSell).to.equal(0);

    // Validate the share supply
    const shareSupplyAfterSell = await contract
      .connect(owner)
      .sharesSupply(addr2.address, "subject1");

    expect(shareSupplyAfterSell).to.equal(0);

    // Validate the values in the contract
    const lockedInValueAfterSell = await ethers.provider.getBalance(
      contract.address
    );
    expect(lockedInValueAfterSell).to.equal(0);

    // Validate the protocol fee collected
    const currentBalanceAddr1AfterSell = await ethers.provider.getBalance(
      addr1.address
    );
    const protocolFeeCollectedAfterSell =
      currentBalanceAddr1AfterSell.sub(addr1InitialBalance);

    expect(protocolFeeCollectedAfterSell).to.equal(
      (((1e18 / 32000) * 500) / 10000 + ((4e18 / 32000) * 500) / 10000) * 2
    );

    // Validate add2 balance
    const currentBalanceAddr2AfterSell = await ethers.provider.getBalance(
      addr2.address
    );
    const newFeeAfterSell =
      currentBalanceAddr2AfterSell.sub(addr2InitialBalance);

    const subjectFeeExpected =
      (((1e18 / 32000) * 500) / 10000 + ((4e18 / 32000) * 500) / 10000) * 2;
    const sellGain = BigNumber.from(1e18 / 32000);
    const sellFee = BigNumber.from((sellGain * 1000) / 10000);

    const totalGain = sellGain.sub(sellFee).add(subjectFeeExpected);

    expect(newFeeAfterSell).to.equal(totalGain);

    // Validate addr3 balance
    const currentBalanceAddr3AfterSell = await ethers.provider.getBalance(
      addr3.address
    );
    const newBalanceAddr3AfterSell =
      currentBalanceAddr3AfterSell.sub(addr3InitialBalance);

    const addr3SellGain = BigNumber.from(4e18 / 32000);
    const addr3SellFee = BigNumber.from((addr3SellGain * 1000) / 10000);

    const addr3TotalGain = addr3SellGain.sub(addr3SellFee);

    expect(newBalanceAddr3AfterSell).to.equal(addr3TotalGain);
  });

  it("should getBuyPrice/getSellPrice/withFee with success", async function () {
    // set the protocol fee and subject fee
    await contract.connect(owner).setProtocolFeePercent(500);
    await contract.connect(owner).setSubjectFeePercent(500);

    // Set protocol wallet
    await contract.connect(owner).setFeeDestination(addr1.address);
    // Set parent protocol address
    await contract.connect(owner).setParentProtocolAddress(owner.address);

    // Now let's try to call the following function: getBuyPrice/getSellPrice/getBuyPriceAfterFee/getSellPriceAfterFee
    const buyPrice = await contract
      .connect(owner)
      .getBuyPrice(addr2.address, "subject1", 1);
    const buyPriceAfterFee = await contract
      .connect(owner)
      .getBuyPriceAfterFee(addr2.address, "subject1", 1);

    // Validate
    expect(buyPrice).to.equal((10 * 1e18) / 320000);
    expect(buyPriceAfterFee).to.equal((11 * 1e18) / 320000);

    // buy shares from self
    await contract
      .connect(owner)
      .buyShares(addr2.address, "subject1", addr2.address, 1, {
        value: (11 * 1e18) / 320000,
      });

    // Validate the buyPrices and buyPricesAfterFee
    const buyPriceAfterBuy = await contract
      .connect(owner)
      .getBuyPrice(addr2.address, "subject1", 1);
    const buyPriceAfterFeeAfterBuy = await contract
      .connect(owner)
      .getBuyPriceAfterFee(addr2.address, "subject1", 1);

    // Validate
    expect(buyPriceAfterBuy).to.equal((40 * 1e18) / 320000);
    expect(buyPriceAfterFeeAfterBuy).to.equal((44 * 1e18) / 320000);

    // Validate the sellPrices and sellPricesAfterFee
    const sellPrice = await contract
      .connect(owner)
      .getSellPrice(addr2.address, "subject1", 1);
    const sellPriceAfterFee = await contract
      .connect(owner)
      .getSellPriceAfterFee(addr2.address, "subject1", 1);

    // Validate
    expect(sellPrice).to.equal((10 * 1e18) / 320000);
    expect(sellPriceAfterFee).to.equal((9 * 1e18) / 320000);

    // Sell the shares from addr2
    await contract
      .connect(owner)
      .sellShares(addr2.address, "subject1", addr2.address, 1);

    // Validate the buyPrices and buyPricesAfterFee
    const buyPriceAfterSell = await contract
      .connect(owner)
      .getBuyPrice(addr2.address, "subject1", 1);
    const buyPriceAfterFeeAfterSell = await contract
      .connect(owner)
      .getBuyPriceAfterFee(addr2.address, "subject1", 1);

    // Validate
    expect(buyPriceAfterSell).to.equal((10 * 1e18) / 320000);
    expect(buyPriceAfterFeeAfterSell).to.equal((11 * 1e18) / 320000);
  });

  it("should buy/sell with failure for edge cases", async function () {
    // set the protocol fee and subject fee
    await contract.connect(owner).setProtocolFeePercent(500);
    await contract.connect(owner).setSubjectFeePercent(500);

    // Set protocol wallet
    await contract.connect(owner).setFeeDestination(addr1.address);

    // Should fail to buy shares if parentProtocolAddress is not set
    // Buy shares
    await expect(
      contract
        .connect(owner)
        .buyShares(addr2.address, "subject1", addr2.address, 1, {
          value: (11 * 1e18) / 320000,
        })
    ).to.be.revertedWith("Caller is not the parent protocol");

    // Should fail to buy shares if parentProtocolAddress is not correct
    // Set parent protocol address
    await contract.connect(owner).setParentProtocolAddress(owner.address);
    // Buy shares
    await expect(
      contract
        .connect(addr1)
        .buyShares(addr2.address, "subject1", addr2.address, 1, {
          value: (11 * 1e18) / 320000,
        })
    ).to.be.revertedWith("Caller is not the parent protocol");

    // Should fail to buy shares if payment is not enough
    // Buy shares
    await expect(
      contract
        .connect(owner)
        .buyShares(addr2.address, "subject1", addr2.address, 1, {
          value: (10 * 1e18) / 320000,
        })
    ).to.be.revertedWith("Insufficient payment");

    // Should fail to sell shares if shares are not available
    // Sell shares
    await expect(
      contract
        .connect(owner)
        .sellShares(addr2.address, "subject1", addr2.address, 1)
    ).to.be.revertedWith("Cannot sell more than the shares supply");

    // Now let's buy share normally
    // Buy shares
    await contract
      .connect(owner)
      .buyShares(addr2.address, "subject1", addr2.address, 1, {
        value: (11 * 1e18) / 320000,
      });

    // Sell shares
    await expect(
      contract
        .connect(owner)
        .sellShares(addr2.address, "subject1", addr2.address, 2)
    ).to.be.revertedWith("Cannot sell more than the shares supply");

    // Let's buy from another address
    // Buy shares
    await contract
      .connect(owner)
      .buyShares(addr2.address, "subject1", addr3.address, 1, {
        value: (44 * 4e18) / 320000,
      });

    // Should fail to sell shares if amount is more than balance
    // Sell shares
    await expect(
      contract
        .connect(owner)
        .sellShares(addr2.address, "subject1", addr2.address, 2)
    ).to.be.revertedWith("Insufficient shares");
  });
});
