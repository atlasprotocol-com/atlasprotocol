const { KeyPair, connect, keyStores, Contract } = require("near-api-js");
const { InMemoryKeyStore } = keyStores;

class NearKeyManager {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.contracts = [];
    this.viewContract = null;
  }

  async initializeKeys(config) {
    // Initialize view contract with main private key
    const viewKeyStore = new InMemoryKeyStore();
    
    const viewKeyPair = KeyPair.fromString(process.env.NEAR_PRIVATE_KEY_0);
    await viewKeyStore.setKey(
      config.network_id,
      config.atlas_account_id,
      viewKeyPair
    );

    const viewConnection = await connect({
      networkId: config.network_id,
      keyStore: viewKeyStore,
      nodeUrl: config.chain_rpc,
    });
    
    const viewAccount = await viewConnection.account(config.atlas_account_id);
    this.viewContract = new Contract(viewAccount, config.contract_id, {
      viewMethods: config.viewMethods,
      changeMethods: config.changeMethods,
    });

    // Initialize change contracts with numbered private keys
    for (let i = 1; i <= 10; i++) {
      const privateKey = process.env[`NEAR_PRIVATE_KEY_${i}`];
      if (!privateKey) {
        console.log(`[KeyManager] No private key found for index ${i}, skipping...`);
        continue;
      }

      const keyStore = new InMemoryKeyStore();
      const keyPair = KeyPair.fromString(privateKey);
      await keyStore.setKey(
        config.network_id,
        config.atlas_account_id,
        keyPair
      );

      const connection = await connect({
        networkId: config.network_id,
        keyStore: keyStore,
        nodeUrl: config.chain_rpc,
      });
      
      const account = await connection.account(config.atlas_account_id);
      const contract = new Contract(account, config.contract_id, {
        viewMethods: config.viewMethods,
        changeMethods: config.changeMethods,
      });

      this.contracts.push(contract);
      this.keys.push({
        public_key: keyPair.getPublicKey().toString()
      });
    }

    console.log(`[KeyManager] Initialized with ${this.keys.length} keys`);
    this.keys.forEach((key, index) => {
      console.log(`[KeyManager] Key ${index + 1}:`, JSON.stringify(key, null, 2));
    });
  }

  getViewContract() {
    if (!this.viewContract) {
      throw new Error("View contract not initialized");
    }
    return this.viewContract;
  }

  getNextContract() {
    if (this.contracts.length === 0) {
      throw new Error("No contracts available");
    }

    const contract = this.contracts[this.currentIndex];
    const key = this.keys[this.currentIndex];
    
    console.log(`[KeyManager] Using contract with key at index ${this.currentIndex}:`, {
      public_key: key.public_key
    });
    
    // Move to next key
    this.currentIndex = (this.currentIndex + 1) % this.contracts.length;
    
    return contract;
  }

  updateNonce(publicKey, newNonce) {
    const key = this.keys.find((k) => k.public_key === publicKey);
    if (key) {
      key.nonce = newNonce;
    }
  }

  getKeyStatistics() {
    return this.keys.map((key) => ({
      public_key: key.public_key,
      nonce: key.nonce.toString(),
      lastUsed: key.lastUsed,
    }));
  }
}

module.exports = NearKeyManager; 