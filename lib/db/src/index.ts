import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Auto-load .env file if available in process working directory
try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {
  // Environment file absent or already loaded via CLI
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const isSupabaseOrCloud =
  connectionString.includes("supabase.co") ||
  connectionString.includes("pooler.supabase.com") ||
  connectionString.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString,
  ssl: isSupabaseOrCloud ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";

