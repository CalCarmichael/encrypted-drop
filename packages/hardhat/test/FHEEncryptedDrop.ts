import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FHEEncryptedDrop, FHEEncryptedDrop__factory } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Users = {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployDrop() {
  const factory = (await ethers.getContractFactory("FHEEncryptedDrop")) as FHEEncryptedDrop__factory;
  return (await factory.deploy()) as FHEEncryptedDrop;
}

describe("FHEEncryptedDrop Unit Tests", function () {
  let accounts: Users;
  let drop: FHEEncryptedDrop;

  before(async () => {
    const signers = await ethers.getSigners();
    accounts = { owner: signers[0], alice: signers[1], bob: signers[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("⚠️ FHE mock required for these tests");
      this.skip();
    }
    drop = await deployDrop();
  });

  it("allows single encrypted flag registration per user", async () => {
    const flagValue = 1;
    const encrypted = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.alice.address)
      .add32(flagValue)
      .encrypt();

    await drop.connect(accounts.alice).registerFlag(encrypted.handles[0], encrypted.inputProof);

    expect(await drop.isRegistered(accounts.alice.address)).to.be.true;

    const stored = await drop.readEncrypted(accounts.alice.address);
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, stored, await drop.getAddress(), accounts.alice);

    expect(decrypted).to.eq(flagValue);
  });

  it("supports multiple independent users", async () => {
    const aliceEnc = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.alice.address)
      .add32(1)
      .encrypt();
    const bobEnc = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.bob.address)
      .add32(0)
      .encrypt();

    await drop.connect(accounts.alice).registerFlag(aliceEnc.handles[0], aliceEnc.inputProof);
    await drop.connect(accounts.bob).registerFlag(bobEnc.handles[0], bobEnc.inputProof);

    const decAlice = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await drop.readEncrypted(accounts.alice.address),
      await drop.getAddress(),
      accounts.alice,
    );
    const decBob = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await drop.readEncrypted(accounts.bob.address),
      await drop.getAddress(),
      accounts.bob,
    );

    expect(decAlice).to.eq(1);
    expect(decBob).to.eq(0);
  });

  it("generates distinct ciphertexts for same value from different users", async () => {
    const value = 1;
    const encAlice = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.alice.address)
      .add32(value)
      .encrypt();
    const encBob = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.bob.address)
      .add32(value)
      .encrypt();

    await drop.connect(accounts.alice).registerFlag(encAlice.handles[0], encAlice.inputProof);
    await drop.connect(accounts.bob).registerFlag(encBob.handles[0], encBob.inputProof);

    const storedAlice = await drop.readEncrypted(accounts.alice.address);
    const storedBob = await drop.readEncrypted(accounts.bob.address);

    expect(storedAlice).to.not.eq(storedBob);
  });

  it("returns false for addresses that did not register", async () => {
    expect(await drop.isRegistered(accounts.bob.address)).to.be.false;
  });

  it("records submitters and their order correctly", async () => {
    const aliceEnc = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.alice.address)
      .add32(1)
      .encrypt();
    const bobEnc = await fhevm
      .createEncryptedInput(await drop.getAddress(), accounts.bob.address)
      .add32(0)
      .encrypt();

    await drop.connect(accounts.alice).registerFlag(aliceEnc.handles[0], aliceEnc.inputProof);
    await drop.connect(accounts.bob).registerFlag(bobEnc.handles[0], bobEnc.inputProof);

    const allUsers = await drop.listSubmitters();

    expect(allUsers.length).to.equal(2);

    expect(allUsers[0]).to.equal(accounts.alice.address);
    expect(allUsers[1]).to.equal(accounts.bob.address);
  });
});
