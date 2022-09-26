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
function Home({ address, chainId, readContracts, writeContracts, mainnetProvider, poolServerUrl, tx, userSigner }) {
  const [txInput, setTxInput] = useState("0x");
  const [txValue, setTxValue] = useState("0");

  const [orderedSignatures, setOrderedSignatures] = useState([]);

  const [txInfo, setTxInfo] = useState({});
  const [error, setError] = useState("");

  const signaturesRequired = useContractReader(readContracts, "MetaMultiSig", "signaturesRequired");
  const txNonce = useContractReader(readContracts, "MetaMultiSig", "nonce");
  const isSigner = useContractReader(readContracts, "MetaMultiSig", "accountToSignpermission", [address]);

  async function getTxInfo() {
    axios

      .get(`/api/txInfo/${txNonce}`)
      .then(function (response) {
        console.log(response.data);
        let signatures = response.data.signatures;
        signatures.sort((a, b) => {
          return a - b;
        });
        setOrderedSignatures(signatures);
        setTxInfo(response.data);
      })
      .catch(function (error) {
        console.log(error);

        setError("No open tx available, create a transaction");
      });
  }

  async function createAndSignTx() {
    if (isSigner) {
      const contractAddress = readContracts["MetaMultiSig"].address;
      const txTo = contractAddress;
      const unencodedCalldata = `addSigner(address), [
        ${txInput},
      ]`;
      const calldataAbi = "addSigner(address)";

      const txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData(calldataAbi, [txInput]);
      const dataHash = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "bytes"],
        [txTo, txNonce, chainId, txValue, txCalldata],
      );

      const txSignature = await userSigner.signMessage(ethers.utils.arrayify(dataHash));

      let payload = {
        nonce: `${txNonce}`,
        creator: address,
        to: txTo,
        unencodedCalldata: unencodedCalldata,
        calldataAbi: calldataAbi,
        value: txValue,
        signatures: txSignature,
      };

      axios
        .post(`/api/storeTx/`, payload)
        .then(function (response) {
          console.log(response);
        })
        .catch(function (error) {
          console.log(error);
        });
    } else {
      console.log("NOT VALID SIGNER");
    }
  }

  async function signTx() {
    if (isSigner) {
      const txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData(txInfo.calldataAbi, [txInput]);

      const dataHash = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "bytes"],
        [txInfo.to, txNonce, chainId, txInfo.value, txCalldata],
      );

      const txSignature = await userSigner.signMessage(ethers.utils.arrayify(dataHash));

      let payload = {
        nonce: `${txNonce}`,
        signature: txSignature,
      };

      axios
        .put(`/api/signTx/`, payload)
        .then(function (response) {
          console.log(response);
        })
        .catch(function (error) {
          console.log(error);
        });
    } else {
      console.log("NOT VALID SIGNER");
    }
  }

  async function executeTx() {
    const txData = await readContracts["MetaMultiSig"].interface.encodeFunctionData("addSigner(address)", [txInput]);

    const txResult = await tx({
      to: txInfo.to,
      value: txInfo.value,
      data: await readContracts["MetaMultiSig"].interface.encodeFunctionData(
        "verifyAndExecuteTx(address, uint256, uint256, bytes, bytes[])",
        [txInfo.to, chainId, txInfo.value, txData, orderedSignatures],
      ),
    });

    let payload = { nonce: `${txNonce}` };
    axios

      .put(`/api/setTxExecuted/`, payload)
      .then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
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
        {error.length > 0 ? (
          <p>{error}</p>
        ) : (
          <Button
            onClick={() => {
              getTxInfo();
            }}
          >
            Get Open Tx Details
          </Button>
        )}
        {Object.keys(txInfo).length > 0 && (
          <div>
            <h3>Creator</h3>
            <p>{txInfo.creator}</p>
            <h3>Unencoded Calldata</h3>
            <p>{txInfo.unencodedCalldata}</p>
            <h3>Value</h3>
            <p>{txInfo.value}</p>
            <div>
              <h3>Signatures</h3>
              {orderedSignatures.map((signature, index) => (
                <p key={index}> {signature.substring(0, 6) + "..." + signature.substring(signature.length - 6)}</p>
              ))}
            </div>
            <h4>Confirm Address</h4>
            <Input
              placeholder="Signer {Address}"
              onChange={e => {
                setTxInput(e.target.value);
              }}
            />
            <Button
              disabled={signaturesRequired > orderedSignatures.length}
              onClick={() => {
                executeTx();
              }}
            >
              Execute Transaction
            </Button>

            <Button
              onClick={() => {
                signTx();
              }}
            >
              Sign tx
            </Button>
          </div>
        )}
        <Divider />
        <Divider />
        <h3>Create AddSigner Transaction</h3>
        <Input
          placeholder="Signer {Address}"
          onChange={e => {
            setTxInput(e.target.value);
          }}
        />
        <Button
          onClick={() => {
            createAndSignTx();
          }}
        >
          Sign Tx & save Signature
        </Button>
        <Divider />
      </div>
    </div>
  );
}

export default Home;
