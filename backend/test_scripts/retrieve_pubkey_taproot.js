const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
bitcoin.initEccLib(ecc);

// Network configuration (Mainnet or Testnet)
const network = bitcoin.networks.testnet; // Change to `bitcoin.networks.bitcoin` for mainnet

// Example Taproot address (Testnet)
const taprootAddress = 'tb1pvh6gp5a5y75pd5cjug6jnjtt4ydzxy9lq4xuln9hhlx6h2z5rwcq5slw9g';

try {
    // Decode the Taproot address to get the witness program
    const { data: witnessProgram, version } = bitcoin.address.fromBech32(taprootAddress);

    // For Taproot (witness v1), the witness program is the 32-byte public key
    if (version !== 1) {
        throw new Error('Not a Taproot address (witness version is not 1)');
    }

    if (witnessProgram.length !== 32) {
        throw new Error('Invalid Taproot witness program length - must be 32 bytes');
    }

    // Convert to compressed pubkey format used by Unisat (adding '03' prefix)
    const pubkey = '03' + witnessProgram.toString('hex');
    console.log('Taproot Public Key (Unisat format):', pubkey);

} catch (error) {
    console.error('Error decoding Taproot address:', error.message);
    process.exit(1);
}
