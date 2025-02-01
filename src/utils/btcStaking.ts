import axios from "axios";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory, ECPairInterface } from "ecpair";
import ecc from "@bitcoinerlab/secp256k1";
import { Psbt,networks } from "bitcoinjs-lib";

const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

interface InputWithTapInternalKey {
  hash: string;
  index: number;
  witnessUtxo: {
    script: Buffer;
    value: number;
  };
  sequence: number;
  tapInternalKey?: Buffer; // Add the optional tapInternalKey property
}

// UTXO is a structure defining attributes for a UTXO
export interface UTXO {
    // hash of transaction that holds the UTXO
    txid: string;
    // index of the output in the transaction
    vout: number;
    // amount of satoshis the UTXO holds
    value: number;
    // the script that the UTXO contains
    scriptPubKey: string;
  }
  export const stakingTransaction = (
    sender: string,
    receiver: string,
    satoshis: number,
    feeRate: number,
    inputUTXOs: UTXO[],
    btcWalletNetwork: networks.Network,
    protocolFeeSat: number,
    mintingFeeSat: number,
    treasuryAddress: string,
    data: string,
    publicKeyNoCoord?: Buffer,
  ) => {
    const psbt = new Psbt({ network: btcWalletNetwork });
    let totalInput = 0;

    // Add inputs to the PSBT with RBF enabled
    // Update the input creation to use the new interface
    inputUTXOs.forEach((utxo) => {
      let input: InputWithTapInternalKey = {
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPubKey, "hex"),
          value: utxo.value,
        },
        sequence: 0xfffffffd, // Enable RBF by setting nSequence to a value less than 0xFFFFFFFE
      };

      if (publicKeyNoCoord) {
        input.tapInternalKey = publicKeyNoCoord;
      }

      psbt.addInput(input);
      totalInput += utxo.value;
    });

    let treasuryAmount = protocolFeeSat + mintingFeeSat;
    let receiverAmount = satoshis - treasuryAmount;    
  
    // Add outputs to the PSBT
    psbt.addOutput({
      address: receiver,
      value: receiverAmount,
    });

    if (treasuryAmount > 0) {
      psbt.addOutput({
        address: treasuryAddress,
        value: treasuryAmount,
      });
    }

    const estimatedSize = psbt.txInputs.length * 148 + psbt.txOutputs.length * 34 + 20; // Approximate calculation
  
    const fee = Math.round(feeRate * estimatedSize);

    // Embed data in the witness stack with staking fee appended
    psbt.addOutput({
      script: bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        Buffer.from(`${data},${fee},${protocolFeeSat},${mintingFeeSat}`),
      ]),
      value: 0,
    });

    const change = totalInput - receiverAmount - fee - treasuryAmount;
    if (change > 0) {
      psbt.addOutput({
        address: sender,
        value: change,
      });
    }

    return { psbt, fee };
  
  };
