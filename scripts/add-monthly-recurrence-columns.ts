import { db } from "../server/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log("Adding monthly recurrence columns to bookings table...");
    
    const sqlContent = fs.readFileSync(
      path.join(__dirname, "add-monthly-recurrence-columns.sql"),
      "utf-8"
    );
    
    await db.execute(sql.raw(sqlContent));
    
    console.log("✓ Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

