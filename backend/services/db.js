const { Pool } = require("pg");
require("dotenv").config();

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
      const result = await this.pool.query(query, [walletAddress, status]);
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
      const result = await this.pool.query(query, [walletAddress]);
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
