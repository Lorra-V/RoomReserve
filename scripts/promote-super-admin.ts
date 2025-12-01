/**
 * Script to promote a user to super admin by email
 * 
 * Usage:
 *   npx tsx scripts/promote-super-admin.ts <email>
 * 
 * Example:
 *   npx tsx scripts/promote-super-admin.ts lvillaroel@arimacommunitycentre.com
 */

import { storage } from "../server/storage";

async function promoteToSuperAdmin(email: string) {
  try {
    console.log(`Looking up user with email: ${email}...`);
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (${user.id})`);
    
    console.log(`Promoting user to super admin...`);
    const updatedUser = await storage.updateAdminUser(user.id, {
      isAdmin: true,
      isSuperAdmin: true,
      permissions: null,
    });

    if (updatedUser) {
      console.log(`✅ Successfully promoted ${email} to super admin!`);
      console.log(`   User ID: ${updatedUser.id}`);
      console.log(`   Name: ${updatedUser.firstName} ${updatedUser.lastName}`);
      console.log(`   Is Super Admin: ${updatedUser.isSuperAdmin}`);
    } else {
      console.error(`❌ Failed to promote user`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

const email = process.argv[2];

if (!email) {
  console.error("Usage: npx tsx scripts/promote-super-admin.ts <email>");
  console.error("Example: npx tsx scripts/promote-super-admin.ts lvillaroel@arimacommunitycentre.com");
  process.exit(1);
}

promoteToSuperAdmin(email).then(() => {
  process.exit(0);
});

