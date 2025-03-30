const CONTRACT_NAME = 'atlasprotocol.almostthere.testnet';

interface Config {
  networkId: string;
  nodeUrl: string;
  walletUrl: string;
  helperUrl: string;
  explorerUrl: string;
  contractName: string;
}

function getConfig(env: 'mainnet' | 'testnet' = 'testnet'): Config {
  switch (env) {
    case 'mainnet':
      return {
        networkId: 'mainnet',
        nodeUrl: 'https://rpc.mainnet.near.org',
        walletUrl: 'https://wallet.mainnet.near.org',
        helperUrl: 'https://helper.mainnet.near.org',
        explorerUrl: 'https://explorer.mainnet.near.org',
        contractName: CONTRACT_NAME,
      };
    case 'testnet':
    default:
      return {
        networkId: 'testnet',
        nodeUrl: 'https://rpc.testnet.fastnear.com',
        walletUrl: 'https://wallet.testnet.near.org',
        helperUrl: 'https://helper.testnet.near.org',
        explorerUrl: 'https://explorer.testnet.near.org',
        contractName: CONTRACT_NAME,
      };
  }
}

export default getConfig;
