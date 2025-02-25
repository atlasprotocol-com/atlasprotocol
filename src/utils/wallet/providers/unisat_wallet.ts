import {
  getFundingUTXOs,
  getNetworkFees,
  getTipHeight,
  pushTx,
} from "@/utils/mempool_api";

import { Fees, Network, UTXO, WalletProvider } from "../wallet_provider";

export const unisatProvider = "unisat";

export class UnisatWallet extends WalletProvider {
  readonly id = "unisat";
  readonly name: string = "Unisat";
  readonly networks: Network[] = [Network.MAINNET, Network.TESTNET];
  public homepage = "https://unisat.io";
  public balance: { confirmed: number; unconfirmed: number; total: number } = {
    confirmed: 0,
    unconfirmed: 0,
    total: 0,
  };
  private unisat: any; // Replace with the actual type if available
  public connected: boolean = false;
  public address?: string;
  public publicKey?: string;
  public network?: Network;

  constructor(network: Network) {
    super();
    this.unisat = (window as any).unisat; // Initialize the Unisat wallet instance
  }

  getWalletProviderName = async (): Promise<string> => {
    return "Unisat";
  };

  async connectWallet(): Promise<this> {
    this.connected = false;
    try {
      await this.requestAccounts();
      await this.getCurrentInfo();
      this.connected = true;
      return this;
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.address = undefined;
    this.publicKey = undefined;
    this.connected = false;
    this.balance = { confirmed: 0, unconfirmed: 0, total: 0 };
  }

  on(eventName: string, callBack: () => void): void {
    this.unisat.on(eventName, callBack);
  }

  removeListener(eventName: string, callBack: () => void): void {
    this.unisat.removeListener(eventName, callBack);
  }

  async requestAccounts(): Promise<string[]> {
    return this.unisat.requestAccounts();
  }

  /**
   * Retrieves the public key from the Unisat wallet.
   * @returns Promise that resolves to the public key string.
   */
  async getPublicKey() {
    return this.unisat.getPublicKey();
  }

  async getCurrentInfo(): Promise<void> {
    const accounts = await this.unisat.getAccounts();
    if (accounts.length) {
      this.address = accounts[0];
      const [publicKey, network] = await Promise.all([
        this.getPublicKey(),
        this.getNetwork(),
        this.getBalance(),
      ]);
      this.publicKey = publicKey;
      this.network = network;
    }
  }

  getAddress = async (): Promise<string> => {
    if (!this.address) {
      throw new Error("Unisat Wallet not connected");
    }
    return this.address;
  };

  async getBalance(): Promise<number> {
    const balance = await this.unisat.getBalance();
    this.balance = balance; // Update local balance state
    return balance.total; // Assuming total balance is returned
  }

  async getNetwork(): Promise<Network> {
    return this.unisat.getNetwork();
  }

  async getPublicKeyHex(): Promise<string> {
    return this.unisat.getPublicKey();
  }

  async signPsbt(psbtHex: string): Promise<string> {
    return this.unisat.signPsbt(psbtHex);
  }

  async signPsbts(psbtsHexes: string[]): Promise<string[]> {
    return this.unisat.signPsbts(psbtsHexes);
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
    return this.unisat.signMessage(message);
  }

  getBTCTipHeight = async (): Promise<number> => {
    return await getTipHeight();
  };

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    return this.unisat.sendBitcoin(toAddress, amount);
  }

  // async switchNetwork(network: Network): Promise<void> {
  //   await this.unisat.switchNetwork(getUnisatNetwork(network));
  // }

  // async getInscriptions(
  //   cursor: number,
  //   size: number,
  // ): Promise<UnisatWalletTypes.GetInscriptionsResult> {
  //   return this.unisat.getInscriptions(cursor, size);
  // }
}
