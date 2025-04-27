const { Router } = require("express");
const verifySignature = require("../utils/verifySignature");
const { getConstants } = require("../constants");

module.exports = (near, bitcoin) => {
  const router = Router();

  router.post("/retry", async (req, res, next) => {
    try {
      const data = { ...req.body };
      const ok = await verifySignature(data);
      if (!ok) {
        return res.status(400).json({ error: "Invalid signature" });
      }

      const deposit = await near.getDepositByBtcTxnHash(data.btcTxnHash);
      if (!deposit) {
        return res.status(404).json({ error: "Deposit not found" });
      }

      const isSender = deposit.btc_sender_address === data.address;
      if (!isSender) {
        return res.status(400).json({
          error: "Invalid sender address",
          expected: deposit.btc_sender_address,
          actual: data.address,
        });
      }

      const { DEPOSIT_STATUS } = getConstants();

      const hasError = Boolean(deposit.remarks);
      const isInRetryStatus = [
        DEPOSIT_STATUS.BTC_DEPOSITED_INTO_ATLAS,
        DEPOSIT_STATUS.BTC_PENDING_YIELD_PROVIDER_DEPOSIT,
      ].includes(deposit.status);
      const allow = hasError && isInRetryStatus;
      if (!allow) {
        return res.status(400).json({
          error: "Deposit is not allowed to retry",
          deposit,
          has_error: hasError,
          is_in_retry_status: isInRetryStatus,
        });
      }

      await near.rollbackDepositStatusByBtcTxnHash({
        btc_txn_hash: data.btcTxnHash,
      });
      const updated = await near.getDepositByBtcTxnHash(data.btcTxnHash);
      return res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
