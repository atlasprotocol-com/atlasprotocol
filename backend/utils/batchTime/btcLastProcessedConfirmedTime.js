const fs = require("fs");
const path = require("path");

// Path to store the last polled time
const btcLastProcessedConfirmedTimeFilePath = path.join(
  __dirname,
  "btcLastProcessedConfirmedTime.json",
);

// Function to get the last polled time from the JSON file
function getLastProcessedConfirmedTime() {
  try {
    const data = fs.readFileSync(
      btcLastProcessedConfirmedTimeFilePath,
      "utf-8",
    );
    return JSON.parse(data).lastProcessedConfirmedTime || 0;
  } catch (error) {
    console.error("Error reading btcProcessedConfirmedTime:", error);
    return Number(process.env.BTC_LAST_PROCESSED_CONFIRMED_TIME || 0); // Default to 0 if no time is found
  }
}

// Function to update the last polled time in the JSON file
function setLastProcessedConfirmedTime(timestamp) {
  try {
    const data = { lastProcessedConfirmedTime: timestamp };
    fs.writeFileSync(
      btcLastProcessedConfirmedTimeFilePath,
      JSON.stringify(data),
      "utf-8",
    );
    console.log("Updated btcLastProcessedConfirmedTime:", timestamp);
  } catch (error) {
    console.error("Error updating btcLastProcessedConfirmedTime:", error);
  }
}

module.exports = {
  getLastProcessedConfirmedTime,
  setLastProcessedConfirmedTime,
};
