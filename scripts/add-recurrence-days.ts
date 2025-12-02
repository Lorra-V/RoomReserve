import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL must be set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrationSQL = `
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS recurrence_days TEXT[];

CREATE INDEX IF NOT EXISTS idx_bookings_recurrence_days ON bookings USING GIN (recurrence_days);
`;

async function runMigration() {
  try {
    console.log("🔄 Running migration: adding recurrence_days column...");
    
    await pool.query(migrationSQL);
    
    console.log("✅ Migration completed successfully!");
    console.log("   - Added recurrence_days column");
    console.log("   - Created GIN index");
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

