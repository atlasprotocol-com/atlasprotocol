const { Router } = require("express");

const PostgresClient = require("../db/PostgresClient");
const client = new PostgresClient();

module.exports = () => {
  const router = Router();

  router.get("/points", async (req, res) => {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    const values = address.split(",").filter(Boolean);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await client.query(
      `SELECT wallet_address, SUM(points) AS points FROM ${client.schema}.point WHERE wallet_address IN (${placeholders}) GROUP BY wallet_address`,
      values,
    );

    const returning = values.reduce((m, wa) => ({ ...m, [wa]: 0 }), {});

    for (const row of rows) {
      returning[row.wallet_address] += Number(row.points);
    }

    res.json({ data: returning });
  });

  return router;
};
