// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// @title Metadata Multi Sig
// @author marty_cfly
// @notice Contract can be used by DAOs
contract MetaMultiSig {
    /// @notice Emitted when Signer added
    /// @param addedSigner Address of added signer
    event SignerAdded(address addedSigner);

    /// @notice Emitted when Signer removed
    /// @param removedSigner Address of removed signer
    event SignerRemoved(address removedSigner);

    /// @notice Emitted when required signature amount is updated
    /// @param requiredSignatures New amount of required signatures
    event UpdatedRequiredSignatures(uint256 requiredSignatures);

    /// @notice Emitted when a tx is executed
    /// @param from Address of tx sender
    /// @param to Address of tx receiver
    /// @param data Sent tx data
    /// @param value Sent tx value
    /// @param signatures Signatures of signed tx
    event TxExecuted(
        address from,
        address to,
        bytes data,
        uint256 value,
        bytes[] signatures
    );

    using ECDSA for bytes32;

    error Unauthorized();
    error TooLittleSignatures(uint256 valid, uint256 required);

    uint public signaturesRequired;
    mapping(address => bool) public accountToSignpermission;

    uint256 public nonce;

    /// @notice Adds initial signers
    /// @param _signers  Address of signers
    /// @param _requiredSignatures  Required signatures
    constructor(address[] memory _signers, uint256 _requiredSignatures)
        payable
    {
        require(
            _requiredSignatures > 0,
            "MetaMultiSig, RequiredSigs must be > 0"
        );
        require(_signers.length > 0, "MetaMultiSig, Nr of signers must be > 0");

        signaturesRequired = _requiredSignatures;
        for (uint256 i = 0; i < _signers.length; i++) {
            accountToSignpermission[_signers[i]] = true;
        }
    }

    /// @notice Receives Ether if tx data was added
    fallback() external payable {}

    /// @notice Receives Ether if no tx data was added
    receive() external payable {}

    modifier self() {
        if (msg.sender != address(this)) {
            revert Unauthorized();
        }
        _;
    }

    /// @notice Sets account of signers mapping to true
    /// @param _signer  Address of added signer
    function addSigner(address _signer) public self {
        accountToSignpermission[_signer] = true;
        emit SignerAdded(_signer);
    }

    /// @notice Sets account of signers mapping to false
    /// @param _signer  Address of removed signer
    function removeSigner(address _signer) public self {
        accountToSignpermission[_signer] = false;
        emit SignerRemoved(_signer);
    }

    /// @notice Updates required amount of valid signatures
    /// @param _requiredSignatures  required amount of valid signatures
    function updateRequiredSignatures(uint256 _requiredSignatures) public self {
        require(
            _requiredSignatures > 0,
            "MetaMultiSig, RequiredSignatures can't be 0"
        );
        signaturesRequired = _requiredSignatures;
        emit UpdatedRequiredSignatures(_requiredSignatures);
    }

    /// @notice Creates encodePacked keccak256 hash of tx info
    /// @param _to Receiver of tx
    /// @param _nonce Tx number of the contract
    /// @param _chainId Id of chain
    /// @param _value Amount of ETH send in tx
    /// @param _data Metadata of tx
    /// @return keccak256 hash of tx info
    function getTxHash(
        address _to,
        uint256 _nonce,
        uint256 _chainId,
        uint256 _value,
        bytes memory _data
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(_to, _nonce, _chainId, _value, _data));
    }

    /// @notice Recovers account of signature
    /// @param _hash Signed hash
    /// @param _signature Signature of signer
    /// @return Address of signature
    function recoverAccount(bytes32 _hash, bytes memory _signature)
        public
        pure
        returns (address)
    {
        return _hash.toEthSignedMessageHash().recover(_signature);
    }

    /// @notice Verifies signature requirements and executes txs
    /// @param _to Address that gets called
    /// @param _chainId Id of chain
    /// @param _value Amount of ETH send in tx
    /// @param _data Metadata of tx
    /// @param _signatures Signatures of signers
    function verifyAndExecuteTx(
        address _to,
        uint256 _chainId,
        uint256 _value,
        bytes memory _data,
        bytes[] memory _signatures
    ) public {
        uint validSignatures = 0;
        bytes32 duplicateGuard;
        bytes32 txHash = getTxHash(_to, nonce, _chainId, _value, _data);
        nonce++;

        for (uint256 i = 0; i < _signatures.length; i++) {
            address recoveredAccount = recoverAccount(txHash, _signatures[i]);
            require(
                bytes32(_signatures[i]) > duplicateGuard,
                "verifyAndExecuteTx, Duplicate or unordered sigs"
            );
            duplicateGuard = bytes32(_signatures[i]);

            if (accountToSignpermission[recoveredAccount]) {
                validSignatures++;
            }
        }
        if (validSignatures >= signaturesRequired) {
            (bool success, ) = address(_to).call(_data);
            require(success, "Tx failed");
            emit TxExecuted(msg.sender, _to, _data, _value, _signatures);
        } else {
            revert TooLittleSignatures({
                valid: validSignatures,
                required: signaturesRequired
            });
        }
    }
}
