const { getConstants } = require("../constants");
const { getPrice } = require("../coin");
const { MemoryCache } = require("../cache");

const cache = new MemoryCache();

function toNumber(v) {
  return Number(v || 0);
}

const getTransactionsAndComputeStats = async (
  deposits,
  redemptions,
  btcAtlasDepositAddress,
) => {
  const { DEPOSIT_STATUS, REDEMPTION_STATUS } = getConstants();

  const depositedStats = deposits
    .filter(
      (deposit) =>
        deposit.btc_sender_address !== btcAtlasDepositAddress &&
        deposit.status != DEPOSIT_STATUS.BTC_PENDING_DEPOSIT_MEMPOOL,
    )
    .reduce(
      (sum, deposit) =>
        sum + toNumber(deposit.btc_amount) - toNumber(deposit.protocol_fee),
      0,
    );

  const redeemedStats = redemptions
    .filter((redemption) =>
      [REDEMPTION_STATUS.BTC_REDEEMED_BACK_TO_USER].includes(redemption.status),
    )
    .reduce((sum, redemption) => sum + toNumber(redemption.abtc_amount), 0);

  const btcStaked = depositedStats - redeemedStats;
  const btcPrice = await cache.wrap(getPrice)("bitcoin", "usd");
  const ethPriceBtc = await cache.wrap(getPrice)("ethereum", "btc");
  const ethPriceUsd = await cache.wrap(getPrice)("ethereum", "usd");
  const nearPriceUsd = await cache.wrap(getPrice)("near", "usd");
  const tvl = (btcPrice * btcStaked) / 1e8;

  const atbtcMinted = deposits
    .filter(
      (deposit) =>
        deposit.btc_sender_address === btcAtlasDepositAddress &&
        [DEPOSIT_STATUS.BTC_MINTED_INTO_ABTC].includes(deposit.status),
    )
    .reduce((sum, deposit) => sum + deposit.btc_amount - deposit.protocol_fee - deposit.yield_provider_gas_fee, 0);

  return {
    btc_staked: btcStaked,
    tvl: tvl,
    atbtc_minted: atbtcMinted,
    metadata: {
      btc_price_usd: btcPrice,
      eth_price_btc: ethPriceBtc,
      eth_price_usd: ethPriceUsd,
      near_price_usd: nearPriceUsd,
      deposits: { count: deposits.length },
      redemptions: { count: redemptions.length },
    },
  };
};

module.exports = { getTransactionsAndComputeStats };
