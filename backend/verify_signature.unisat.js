const verifySignature = require("./utils/verifySignature");

const data = {
  id: "unisat",
  publicKey:
    "02fd634033277657b632638d2f543214d1c821d606e4476f1848ac94edbf8adab7",
  address: "tb1qx3ekz0xv4h2dxfz23mtujuna25vd2056pfffrk",
  btcTxnHash:
    "700989defa0fd312d9adcc31429065a628d08af5e93273a4195ba5efcb181dd9",
  message:
    "tb1qx3ekz0xv4h2dxfz23mtujuna25vd2056pfffrk,700989defa0fd312d9adcc31429065a628d08af5e93273a4195ba5efcb181dd9",
  signature:
    "IE4/pWWHTtMwHHhwMZdpDrRLPwLsKbP5rEXuYQ3ne/GYIKabWkLNlQih/AVnVYK7TLazUFnN4M+W8cWg6JgfTRs=",
};

verifySignature(data).then(console.log).catch(console.error);
