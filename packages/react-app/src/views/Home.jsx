import { useContractReader } from "eth-hooks";
import { Divider, Input, Button } from "antd";
import { ethers } from "ethers";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Address } from "../components";

const axios = require("axios");
axios.defaults.baseURL = "http://localhost:5000";

/**
 * web3 props can be passed from '../App.jsx' into your local view component for use
 * @param {*} yourLocalBalance balance on current network
 * @param {*} readContracts contracts from current chain already pre-loaded using ethers contract module. More here https://docs.ethers.io/v5/api/contract/contract/
 * @returns react component
 **/
function Home({ address, chainId, readContracts, mainnetProvider, poolServerUrl, userSigner }) {
  const [txNewSigner, setTxNewSigner] = useState("0x");
  const [txValue, setTxValue] = useState(0);
  const [txData, setTxData] = useState("");

  const [signatures, setSignatures] = useState([]);

  const signaturesRequired = useContractReader(readContracts, "MetaMultiSig", "signaturesRequired");
  const txNonce = useContractReader(readContracts, "MetaMultiSig", "nonce");
  const isSigner = useContractReader(readContracts, "MetaMultiSig", "accountToSignpermission", [address]);

  // const getTxHash = useContractReader(readContracts, "MetaMultiSig", "getTxHash", [to, nonce, chainid, value, data]);
  // const verifyAndExecuteTx = useContractReader(readContracts, "MetaMultiSig", "verifyAndExecuteTx", [to, chainid, value, data, signatures]);
  async function getTxSignature() {
    if (isSigner) {
      console.log("txNewSigner");
      console.log(txNewSigner);
      console.log("txNonce");
      console.log(txNonce);
      console.log("chainId");
      console.log(chainId);
      console.log("txValue");
      console.log(txValue);

      const contractAddress = readContracts["MetaMultiSig"].address;
      const txTo = contractAddress;

      const txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData("addSigner(address)", [
        txNewSigner,
      ]);

      const dataHash = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "bytes"],
        [txTo, txNonce, chainId, txValue, txCalldata],
      );

      const signature = await userSigner.signMessage(ethers.utils.arrayify(dataHash));
      console.log(signature);

      postSignature(signature);
    } else {
      console.log("NOT VALID SIGNER");
    }
  }
  function executeTx() {
    // const verifyAndExecuteTx = useContractReader(readContracts, "MetaMultiSig", "verifyAndExecuteTx", [
    //   txTo,
    //   chainId,
    //   txValue,
    //   txData,
    //   signatures,
    // ]);
    return;
  }

  async function getSignaturesOfNonce() {
    axios
      // .get(`/api/signatures/${txNonce}`)
      .get(`/api/signatures/${txNonce}`)
      .then(function (response) {
        // handle success
        console.log(response.data);
        setSignatures(response.data.signatures);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  }
  async function postSignature(_signature) {
    let payload = { nonce: `${txNonce}`, signature: _signature };
    console.log("payload");
    console.log(payload);
    axios
      // .post(`/api/signatures/${txNonce}/${_signature}`)
      .post(`/api/postsignatures/`, payload)
      .then(function (response) {
        // handle success
        console.log(response);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  }

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
        <h2>Meta Multisig Wallet</h2>
        Your Address:
        <Address address={address} ensProvider={mainnetProvider} fontSize={16} />
        <Divider />
        <h4>Signatures Required: {`${signaturesRequired}`}</h4>
        <h4>Tx nonce: {`${txNonce}`}</h4>
        <h4>Signer: {`${isSigner}`}</h4>
        <Divider />
        <h3>Create AddSigner Transaction</h3>
        <Input
          placeholder="Added Signer {Address}"
          onChange={e => {
            setTxNewSigner(e.target.value);
          }}
        />
        <Button
          onClick={() => {
            getTxSignature();
          }}
        >
          Sign Transaction
        </Button>
        <Divider />
        <Button
          onClick={() => {
            getSignaturesOfNonce();
          }}
        >
          Get Signatures
        </Button>
        {signatures.length > 0 && signatures.map((signature, index) => <p key={index}>{signature}</p>)}
        <Divider />
        <Button
          disabled={signaturesRequired > signatures.length}
          onClick={() => {
            executeTx();
          }}
        >
          Execute Transaction
        </Button>
      </div>
    </div>
  );
}

export default Home;
