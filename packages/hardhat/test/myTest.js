const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Deploy MetaMultiSig contract", function () {
  async function deployContractsFixture() {
    const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const MetaMultiSig = await ethers.getContractFactory("MetaMultiSig");
    const hardhatMetaMultiSig = await MetaMultiSig.connect(owner).deploy(
      [addr1.address, addr2.address],
      2
    );
    await hardhatMetaMultiSig.deployed();

    const tx = await owner.sendTransaction({
      to: hardhatMetaMultiSig.address,
      value: ethers.utils.parseEther("2.0"),
    });

    const IMetaMultiSig = new ethers.utils.Interface([
      "function addSigner(address signer)",
      "function removeSigner(address signer)",
      "function updateRequiredSignatures(uint256 _requiredSignatures)",
    ]);

    return {
      MetaMultiSig,
      IMetaMultiSig,
      hardhatMetaMultiSig,
      owner,
      addr1,
      addr2,
      addr3,
      addr4,
    };
  }

  describe("Test smartcontract functionalities", function () {
    it("Should call addSigner function with 2 valid signatures", async function () {
      const { hardhatMetaMultiSig, IMetaMultiSig, owner, addr1, addr2, addr3 } =
        await loadFixture(deployContractsFixture);

      const to = hardhatMetaMultiSig.address;
      const nonce = await hardhatMetaMultiSig.nonce();
      const chainId = 1;
      const value = ethers.utils.parseEther("0.5");

      let encodedData = IMetaMultiSig.encodeFunctionData("addSigner(address)", [
        addr3.address,
      ]);

      let txHash = await hardhatMetaMultiSig.getTxHash(
        to,
        nonce,
        chainId,
        value,
        encodedData
      );
      let signature_1 = await addr1.signMessage(ethers.utils.arrayify(txHash));
      let signature_2 = await addr2.signMessage(ethers.utils.arrayify(txHash));

      let signatures = [signature_1, signature_2];

      signatures.sort((a, b) => {
        return ethers.BigNumber.from(a).sub(ethers.BigNumber.from(b));
      });

      await expect(
        hardhatMetaMultiSig
          .connect(owner)
          .verifyAndExecuteTx(to, chainId, value, encodedData, signatures)
      ).not.to.be.reverted;
    });

    it("Should add Signer addr3 via encoded call ", async function () {
      const {
        hardhatMetaMultiSig,
        IMetaMultiSig,
        owner,
        addr1,
        addr2,
        addr3,
        addr4,
      } = await loadFixture(deployContractsFixture);

      const to = hardhatMetaMultiSig.address;
      const nonce = await hardhatMetaMultiSig.nonce();
      const chainId = 1;
      const value = ethers.utils.parseEther("0.5");

      let encodedData = IMetaMultiSig.encodeFunctionData("addSigner(address)", [
        addr3.address,
      ]);

      let txHash = await hardhatMetaMultiSig.getTxHash(
        to,
        nonce,
        chainId,
        value,
        encodedData
      );

      let signature_1 = await addr1.signMessage(ethers.utils.arrayify(txHash));
      let signature_2 = await addr2.signMessage(ethers.utils.arrayify(txHash));

      let signatures = [signature_1, signature_2];
      signatures.sort((a, b) => {
        return ethers.BigNumber.from(a).sub(ethers.BigNumber.from(b));
      });

      let addSignerTx = await hardhatMetaMultiSig
        .connect(addr4)
        .verifyAndExecuteTx(to, chainId, value, encodedData, signatures);

      expect(
        await hardhatMetaMultiSig
          .connect(addr4)
          .accountToSignpermission(addr3.address)
      ).to.equal(true);
    });

    it("Should NOT send tx with 1 valid and 1 INvalid signature ", async function () {
      const {
        hardhatMetaMultiSig,
        IMetaMultiSig,
        owner,
        addr1,
        addr2,
        addr3,
        addr4,
      } = await loadFixture(deployContractsFixture);

      const to = hardhatMetaMultiSig.address;
      const nonce = await hardhatMetaMultiSig.nonce();
      const chainId = 1;
      const value = ethers.utils.parseEther("0.5");

      let encodedData = IMetaMultiSig.encodeFunctionData("addSigner(address)", [
        addr3.address,
      ]);

      let txHash = await hardhatMetaMultiSig.getTxHash(
        to,
        nonce,
        chainId,
        value,
        encodedData
      );

      let signature_1 = await addr1.signMessage(ethers.utils.arrayify(txHash));
      let signature_3 = await addr3.signMessage(ethers.utils.arrayify(txHash));

      let signatures = [signature_1, signature_3];
      signatures.sort((a, b) => {
        return ethers.BigNumber.from(a).sub(ethers.BigNumber.from(b));
      });

      await expect(
        hardhatMetaMultiSig
          .connect(addr2)
          .verifyAndExecuteTx(to, chainId, value, encodedData, signatures)
      ).to.be.reverted;
    });

    it("Should update required signatures to 3", async function () {
      const { hardhatMetaMultiSig, IMetaMultiSig, owner, addr1, addr2, addr3 } =
        await loadFixture(deployContractsFixture);

      const to = hardhatMetaMultiSig.address;
      const nonce = await hardhatMetaMultiSig.nonce();
      const chainId = 1;
      const value = 0;
      const requiredSignatures = 3;

      let encodedData = IMetaMultiSig.encodeFunctionData(
        "updateRequiredSignatures(uint256)",
        [requiredSignatures]
      );

      let txHash = await hardhatMetaMultiSig.getTxHash(
        to,
        nonce,
        chainId,
        value,
        encodedData
      );

      let signature_1 = await addr1.signMessage(ethers.utils.arrayify(txHash));
      let signature_2 = await addr2.signMessage(ethers.utils.arrayify(txHash));
      let signatures = [signature_1, signature_2];
      signatures.sort((a, b) => {
        return ethers.BigNumber.from(a).sub(ethers.BigNumber.from(b));
      });

      await hardhatMetaMultiSig
        .connect(owner)
        .verifyAndExecuteTx(to, chainId, value, encodedData, signatures);

      expect(await hardhatMetaMultiSig.signaturesRequired()).to.equal(3);
    });
  });
});
