import { defineConfig } from "drizzle-kit";
import path from "path";

// Auto-load .env file if available in process working directory
try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {
  // Environment file absent or already loaded via CLI
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
