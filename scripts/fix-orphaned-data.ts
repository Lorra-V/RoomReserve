import { Pool } from "pg";

const ORIGINAL_ORG_ID = "12e5ccce-9802-4390-b7c4-32d365f85cd1";
const DUPLICATE_ORG_ID = "04c5c948-b032-47b8-898c-d73739908594";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    // 1. Show bookings in the duplicate org (to see if any belong to Shadae)
    const dupBookings = await pool.query(
      "SELECT b.id, b.user_id, b.date, b.organization_id, u.email, u.first_name, u.last_name FROM bookings b LEFT JOIN users u ON b.user_id = u.id WHERE b.organization_id = $1",
      [DUPLICATE_ORG_ID]
    );
    console.log("=== Bookings in duplicate org ===");
    console.table(dupBookings.rows);

    // 2. Show users in duplicate org
    const dupUsers = await pool.query(
      "SELECT id, email, first_name, last_name, is_admin, is_super_admin FROM users WHERE organization_id = $1",
      [DUPLICATE_ORG_ID]
    );
    console.log("=== Users in duplicate org ===");
    console.table(dupUsers.rows);

    // 3. Fix orphaned user (Shadae) → assign to original org
    const fixUser = await pool.query(
      "UPDATE users SET organization_id = $1, updated_at = now() WHERE organization_id IS NULL AND is_admin = false RETURNING id, email, first_name, last_name, organization_id",
      [ORIGINAL_ORG_ID]
    );
    console.log("=== Fixed orphaned users ===");
    console.table(fixUser.rows);

    // 4. Move duplicate-org bookings to original org
    const fixBookings = await pool.query(
      "UPDATE bookings SET organization_id = $1, updated_at = now() WHERE organization_id = $2 RETURNING id, user_id, date, organization_id",
      [ORIGINAL_ORG_ID, DUPLICATE_ORG_ID]
    );
    console.log("=== Moved bookings from duplicate to original org ===");
    console.table(fixBookings.rows);

    // 5. Move duplicate-org users to original org
    const fixDupUsers = await pool.query(
      "UPDATE users SET organization_id = $1, updated_at = now() WHERE organization_id = $2 RETURNING id, email, first_name, last_name, organization_id",
      [ORIGINAL_ORG_ID, DUPLICATE_ORG_ID]
    );
    console.log("=== Moved users from duplicate to original org ===");
    console.table(fixDupUsers.rows);

    // 6. Move duplicate-org rooms to original org
    const fixRooms = await pool.query(
      "UPDATE rooms SET organization_id = $1 WHERE organization_id = $2 RETURNING id, name, organization_id",
      [ORIGINAL_ORG_ID, DUPLICATE_ORG_ID]
    );
    console.log("=== Moved rooms from duplicate to original org ===");
    console.table(fixRooms.rows);

    // 7. Move duplicate-org amenities and additional_items
    await pool.query("UPDATE amenities SET organization_id = $1 WHERE organization_id = $2", [ORIGINAL_ORG_ID, DUPLICATE_ORG_ID]);
    await pool.query("UPDATE additional_items SET organization_id = $1 WHERE organization_id = $2", [ORIGINAL_ORG_ID, DUPLICATE_ORG_ID]);

    // 8. Fix site_settings: point duplicate row to original org too
    const fixSettings = await pool.query(
      "UPDATE site_settings SET organization_id = $1, updated_at = now() WHERE organization_id = $2 RETURNING id, centre_name, organization_id",
      [ORIGINAL_ORG_ID, DUPLICATE_ORG_ID]
    );
    console.log("=== Fixed site_settings ===");
    console.table(fixSettings.rows);

    // 9. Delete the duplicate organization (all FKs should be clear now)
    const delOrg = await pool.query(
      "DELETE FROM organizations WHERE id = $1 RETURNING id, name, slug",
      [DUPLICATE_ORG_ID]
    );
    console.log("=== Deleted duplicate organization ===");
    console.table(delOrg.rows);

    // 10. Delete the extra site_settings row (keep only the 'default' one)
    const delSettings = await pool.query(
      "DELETE FROM site_settings WHERE id != 'default' RETURNING id, centre_name"
    );
    console.log("=== Removed extra site_settings rows ===");
    console.table(delSettings.rows);

    // Final verification
    console.log("\n=== VERIFICATION ===");
    const orgs = await pool.query("SELECT id, name, slug FROM organizations");
    console.log("Organizations:");
    console.table(orgs.rows);

    const ss = await pool.query("SELECT id, centre_name, organization_id FROM site_settings");
    console.log("Site Settings:");
    console.table(ss.rows);

    const nullUsers = await pool.query("SELECT id, email FROM users WHERE organization_id IS NULL");
    console.log("Users with NULL org:", nullUsers.rows.length === 0 ? "NONE (good!)" : nullUsers.rows);

    const nullBookings = await pool.query("SELECT id FROM bookings WHERE organization_id IS NULL");
    console.log("Bookings with NULL org:", nullBookings.rows.length === 0 ? "NONE (good!)" : nullBookings.rows);

    console.log("\nAll data has been consolidated into the original ArimaCC organization.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
