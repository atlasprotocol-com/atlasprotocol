import { network } from "@/config/network.config";
import metamaskIcon from "./icons/metamask.png";
import okxIcon from "./icons/okx.svg";
import rabbyIcon from "./icons/rabby.png";
import { OKXWallet, okxProvider } from "./providers/okx_wallet";
import { Network } from "./wallet_provider";

interface IntegratedWallet {
  name: string;
  icon: string;
  wallet: any;
  linkToDocs: string;
  provider?: string;
  isQRWallet?: boolean;
  supportedNetworks?: Network[];
}

// Special case for the browser wallet. i.e injected wallet
export const BROWSER_INJECTED_WALLET_NAME = "Browser";

export const walletList: IntegratedWallet[] = [
  {
    name: "OKX",
    icon: okxIcon,
    wallet: OKXWallet,
    provider: okxProvider,
    linkToDocs: "https://www.okx.com/web3",
    supportedNetworks: [Network.MAINNET, Network.SIGNET, Network.TESTNET],
  },
  // {
  //   name: BROWSER_INJECTED_WALLET_NAME,
  //   icon: "",
  //   wallet: "",
  //   provider: "",
  //   linkToDocs: "",
  //   supportedNetworks: [Network.MAINNET, Network.SIGNET],
  // },
  // {
  //   name: "Tomo",
  //   icon: tomoIcon,
  //   wallet: TomoWallet,
  //   provider: tomoProvider,
  //   linkToDocs: "https://tomo.inc/",
  //   supportedNetworks: [Network.MAINNET, Network.SIGNET],
  // },
  // {
  //   name: "OneKey",
  //   icon: oneKeyIcon,
  //   wallet: OneKeyWallet,
  //   provider: oneKeyProvider,
  //   linkToDocs: "https://onekey.so/download",
  //   supportedNetworks: [Network.MAINNET, Network.SIGNET],
  // },
  // {
  //   name: "Bitget Wallet",
  //   icon: bitgetWalletIcon,
  //   wallet: BitgetWallet,
  //   provider: bitgetWalletProvider,
  //   linkToDocs: "https://web3.bitget.com",
  //   supportedNetworks: [Network.MAINNET, Network.SIGNET],
  // },
  // {
  //   name: "Keystone",
  //   icon: keystoneIcon,
  //   wallet: KeystoneWallet,
  //   linkToDocs: "https://www.keyst.one/btc-only",
  //   isQRWallet: true,
  //   supportedNetworks: [Network.MAINNET, Network.SIGNET],
  // },
];

export const evmWalletList = [
  {
    id: "metamask",
    title: "MetaMask",
    icon: metamaskIcon,
    get installed() {
      return isMetamaskInstalled();
    },
    downloadLink: "https://metamask.io/download/",
  },
  {
    id: "okx",
    title: "OKX Wallet",
    icon: okxIcon,
    get installed() {
      return typeof window !== "undefined" && Boolean(window.okxwallet);
    },
    downloadLink:
      "https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge",
  },
  {
    id: "rabby",
    title: "Rabby Wallet",
    icon: rabbyIcon,
    get installed() {
      return (
        typeof window !== "undefined" &&
        Boolean((window.ethereum as any)?.isRabby)
      );
    },
    downloadLink:
      "https://chrome.google.com/webstore/detail/rabby/acmacodkjbdgmoleebolmdjonilkdbch",
  },
];

const isMetamaskInstalled = () => {
  if (typeof window === "undefined") {
    return false;
  }

  let otherWalletAvailable = false;

  evmWalletList.map((wallet) => {
    if (wallet.id !== "metamask") {
      if (wallet.installed) {
        otherWalletAvailable = true;
      }
    }
  });

  if (otherWalletAvailable) {
    return false;
  }

  if (window.ethereum?.isMetaMask) {
    return true;
  }

  if ((window.ethereum as any)?.providers?.some((p: any) => p.isMetaMask)) {
    return true;
  }

  return false;
};