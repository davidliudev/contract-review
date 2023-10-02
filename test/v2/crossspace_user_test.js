const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const eth = BigNumber.from("10").pow(18);

describe("CrossSpace user contract v2 operations", function () {
  let constructor, contract;
  let owner, addr1, addr2, addr3;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    constructor = await ethers.getContractFactory("CrossSpaceShareUserV2");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    contract = await constructor.deploy(32000, true);
  });

  it("get price expect success", async function () {
    const testData = [
      // supply, amount ,price
      [0, eth, eth.div(96000)],
      [eth, eth, eth.mul(7).div(96000)],
    ];
    for (let i = 0; i < testData.length; i++) {
      const [supply, amount, expectedPrice] = testData[i];
      const price = await contract.connect(addr1).getPrice(supply, amount);
      // log the price
      expect(price).to.equal(expectedPrice);
    }
  });

  it("get amount expect success", async function () {
    const testData = [
      // supply, price ,amount
      [0, eth.div(96000), "999999999999978666"], // There are some rounding errors here due to price is not exactly 1/96000
      [eth, eth.mul(7).div(96000), "999999999999994666"], // Same here
    ];
    for (let i = 0; i < testData.length; i++) {
      const [supply, price, expectedAmount] = testData[i];
      const amount = await contract
        .connect(addr1)
        .getAmountInWeiByValue(supply, price);

      // Validate the amount
      expect(amount).to.equal(expectedAmount);
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

    // Set protocol wallet
    await contract.connect(owner).setFeeDestination(addr1.address);

    // buy shares from self
    const firstSharePrice = eth.div(96000);
    const firstShareProtocolFee = firstSharePrice.mul(500).div(10000);
    const firstShareSubjectFee = firstSharePrice.mul(500).div(10000);
    const firstSharePayment = firstSharePrice
      .add(firstShareProtocolFee)
      .add(firstShareSubjectFee);

    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await contract.connect(addr2).buyShares(addr2.address, addr2.address, eth, {
      value: firstSharePayment,
    });

    // buy shares from others
    const secondSharePrice = eth.mul(7).div(96000);
    const secondShareProtocolFee = secondSharePrice.mul(500).div(10000);
    const secondShareSubjectFee = secondSharePrice.mul(500).div(10000);
    const secondSharePayment = secondSharePrice
      .add(secondShareProtocolFee)
      .add(secondShareSubjectFee);
    await contract.connect(owner).setParentProtocolAddress(addr3.address);
    await contract.connect(addr3).buyShares(addr2.address, addr3.address, eth, {
      value: secondSharePayment,
    });

    // Validate the shares balances
    const shareBalanceFromAddr2 = await contract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr2.address);
    const shareBalanceFromAddr3 = await contract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr3.address);

    expect(shareBalanceFromAddr2).to.equal(eth);
    expect(shareBalanceFromAddr3).to.equal(eth);

    // Validate the share supply
    const shareSupply = await contract
      .connect(owner)
      .sharesSupplyInWei(addr2.address);

    expect(shareSupply).to.equal(eth.mul(2));

    // Validate the values in the contract
    const lockedInValue = await ethers.provider.getBalance(contract.address);
    expect(lockedInValue).to.equal(eth.div(96000).add(eth.mul(7).div(96000)));

    // Validate the protocol fee collected
    const currentBalanceAddr1 = await ethers.provider.getBalance(addr1.address);
    const protocolFeeCollected = currentBalanceAddr1.sub(addr1InitialBalance);
    expect(protocolFeeCollected).to.equal(
      firstShareProtocolFee.add(secondShareProtocolFee)
    );

    // Validate te subject fee collected
    const currentBalanceAddr2 = await ethers.provider.getBalance(addr2.address);
    const subjectFeeCollected = currentBalanceAddr2
      .sub(addr2InitialBalance)
      .add(firstSharePayment); // Need to add back the first payment
    expect(subjectFeeCollected).to.equal(
      firstShareSubjectFee.add(secondShareSubjectFee)
    );

    // Now sell the shares fro addr3
    await contract.connect(addr3).sellShares(addr2.address, addr3.address, eth);

    // Sell the shares from addr2
    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await contract.connect(addr2).sellShares(addr2.address, addr2.address, eth);

    // Validate the shares balances
    const shareBalanceFromAddr2AfterSell = await contract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr2.address);
    const shareBalanceFromAddr3AfterSell = await contract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr3.address);

    expect(shareBalanceFromAddr2AfterSell).to.equal(0);
    expect(shareBalanceFromAddr3AfterSell).to.equal(0);

    // Validate the share supply
    const shareSupplyAfterSell = await contract
      .connect(owner)
      .sharesSupplyInWei(addr2.address);

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
      firstShareProtocolFee.add(secondShareProtocolFee).mul(2)
    );

    // Validate add2 balance
    const currentBalanceAddr2AfterSell = await ethers.provider.getBalance(
      addr2.address
    );
    const newFeeAfterSell =
      currentBalanceAddr2AfterSell.sub(addr2InitialBalance);

    const subjectFeeExpected = firstShareSubjectFee
      .add(secondShareSubjectFee)
      .mul(2);

    const sellPrice = BigNumber.from(eth.div(96000)); // We never gain anything from buy/sell the share since the price is the same. Thus only the cost of the fee is counted below
    const sellFee = BigNumber.from(sellPrice.mul(1000).div(10000)).mul(2);

    const totalGain = subjectFeeExpected.sub(sellFee);

    expect(newFeeAfterSell).to.equal(totalGain);

    // Validate addr3 balance
    const currentBalanceAddr3AfterSell = await ethers.provider.getBalance(
      addr3.address
    );
    const newBalanceAddr3AfterSell =
      currentBalanceAddr3AfterSell.sub(addr3InitialBalance);

    const addr3SellPrice = BigNumber.from(eth.mul(7).div(96000)); // Again, add3 gain nothing from trading for the same reason as above
    const addr3SellFee = BigNumber.from(
      addr3SellPrice.mul(1000).div(10000)
    ).mul(2);

    const addr3TotalGain = BigNumber.from(0).sub(addr3SellFee);

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
      .getBuyPrice(addr2.address, eth);
    const buyPriceAfterFee = await contract
      .connect(owner)
      .getBuyPriceAfterFee(addr2.address, eth);

    // Validate
    expect(buyPrice).to.equal(eth.div(96000));
    expect(buyPriceAfterFee).to.equal(eth.div(96000).mul(11).div(10));

    // buy shares from self
    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await contract.connect(addr2).buyShares(addr2.address, addr2.address, eth, {
      value: eth.div(96000).mul(11).div(10),
    });

    // Validate the buyPrices and buyPricesAfterFee
    const buyPriceAfterBuy = await contract
      .connect(owner)
      .getBuyPrice(addr2.address, eth);
    const buyPriceAfterFeeAfterBuy = await contract
      .connect(owner)
      .getBuyPriceAfterFee(addr2.address, eth);

    // Validate
    expect(buyPriceAfterBuy).to.equal(eth.mul(7).div(96000));
    expect(buyPriceAfterFeeAfterBuy).to.equal(
      eth.mul(7).div(96000).add(eth.mul(7).div(96000).div(10))
    );

    // Validate the sellPrices and sellPricesAfterFee
    const sellPrice = await contract
      .connect(owner)
      .getSellPrice(addr2.address, eth);
    const sellPriceAfterFee = await contract
      .connect(owner)
      .getSellPriceAfterFee(addr2.address, eth);

    // Validate
    expect(sellPrice).to.equal(eth.div(96000));
    expect(sellPriceAfterFee).to.equal(
      eth.div(96000).sub(eth.div(96000).div(10))
    );

    // Sell the shares from addr2
    await contract.connect(addr2).sellShares(addr2.address, addr2.address, eth);

    // Validate the buyPrices and buyPricesAfterFee
    const buyPriceAfterSell = await contract
      .connect(owner)
      .getBuyPrice(addr2.address, eth);
    const buyPriceAfterFeeAfterSell = await contract
      .connect(owner)
      .getBuyPriceAfterFee(addr2.address, eth);

    // Validate
    expect(buyPriceAfterSell).to.equal(eth.div(96000));
    expect(buyPriceAfterFeeAfterSell).to.equal(
      eth.div(96000).add(eth.div(96000).div(10))
    );
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
      contract.connect(owner).buyShares(addr2.address, addr2.address, eth, {
        value: eth.div(96000).mul(11).div(10),
      })
    ).to.be.revertedWith("Caller is not the parent protocol");

    // Should fail to buy shares if parentProtocolAddress is not correct
    // Set parent protocol address
    await contract.connect(owner).setParentProtocolAddress(owner.address);
    // Buy shares
    await expect(
      contract.connect(addr1).buyShares(addr2.address, addr2.address, eth, {
        value: eth.div(96000).mul(11).div(10),
      })
    ).to.be.revertedWith("Caller is not the parent protocol");

    // Should fail to buy shares if payment is not enough
    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    // Buy shares
    await expect(
      contract.connect(addr2).buyShares(addr2.address, addr2.address, eth, {
        value: eth.div(96000).mul(11).div(10).sub(1),
      })
    ).to.be.revertedWith("Insufficient payment");

    // Should fail to sell shares if shares are not available
    // Sell shares
    await expect(
      contract.connect(addr2).sellShares(addr2.address, addr2.address, eth)
    ).to.be.revertedWith("Cannot sell exceeding shares supply");

    // Now let's buy share normally
    // Buy shares
    await contract.connect(addr2).buyShares(addr2.address, addr2.address, eth, {
      value: eth.div(96000).mul(11).div(10),
    });

    // Sell shares
    await expect(
      contract
        .connect(addr2)
        .sellShares(addr2.address, addr2.address, eth.add(1))
    ).to.be.revertedWith("Cannot sell exceeding shares supply");

    // Let's buy from another address
    // Buy shares
    await contract.connect(owner).setParentProtocolAddress(addr3.address);
    await contract.connect(addr3).buyShares(addr2.address, addr3.address, eth, {
      value: eth.mul(7).div(96000).mul(11).div(10),
    });

    // Should fail to sell shares if amount is more than balance
    // Sell shares
    await contract.connect(owner).setParentProtocolAddress(addr2.address);
    await expect(
      contract
        .connect(addr2)
        .sellShares(addr2.address, addr2.address, eth.mul(2))
    ).to.be.revertedWith("Insufficient shares");
  });
});
