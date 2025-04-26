const bitcorelib = require("bitcore-lib");
const bitcoinMessage = require("bitcoinjs-message");

async function unisat(data) {
  const message = new bitcorelib.Message(data.message);
  const signature = bitcorelib.crypto.Signature.fromCompact(
    Buffer.from(data.signature, "base64"),
  );
  const hash = message.magicHash();
  // recover the public key
  const ecdsa = new bitcorelib.crypto.ECDSA();
  ecdsa.hashbuf = hash;
  ecdsa.sig = signature;
  const pubkeyInSig = ecdsa.toPublicKey();
  const pubkeyInSigString = new bitcorelib.PublicKey(
    Object.assign({}, pubkeyInSig.toObject(), { compressed: true }),
  ).toString();
  if (pubkeyInSigString != data.publicKey) {
    return false;
  }
  return bitcorelib.crypto.ECDSA.verify(hash, signature, pubkeyInSig);
}

async function xverse(data) {
  return bitcoinMessage.verify(data.message, data.address, data.signature);
}

function validate(data) {
  if (!data) {
    throw new Error("No data provided");
  }
  if (!data.id) {
    throw new Error("No id provided");
  }
  if (!data.publicKey) {
    throw new Error("No publicKey provided");
  }
  if (!data.address) {
    throw new Error("No address provided");
  }
  if (!data.btcTxnHash) {
    throw new Error("No btcTxnHash provided");
  }
  if (!data.message) {
    throw new Error("No message provided");
  }
  if (!data.signature) {
    throw new Error("No signature provided");
  }
  if (data.id !== "unisat" && data.id !== "xverse") {
    throw new Error("Invalid id provided");
  }
}

async function verify(data) {
  validate(data);
  if (data.id === "unisat") {
    return unisat(data);
  } else if (data.id === "xverse") {
    return xverse(data);
  }
  throw new Error("Invalid id provided");
}

module.exports = verify;
