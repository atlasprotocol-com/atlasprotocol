// wallet selector
import "@near-wallet-selector/modal-ui/styles.css";

import { setupBitteWallet } from "@near-wallet-selector/bitte-wallet";
import {
  setupWalletSelector,
  WalletModuleFactory,
  WalletSelector,
} from "@near-wallet-selector/core";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupLedger } from "@near-wallet-selector/ledger";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import {
  setupModal,
  WalletSelectorModal,
} from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
// near api js
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyPair, providers, utils } from "near-api-js";
import { createContext, useContext } from "react";
import { formatUnits } from "viem";

const THIRTY_TGAS = "30000000000000";
const NO_DEPOSIT = "0";

interface WalletOptions {
  networkId?: string;
  createAccessKeyFor?: string;
}

export class Wallet {
  private createAccessKeyFor?: string;
  private networkId: string;
  private selector?: Promise<WalletSelector>;

  /**
   * @constructor
   * @param {WalletOptions} options - the options for the wallet
   * @param {string} [options.networkId] - the network id to connect to
   * @param {string} [options.createAccessKeyFor] - the contract to create an access key for
   * @example
   * const wallet = new Wallet({ networkId: 'testnet', createAccessKeyFor: 'contractId' });
   * wallet.startUp((signedAccountId) => console.log(signedAccountId));
   */
  constructor({
    networkId = "testnet",
    createAccessKeyFor,
  }: WalletOptions = {}) {
    this.createAccessKeyFor = createAccessKeyFor;
    this.networkId = networkId;
  }

  /**
   * To be called when the website loads
   * @param {Function} accountChangeHook - a function that is called when the user signs in or out
   * @returns {Promise<string>} - the accountId of the signed-in user
   */
  startUp = async (
    accountChangeHook: (accountId: string) => void,
  ): Promise<string> => {
    this.selector = setupWalletSelector({
      network: this.networkId as any,
      modules: [
        setupMyNearWallet() as WalletModuleFactory,
        setupHereWallet() as WalletModuleFactory,
        setupLedger() as WalletModuleFactory,
        setupMeteorWallet() as WalletModuleFactory,
        setupSender() as WalletModuleFactory,
        setupBitteWallet() as WalletModuleFactory,
        // setupEthereumWallets({ wagmiConfig, web3Modal, alwaysOnboardDuringSignIn: true }),
      ],
    });

    const walletSelector = await this.selector;
    const isSignedIn = walletSelector.isSignedIn();
    const accountId = isSignedIn
      ? walletSelector.store.getState().accounts[0].accountId
      : "";

    walletSelector.store.observable.subscribe(async (state) => {
      const signedAccount = state?.accounts.find(
        (account) => account.active,
      )?.accountId;
      accountChangeHook(signedAccount || "");
    });

    return accountId;
  };

  /**
   * Displays a modal to login the user
   */
  signIn = async (): Promise<void> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }

    const modal: WalletSelectorModal = setupModal(
      (await this.selector) as any,
      {
        contractId: this.createAccessKeyFor || "",
      },
    );
    modal.show();
  };

  /**
   * Logout the user
   */
  signOut = async (): Promise<void> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }
    const selectedWallet = await (await this.selector).wallet();
    selectedWallet.signOut();
  };

  /**
   * Makes a read-only call to a contract
   * @param {Object} options - the options for the call
   * @param {string} options.contractId - the contract's account id
   * @param {string} options.method - the method to call
   * @param {Object} options.args - the arguments to pass to the method
   * @returns {Promise<any>} - the result of the method call
   */
  viewMethod = async <T = any>({
    contractId,
    method,
    args = {},
  }: {
    contractId: string;
    method: string;
    args?: Record<string, any>;
  }): Promise<any> => {
    const url = `https://rpc.${this.networkId}.near.org`;
    const provider = new providers.JsonRpcProvider({ url });

    const res: any = await provider.query({
      request_type: "call_function",
      account_id: contractId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      finality: "optimistic",
    });
    return JSON.parse(Buffer.from(res.result).toString()) as T;
  };

  /**
   * Makes a call to a contract
   * @param {Object} options - the options for the call
   * @param {string} options.contractId - the contract's account id
   * @param {string} options.method - the method to call
   * @param {Object} options.args - the arguments to pass to the method
   * @param {string} options.gas - the amount of gas to use
   * @param {string} options.deposit - the amount of yoctoNEAR to deposit
   * @returns {Promise<any>} - the resulting transaction
   */
  callMethod = async ({
    contractId,
    method,
    args = {},
    gas = THIRTY_TGAS,
    deposit = NO_DEPOSIT,
  }: {
    contractId: string;
    method: string;
    args?: Record<string, any>;
    gas?: string;
    deposit?: string;
  }): Promise<any> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }
    // Sign a transaction with the "FunctionCall" action
    const selectedWallet = await (await this.selector).wallet();
    const outcome = await selectedWallet.signAndSendTransaction({
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: method,
            args,
            gas,
            deposit,
          },
        },
      ],
    });

    return providers.getTransactionLastResult(outcome as any);
  };

  /**
   * Makes a call to a contract
   * @param {string} txhash - the transaction hash
   * @returns {Promise<any>} - the result of the transaction
   */
  getTransactionResult = async (txhash: string): Promise<any> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }
    const walletSelector = await this.selector;
    const { network } = walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    // Retrieve transaction result from the network
    const transaction = await provider.txStatus(txhash, "unused");
    return providers.getTransactionLastResult(transaction);
  };

  /**
   * Gets the balance of an account
   * @param {string} accountId - the account id to get the balance of
   * @returns {Promise<number>} - the balance of the account
   */
  getBalance = async (accountId: string): Promise<number> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }
    const walletSelector = await this.selector;
    const { network } = walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    // Retrieve account state from the network
    const account: any = await provider.query({
      request_type: "view_account",
      account_id: accountId,
      finality: "final",
    });
    // return amount on NEAR
    return account.amount
      ? Number(utils.format.formatNearAmount(account.amount))
      : 0;
  };

  /**
   * Signs and sends transactions
   * @param {Object[]} transactions - the transactions to sign and send
   * @returns {Promise<any[]>} - the resulting transactions
   */
  signAndSendTransactions = async ({
    transactions,
  }: {
    transactions: any[];
  }): Promise<any[]> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }
    const selectedWallet = await (await this.selector).wallet();
    return selectedWallet.signAndSendTransactions({ transactions }) as any;
  };

  /**
   * Gets the access keys for an account
   * @param {string} accountId
   * @returns {Promise<KeyPair[]>} - the access keys for the account
   */
  getAccessKeys = async (accountId: string): Promise<KeyPair[]> => {
    if (!this.selector) {
      throw new Error("Wallet selector not initialized");
    }
    const walletSelector = await this.selector;
    const { network } = walletSelector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });

    // Retrieve access keys from the network
    const keys: any = await provider.query({
      request_type: "view_access_key_list",
      account_id: accountId,
      finality: "final",
    });
    return keys.keys;
  };
}

/**
 * @typedef NearContext
 * @property {Wallet} wallet Current wallet
 * @property {string} signedAccountId The AccountId of the signed user
 */

/** @type {import ('react').Context<NearContext>} */
export const NearContext = createContext<{
  wallet?: Wallet;
  signedAccountId: string;
}>({
  wallet: undefined,
  signedAccountId: "",
});

export interface NearTokenMetadata {
  decimals: number;
  icon: string;
  name: string;
  symbol: string;
}

export function useNearTokenBalance({
  tokenContract,
}: {
  tokenContract?: string;
}) {
  const { signedAccountId, wallet } = useContext(NearContext);
  return useQuery({
    queryKey: ["near-token-balance", tokenContract, signedAccountId],
    queryFn: async () => {
      if (!tokenContract || !wallet) return undefined;

      const [result, metadata] = await Promise.all([
        wallet.viewMethod({
          contractId: tokenContract,
          method: "ft_balance_of",
          args: { account_id: signedAccountId },
        }),
        wallet.viewMethod<NearTokenMetadata>({
          contractId: tokenContract,
          method: "ft_metadata",
          args: {},
        }),
      ]);

      const returnResult = {
        value: BigInt(result),
        formatted: formatUnits(result, metadata.decimals),
      };

      return returnResult;
    },
    enabled: !!tokenContract && !!signedAccountId,
  });
}

export function useNearAbtcBridge({ contract }: { contract?: string } = {}) {
  const { wallet } = useContext(NearContext);

  return useMutation({
    mutationFn: async ({
      destinationAddress,
      destinationChain,
      amount,
    }: {
      destinationAddress: string;
      destinationChain: string;
      amount: string;
    }) => {
      if (!contract || !wallet) return undefined;

      const result = await wallet.callMethod({
        contractId: contract,
        method: "burn_bridge",
        args: {
          dest_chain_id: destinationChain,
          amount,
          dest_chain_address: destinationAddress,
        },
      });

      return result;
    },
  });
}

export function useNearAbtcBurnRedeem({
  contract,
}: { contract?: string } = {}) {
  const { wallet } = useContext(NearContext);

  return useMutation({
    mutationFn: async ({
      btcAddress,
      amount,
    }: {
      btcAddress: string;
      amount: string;
    }) => {
      if (!contract || !wallet) return undefined;

      const result = await wallet.callMethod({
        contractId: contract,
        method: "burn_redeem",
        args: {
          amount,
          btc_address: btcAddress,
        },
      });

      return result;
    },
  });
}
