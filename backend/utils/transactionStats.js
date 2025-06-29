const _ = require("lodash");
const { getConstants } = require("../constants");
const { getPrice } = require("../coin");
const { MemoryCache } = require("../cache");

const cache = new MemoryCache();

function toNumber(v) {
  return Number(v || 0);
}

const getTransactionsAndComputeStats = async (near, deposits, redemptions) => {
  const { DEPOSIT_STATUS, REDEMPTION_STATUS } = getConstants();

  const depositedStats = deposits
    .filter((deposit) =>
      [DEPOSIT_STATUS.DEP_BTC_DEPOSITED_INTO_ATLAS].includes(deposit.status),
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
  const nearPriceBtc = await cache.wrap(getPrice)("near", "btc");
  const polPriceUsd = await cache.wrap(getPrice)("polygon", "usd");

  const tvl = (btcPrice * btcStaked) / 1e8;

  const balances = await near.getBalances();

  return {
    btc_staked: btcStaked,
    tvl: tvl,
    atbtc_minted: _.sum(Object.values(balances)),
    metadata: {
      btc_price_usd: btcPrice,
      eth_price_btc: ethPriceBtc,
      eth_price_usd: ethPriceUsd,
      near_price_usd: nearPriceUsd,
      near_price_btc: nearPriceBtc,
      pol_price_usd: polPriceUsd,
      deposits: { count: deposits.length },
      redemptions: { count: redemptions.length },
    },
  };
};

module.exports = { getTransactionsAndComputeStats };
