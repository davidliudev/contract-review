const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const eth = (n) => {
  const eth = BigNumber.from("10").pow(18);
  return BigNumber.from(n).mul(eth);
};

describe("CrossSpace trading contract v2 operations", function () {
  let constructor, contract;
  let owner, addr1, addr2, addr3;
  let shareContentContract, shareUserContract;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.

    // We also need to deploy the CrossSpaceShareContentV2 contract CrossSpaceShareUserV2
    const cspShareContent = await ethers.getContractFactory(
      "CrossSpaceShareContentV2"
    );
    const cspShareUser = await ethers.getContractFactory(
      "CrossSpaceShareUserV2"
    );

    shareContentContract = await cspShareContent.deploy(32000, true);
    shareUserContract = await cspShareUser.deploy(32000, true);

    constructor = await ethers.getContractFactory("CrossSpaceTradingMain");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    contract = await constructor.deploy(
      shareContentContract.address,
      shareUserContract.address
    );

    // We also need to set the parent protocol address for the share content contract and share user contract
    await shareContentContract
      .connect(owner)
      .setParentProtocolAddress(contract.address);
    await shareUserContract
      .connect(owner)
      .setParentProtocolAddress(contract.address);

    // Let's set the protocol fee and subject fee for the share content contract and share user contract
    await shareContentContract.connect(owner).setProtocolFeePercent(500);
    await shareContentContract.connect(owner).setSubjectFeePercent(500);
    await shareUserContract.connect(owner).setProtocolFeePercent(500);
    await shareUserContract.connect(owner).setSubjectFeePercent(500);

    // Set the protocol wallet
    await shareContentContract.connect(owner).setFeeDestination(addr1.address);
    await shareUserContract.connect(owner).setFeeDestination(addr1.address);

    // Disable the pause state
    await contract.connect(owner).setPaused(false);
  });

  it("get price expect success", async function () {
    const testData = [
      [
        eth(1).div(32000), // contentTotalBeforeFee
        eth(1).div(32000).add(eth(1).div(32000).div(10)), // contentTotalAfterFee
        "1442249570307408382", // userShareAmountInWei
        "31249999999999", // contentTotalBeforeFee, // userShareFeeBeforeFee
        BigNumber.from("31249999999999").add(
          BigNumber.from("31249999999999").mul(500).div(10000).mul(2)
        ), // userShareFeeAfterFee
        eth(1)
          .div(32000)
          .add(eth(1).div(32000).div(10))
          .add(
            BigNumber.from("31249999999999").add(
              BigNumber.from("31249999999999").mul(500).div(10000).mul(2)
            )
          ), // grandTotal
      ],
    ];
    for (let i = 0; i < testData.length; i++) {
      const [
        contentTotalBeforeFee,
        contentTotalAfterFee,
        userShareAmountInWei,
        userShareFeeBeforeFee,
        userShareFeeAfterFee,
        grandTotal,
      ] = testData[i];
      const priceDetails = await contract
        .connect(addr1)
        .getTotalBuyPriceDetails(addr2.address, "subject1", 1);

      // Validate the array
      expect(priceDetails[0]).to.equal(contentTotalBeforeFee);
      expect(priceDetails[1]).to.equal(contentTotalAfterFee);
      expect(priceDetails[2]).to.equal(userShareAmountInWei);
      expect(priceDetails[3]).to.equal(userShareFeeBeforeFee);
      expect(priceDetails[4]).to.equal(userShareFeeAfterFee);
      expect(priceDetails[5]).to.equal(grandTotal);
    }
  });

  it("get price expect revert", async function () {
    await expect(
      contract
        .connect(addr1)
        .getTotalBuyPriceDetails(addr2.address, "subject1", -1)
    ).to.be.reverted;
  });

  it("should buy/sell with success", async function () {
    // Record the initial balance of the owner, addr1, addr2, addr3
    const ownerInitialBalance = await ethers.provider.getBalance(owner.address);
    const addr1InitialBalance = await ethers.provider.getBalance(addr1.address);
    const addr2InitialBalance = await ethers.provider.getBalance(addr2.address);
    const addr3InitialBalance = await ethers.provider.getBalance(addr3.address);

    // buy shares from self
    const firstPayment = eth(1)
      .div(32000)
      .add(eth(1).div(32000).div(10))
      .add(
        BigNumber.from("31249999999999").add(
          BigNumber.from("31249999999999").mul(500).div(10000).mul(2)
        )
      );

    // Log the payment
    console.log("First payment: ", firstPayment.toString());

    await contract.connect(addr2).buyShares(addr2.address, "subject1", 1, {
      value: firstPayment,
    });

    // buy shares from others
    await contract.connect(addr3).buyShares(addr2.address, "subject1", 1, {
      value: "274999999999997",
    });

    // Validate the shares balances for content
    const contentBalanceFromAddr2 = await shareContentContract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr2.address);
    const contentBalanceFromAddr3 = await shareContentContract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr3.address);

    expect(contentBalanceFromAddr2).to.equal(1);
    expect(contentBalanceFromAddr3).to.equal(1);

    // Validate the shares balances for user
    const userBalanceFromAddr2 = await shareUserContract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr2.address);
    const userBalanceFromAddr3 = await shareUserContract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr3.address);

    expect(userBalanceFromAddr2).to.equal("1442249570307408382");
    expect(userBalanceFromAddr3).to.equal("1023962504023061719");

    // Validate the share supply in content contract
    const shareSupply = await shareContentContract
      .connect(owner)
      .sharesSupply(addr2.address, "subject1");
    expect(shareSupply).to.equal(2);
    // Validate the share supply in the user contract
    const userShareSupply = await shareUserContract
      .connect(owner)
      .sharesSupplyInWei(addr2.address);
    expect(userShareSupply).to.equal("2466212074330470101");

    // Validate the values in the content contract
    const lockedInValue = await ethers.provider.getBalance(
      shareContentContract.address
    );
    expect(lockedInValue).to.equal(1e18 / 32000 + 4e18 / 32000);

    // Validate the values in the user contract
    const lockedInValueUser = await ethers.provider.getBalance(
      shareUserContract.address
    );
    expect(lockedInValueUser).to.equal("156249999999998");

    // Validate the protocol fee collected
    const currentBalanceAddr1 = await ethers.provider.getBalance(addr1.address);
    const protocolFeeCollected = currentBalanceAddr1.sub(addr1InitialBalance);
    expect(protocolFeeCollected).to.equal("15624999999998");

    // Validate te subject fee collected
    const currentBalanceAddr2 = await ethers.provider.getBalance(addr2.address);
    const subjectFeeCollected = currentBalanceAddr2
      .sub(addr2InitialBalance)
      .add(firstPayment); // Need to compensate the first payment
    expect(subjectFeeCollected).to.equal("15624999999998");

    // Now sell the shares fro addr3
    await contract.connect(addr3).sellShares(addr2.address, "subject1", 1);
    // Sell the shares from addr2
    await contract.connect(addr2).sellShares(addr2.address, "subject1", 1);

    // Validate the shares balances for the content contract
    const shareBalanceFromAddr2AfterSell = await shareContentContract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr2.address);
    const shareBalanceFromAddr3AfterSell = await shareContentContract
      .connect(owner)
      .sharesBalance(addr2.address, "subject1", addr3.address);
    expect(shareBalanceFromAddr2AfterSell).to.equal(0);
    expect(shareBalanceFromAddr3AfterSell).to.equal(0);

    // Validate the shares balances for the user contract
    const userBalanceFromAddr2AfterSell = await shareUserContract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr2.address);
    const userBalanceFromAddr3AfterSell = await shareUserContract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr3.address);
    expect(userBalanceFromAddr2AfterSell).to.equal(0);
    expect(userBalanceFromAddr3AfterSell).to.equal(0);

    // Validate the share supply in content contract
    const shareSupplyAfterSell = await shareContentContract
      .connect(owner)
      .sharesSupply(addr2.address, "subject1");
    expect(shareSupplyAfterSell).to.equal(0);

    // Validate the share supply in the user contract
    const userShareSupplyAfterSell = await shareUserContract
      .connect(owner)
      .sharesSupplyInWei(addr2.address);
    expect(userShareSupplyAfterSell).to.equal(0);

    // Validate the values in the content contract
    const lockedInValueAfterSell = await ethers.provider.getBalance(
      shareContentContract.address
    );
    expect(lockedInValueAfterSell).to.equal(0);

    // Validate the values in the user contract
    const lockedInValueUserAfterSell = await ethers.provider.getBalance(
      shareUserContract.address
    );
    expect(lockedInValueUserAfterSell).to.equal(0);

    // Validate the protocol fee collected
    const currentBalanceAddr1AfterSell = await ethers.provider.getBalance(
      addr1.address
    );
    const protocolFeeCollectedAfterSell =
      currentBalanceAddr1AfterSell.sub(addr1InitialBalance);
    expect(protocolFeeCollectedAfterSell).to.equal(
      BigNumber.from("15624999999998").mul(2)
    );

    // Validate add2 balance
    const currentBalanceAddr2AfterSell = await ethers.provider.getBalance(
      addr2.address
    );
    const newFeeAfterSell =
      currentBalanceAddr2AfterSell.sub(addr2InitialBalance);

    // To calculate this,
    // First, we never get any profit from buy/sell the shares since the price is the same
    // We gain the profit from the subject fees addr3 buying and selling
    // And we loss by paying add1 the protocol fee
    // From the excel,
    // The subject fees from add3 is 25000000000000
    // The add1 protocol fee loss is 6250000000000
    expect(newFeeAfterSell).to.equal("18750000000000");

    // Validate addr3 balance
    // addr3 should have the loss of the fees
    const currentBalanceAddr3AfterSell = await ethers.provider.getBalance(
      addr3.address
    );
    const newBalanceAddr3AfterSell =
      currentBalanceAddr3AfterSell.sub(addr3InitialBalance);

    // To calculate this,
    // First, we never get any profit from buy/sell the shares since the price is the same
    // We have losses
    // We loss all the fees
    // That would be 50000000000000. But since we are not buying the full amount due to rounding error, we loss less
    expect(newBalanceAddr3AfterSell).to.equal("-49999999999996");
  });

  it("get sell price expect success", async function () {
    const testData = [
      [
        eth(1).div(32000), // contentTotalBeforeFee
        eth(1).div(32000).sub(eth(1).div(32000).div(10)), // contentTotalAfterFee
        "1442249570307408382", // userShareAmountInWei
        "31249999999999", // contentTotalBeforeFee, // userShareFeeBeforeFee
        BigNumber.from("31249999999999").sub(
          BigNumber.from("31249999999999").mul(500).div(10000).mul(2)
        ), // userShareFeeAfterFee
        eth(1)
          .div(32000)
          .sub(eth(1).div(32000).div(10))
          .add(
            BigNumber.from("31249999999999").sub(
              BigNumber.from("31249999999999").mul(500).div(10000).mul(2)
            )
          ), // grandTotal
      ],
    ];

    // buy shares from self
    const firstPayment = eth(1)
      .div(32000)
      .add(eth(1).div(32000).div(10))
      .add(
        BigNumber.from("31249999999999").add(
          BigNumber.from("31249999999999").mul(500).div(10000).mul(2)
        )
      );

    // Log the payment
    console.log("First payment: ", firstPayment.toString());

    await contract.connect(addr2).buyShares(addr2.address, "subject1", 1, {
      value: firstPayment,
    });

    for (let i = 0; i < testData.length; i++) {
      const [
        contentTotalBeforeFee,
        contentTotalAfterFee,
        userShareAmountInWei,
        userShareFeeBeforeFee,
        userShareFeeAfterFee,
        grandTotal,
      ] = testData[i];
      const priceDetails = await contract
        .connect(addr2)
        .getTotalSellPriceDetails(addr2.address, "subject1", addr2.address, 1);
      // Validate the array
      expect(priceDetails[0]).to.equal(contentTotalBeforeFee);
      expect(priceDetails[1]).to.equal(contentTotalAfterFee);
      expect(priceDetails[2]).to.equal(userShareAmountInWei);
      expect(priceDetails[3]).to.equal(userShareFeeBeforeFee);
      expect(priceDetails[4]).to.equal(userShareFeeAfterFee);
      expect(priceDetails[5]).to.equal(grandTotal);
    }
  });
  it("should buy/sell with failure for edge cases", async function () {
    // Should fail to buy shares if payment is not enough
    // Buy shares
    await expect(
      contract.connect(owner).buyShares(addr2.address, "subject1", 1, {
        value: 1,
      })
    ).to.be.revertedWith("Not enough funds");

    // Should fail to sell shares if shares are not available
    // Sell shares
    await expect(
      contract.connect(owner).sellShares(addr2.address, "subject1", 1)
    ).to.be.revertedWith("Insufficient shares");

    // Now let's buy share normally
    const firstPayment = (
      await contract
        .connect(addr2)
        .getTotalBuyPriceDetails(addr2.address, "subject1", 1)
    )[5];

    // Log the payment
    console.log("First payment: ", firstPayment.toString());

    // Buy shares
    await contract.connect(addr2).buyShares(addr2.address, "subject1", 1, {
      value: firstPayment,
    });

    // Sell shares
    await expect(
      contract.connect(addr2).sellShares(addr2.address, "subject1", 2)
    ).to.be.revertedWith("Insufficient shares");
  });
  // Sell in proportion test
  it("should buy and sell in proportion for user share", async function () {
    // Let's buy 1 share from addr2
    // buy shares from self
    const firstPayment = (
      await contract
        .connect(addr2)
        .getTotalBuyPriceDetails(addr2.address, "subject1", 1)
    )[5];
    // Log the payment
    console.log("First payment: ", firstPayment.toString());
    await contract.connect(addr2).buyShares(addr2.address, "subject1", 1, {
      value: firstPayment,
    });
    // Let's buy 10 shares from addr2
    const secondPayment = (
      await contract
        .connect(addr2)
        .getTotalBuyPriceDetails(addr2.address, "subject1", 10)
    )[5];
    // Log the payment
    console.log("Second payment: ", secondPayment.toString());
    await contract.connect(addr2).buyShares(addr2.address, "subject1", 10, {
      value: secondPayment,
    });
    // The total user share
    const userShareTotal = await shareUserContract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr1.address);
    // Now let's sell 1 share from addr2
    await contract.connect(addr2).sellShares(addr2.address, "subject1", 1);
    // Now let's get the new user share total
    const newUserShareTotal = await shareUserContract
      .connect(owner)
      .sharesBalanceInWei(addr2.address, addr1.address);
    // The new user share total should be 9/10 of the original
    expect(newUserShareTotal).to.equal(userShareTotal.mul(9).div(10));
  });
});
