require("dotenv").config();
const { Pool } = require("pg");
const _ = require("lodash");

class DatabaseService {
  constructor() {
    this.pool = null;
    this.initialized = false;
    this.schemaName = process.env.PGSCHEMA || "public";
  }

  async init() {
    if (this.initialized) return;

    try {
      // Validate required environment variables
      const requiredVars = [
        "PGUSER",
        "PGPASSWORD",
        "PGHOST",
        "PGPORT",
        "PGDATABASE",
      ];
      const missingVars = requiredVars.filter(
        (varName) => !process.env[varName],
      );

      if (missingVars.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missingVars.join(", ")}`,
        );
      }

      // Create a new pool of connections
      this.pool = new Pool({
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT, 10),
        database: process.env.PGDATABASE,
        ...(process.env.PGSCHEMA && { searchPath: process.env.PGSCHEMA }),
      });

      // Test the connection
      await this.pool.query("SELECT NOW()");

      // Create table if not exists
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.schemaName}.onboarding (
          wallet_address TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create table if not exists
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.schemaName}.wallet_maps (
          ref_id TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (ref_id, wallet_address)
        )
      `);

      // Create index if not exists
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_wallet_address ON ${this.schemaName}.wallet_maps (wallet_address); 
      `);

      // Create index if not exists
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ref_id ON ${this.schemaName}.wallet_maps (ref_id); 
      `);

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }

  async updateOnboardingStatus(walletAddress, status) {
    await this.init();
    const query = `
      INSERT INTO ${this.schemaName}.onboarding (wallet_address, status, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (wallet_address) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [
        walletAddress.toLowerCase(),
        status,
      ]);
      return result.rows[0];
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      throw error;
    }
  }

  async getOnboardingStatus(walletAddress) {
    await this.init();
    const query = `
      SELECT wallet_address, status, created_at, updated_at 
      FROM ${this.schemaName}.onboarding 
      WHERE wallet_address = $1
    `;

    try {
      const result = await this.pool.query(query, [
        walletAddress.toLowerCase(),
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      throw error;
    }
  }

  async updateLinkWallet(refId, walletAddress) {
    await this.init();
    const query = `
      INSERT INTO ${this.schemaName}.wallet_maps (ref_id, wallet_address, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (ref_id, wallet_address) 
      DO UPDATE SET 
        updated_at = EXCLUDED.updated_at
      RETURNING *;
    `;

    try {
      const result = await this.pool.query(query, [
        refId.toLowerCase(),
        walletAddress.toLowerCase(),
      ]);
      return result.rows[0];
    } catch (error) {
      console.error("Error updating link wallet:", error);
      throw error;
    }
  }

  async getLinkWalletByWalletAddress(walletAddress) {
    await this.init();
    const query = `
    SELECT * FROM ${this.schemaName}.wallet_maps WHERE ref_id IN (
      SELECT DISTINCT ref_id FROM ${this.schemaName}.wallet_maps WHERE wallet_address = $1
    )
    `;

    try {
      const result = await this.pool.query(query, [
        walletAddress.toLowerCase(),
      ]);
      return result.rows;
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      throw error;
    }
  }

  async getLinkWalletByRefId(refId) {
    await this.init();
    const query = `
    SELECT * FROM ${this.schemaName}.wallet_maps WHERE wallet_address IN (
      SELECT DISTINCT wallet_address FROM ${this.schemaName}.wallet_maps WHERE ref_id = $1
    )
    `;

    try {
      const result = await this.pool.query(query, [refId.toLowerCase()]);
      return result.rows;
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      throw error;
    }
  }

  async getLinkWallets(q) {
    await this.init();
    const recordsByWalletAddress = await this.getLinkWalletByWalletAddress(q);
    const recordsByRefId = await this.getLinkWalletByRefId(q);

    const records = [...recordsByWalletAddress, ...recordsByRefId];
    return _.uniq(records.map((r) => r.wallet_address));
  }
}

module.exports = new DatabaseService();
