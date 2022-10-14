import { useContractReader } from "eth-hooks";
import { Divider, Input, Button, Select } from "antd";
import { ethers } from "ethers";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Address, Balance, Events } from "../components";
const { Option } = Select;

const axios = require("axios");
axios.defaults.baseURL = "https://backend-multisig-wallet.herokuapp.com";

/**
 * web3 props can be passed from '../App.jsx' into your local view component for use
 * @param {*} yourLocalBalance balance on current network
 * @param {*} readContracts contracts from current chain already pre-loaded using ethers contract module. More here https://docs.ethers.io/v5/api/contract/contract/
 * @returns react component
 **/
function Home({ localProvider, address, chainId, readContracts, mainnetProvider, tx, userSigner, price }) {
  const [txInput_1, setTxInput_1] = useState("");
  const [txInput_2, setTxInput_2] = useState("");
  const [txInputPlaceHolder_1, setTxInputPlaceHolder_1] = useState("New Signer (address)");
  const [txInputPlaceHolder_2, setTxInputPlaceHolder_2] = useState("Amount in ETH (uint)");
  const [txValue, setTxValue] = useState("0");
  const [calldataAbi, setCalldataAbi] = useState("addSigner(address)");

  const [orderedSignatures, setOrderedSignatures] = useState([]);

  const [txInfo, setTxInfo] = useState({});
  const [message, setMessage] = useState("");

  const signaturesRequired = useContractReader(readContracts, "MetaMultiSig", "signaturesRequired");
  const txNonce = useContractReader(readContracts, "MetaMultiSig", "nonce");
  const nrOfSigners = useContractReader(readContracts, "MetaMultiSig", "nrOfSigners");
  const isSigner = useContractReader(readContracts, "MetaMultiSig", "accountToSignpermission", [address]);

  async function getTxInfo() {
    setTxInput_1("");
    setTxInput_2("");
    setTxInfo({});
    axios

      .get(`/api/txInfo/${txNonce}`)
      .then(function (response) {
        // console.log(response.data);
        let signatures = response.data.signatures;
        signatures.sort((a, b) => {
          return a - b;
        });
        if (response.data.executed === true) {
          setMessage("No open tx available, create a transaction");
        } else {
          setMessage("");
        }
        setOrderedSignatures(signatures);
        setTxInfo(response.data);
      })
      .catch(function (error) {
        console.log(error);
        setTxInfo({});

        setMessage("No open tx available, create a transaction");
      });
  }

  async function createAndSignTx() {
    if (isSigner) {
      const contractAddress = readContracts["MetaMultiSig"].address;
      const txTo = contractAddress;

      let unencodedCalldata;
      let txCalldata;

      if (txInput_2) {
        unencodedCalldata = `${calldataAbi}, [
          ${txInput_1},${txInput_2}
        ]`;

        txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData(calldataAbi, [
          txInput_1,
          ethers.utils.parseEther(txInput_2),
        ]);
      } else {
        unencodedCalldata = `${calldataAbi}, [
          ${txInput_1}
        ]`;
        txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData(calldataAbi, [txInput_1]);
      }

      const dataHash = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "bytes"],
        [txTo, txNonce, chainId, txValue, txCalldata],
      );
      console.log("txValue");
      console.log(txValue);

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
          getTxInfo();
        })
        .catch(function (error) {
          console.log(error);
        });
    } else {
      setMessage("This account is not a signer");
      console.log("NOT VALID SIGNER");
    }
  }

  async function signTx() {
    if (isSigner) {
      let txCalldata;

      if (txInput_2) {
        txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData(txInfo.calldataAbi, [
          txInput_1,
          ethers.utils.parseEther(txInput_2),
        ]);
      } else {
        txCalldata = readContracts["MetaMultiSig"].interface.encodeFunctionData(txInfo.calldataAbi, [txInput_1]);
      }

      const dataHash = ethers.utils.solidityKeccak256(
        ["address", "uint256", "uint256", "uint256", "bytes"],
        [txInfo.to, txNonce, chainId, txInfo.value, txCalldata],
      );
      console.log("txInfo.value");
      console.log(txInfo.value);
      const txSignature = await userSigner.signMessage(ethers.utils.arrayify(dataHash));

      let payload = {
        nonce: `${txNonce}`,
        signature: txSignature,
      };

      axios
        .put(`/api/signTx/`, payload)
        .then(function (response) {
          console.log(response);
          getTxInfo();
        })
        .catch(function (error) {
          console.log(error);
        });
    } else {
      console.log("NOT VALID SIGNER");
    }
  }

  async function resetDb() {
    axios
      .put(`/api/resetDb/`)
      .then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  async function executeTx() {
    let txCalldata;

    if (txInput_2) {
      txCalldata = await readContracts["MetaMultiSig"].interface.encodeFunctionData(txInfo.calldataAbi, [
        txInput_1,
        ethers.utils.parseEther(txInput_2),
      ]);
    } else {
      txCalldata = await readContracts["MetaMultiSig"].interface.encodeFunctionData(txInfo.calldataAbi, [txInput_1]);
    }

    const txResult = await tx({
      to: txInfo.to,
      value: ethers.BigNumber.from(txInfo.value),
      data: await readContracts["MetaMultiSig"].interface.encodeFunctionData(
        "verifyAndExecuteTx(address, uint256, uint256, bytes, bytes[])",
        [txInfo.to, chainId, txInfo.value, txCalldata, orderedSignatures],
      ),
    });

    let payload = { nonce: `${txNonce}` };
    axios
      .put(`/api/setTxSent/`, payload)
      .then(function (response) {
        console.log(response);
        setTxInfo({});
        getTxInfo();
        setMessage("Transaction successful");
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  function handleTxChange(option) {
    setCalldataAbi(option.value);
    switch (option.value) {
      case "addSigner(address)":
        setTxInputPlaceHolder_1("New Signer (address)");
        break;
      case "removeSigner(address)":
        setTxInputPlaceHolder_1("Removed Signer (address)");
        break;
      case "updateRequiredSignatures(uint256)":
        setTxInputPlaceHolder_1("Required Sigs (uint)");
        break;
      case "withdrawEth(address,uint256)":
        setTxInputPlaceHolder_1("Receiver (address)");
        setTxInputPlaceHolder_2("Amount in ETH (uint)");
        break;
    }
  }

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
        <h2>Meta Multisig Wallet</h2>

        {readContracts["MetaMultiSig"] && (
          <div>
            <div>
              {" "}
              <Address address={readContracts["MetaMultiSig"].address} ensProvider={mainnetProvider} fontSize={16} />
            </div>
            <Balance address={readContracts["MetaMultiSig"].address} provider={localProvider} price={price} />
          </div>
        )}
        <Divider />
        <h4>Signatures Required: {`${signaturesRequired}`}</h4>
        <h4>Nr of Signers: {`${nrOfSigners}`}</h4>
        <h4>Tx nonce: {`${txNonce}`}</h4>
        <h4>Signer: {`${isSigner}`}</h4>
        {message.length > 0 && (
          <div>
            <Divider />
            <p>{message}</p>{" "}
          </div>
        )}
        <Divider />
        <Button
          onClick={() => {
            getTxInfo();
          }}
        >
          Get Open Tx Details
        </Button>
        {Object.keys(txInfo).length > 0 && txInfo.executed === false && (
          <div>
            <Divider />
            <h3>Open Transaction</h3>
            <h4>Creator</h4>
            <p>{txInfo.creator}</p>
            <h4>Unencoded Calldata</h4>
            <p>{txInfo.unencodedCalldata}</p>
            <h4>Value</h4>
            <p>{txInfo.value}</p>
            <div>
              <h4>Signatures</h4>
              {orderedSignatures.map((signature, index) => (
                <p key={index}> {signature.substring(0, 6) + "..." + signature.substring(signature.length - 6)}</p>
              ))}
            </div>
            <Divider />
            <h3>Confirm Tx Input</h3>
            <Input
              value={txInput_1}
              placeholder="Confirm input (optional)"
              onChange={e => {
                setTxInput_1(e.target.value);
              }}
            />

            <Input
              value={txInput_2}
              placeholder="Confirm input (optional)"
              onChange={e => {
                setTxInput_2(e.target.value);
              }}
            />

            <Button
              disabled={signaturesRequired > orderedSignatures.length || !txInput_1}
              onClick={() => {
                executeTx();
              }}
            >
              Execute Transaction
            </Button>

            <Button
              disabled={!txInput_1}
              onClick={() => {
                signTx();
              }}
            >
              Sign tx
            </Button>
          </div>
        )}
        <Divider />
        {!Object.keys(txInfo).length && (
          <div>
            <h3>Create Transaction</h3>
            <Select
              labelInValue
              defaultValue={{
                value: "addSigner(address)",
                label: "Add Signer",
              }}
              style={{
                width: 170,
              }}
              onChange={handleTxChange}
            >
              <Option value="addSigner(address)">Add Signer</Option>
              <Option value="removeSigner(address)">Remove Signer</Option>
              <Option value="updateRequiredSignatures(uint256)">Update Req Sigs</Option>
              <Option value="withdrawEth(address,uint256)">Send ETH</Option>
            </Select>
            <Input
              value={txInput_1}
              placeholder={txInputPlaceHolder_1}
              onChange={e => {
                setTxInput_1(e.target.value);
              }}
            />
            {calldataAbi === "withdrawEth(address,uint256)" && (
              <Input
                value={txInput_2}
                placeholder={txInputPlaceHolder_2}
                onChange={e => {
                  setTxInput_2(e.target.value);
                }}
              />
            )}
            <Button
              onClick={() => {
                createAndSignTx();
              }}
            >
              Sign Tx & save Signature
            </Button>
            <Divider />{" "}
          </div>
        )}
        <Button
          onClick={() => {
            resetDb();
          }}
        >
          Reset DB
        </Button>
      </div>
      <Events
        contracts={readContracts}
        contractName="MetaMultiSig"
        eventName="TxExecuted"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      />
      {/* <Events
        contracts={readContracts}
        contractName="MetaMultiSig"
        eventName="SignerAdded"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      />
      <Events
        contracts={readContracts}
        contractName="MetaMultiSig"
        eventName="SignerRemoved"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      />
      <Events
        contracts={readContracts}
        contractName="MetaMultiSig"
        eventName="UpdatedRequiredSignatures"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      />
      <Events
        contracts={readContracts}
        contractName="MetaMultiSig"
        eventName="EthWithdrawn"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      /> */}
    </div>
  );
}

export default Home;
