/**
 * Script to check user permissions by email
 * 
 * Usage:
 *   npx tsx scripts/check-user-permissions.ts <email>
 * 
 * Example:
 *   npx tsx scripts/check-user-permissions.ts lvillaroel@arimaconnunitycentre.com
 */

import { storage } from "../server/storage";

async function checkUserPermissions(email: string) {
  try {
    console.log(`Looking up user with email: ${email}...`);
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`\n✅ User found:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Is Admin: ${user.isAdmin ? '✅ Yes' : '❌ No'}`);
    console.log(`   Is Super Admin: ${user.isSuperAdmin ? '✅ Yes' : '❌ No'}`);
    console.log(`   Profile Complete: ${user.profileComplete ? '✅ Yes' : '❌ No'}`);
    
    if (user.permissions) {
      console.log(`   Permissions:`, JSON.stringify(user.permissions, null, 2));
    } else {
      console.log(`   Permissions: None (using default admin permissions)`);
    }
    
    if (user.isSuperAdmin) {
      console.log(`\n🎯 This user HAS super admin permissions`);
    } else if (user.isAdmin) {
      console.log(`\n⚠️  This user is a regular admin (not super admin)`);
    } else {
      console.log(`\n❌ This user does NOT have admin permissions`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

const email = process.argv[2];

if (!email) {
  console.error("Usage: npx tsx scripts/check-user-permissions.ts <email>");
  console.error("Example: npx tsx scripts/check-user-permissions.ts lvillaroel@arimaconnunitycentre.com");
  process.exit(1);
}

checkUserPermissions(email).then(() => {
  process.exit(0);
});

