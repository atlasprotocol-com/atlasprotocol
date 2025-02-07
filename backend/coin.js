const axios = require("axios");

async function getPrice(coin, currency = "usd") {
  // Convert coin and currency to Binance format
  const coinMap = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'near': 'NEAR'
  };
  const currencyMap = {
    'btc': 'BTC',
    'usd': 'USDT',
    'eth': 'ETH',
    'near': 'NEAR'
  };

  const symbol = `${coinMap[coin]}${currencyMap[currency]}`;
  const uri = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;

  return axios
    .get(uri)
    .then((res) => Number(res.data.price) || 0)
    .catch(() => 0); // Return 0 if error occurs
}

module.exports = { getPrice };
