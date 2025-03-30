class MemoryCache {
  constructor(ttl = 1000 * 60 * 5) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Set a key-value pair in the cache with an optional expiration time (in ms).
   * @param {string} key - The cache key.
   * @param {*} value - The value to cache.
   * @param {number} [ttl] - Time-to-live in milliseconds.
   */
  set(key, value, ttl) {
    const entry = { value, expiry: Date.now() + (ttl || this.ttl) };
    this.cache.set(key, entry);
  }

  /**
   * Get a value from the cache.
   * @param {string} key - The cache key.
   * @returns {*} The cached value, or undefined if not found or expired.
   */
  get(key, defaulv = null) {
    const entry = this.cache.get(key);
    if (!entry) return defaulv;

    // Check for expiration
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return defaulv;
    }
    return entry.value;
  }

  /**
   * Delete a key from the cache.
   * @param {string} key - The cache key.
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache.
   */
  clear() {
    this.cache.clear();
  }

  wrap(fn) {
    return async (...args) => {
      const key = fn.name + JSON.stringify(args);
      const value = this.get(key);
      if (value) return value;
      const result = await fn(...args);
      this.set(key, result);
      return result;
    };
  }
}

module.exports = { MemoryCache };
