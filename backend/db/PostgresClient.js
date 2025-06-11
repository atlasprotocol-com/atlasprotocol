require('dotenv').config();
const { Client } = require('pg');

class PostgresClient {
  constructor() {
    this.schema = process.env.PGSCHEMA || 'public'; // fallback to public if not set
    this.client = new Client({
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
    });
    this.connected = false;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      await this.client.query(`SET search_path TO ${this.schema}`);
      this.connected = true;
    }
  }

  async query(sql, params) {
    await this.connect();
    return this.client.query(sql, params);
  }

  async disconnect() {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }
}

module.exports = PostgresClient; 