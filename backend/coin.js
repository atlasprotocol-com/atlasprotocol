const axios = require("axios");

async function getPrice(coin, currency = "usd") {
  const uri = new URL(`https://api.coingecko.com/api/v3/simple/price`);
  uri.searchParams.set("ids", coin);
  uri.searchParams.set("vs_currencies", currency);

  return axios
    .get(uri.toString())
    .then((res) => Number(res.data[coin][currency]) || 0);
}

module.exports = { getPrice };
