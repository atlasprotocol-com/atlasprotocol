const dotenv = require("dotenv");
// Load environment variables from .env.local or .env based on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envFile });
