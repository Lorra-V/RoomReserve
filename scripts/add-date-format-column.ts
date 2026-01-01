import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addDateFormatColumn() {
  try {
    console.log("Adding date_format column to users table...");
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'dd-MMM-yyyy'
    `);
    console.log("✓ date_format column added successfully");
  } catch (error) {
    console.error("✗ Error adding date_format column:", error);
    throw error;
  }
}

addDateFormatColumn()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
