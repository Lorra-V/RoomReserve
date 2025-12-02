import { db } from "../server/db";
import { bookings } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Migration script to update booking status from 'approved' to 'confirmed'
 * This updates existing database records to match the new schema
 */
async function updateApprovedToConfirmed() {
  try {
    console.log("Starting migration: updating 'approved' status to 'confirmed'...");
    
    const result = await db
      .update(bookings)
      .set({ status: "confirmed" })
      .where(eq(bookings.status, "approved"));
    
    console.log("Migration completed successfully!");
    console.log(`Updated records: ${result.rowCount || 0}`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  updateApprovedToConfirmed()
    .then(() => {
      console.log("Migration script finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { updateApprovedToConfirmed };

