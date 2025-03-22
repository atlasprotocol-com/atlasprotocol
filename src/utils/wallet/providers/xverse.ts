import Wallet, { AddressPurpose } from "sats-connect";

import {
  getFundingUTXOs,
  getNetworkFees,
  getTipHeight,
  pushTx,
} from "@/utils/mempool_api";

import { Fees, Network, UTXO, WalletProvider } from "../wallet_provider";

export class Xverse extends WalletProvider {
  readonly id = "xverse";
  readonly name: string = "Xverse";
  readonly networks: Network[] = [
    Network.MAINNET,
    Network.TESTNET,
    Network.TESTNET4,
  ];
  public homepage = "https://xverse.io";
  public connected: boolean = false;
  public address?: string;
  public publicKey?: string;
  public network?: Network;

  constructor() {
    super();
  }

  getWalletProviderName = async (): Promise<string> => {
    return "Xverse";
  };

  async connectWallet(): Promise<this> {
    this.connected = false;
    try {
      await Wallet.request("wallet_connect", null);
      this.connected = true;
      return this;
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await Wallet.request("wallet_disconnect", null);
    this.connected = false;
    this.address = undefined;
    this.publicKey = undefined;
    this.network = undefined;
  }

  async getAddress(): Promise<string> {
    const response = await Wallet.request("getAddresses", {
      purposes: [AddressPurpose.Payment],
    });

    return (response as any).result.addresses[0].address;
  }

  async getNetwork(): Promise<Network> {
    const response = await Wallet.request("wallet_getNetwork", null);
    return (
      "" + (response as any).result.bitcoin.name
    ).toLowerCase() as Network;
  }

  async getBalance(): Promise<number> {
    const response = await Wallet.request("getBalance", null);
    return Number((response as any).result.confirmed);
  }

  async getPublicKeyHex(): Promise<string> {
    const response = await Wallet.request("wallet_getAccount", null);
    return (response as any).result.addresses[0].publicKey;
  }

  async signPsbt(psbtHex: string): Promise<string> {
    const response = await Wallet.request("signPsbt", {
      psbt: psbtHex,
      signInputs: {},
    });
    return (response as any).result.psbt;
  }

  async signPsbts(psbtsHexes: string[]): Promise<string[]> {
    const signedPsbts = await Promise.all(
      psbtsHexes.map((psbtHex) => this.signPsbt(psbtHex)),
    );
    return signedPsbts;
  }

  async getUtxos(address: string, amount?: number): Promise<UTXO[]> {
    return await getFundingUTXOs(address, amount);
  }

  getNetworkFees = async (): Promise<Fees> => {
    return await getNetworkFees();
  };

  async pushTx(txHex: string): Promise<string> {
    return await pushTx(txHex);
  }

  async signMessageBIP322(message: string): Promise<string> {
    const response = await Wallet.request("signMessage", {
      address: await this.getAddress(),
      message,
    });

    return (response as any).result.signature;
  }

  getBTCTipHeight = async (): Promise<number> => {
    return await getTipHeight();
  };

  on(eventName: string, callBack: () => void): void {
    if (eventName === "accountChanged") {
      Wallet.addListener("accountChange", callBack);
    } else {
      Wallet.addListener(eventName as any, callBack);
    }
  }
}

export const xverseProvider = "XverseProviders";
