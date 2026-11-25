import "dotenv/config";

import { defineConfig } from "drizzle-kit";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not configured");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",

  out: "./drizzle",

  dialect: "postgresql",

  dbCredentials: {
    url: process.env.TEST_DATABASE_URL,
  },

  strict: true,

  verbose: true,
});
