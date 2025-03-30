const { BorshSchema, borshSerialize, borshDeserialize } = require('borsher');
const zlib = require('zlib');

// Define the schema for our data structure - using minimal field names and optimal types
const schema = BorshSchema.Struct({
    n: BorshSchema.String,  // network -> n
    a: BorshSchema.String,  // address -> a
    1: BorshSchema.u16,  // num1 -> 1
    2: BorshSchema.u16,  // num2 -> 2
    3: BorshSchema.u16,  // num3 -> 3
});

// Data class
class DataMessage {
    constructor(props) {
        this.n = props.n;
        this.a = props.a;
        this[1] = props[1];
        this[2] = props[2];
        this[3] = props[3];
    }
}

// Encoding functions
function encodeData(message) {
    const messageRaw = {
        n: message.n,
        a: message.a,
        1: message[1],
        2: message[2],
        3: message[3],
    };
    const borshEncoded = borshSerialize(schema, messageRaw);
    return zlib.deflateSync(borshEncoded); // Further compress using zlib
}

// Decoding functions
function decodeData(buffer) {
    const decompressed = zlib.inflateSync(buffer); // Decompress first
    const messageRaw = borshDeserialize(schema, decompressed);
    return new DataMessage({
        n: messageRaw.n,
        a: messageRaw.a,
        1: messageRaw[1],
        2: messageRaw[2],
        3: messageRaw[3],
    });
}

// Test the implementation
const testData = new DataMessage({
    n: "NEAR_TESTNET",
    a: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",  // 64 chars
    1: 99999999,
    2: 99999999,
    3: 99999999
});

// Encode
const encoded = encodeData(testData);
console.log('Original data:', testData);
console.log('Encoded size:', encoded.length, 'bytes');
console.log('Encoded buffer:', encoded);

// Decode
const decoded = decodeData(encoded);
console.log('Decoded data:', decoded);
