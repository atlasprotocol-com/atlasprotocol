const { KeyPair } = require("near-api-js");

class NearKeyManager {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
  }

  initializeKeys(accessKeys) {
    if (!Array.isArray(accessKeys)) {
      throw new Error('accessKeys must be an array');
    }

    this.keys = accessKeys.map((key) => {
      console.log('[KeyManager] Processing key:', {
        public_key: key.public_key,
        has_secret_key: !!key.secret_key,
        nonce: key.access_key?.nonce?.toString() || '0'
      });

      return {
        public_key: key.public_key,
        secret_key: key.secret_key,
        nonce: key.access_key?.nonce || 0,
        lastUsed: 0,
      };
    });

    console.log(`[KeyManager] Initialized with ${this.keys.length} keys`);
    this.keys.forEach((key, index) => {
      console.log(`[KeyManager] Key ${index}: ${key.public_key}`);
    });
  }

  getNextKey() {
    if (this.keys.length === 0) {
      throw new Error("No keys available");
    }

    const key = this.keys[this.currentIndex];
    if (!key || !key.public_key || !key.secret_key) {
      console.error('[KeyManager] Invalid key at index', this.currentIndex, {
        public_key: key?.public_key,
        has_secret_key: !!key?.secret_key,
        nonce: key?.nonce?.toString()
      });
      throw new Error(`Invalid key at index ${this.currentIndex}`);
    }

    console.log(`[KeyManager] Using key at index ${this.currentIndex}:`, {
      public_key: key.public_key,
      has_secret_key: !!key.secret_key,
      nonce: key.nonce.toString()
    });
    
    // Move to next key
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    
    return key;
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