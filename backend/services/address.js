// NEAR account IDs must be between 2 and 64 characters long.
// Valid characters are a-z, 0-9, and -_. (with some restrictions on placement).
// NEAR account IDs should not start or end with special characters (-, _, or .).
// The @ symbol is used in implicit accounts and should be validated accordingly.
const isValidNearAddress = (address) => {
  if (!address) return false;
  const nearRegex = /^(?=.{2,64}$)([a-z0-9]+([-_.][a-z0-9]+)*)$/;
  return nearRegex.test(address);
};

// Ethereum addresses are 42 characters long, starting with 0x.
// The rest of the address is a 40-character hexadecimal string (0-9, a-f, or A-F).
// Ethereum addresses are case-insensitive but may use checksum encoding (mixed-case).
const isValidEthereumAddress = (address) => {
  if (!address) return false;
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethRegex.test(address);
};

// P2PKH (Pay-to-PubKey-Hash):
//    These addresses start with a 1.
//    Length is typically 26 to 35 characters.
//    They consist of base58 characters ([1-9A-HJ-NP-Za-km-z]).
// P2SH (Pay-to-Script-Hash):
//    These addresses start with a 3.
//    Length is typically 26 to 35 characters.
//    They also consist of base58 characters.
// Bech32 (SegWit):
//    These addresses start with bc1.
//    They consist of lowercase alphanumeric characters.
//    Length is typically 42 to 62 characters.
const isValidBTCAddress = (address) => {
  if (!address) return false;
  const btcP2PKH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // P2PKH (starts with 1) or P2SH (starts with 3)
  const btcBech32 = /^(bc1|tb1)[a-z0-9]{39,59}$/; // Bech32 (mainnet: bc1, testnet: tb1)

  return btcP2PKH.test(address) || btcBech32.test(address);
};
module.exports = {
  isValidNearAddress,
  isValidEthereumAddress,
  isValidBTCAddress,
};
