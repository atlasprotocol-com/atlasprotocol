import axios from "axios";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory, ECPairInterface } from "ecpair";
import ecc from "@bitcoinerlab/secp256k1";
import { Psbt,networks } from "bitcoinjs-lib";
import { BorshSchema, borshSerialize } from "borsher";
import zlib from "zlib";

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
    receivingChainID: string,
    receivingAddress: string,
    publicKeyNoCoord?: Buffer,
  ) => {
    const psbt = new Psbt({ network: btcWalletNetwork });
    let totalInput = 0;

    let treasuryAmount = protocolFeeSat + mintingFeeSat;
    let receiverAmount = satoshis - treasuryAmount;    

    let totalOutput = receiverAmount + treasuryAmount;
    
    // Add inputs to the PSBT with RBF enabled
    // Update the input creation to use the new interface
    // Sort UTXOs by value in descending order
    const sortedUTXOs = [...inputUTXOs].sort((a, b) => b.value - a.value);
    
    // Select minimum UTXOs needed to cover totalOutput
    let runningTotal = 0;
    const selectedUTXOs = [];
    
    for (const utxo of sortedUTXOs) {
      totalOutput = totalOutput + 68;

      if (runningTotal >= totalOutput) break;

      selectedUTXOs.push(utxo);
      runningTotal += utxo.value;
    }

    if (runningTotal < totalOutput) {
      throw new Error("Not enough funds to cover output amount");
    }

    selectedUTXOs.forEach((utxo) => {
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

    const estimatedSize = psbt.txInputs.length * 68 + psbt.txOutputs.length * 34 + 100; // Approximate calculation
  
    const fee = Math.round(feeRate * estimatedSize);

    const estimatedSizeYieldProviderGasFee = 1 * 68 + psbt.txOutputs.length * 34 + 100; // Approximate calculation
  
    const yieldProviderGasFee = Math.round(feeRate * estimatedSizeYieldProviderGasFee);

    // Define schema for OP_RETURN data
    const schema = BorshSchema.Struct({
      n: BorshSchema.String,
      a: BorshSchema.String,
      1: BorshSchema.u16,
      2: BorshSchema.u16,
      3: BorshSchema.u16,
    });

    // Prepare data for encoding
    const messageData = {
      n: receivingChainID,
      a: receivingAddress,
      1: yieldProviderGasFee,
      2: protocolFeeSat,
      3: mintingFeeSat
    };

    // Serialize and compress data
    const borshEncoded = borshSerialize(schema, messageData);
    const compressedData = zlib.deflateSync(borshEncoded);

    // Embed compressed data in OP_RETURN output
    psbt.addOutput({
      script: bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        compressedData
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

    return { psbt, fee, yieldProviderGasFee };
  
  };
