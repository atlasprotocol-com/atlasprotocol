const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, "../data/onboarding.db");
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Ensure the data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(
          `
                    CREATE TABLE IF NOT EXISTS onboarding (
                        wallet_address TEXT PRIMARY KEY,
                        status TEXT NOT NULL,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            this.initialized = true;
            resolve();
          },
        );
      });
    });
  }

  async updateOnboardingStatus(walletAddress, status) {
    await this.init();

    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(
        `INSERT INTO onboarding (wallet_address, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(wallet_address) DO UPDATE SET
                 status = excluded.status,
                 updated_at = excluded.updated_at`,
        [walletAddress, status, now, now],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(true);
        },
      );
    });
  }

  async getOnboardingStatus(walletAddress) {
    await this.init();

    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT wallet_address, status, created_at, updated_at FROM onboarding WHERE wallet_address = ?",
        [walletAddress],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row || null);
        },
      );
    });
  }
}

module.exports = new DatabaseService();
