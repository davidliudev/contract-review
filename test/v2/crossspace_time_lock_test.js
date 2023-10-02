const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("CrossSpace timelock test", function () {
  let owner, addr1, addr2, addr3;
  let shareContentContract, shareUserContract, timelockContract;
  const ACTION_PROPOSE = 0;
  const ACTION_EXECUTE = 1;
  const ACTION_CANCEL = 2;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // We also need to deploy the CrossSpaceShareContentV2 contract CrossSpaceShareUserV2
    const cspShareContent = await ethers.getContractFactory(
      "CrossSpaceShareContentV2"
    );
    const cspShareUser = await ethers.getContractFactory(
      "CrossSpaceShareUserV2"
    );

    shareContentContract = await cspShareContent.deploy(32000, true);
    shareUserContract = await cspShareUser.deploy(32000, true);

    // We also need to deploy the CrossSpaceTimelock contract
    const cspTimelock = await ethers.getContractFactory(
      "CrossSpaceTradingAdminTimelockContract"
    );

    timelockContract = await cspTimelock.deploy(
      48 * 60 * 60, // 48 hours
      [addr1.address],
      [addr2.address],
      [addr3.address],
      owner.address
    );

    // Need to transfer the ownership of the contracts to the timelock contract
    await shareContentContract
      .connect(owner)
      .transferOwnership(timelockContract.address);
    await shareUserContract
      .connect(owner)
      .transferOwnership(timelockContract.address);
  });

  it("should schedule and execute ok with setContentContractParentProtocolAddress", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractParentProtocolAddress(
        shareContentContract.address,
        addr2.address,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractParentProtocolAddress(
          shareContentContract.address,
          addr2.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setContentContractParentProtocolAddress(
        shareContentContract.address,
        addr2.address,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareContentContract.parentProtocolAddress()).to.equal(
      addr2.address
    );
  });

  it("should schedule and cancel ok with setContentContractParentProtocolAddress", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractParentProtocolAddress(
        shareContentContract.address,
        addr3.address,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setContentContractParentProtocolAddress(
        shareContentContract.address,
        addr3.address,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractParentProtocolAddress(
          shareContentContract.address,
          addr3.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setContentContractProtocolFeeDestination", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractProtocolFeeDestination(
        shareContentContract.address,
        addr2.address,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractProtocolFeeDestination(
          shareContentContract.address,
          addr2.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setContentContractProtocolFeeDestination(
        shareContentContract.address,
        addr2.address,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareContentContract.protocolFeeDestination()).to.equal(
      addr2.address
    );
  });
  it("should cancel ok with setContentContractProtocolFeeDestination", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractProtocolFeeDestination(
        shareContentContract.address,
        addr3.address,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setContentContractProtocolFeeDestination(
        shareContentContract.address,
        addr3.address,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractProtocolFeeDestination(
          shareContentContract.address,
          addr3.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setContentContractProtocolFeePercent", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractProtocolFeePercent(
        shareContentContract.address,
        500,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractProtocolFeePercent(
          shareContentContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setContentContractProtocolFeePercent(
        shareContentContract.address,
        500,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareContentContract.protocolFeePercent()).to.equal(500);
  });
  it("should cancel ok with setContentContractProtocolFeePercent", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractProtocolFeePercent(
        shareContentContract.address,
        500,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setContentContractProtocolFeePercent(
        shareContentContract.address,
        500,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractProtocolFeePercent(
          shareContentContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setContentContractSubjectFeePercent", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractSubjectFeePercent(
        shareContentContract.address,
        500,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractSubjectFeePercent(
          shareContentContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setContentContractSubjectFeePercent(
        shareContentContract.address,
        500,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareContentContract.subjectFeePercent()).to.equal(500);
  });
  it("should cancel ok with setContentContractSubjectFeePercent", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractSubjectFeePercent(
        shareContentContract.address,
        500,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setContentContractSubjectFeePercent(
        shareContentContract.address,
        500,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractSubjectFeePercent(
          shareContentContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setUserContractParentProtocolAddress", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setContentContractParentProtocolAddress(
        shareUserContract.address,
        addr2.address,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setContentContractParentProtocolAddress(
          shareUserContract.address,
          addr2.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setContentContractParentProtocolAddress(
        shareUserContract.address,
        addr2.address,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareUserContract.parentProtocolAddress()).to.equal(
      addr2.address
    );
  });
  it("should cancel ok with setUserContractParentProtocolAddress", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractParentProtocolAddress(
        shareUserContract.address,
        addr3.address,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setUserContractParentProtocolAddress(
        shareUserContract.address,
        addr3.address,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractParentProtocolAddress(
          shareUserContract.address,
          addr3.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setUserContractProtocolFeeDestination", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractProtocolFeeDestination(
        shareUserContract.address,
        addr2.address,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractProtocolFeeDestination(
          shareUserContract.address,
          addr2.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setUserContractProtocolFeeDestination(
        shareUserContract.address,
        addr2.address,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareUserContract.protocolFeeDestination()).to.equal(
      addr2.address
    );
  });
  it("should cancel ok with setUserContractProtocolFeeDestination", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractProtocolFeeDestination(
        shareUserContract.address,
        addr3.address,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setUserContractProtocolFeeDestination(
        shareUserContract.address,
        addr3.address,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractProtocolFeeDestination(
          shareUserContract.address,
          addr3.address,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setUserContractProtocolFeePercent", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractProtocolFeePercent(
        shareUserContract.address,
        500,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractProtocolFeePercent(
          shareUserContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setUserContractProtocolFeePercent(
        shareUserContract.address,
        500,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareUserContract.protocolFeePercent()).to.equal(500);
  });
  it("should cancel ok with setUserContractProtocolFeePercent", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractProtocolFeePercent(
        shareUserContract.address,
        500,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setUserContractProtocolFeePercent(
        shareUserContract.address,
        500,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractProtocolFeePercent(
          shareUserContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });

  it("should schedule and execute with setUserContractSubjectFeePercent", async function () {
    // Test schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractSubjectFeePercent(
        shareUserContract.address,
        500,
        ACTION_PROPOSE
      );
    // Now let's try to execute without min delay and this should be reverted
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractSubjectFeePercent(
          shareUserContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should go through
    await timelockContract
      .connect(addr2)
      .setUserContractSubjectFeePercent(
        shareUserContract.address,
        500,
        ACTION_EXECUTE
      );

    // Validate that the parent protocol address is set
    expect(await shareUserContract.subjectFeePercent()).to.equal(500);
  });
  it("should cancel ok with setUserContractSubjectFeePercent", async function () {
    // Test cancel
    // Schedule
    const tx = await timelockContract
      .connect(addr1)
      .setUserContractSubjectFeePercent(
        shareUserContract.address,
        500,
        ACTION_PROPOSE
      );
    // Let's cancel
    await timelockContract
      .connect(addr3)
      .setUserContractSubjectFeePercent(
        shareUserContract.address,
        500,
        ACTION_CANCEL
      );

    // Now let's advance the time
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Now let's try to execute with min delay and this should not go through
    await expect(
      timelockContract
        .connect(addr2)
        .setUserContractSubjectFeePercent(
          shareUserContract.address,
          500,
          ACTION_EXECUTE
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");
  });
});
