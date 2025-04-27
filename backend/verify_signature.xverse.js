const verifySignature = require("./utils/verifySignature");

const data = {
  id: "xverse",
  publicKey: "e32079998927b4e165aeb97b4d266bb1d2754c109a28dde86f375c0a09d813a0",
  address: "tb1q5zr7tp9l28pft9cqu0f76wprzxwx0m0uu65049",
  btcTxnHash:
    "5ccb0bf889b824fb031987c2f4eddb4a679f69ca2714f7bba4c9df1d51cf7d39",
  message:
    "tb1q5zr7tp9l28pft9cqu0f76wprzxwx0m0uu65049,5ccb0bf889b824fb031987c2f4eddb4a679f69ca2714f7bba4c9df1d51cf7d39",
  signature:
    "JwjVW1NpEOgCAwa25gH18SVVPkuBXamh98yU7ZwqE2ubEoDgOuuSBT5XSQ5HjT+0dSINcgMxrzVTyd4/fGx8Fyo=",
};

verifySignature(data).then(console.log).catch(console.error);
