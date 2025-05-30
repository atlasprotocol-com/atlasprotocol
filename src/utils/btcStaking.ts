import axios from "axios";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory, ECPairInterface } from "ecpair";
import ecc from "@bitcoinerlab/secp256k1";
import { Psbt,networks } from "bitcoinjs-lib";

const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

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
    treasuryAddress: string,
    data: string,
    publicKeyNoCoord?: Buffer,
    
  ) => {
    const psbt = new Psbt({ network: btcWalletNetwork });
    let totalInput = 0;

    // Add inputs to the PSBT
    if (publicKeyNoCoord){
      inputUTXOs.forEach((utxo) => {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: Buffer.from(utxo.scriptPubKey, "hex"),
            value: utxo.value,
          },
          tapInternalKey: publicKeyNoCoord,
        });
  
        totalInput += utxo.value;
      });
    }else{
      inputUTXOs.forEach((utxo) => {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: Buffer.from(utxo.scriptPubKey, "hex"),
            value: utxo.value,
          }
        });
  
        totalInput += utxo.value;
      });
    }

    let receiverAmount = satoshis;
  
    if (protocolFeeSat > 0) {
      receiverAmount = satoshis - protocolFeeSat;
    }
    
  
    // Add outputs to the PSBT
    psbt.addOutput({
      address: receiver,
      value: receiverAmount,
    });

    if (protocolFeeSat > 0) {
      psbt.addOutput({
        address: treasuryAddress,
        value: protocolFeeSat,
      });
    }

    // Embed data in the witness stack
    psbt.addOutput({
      script: bitcoin.script.compile([
        bitcoin.opcodes.OP_RETURN,
        Buffer.from(data),
      ]),
      value: 0,
    });

    const estimatedSize = psbt.txInputs.length * 148 + psbt.txOutputs.length * 34 + 10; // Approximate calculation
  
    const fee = Math.round(feeRate * estimatedSize);

    const change = totalInput - Number(satoshis) - fee;
    if (change > 0) {
      psbt.addOutput({
        address: sender,
        value: change,
      });
    }

    
  
    return { psbt, fee };
  
  };
