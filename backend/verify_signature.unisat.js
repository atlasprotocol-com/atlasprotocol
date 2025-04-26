const bitcore_lib_1 = require("bitcore-lib");

function verifyMessage(publicKey, text, sig) {
  const message = new bitcore_lib_1.Message(text);
  var signature = bitcore_lib_1.crypto.Signature.fromCompact(
    Buffer.from(sig, "base64"),
  );
  var hash = message.magicHash();
  // recover the public key
  var ecdsa = new bitcore_lib_1.crypto.ECDSA();
  ecdsa.hashbuf = hash;
  ecdsa.sig = signature;
  const pubkeyInSig = ecdsa.toPublicKey();
  const pubkeyInSigString = new bitcore_lib_1.PublicKey(
    Object.assign({}, pubkeyInSig.toObject(), { compressed: true }),
  ).toString();
  if (pubkeyInSigString != publicKey) {
    return false;
  }
  return bitcore_lib_1.crypto.ECDSA.verify(hash, signature, pubkeyInSig);
}

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

const result = verifyMessage(data.publicKey, data.message, data.signature);
console.log(result);
