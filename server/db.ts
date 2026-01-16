import { Pool, types } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Ensure timestamp columns are parsed into valid JS Dates.
types.setTypeParser(types.builtins.TIMESTAMP, (value) => {
  if (!value) return null;
  // Postgres TIMESTAMP (no tz) comes as "YYYY-MM-DD HH:MM:SS"
  return new Date(`${value.replace(" ", "T")}Z`);
});
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => {
  if (!value) return null;
  return new Date(value);
});

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
