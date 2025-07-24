export default function base64ToHex(base64: string) {
  // Decode the Base64 string to a binary string
  const binaryString = atob(base64);

  // Convert the binary string to a hexadecimal string
  let hexString = "";
  for (let i = 0; i < binaryString.length; i++) {
    const hex = binaryString.charCodeAt(i).toString(16);
    hexString += (hex.length === 1 ? "0" : "") + hex;
  }

  return hexString;
}
