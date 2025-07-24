const { google } = require("googleapis");
const path = require("path");

class GoogleSheetsService {
  constructor() {
    this.sheetId = "1YrjGvYB9nfNlYlZBxJLsDyZC2hX9wyB2SbMtYnV9Czc";
    this.auth = null;
    this.sheets = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const credentialsPath =
      process.env.GOOGLE_SHEETS_CREDENTIALS ||
      path.join(__dirname, "../credentials/google-sa.json");
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.auth = auth;
    this.sheets = google.sheets({ version: "v4", auth });
    this.initialized = true;
  }

  async findEmail(email) {
    await this.init();

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: "Sheet1!A:B", // Assuming email is in column A and status in column B
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex((row) => row[0] === email);

      if (rowIndex === -1) return null;

      return {
        email: rows[rowIndex][0],
        status: rows[rowIndex][1] || "",
        rowIndex: rowIndex + 1, // Adding 1 because spreadsheet rows are 1-based
      };
    } catch (error) {
      console.error("Error finding email:", error);
      throw error;
    }
  }

  async insertEmail(email) {
    await this.init();

    try {
      const existing = await this.findEmail(email);
      if (existing) return false; // Email already exists

      await this.sheets.spreadsheets.values
        .append({
          spreadsheetId: this.sheetId,
          range: "Sheet1!A:B",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: {
            values: [[email, ""]], // Empty status
          },
        })
        .then((value) => {
          console.log("Email inserted:", JSON.stringify(value.data, null, 2));
        });

      return true;
    } catch (error) {
      console.error("Error inserting email:", error);
      throw error;
    }
  }

  async updateOnboardingStatus(email, status) {
    await this.init();

    try {
      let record = await this.findEmail(email);

      if (!record) {
        // Insert new record if email doesn't exist
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range: "Sheet1!A:B",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: {
            values: [[email, status]],
          },
        });
        return true;
      }

      // Update existing record
      await this.sheets.spreadsheets.values
        .update({
          spreadsheetId: this.sheetId,
          range: `Sheet1!B${record.rowIndex}`,
          valueInputOption: "RAW",
          resource: {
            values: [[status]],
          },
        })
        .then((value) => {
          console.log("Email inserted:", JSON.stringify(value.data, null, 2));
        });

      return true;
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      throw error;
    }
  }

  async getOnboardingStatus(email) {
    await this.init();

    try {
      const record = await this.findEmail(email);
      if (!record) return null;

      return {
        email: record.email,
        status: record.status || "",
      };
    } catch (error) {
      console.error("Error getting onboarding status:", error);
      throw error;
    }
  }
}

module.exports = new GoogleSheetsService();
