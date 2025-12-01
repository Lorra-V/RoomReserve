/**
 * Script to run the database migration for super admin features
 * 
 * Usage:
 *   npx tsx scripts/run-migration.ts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL must be set");
  console.error("   Please set it in your environment or use start-dev.ps1");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrationSQL = `
-- Add isSuperAdmin column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Add permissions column (JSONB for flexible permission storage)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Create an index on is_super_admin for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin);

-- Create an index on is_admin for faster queries (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
`;

async function runMigration() {
  try {
    console.log("🔄 Running database migration...");
    console.log("   Adding is_super_admin column...");
    console.log("   Adding permissions column...");
    console.log("   Creating indexes...");
    
    await pool.query(migrationSQL);
    
    console.log("✅ Migration completed successfully!");
    console.log("   - Added is_super_admin column");
    console.log("   - Added permissions column");
    console.log("   - Created indexes");
    
    // Verify the migration
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('is_super_admin', 'permissions')
      ORDER BY column_name;
    `);
    
    if (result.rows.length === 2) {
      console.log("\n✅ Verification: Both columns exist in the database");
      result.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log("\n⚠️  Warning: Could not verify all columns were added");
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    if (error.code === '42701') {
      console.error("   Note: Column already exists (this is okay)");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
