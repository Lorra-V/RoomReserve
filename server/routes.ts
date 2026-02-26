import type { Express } from "express";
import { createServer, type Server } from "http";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import authRoutes from "./routes/auth";
import { attachUser, logAuthContext, requireAuth } from "./middleware/auth";
import { insertRoomSchema, insertBookingSchema, insertSiteSettingsSchema, insertAdditionalItemSchema, insertAmenitySchema, updateUserProfileSchema, organizations, rooms as roomsTable, users as usersTable, siteSettings as siteSettingsTable } from "@shared/schema";
import { sendBookingNotification } from "./emailService";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads (must be before routes that use it)
  const upload = multer({ storage: multer.memoryStorage() });

  app.use("/api/auth", authRoutes);

  // Auth routes - return user data for authenticated users
  app.get("/api/auth/user", logAuthContext, requireAuth, attachUser, async (req: any, res) => {
    try {
      console.log("[Auth User] Returning user", {
        id: req.user?.id,
        email: req.user?.email,
        isAdmin: req.user?.isAdmin,
        isSuperAdmin: req.user?.isSuperAdmin,
        clerkUserId: req.user?.clerkUserId,
      });
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile update route
  app.patch("/api/user/profile", requireAuth, attachUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const result = updateUserProfileSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Profile validation error:", result.error.flatten());
        return res.status(400).json({ message: "Invalid profile data", errors: result.error.flatten() });
      }
      
      const user = await storage.updateUserProfile(userId, result.data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Upload profile image route
  app.post("/api/user/profile/image", requireAuth, attachUser, upload.single("image"), async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      // Convert buffer to base64 data URL
      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Update user profile with image URL
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUserProfile(userId, {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || undefined,
        organization: user.organization || undefined,
        profileImageUrl: dataUrl,
      });

      res.json({ imageUrl: dataUrl, user: updatedUser });
    } catch (error: any) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Admin customers list route
  app.get("/api/admin/customers", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      
      const orgId = getOrgId(req);
      const customers = await storage.getUsers(orgId ?? undefined);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Admin create customer route
  app.post("/api/admin/customers", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { email, firstName, lastName, phone, organization } = req.body;

      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Generate a unique ID for the new user
      const newUserId = `admin_created_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const orgId = getOrgId(req);
      
      const newUser = await storage.upsertUser({
        id: newUserId,
        email,
        firstName,
        lastName,
        phone: phone || null,
        organization: organization || null,
        organizationId: orgId,
        isAdmin: false,
        profileComplete: !!(firstName && lastName && phone),
      });

      res.status(201).json(newUser);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Admin get customer bookings route
  app.get("/api/admin/customers/:id/bookings", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const customerId = req.params.id;
      const orgId = getOrgId(req);
      const customerBookings = await storage.getBookings(customerId, undefined, undefined, orgId ?? undefined);
      res.json(customerBookings);
    } catch (error) {
      console.error("Error fetching customer bookings:", error);
      res.status(500).json({ message: "Failed to fetch customer bookings" });
    }
  });

  // Admin update customer route
  app.patch("/api/admin/customers/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const customerId = req.params.id;
      const { email, firstName, lastName, phone, organization } = req.body;

      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }

      // Get existing user to preserve admin status
      const existingUser = await storage.getUser(customerId);
      if (!existingUser) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Check if email is already taken by another user
      if (email && email !== existingUser.email) {
        const allUsers = await storage.getUsers();
        const emailTaken = allUsers.some(u => u.id !== customerId && u.email === email);
        if (emailTaken) {
          return res.status(409).json({ message: "A user with this email already exists" });
        }
      }

      // Update using upsertUser to handle email updates
      const updatedUser = await storage.upsertUser({
        id: customerId,
        email: email || existingUser.email,
        firstName,
        lastName,
        phone: phone || null,
        organization: organization || null,
        isAdmin: existingUser.isAdmin, // Preserve admin status
        profileComplete: !!(firstName && lastName && phone),
      });

      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  // Super admin delete customer route
  app.delete("/api/admin/customers/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Super admin access required" });
      }

      const customerId = req.params.id;
      const customer = await storage.getUser(customerId);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Prevent deleting admin or super admin users
      if (customer.isAdmin || customer.isSuperAdmin) {
        return res.status(400).json({ message: "Cannot delete admin users. Use Admin Users page to manage admins." });
      }

      await storage.deleteUser(customerId);
      res.json({ message: "Customer deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Helper middleware to check if user is super admin
  const isSuperAdmin = async (req: any, res: any, next: any) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Super admin access required" });
      }
      next();
    } catch (error) {
      console.error("Error checking super admin:", error);
      res.status(500).json({ message: "Failed to verify super admin status" });
    }
  };

  // Helper to get organizationId from the authenticated user.
  // Returns the orgId or null. Routes decide whether null is acceptable.
  const getOrgId = (req: any): string | null => req.user?.organizationId ?? null;

  // Endpoint to promote a user to super admin by email (for initial setup)
  app.post("/api/admin/promote-super-admin", requireAuth, attachUser, async (req: any, res) => {
    try {
      const currentUser = req.user;
      
      // Only allow if current user is already a super admin, or if no super admin exists
      const admins = await storage.getAdmins();
      const hasSuperAdmin = admins.some(a => a.isSuperAdmin);
      
      if (!hasSuperAdmin || currentUser.isSuperAdmin) {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ message: "Email is required" });
        }

        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await storage.updateAdminUser(user.id, {
          isAdmin: true,
          isSuperAdmin: true,
          permissions: null,
        });

        res.json({ message: "User promoted to super admin", user: updatedUser });
      } else {
        return res.status(403).json({ message: "Forbidden: Super admin access required" });
      }
    } catch (error: any) {
      console.error("Error promoting super admin:", error);
      res.status(500).json({ message: "Failed to promote super admin" });
    }
  });

  // Admin management routes - only accessible to super admins
  app.get("/api/admin/admins", requireAuth, attachUser, isSuperAdmin, async (req: any, res) => {
    try {
      const orgId = getOrgId(req);
      const admins = await storage.getAdmins(orgId ?? undefined);
      res.json(admins);
    } catch (error) {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: "Failed to fetch admins" });
    }
  });

  app.post("/api/admin/admins", requireAuth, attachUser, isSuperAdmin, async (req: any, res) => {
    try {
      const { email, isAdmin, isSuperAdmin: isSuper, permissions } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user to admin
      const updatedUser = await storage.updateAdminUser(user.id, {
        isAdmin: isAdmin !== undefined ? isAdmin : true,
        isSuperAdmin: isSuper !== undefined ? isSuper : false,
        permissions: permissions || null,
      });

      res.status(200).json(updatedUser);
    } catch (error: any) {
      console.error("Error creating admin:", error);
      res.status(500).json({ message: "Failed to create admin" });
    }
  });

  app.patch("/api/admin/admins/:id", requireAuth, attachUser, isSuperAdmin, async (req: any, res) => {
    try {
      const adminId = req.params.id;
      const { isAdmin, isSuperAdmin: isSuper, permissions } = req.body;

      // Prevent super admins from demoting themselves
      const currentUserId = req.user.id;
      if (adminId === currentUserId && (isSuper === false || isAdmin === false)) {
        return res.status(400).json({ message: "You cannot demote yourself" });
      }

      const updatedUser = await storage.updateAdminUser(adminId, {
        isAdmin,
        isSuperAdmin: isSuper,
        permissions,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "Admin not found" });
      }

      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating admin:", error);
      res.status(500).json({ message: "Failed to update admin" });
    }
  });

  app.delete("/api/admin/admins/:id", requireAuth, attachUser, isSuperAdmin, async (req: any, res) => {
    try {
      const adminId = req.params.id;
      const currentUserId = req.user.id;

      // Prevent super admins from deleting themselves
      if (adminId === currentUserId) {
        return res.status(400).json({ message: "You cannot remove yourself" });
      }

      // Demote admin to regular user
      const updatedUser = await storage.updateAdminUser(adminId, {
        isAdmin: false,
        isSuperAdmin: false,
        permissions: null,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "Admin not found" });
      }

      res.json({ message: "Admin removed successfully", user: updatedUser });
    } catch (error: any) {
      console.error("Error removing admin:", error);
      res.status(500).json({ message: "Failed to remove admin" });
    }
  });

  // Helper function to parse CSV
  function parseCSV(csvText: string): string[][] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentLine.push(currentField.trim());
        currentField = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentField || currentLine.length > 0) {
          currentLine.push(currentField.trim());
          currentField = "";
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          currentLine = [];
        }
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n after \r
        }
      } else {
        currentField += char;
      }
    }

    // Add last field and line
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  // Import customers endpoint
  app.post("/api/admin/customers/import", requireAuth, attachUser, upload.single("file"), async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      if (!orgId && !user?.isSuperAdmin) {
        return res.status(400).json({ message: "Organization context required. Please ensure your account is associated with an organization." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const rows = parseCSV(csvText);
      
      if (rows.length < 2) {
        return res.status(400).json({ message: "CSV file must have at least a header row and one data row" });
      }

      const headers = rows[0].map((h: string) => h.trim());
      const dataRows = rows.slice(1);

      // Get column mapping from request body
      let columnMapping: Record<string, string> = {};
      if (req.body.columnMapping) {
        try {
          columnMapping = JSON.parse(req.body.columnMapping);
        } catch (e) {
          // If parsing fails, try auto-detection
          const lowerHeaders = headers.map(h => h.toLowerCase());
          const firstNameIdx = lowerHeaders.findIndex((h: string) => h.includes("first") && h.includes("name"));
          const lastNameIdx = lowerHeaders.findIndex((h: string) => h.includes("last") && h.includes("name"));
          const emailIdx = lowerHeaders.findIndex((h: string) => h.includes("email"));
          const phoneIdx = lowerHeaders.findIndex((h: string) => h.includes("phone"));
          const orgIdx = lowerHeaders.findIndex((h: string) => h.includes("organization") || h.includes("org"));

          if (firstNameIdx !== -1) columnMapping["First Name"] = headers[firstNameIdx];
          if (lastNameIdx !== -1) columnMapping["Last Name"] = headers[lastNameIdx];
          if (emailIdx !== -1) columnMapping["Email"] = headers[emailIdx];
          if (phoneIdx !== -1) columnMapping["Phone"] = headers[phoneIdx];
          if (orgIdx !== -1) columnMapping["Organization"] = headers[orgIdx];
        }
      }

      // Get column indices from mapping
      const firstNameIdx = columnMapping["First Name"] ? headers.indexOf(columnMapping["First Name"]) : -1;
      const lastNameIdx = columnMapping["Last Name"] ? headers.indexOf(columnMapping["Last Name"]) : -1;
      const emailIdx = columnMapping["Email"] ? headers.indexOf(columnMapping["Email"]) : -1;
      const phoneIdx = columnMapping["Phone"] ? headers.indexOf(columnMapping["Phone"]) : -1;
      const orgIdx = columnMapping["Organization"] ? headers.indexOf(columnMapping["Organization"]) : -1;

      if (firstNameIdx === -1 || lastNameIdx === -1 || emailIdx === -1) {
        return res.status(400).json({ message: "CSV must contain 'First Name', 'Last Name', and 'Email' columns" });
      }

      const results = {
        created: 0,
        updated: 0,
        errors: [] as Array<{ row: number; error: string }>,
      };

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0 || row.every(cell => !cell || !cell.trim())) continue;

        try {
          const firstName = row[firstNameIdx]?.trim() || "";
          const lastName = row[lastNameIdx]?.trim() || "";
          const email = row[emailIdx]?.trim() || "";
          const phone = phoneIdx !== -1 ? row[phoneIdx]?.trim() || undefined : undefined;
          const organization = orgIdx !== -1 ? row[orgIdx]?.trim() || undefined : undefined;

          if (!firstName || !lastName || !email) {
            results.errors.push({ row: i + 2, error: "Missing required fields (First Name, Last Name, or Email)" });
            continue;
          }

          // Basic email validation
          if (!email.includes("@")) {
            results.errors.push({ row: i + 2, error: "Invalid email format" });
            continue;
          }

          // Check if user exists by email
          const allUsers = await storage.getUsers(orgId ?? undefined);
          const existingUser = allUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());

          if (existingUser) {
            // Update existing user
            await storage.upsertUser({
              id: existingUser.id,
              email,
              firstName,
              lastName,
              phone: phone || null,
              organization: organization || null,
              organizationId: orgId,
              isAdmin: existingUser.isAdmin,
              isSuperAdmin: existingUser.isSuperAdmin,
              profileComplete: !!(firstName && lastName && phone),
            });
            results.updated++;
          } else {
            // Create new user
            await storage.upsertUser({
              id: uuidv4(),
              email,
              firstName,
              lastName,
              phone: phone || null,
              organization: organization || null,
              organizationId: orgId,
              isAdmin: false,
              isSuperAdmin: false,
              profileComplete: !!(firstName && lastName && phone),
            });
            results.created++;
          }
        } catch (error: any) {
          results.errors.push({
            row: i + 2,
            error: error.message || "Failed to process row",
          });
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error importing customers:", error);
      res.status(500).json({ message: "Failed to import customers", error: error.message });
    }
  });

  // Import bookings endpoint
  app.post("/api/admin/bookings/import", requireAuth, attachUser, upload.single("file"), async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const rows = parseCSV(csvText);
      
      if (rows.length < 2) {
        return res.status(400).json({ message: "CSV file must have at least a header row and one data row" });
      }

      const headers = rows[0].map((h: string) => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      // Expected headers: Customer Name/Email, Room Name, Date, Start Time, End Time, Status, Event Name, Purpose, Attendees, Visibility
      const customerNameIdx = headers.findIndex((h: string) => (h.includes("customer") || h.includes("user")) && h.includes("name"));
      const customerEmailIdx = headers.findIndex((h: string) => (h.includes("customer") || h.includes("user")) && h.includes("email"));
      const roomNameIdx = headers.findIndex((h: string) => h.includes("room") && h.includes("name"));
      const dateIdx = headers.findIndex((h: string) => h.includes("date"));
      const startTimeIdx = headers.findIndex((h: string) => h.includes("start") && h.includes("time"));
      const endTimeIdx = headers.findIndex((h: string) => h.includes("end") && h.includes("time"));
      const statusIdx = headers.findIndex((h: string) => h.includes("status"));
      const eventNameIdx = headers.findIndex((h: string) => h.includes("event") && h.includes("name"));
      const purposeIdx = headers.findIndex((h: string) => h.includes("purpose"));
      const attendeesIdx = headers.findIndex((h: string) => h.includes("attendees"));
      const visibilityIdx = headers.findIndex((h: string) => h.includes("visibility"));

      if (roomNameIdx === -1 || dateIdx === -1 || startTimeIdx === -1 || endTimeIdx === -1) {
        return res.status(400).json({ message: "CSV must contain 'Room Name', 'Date', 'Start Time', and 'End Time' columns" });
      }

      const results = {
        created: 0,
        errors: [] as Array<{ row: number; error: string }>,
      };

      // Get all rooms and users for lookup (scoped to org)
      const allRooms = await storage.getRooms(orgId ?? undefined);
      const allUsers = await storage.getUsers(orgId ?? undefined);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row.length === 0) continue;

        try {
          const roomName = row[roomNameIdx]?.trim() || "";
          const dateStr = row[dateIdx]?.trim() || "";
          const startTime = row[startTimeIdx]?.trim() || "";
          const endTime = row[endTimeIdx]?.trim() || "";
          const status = (row[statusIdx]?.trim() || "pending").toLowerCase();
          const eventName = row[eventNameIdx]?.trim() || undefined;
          const purpose = row[purposeIdx]?.trim() || undefined;
          const attendees = row[attendeesIdx] ? parseInt(row[attendeesIdx], 10) : undefined;
          const visibility = (row[visibilityIdx]?.trim() || "private").toLowerCase() as "private" | "public";

          if (!roomName || !dateStr || !startTime || !endTime) {
            results.errors.push({ row: i + 2, error: "Missing required fields (Room Name, Date, Start Time, or End Time)" });
            continue;
          }

          // Find room
          const room = allRooms.find((r) => r.name.toLowerCase() === roomName.toLowerCase());
          if (!room) {
            results.errors.push({ row: i + 2, error: `Room "${roomName}" not found` });
            continue;
          }

          // Find user by email or name
          let bookingUser: typeof allUsers[0] | undefined;
          if (customerEmailIdx !== -1 && row[customerEmailIdx]) {
            bookingUser = allUsers.find((u) => u.email?.toLowerCase() === row[customerEmailIdx].toLowerCase());
          }
          if (!bookingUser && customerNameIdx !== -1 && row[customerNameIdx]) {
            const customerName = row[customerNameIdx].toLowerCase();
            bookingUser = allUsers.find((u) => {
              const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().trim();
              return fullName === customerName || u.firstName?.toLowerCase() === customerName || u.lastName?.toLowerCase() === customerName;
            });
          }
          if (!bookingUser) {
            results.errors.push({ row: i + 2, error: "Customer not found" });
            continue;
          }

          // Parse date
          const bookingDate = new Date(dateStr);
          if (isNaN(bookingDate.valueOf())) {
            results.errors.push({ row: i + 2, error: `Invalid date: ${dateStr}` });
            continue;
          }
          bookingDate.setHours(0, 0, 0, 0);

          // Validate time format
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            results.errors.push({ row: i + 2, error: "Invalid time format. Use HH:MM" });
            continue;
          }

          if (endTime <= startTime) {
            results.errors.push({ row: i + 2, error: "End time must be after start time" });
            continue;
          }

          // Check for conflicts
          const hasConflict = await storage.checkBookingConflict(room.id, bookingDate, startTime, endTime);
          if (hasConflict) {
            results.errors.push({ row: i + 2, error: "Booking conflict: Time slot already booked" });
            continue;
          }

          // Create booking
          const bookingData = {
            roomId: room.id,
            organizationId: orgId,
            date: bookingDate,
            startTime,
            endTime,
            status: (status === "confirmed" || status === "cancelled" ? status : "pending") as "pending" | "confirmed" | "cancelled",
            purpose: purpose || "Booking",
            eventName: eventName || undefined,
            attendees: attendees || 1,
            visibility: (visibility === "public" ? "public" : "private") as "private" | "public",
            isRecurring: false,
            recurrencePattern: null,
            recurrenceEndDate: null,
            parentBookingId: null,
            selectedItems: [],
          };

          await storage.createBooking(bookingData, bookingUser.id);
          results.created++;
        } catch (error: any) {
          results.errors.push({
            row: i + 2,
            error: error.message || "Failed to process row",
          });
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error importing bookings:", error);
      res.status(500).json({ message: "Failed to import bookings", error: error.message });
    }
  });

  // Admin bootstrap route - promotes first authenticated user to admin
  // Only works once when no admin exists (safe for first-time setup)
  app.post("/api/admin/bootstrap", requireAuth, attachUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = req.user;
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Promote this user to admin (transaction handles race conditions)
      const updatedUser = await storage.promoteToAdmin(userId);
      res.json({ message: "Admin access granted", user: updatedUser });
    } catch (error: any) {
      console.error("Error bootstrapping admin:", error);
      if (error.message === "Admin already exists") {
        return res.status(403).json({ message: "Admin already exists. Cannot bootstrap again." });
      }
      res.status(500).json({ message: "Failed to bootstrap admin" });
    }
  });

  // Room routes
  app.get("/api/rooms", async (_req, res) => {
    try {
      const rooms = await storage.getRooms();
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  app.patch("/api/rooms/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      console.log(`Updating room ${req.params.id} with amenities:`, req.body.amenities);
      const room = await storage.updateRoom(req.params.id, req.body);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      console.log(`Room ${req.params.id} updated. Saved amenities:`, room.amenities);
      res.json(room);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  app.delete("/api/rooms/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      await storage.deleteRoom(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ message: "Failed to delete room" });
    }
  });

  // Booking routes
  app.get("/api/bookings", requireAuth, attachUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = req.user;
      const orgId = getOrgId(req);

      // Parse date range - support both date-only (yyyy-MM-dd) and ISO strings
      // Date-only strings avoid timezone mismatches (e.g. Monday in Trinidad ≠ Monday in UTC)
      const fromParam = req.query.fromDate as string | undefined;
      const toParam = req.query.toDate as string | undefined;
      const fromDate = fromParam
        ? new Date(fromParam.trim().slice(0, 10) + "T00:00:00.000Z")
        : undefined;
      const toDate = toParam
        ? new Date(toParam.trim().slice(0, 10) + "T23:59:59.999Z")
        : undefined;
      
      // Admins can see all bookings in their org, users see only their own
      const bookings = user?.isAdmin
        ? await storage.getBookings(undefined, fromDate, toDate, orgId ?? undefined)
        : await storage.getBookings(userId, fromDate, toDate, orgId ?? undefined);
        
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/rooms/:roomId/bookings", async (req, res) => {
    try {
      const { roomId } = req.params;
      const resolveWeekStart = (date: Date) => {
        const start = new Date(date);
        const day = start.getDay();
        const diff = (day + 6) % 7; // Monday as week start
        start.setDate(start.getDate() - diff);
        start.setHours(0, 0, 0, 0);
        return start;
      };
      const today = new Date();
      const defaultFrom = resolveWeekStart(today);
      const defaultTo = (() => {
        const weekEnd = new Date(defaultFrom);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return weekEnd;
      })();

      // Parse date range - support both date-only (yyyy-MM-dd) and ISO strings
      // Date-only avoids timezone mismatches: client in Trinidad sends "2025-02-17"
      // which correctly includes all bookings on that calendar date
      let fromDate: Date;
      let toDate: Date;
      const fromParam = req.query.fromDate as string | undefined;
      const toParam = req.query.toDate as string | undefined;

      if (fromParam && toParam) {
        const fromStr = fromParam.trim().slice(0, 10); // "yyyy-MM-dd"
        const toStr = toParam.trim().slice(0, 10);
        fromDate = new Date(fromStr + "T00:00:00.000Z");
        toDate = new Date(toStr + "T23:59:59.999Z");
      } else {
        fromDate = defaultFrom;
        toDate = defaultTo;
      }
      
      console.log(`[API] Fetching bookings for room ${roomId}:`, {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        fromDateLocal: fromDate.toLocaleString(),
        toDateLocal: toDate.toLocaleString()
      });
      
      const bookings = await storage.getBookingsByRoom(roomId, fromDate, toDate);
      
      console.log(`[API] Found ${bookings.length} bookings for room ${roomId}:`, 
        bookings.map(b => ({
          id: b.id,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status
        }))
      );
      
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching room bookings:", error);
      res.status(500).json({ message: "Failed to fetch room bookings" });
    }
  });

  app.post("/api/bookings", requireAuth, attachUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = getOrgId(req);
      
      console.log("Received booking request:", {
        date: req.body.date,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        roomId: req.body.roomId,
        hasEventName: !!req.body.eventName,
        purpose: req.body.purpose,
        visibility: req.body.visibility,
        isRecurring: req.body.isRecurring,
      });
      
      // Parse and validate the date
      if (!req.body.date) {
        return res.status(400).json({ message: "Date is required" });
      }
      
      const parsedDate = new Date(req.body.date);
      
      // Explicitly check for invalid dates
      if (isNaN(parsedDate.valueOf())) {
        return res.status(400).json({ message: "Invalid date provided" });
      }
      
      // Ensure date is set to start of day in UTC to avoid timezone issues
      parsedDate.setUTCHours(0, 0, 0, 0);
      
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(req.body.startTime) || !timeRegex.test(req.body.endTime)) {
        return res.status(400).json({ message: "Invalid time format. Use HH:MM" });
      }
      
      // Validate end time is after start time
      if (req.body.endTime <= req.body.startTime) {
        return res.status(400).json({ message: "End time must be after start time" });
      }

      // Handle recurring bookings
      const isRecurring = req.body.isRecurring === true;
      const recurrencePattern = req.body.recurrencePattern;
      const recurrenceEndDate = req.body.recurrenceEndDate ? new Date(req.body.recurrenceEndDate) : null;
      const recurrenceDays = req.body.recurrenceDays ? req.body.recurrenceDays.map((d: string) => parseInt(d)) : [];
      const recurrenceWeekOfMonth = req.body.recurrenceWeekOfMonth ? parseInt(req.body.recurrenceWeekOfMonth) : null;
      const recurrenceDayOfWeek = req.body.recurrenceDayOfWeek !== undefined ? parseInt(req.body.recurrenceDayOfWeek) : null;

      if (isRecurring && (!recurrencePattern || !recurrenceEndDate)) {
        return res.status(400).json({ message: "Recurring bookings require pattern and end date" });
      }

      // Helper function to get the nth occurrence of a day in a month
      const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstDayOfWeek = firstDay.getDay();
        
        // Calculate days to add to get to the first occurrence of the target day
        let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
        
        // Special case: "last" occurrence (weekOfMonth === 5)
        if (weekOfMonth === 5) {
          // Start from the last day of the month and work backwards
          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          const lastDayOfWeek = lastDay.getDay();
          const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
          return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
        }
        
        // Add weeks to get to the nth occurrence
        daysToAdd += (weekOfMonth - 1) * 7;
        const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
        
        // Verify the date is still in the same month
        if (targetDate.getMonth() !== date.getMonth()) {
          return null; // This occurrence doesn't exist in this month
        }
        
        return targetDate;
      };

      // Calculate all booking dates for recurring bookings
      const bookingDates: Date[] = [parsedDate];
      
      if (isRecurring && recurrenceEndDate) {
        let currentDate = new Date(parsedDate);
        
        while (true) {
          if (recurrencePattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrencePattern === 'weekly') {
            if (recurrenceDays.length > 0) {
              // Move to next day and check if it's a selected day
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
              
              // Skip if this day is not in the selected days
              if (currentDate <= recurrenceEndDate && !recurrenceDays.includes(currentDate.getDay())) {
                continue;
              }
            } else {
              // Default: same day next week
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else if (recurrencePattern === 'monthly') {
            // Move to next month
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            
            // For monthly by week (e.g., "second Saturday"), calculate the specific date
            if (recurrenceWeekOfMonth !== null && recurrenceDayOfWeek !== null) {
              const nthDay = getNthDayOfMonth(currentDate, recurrenceWeekOfMonth, recurrenceDayOfWeek);
              if (nthDay) {
                currentDate = nthDay;
              } else {
                // Skip this month if the occurrence doesn't exist
                continue;
              }
            }
          }
          
          if (currentDate > recurrenceEndDate) break;
          bookingDates.push(new Date(currentDate));
        }
      }

      // Check for conflicts on all dates
      const conflictingDates: string[] = [];
      for (const date of bookingDates) {
        const hasConflict = await storage.checkBookingConflict(
          req.body.roomId,
          date,
          req.body.startTime,
          req.body.endTime
        );
        if (hasConflict) {
          conflictingDates.push(date.toLocaleDateString());
        }
      }

      if (conflictingDates.length > 0) {
        return res.status(409).json({ 
          message: `Conflicts found on: ${conflictingDates.join(', ')}`,
          conflictingDates 
        });
      }

      // Use client-provided bookingGroupId (for multi-room) or generate one for recurring
      const bookingGroupId = req.body.bookingGroupId || (isRecurring ? uuidv4() : null);
      
      // Create all bookings
      const createdBookings = [];
      let parentBookingId: string | null = null;
      
      for (let i = 0; i < bookingDates.length; i++) {
        const date = bookingDates[i];
        const bookingData = {
          roomId: req.body.roomId,
          organizationId: orgId,
          date,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          eventName: req.body.eventName,
          purpose: req.body.purpose,
          attendees: req.body.attendees,
          selectedItems: req.body.selectedItems || [],
          visibility: req.body.visibility || "private",
          isRecurring: isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : null,
          recurrenceEndDate: isRecurring ? recurrenceEndDate : null,
          recurrenceDays: isRecurring && recurrenceDays.length > 0 ? recurrenceDays.map(String) : null,
          recurrenceWeekOfMonth: isRecurring && recurrenceWeekOfMonth !== null ? recurrenceWeekOfMonth : null,
          recurrenceDayOfWeek: isRecurring && recurrenceDayOfWeek !== null ? recurrenceDayOfWeek : null,
          parentBookingId: i === 0 ? null : parentBookingId,
          bookingGroupId: bookingGroupId,
        };
        
        const result = insertBookingSchema.safeParse(bookingData);
        if (!result.success) {
          console.error("Booking validation error:", JSON.stringify(result.error.errors, null, 2));
          console.error("Booking data that failed:", JSON.stringify(bookingData, null, 2));
          
          // Create a more user-friendly error message
          const errorMessages = result.error.errors.map((err: any) => {
            const field = err.path?.join('.') || 'field';
            const message = err.message || 'invalid';
            return `${field}: ${message}`;
          });
          
          return res.status(400).json({ 
            message: `Invalid booking data: ${errorMessages.join(', ')}`, 
            errors: result.error.errors,
            details: result.error.format()
          });
        }

        const booking = await storage.createBooking(result.data, userId);
        createdBookings.push(booking);
        
        // The first booking becomes the parent for subsequent bookings
        if (i === 0) {
          parentBookingId = booking.id;
        }
      }
      
      // Send confirmation email notification to customer (async, don't await to avoid blocking response)
      const user = req.user;
      const room = await storage.getRoom(req.body.roomId);
      if (user && room && createdBookings.length > 0) {
        const firstBooking = createdBookings[0];
        
        // Send notification to customer about their booking submission
        if (user.email) {
          console.log(`[Booking API] Preparing to send confirmation email to ${user.email} for booking ${firstBooking.id}`);
          // Use void to explicitly mark as fire-and-forget
          void sendBookingNotification("confirmation", firstBooking, room, user).catch((err) => {
            console.error("✗ Failed to send booking confirmation email to customer:", {
              email: user.email,
              bookingId: firstBooking.id,
              error: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            });
            // Log the error but don't fail the booking creation
          });
        } else {
          console.warn(`⚠ Cannot send booking confirmation: customer ${user.id} has no email address`);
        }
      } else {
        console.warn("⚠ Could not send booking confirmation: missing user, room, or bookings", {
          hasUser: !!user,
          hasRoom: !!room,
          bookingsCount: createdBookings.length,
        });
      }
      
      // Return first booking for single, or array for recurring
      res.status(201).json(isRecurring ? createdBookings : createdBookings[0]);
    } catch (error: any) {
      console.error("Error creating booking:", error);
      console.error("Error stack:", error?.stack);
      const errorMessage = error?.message || "Failed to create booking";
      res.status(500).json({ 
        message: errorMessage,
        error: error?.toString()
      });
    }
  });

  // Customer booking update route (for converting single bookings to recurring)
  app.patch("/api/bookings/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const { date, startTime, endTime, purpose, attendees, visibility, isRecurring, recurrencePattern, recurrenceEndDate, recurrenceDays, recurrenceWeekOfMonth, recurrenceDayOfWeek, extendRecurring, updateGroup = false, editRecurrencePattern } = req.body;
      
      // Get the target booking
      const targetBooking = await storage.getBooking(req.params.id);
      if (!targetBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Ensure customer can only update their own bookings
      if (targetBooking.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: You can only update your own bookings" });
      }

      // Only allow updates to pending bookings
      if (targetBooking.status !== "pending") {
        return res.status(403).json({ message: "Only pending bookings can be updated" });
      }

      // Parse and validate the date - normalize to local midnight to avoid timezone issues
      let parsedDate: Date | undefined = undefined;
      if (date) {
        // If date is a string like "2024-01-13", parse it as local date
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Parse as local date (YYYY-MM-DD format)
          const [year, month, day] = date.split('-').map(Number);
          parsedDate = new Date(year, month - 1, day);
        } else {
          parsedDate = new Date(date);
        }
        
        if (isNaN(parsedDate.valueOf())) {
          return res.status(400).json({ message: "Invalid date provided" });
        }
        
        // Normalize to start of day (local time) to avoid timezone shifts
        parsedDate.setHours(0, 0, 0, 0);
      }

      // Handle recurring booking conversion
      const isRecurringBooking = isRecurring === true;
      const parsedRecurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
      const parsedRecurrenceDays = recurrenceDays ? recurrenceDays.map((d: string) => parseInt(d)) : [];
      const parsedRecurrenceWeekOfMonth = recurrenceWeekOfMonth ? parseInt(recurrenceWeekOfMonth) : null;
      const parsedRecurrenceDayOfWeek = recurrenceDayOfWeek !== undefined ? parseInt(recurrenceDayOfWeek) : null;

      // Check if we're converting a single booking to recurring
      const shouldCreateRecurringSeries = isRecurringBooking && !targetBooking.bookingGroupId;
      // Check if we're extending an existing recurring series
      const shouldExtendRecurringSeries = extendRecurring === true && targetBooking.bookingGroupId && parsedRecurrenceEndDate;
      // Check if we're editing the recurrence pattern for an existing recurring monthly series
      const shouldEditRecurrencePattern = editRecurrencePattern === true && updateGroup && targetBooking.bookingGroupId &&
        parsedRecurrenceWeekOfMonth !== null && parsedRecurrenceDayOfWeek !== null;

      console.log(`[Extend Recurring] Customer endpoint - extendRecurring=${extendRecurring}, editRecurrencePattern=${editRecurrencePattern}, bookingGroupId=${targetBooking.bookingGroupId}`);

      let updatedBookings = [];

      // If editing the recurrence pattern (nth day of month)
      if (shouldEditRecurrencePattern) {
        const allBookings = await storage.getBookings(userId, undefined, undefined, getOrgId(req) ?? undefined);
        const groupBookings = allBookings.filter(b => b.bookingGroupId === targetBooking.bookingGroupId);
        const parentBooking = groupBookings.find(b => !b.parentBookingId) || targetBooking;

        if (parentBooking.recurrencePattern !== 'monthly') {
          return res.status(400).json({ message: "Edit recurrence pattern is only supported for monthly recurring bookings" });
        }
        if (!parentBooking.recurrenceEndDate) {
          return res.status(400).json({ message: "Recurring series has no end date" });
        }

        const baseDate = new Date(parentBooking.date);
        baseDate.setHours(0, 0, 0, 0);
        const endDate = new Date(parentBooking.recurrenceEndDate);
        endDate.setHours(0, 0, 0, 0);

        const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const firstDayOfWeek = firstDay.getDay();
          let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
          if (weekOfMonth === 5) {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const lastDayOfWeek = lastDay.getDay();
            const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
            return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
          }
          daysToAdd += (weekOfMonth - 1) * 7;
          const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
          if (targetDate.getMonth() !== date.getMonth()) return null;
          return targetDate;
        };

        const bookingDates: Date[] = [];
        let currentDate = new Date(baseDate);
        bookingDates.push(new Date(currentDate));

        while (true) {
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
          const nthDay = getNthDayOfMonth(currentDate, parsedRecurrenceWeekOfMonth!, parsedRecurrenceDayOfWeek!);
          if (nthDay) currentDate = nthDay;
          else continue;
          if (currentDate > endDate) break;
          bookingDates.push(new Date(currentDate));
        }

        const conflictingDates: string[] = [];
        for (const bookingDate of bookingDates) {
          const hasConflict = await storage.checkBookingConflict(
            parentBooking.roomId,
            bookingDate,
            parentBooking.startTime,
            parentBooking.endTime
          );
          if (hasConflict) {
            conflictingDates.push(bookingDate.toLocaleDateString());
          }
        }
        if (conflictingDates.length > 0) {
          return res.status(409).json({
            message: `Conflicts found on: ${conflictingDates.join(', ')}`,
            conflictingDates,
          });
        }

        const childBookings = groupBookings.filter(b => b.parentBookingId);
        for (const child of childBookings) {
          await storage.deleteBooking(child.id);
        }

        const updatedParent = await storage.updateBooking(parentBooking.id, {
          date: baseDate,
          recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
          recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
        });
        if (updatedParent) updatedBookings.push(updatedParent);

        for (let i = 1; i < bookingDates.length; i++) {
          const bookingDate = bookingDates[i];
          const bookingData = {
            roomId: parentBooking.roomId,
            organizationId: getOrgId(req),
            date: bookingDate,
            startTime: parentBooking.startTime,
            endTime: parentBooking.endTime,
            eventName: parentBooking.eventName || null,
            purpose: parentBooking.purpose,
            attendees: parentBooking.attendees,
            selectedItems: parentBooking.selectedItems || [],
            visibility: parentBooking.visibility as "private" | "public",
            isRecurring: true,
            recurrencePattern: 'monthly',
            recurrenceEndDate: endDate,
            recurrenceDays: null,
            recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
            recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
            parentBookingId: parentBooking.id,
            bookingGroupId: targetBooking.bookingGroupId,
            adminNotes: parentBooking.adminNotes,
          };
          const result = insertBookingSchema.safeParse(bookingData);
          if (!result.success) {
            return res.status(400).json({ message: "Invalid booking data", errors: result.error.errors });
          }
          const booking = await storage.createBooking(result.data, parentBooking.userId);
          if (booking) updatedBookings.push(booking);
        }

        return res.json({
          bookings: updatedBookings,
          count: updatedBookings.length,
          isGroup: true,
        });
      }

      // If extending an existing recurring series
      if (shouldExtendRecurringSeries) {
        if (!parsedRecurrenceEndDate) {
          console.error(`[Extend Recurring] Customer endpoint - parsedRecurrenceEndDate is null/undefined`);
          return res.status(400).json({ message: "New end date is required to extend recurring booking" });
        }

        // Get all bookings in the series (customers can only see their own bookings, scoped to org)
        const allBookings = await storage.getBookings(userId, undefined, undefined, getOrgId(req) ?? undefined);
        const groupBookings = allBookings.filter(b => b.bookingGroupId === targetBooking.bookingGroupId);
        
        // Get the parent booking (the one without parentBookingId) - parent has the recurrence fields
        const parentBooking = groupBookings.find(b => !b.parentBookingId) || targetBooking;
        
        // Check if parent booking has recurrence fields (if not, it's not a proper recurring series)
        if (!parentBooking.recurrencePattern) {
          return res.status(400).json({ message: "Booking is not part of a recurring series" });
        }
        
        // Find the latest date in the existing series
        const latestDate = groupBookings.reduce((latest, b) => {
          const bookingDate = new Date(b.date);
          bookingDate.setHours(0, 0, 0, 0);
          const latestDateNorm = new Date(latest);
          latestDateNorm.setHours(0, 0, 0, 0);
          return bookingDate > latestDateNorm ? bookingDate : latestDateNorm;
        }, new Date(targetBooking.date));
        latestDate.setHours(0, 0, 0, 0);

        parsedRecurrenceEndDate.setHours(0, 0, 0, 0);

        // Validate that new end date is after the latest date in the series
        if (parsedRecurrenceEndDate <= latestDate) {
          return res.status(400).json({ message: "New end date must be after the latest date in the series" });
        }

        // Use existing recurrence pattern from parent booking
        const existingPattern = parentBooking.recurrencePattern;
        const existingRecurrenceDays = parentBooking.recurrenceDays ? parentBooking.recurrenceDays.map(d => parseInt(d)) : [];
        const existingRecurrenceWeekOfMonth = parentBooking.recurrenceWeekOfMonth;
        const existingRecurrenceDayOfWeek = parentBooking.recurrenceDayOfWeek;

        // Helper function to get the nth occurrence of a day in a month
        const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const firstDayOfWeek = firstDay.getDay();
          let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
          
          if (weekOfMonth === 5) {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const lastDayOfWeek = lastDay.getDay();
            const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
            return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
          }
          
          daysToAdd += (weekOfMonth - 1) * 7;
          const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
          
          if (targetDate.getMonth() !== date.getMonth()) {
            return null;
          }
          
          return targetDate;
        };

        // Calculate new booking dates starting from the day after the latest date
        const bookingDates: Date[] = [];
        let currentDate = new Date(latestDate);
        currentDate.setDate(currentDate.getDate() + 1); // Start from day after latest

        while (true) {
          if (existingPattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (existingPattern === 'weekly') {
            if (existingRecurrenceDays.length > 0) {
              // Move to next day and check if it's a selected day
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
              
              // Skip if this day is not in the selected days
              if (currentDate <= parsedRecurrenceEndDate && !existingRecurrenceDays.includes(currentDate.getDay())) {
                continue;
              }
            } else {
              // Default: same day next week
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else if (existingPattern === 'monthly') {
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            
            // For monthly by week (e.g., "second Saturday"), calculate the specific date
            if (existingRecurrenceWeekOfMonth !== null && existingRecurrenceDayOfWeek !== null) {
              const nthDay = getNthDayOfMonth(currentDate, existingRecurrenceWeekOfMonth, existingRecurrenceDayOfWeek);
              if (nthDay) {
                currentDate = nthDay;
              } else {
                // Skip this month if the occurrence doesn't exist
                continue;
              }
            }
          }
          
          if (currentDate > parsedRecurrenceEndDate) break;
          bookingDates.push(new Date(currentDate));
        }

        console.log(`[Extend Recurring] Calculated ${bookingDates.length} new booking dates (customer):`, bookingDates.map(d => d.toISOString().split('T')[0]).join(', '));

        if (bookingDates.length === 0) {
          return res.status(400).json({ message: "No additional dates found to extend the series" });
        }

        console.log(`[Extend Recurring] Creating ${bookingDates.length} new bookings for series ${targetBooking.bookingGroupId} (customer)`);

        // Use existing booking fields (customers can't change these when extending)
        const finalRoomId = targetBooking.roomId;
        const finalStartTime = targetBooking.startTime;
        const finalEndTime = targetBooking.endTime;
        const finalPurpose = targetBooking.purpose;
        const finalAttendees = targetBooking.attendees;
        const finalVisibility = targetBooking.visibility as "private" | "public";

        // Check for conflicts on all new dates
        const conflictingDates: string[] = [];
        for (const bookingDate of bookingDates) {
          const hasConflict = await storage.checkBookingConflict(
            finalRoomId,
            bookingDate,
            finalStartTime,
            finalEndTime
          );
          if (hasConflict) {
            conflictingDates.push(bookingDate.toLocaleDateString());
          }
        }

        if (conflictingDates.length > 0) {
          return res.status(409).json({ 
            message: `Conflicts found on: ${conflictingDates.join(', ')}`,
            conflictingDates 
          });
        }

        // Create new child bookings (all should have the same parentBookingId as the existing series)
        for (const bookingDate of bookingDates) {
          const bookingData = {
            roomId: finalRoomId,
            organizationId: getOrgId(req),
            date: bookingDate,
            startTime: finalStartTime,
            endTime: finalEndTime,
            eventName: targetBooking.eventName || null,
            purpose: finalPurpose,
            attendees: finalAttendees,
            selectedItems: targetBooking.selectedItems || [],
            visibility: finalVisibility,
            isRecurring: true,
            recurrencePattern: existingPattern,
            recurrenceEndDate: parsedRecurrenceEndDate,
            recurrenceDays: existingRecurrenceDays.length > 0 ? existingRecurrenceDays.map(String) : null,
            recurrenceWeekOfMonth: existingRecurrenceWeekOfMonth,
            recurrenceDayOfWeek: existingRecurrenceDayOfWeek,
            parentBookingId: parentBooking.id,
            bookingGroupId: targetBooking.bookingGroupId,
          };
          
          const result = insertBookingSchema.safeParse(bookingData);
          if (!result.success) {
            console.error("Extended recurring booking validation error:", JSON.stringify(result.error.errors, null, 2));
            return res.status(400).json({ 
              message: "Invalid extended recurring booking data", 
              errors: result.error.errors,
            });
          }

          try {
            const booking = await storage.createBooking(result.data, userId);
            if (booking) {
              updatedBookings.push(booking);
              console.log(`[Extend Recurring] Created new booking ${booking.id} for date ${bookingDate.toISOString().split('T')[0]} (customer)`);
            } else {
              console.error(`[Extend Recurring] createBooking returned null/undefined for date ${bookingDate.toISOString().split('T')[0]}`);
            }
          } catch (error: any) {
            console.error(`[Extend Recurring] Error creating booking for date ${bookingDate.toISOString().split('T')[0]}:`, error);
            // Continue with other bookings even if one fails
          }
        }

        // Update recurrenceEndDate on all existing bookings in the series
        for (const groupBooking of groupBookings) {
          const updated = await storage.updateBooking(groupBooking.id, {
            recurrenceEndDate: parsedRecurrenceEndDate,
          });
          if (updated) {
            updatedBookings.push(updated);
          }
        }

        const totalCount = updatedBookings.length;
        console.log(`[Extend Recurring] Extension complete: ${totalCount} total bookings (${updatedBookings.length - groupBookings.length} new, ${groupBookings.length} updated) (customer)`);

        res.json({ 
          bookings: updatedBookings,
          count: totalCount,
          isGroup: true,
          extended: true,
          newBookingsCount: totalCount - groupBookings.length
        });
        return;
      }

      // If converting to recurring, create the series
      if (shouldCreateRecurringSeries) {
        if (!recurrencePattern || !parsedRecurrenceEndDate) {
          return res.status(400).json({ message: "Recurring bookings require pattern and end date" });
        }

        // Use the booking's current date or the provided date
        const baseDate = parsedDate || new Date(targetBooking.date);
        baseDate.setHours(0, 0, 0, 0);

        // Helper function to get the nth occurrence of a day in a month (from POST endpoint)
        const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const firstDayOfWeek = firstDay.getDay();
          let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
          
          if (weekOfMonth === 5) {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const lastDayOfWeek = lastDay.getDay();
            const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
            return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
          }
          
          daysToAdd += (weekOfMonth - 1) * 7;
          const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
          
          if (targetDate.getMonth() !== date.getMonth()) {
            return null;
          }
          
          return targetDate;
        };

        // Calculate all booking dates for recurring bookings
        const bookingDates: Date[] = [baseDate];
        let currentDate = new Date(baseDate);
        
        while (true) {
          if (recurrencePattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrencePattern === 'weekly') {
            if (parsedRecurrenceDays.length > 0) {
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
              if (currentDate <= parsedRecurrenceEndDate && !parsedRecurrenceDays.includes(currentDate.getDay())) {
                continue;
              }
            } else {
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else if (recurrencePattern === 'monthly') {
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            if (parsedRecurrenceWeekOfMonth !== null && parsedRecurrenceDayOfWeek !== null) {
              const nthDay = getNthDayOfMonth(currentDate, parsedRecurrenceWeekOfMonth, parsedRecurrenceDayOfWeek);
              if (nthDay) {
                currentDate = nthDay;
              } else {
                continue;
              }
            }
          }
          
          if (currentDate > parsedRecurrenceEndDate) break;
          bookingDates.push(new Date(currentDate));
        }

        // Generate bookingGroupId
        const bookingGroupId = uuidv4();
        const finalRoomId = targetBooking.roomId; // Customers can't change room
        const finalStartTime = startTime !== undefined ? startTime : targetBooking.startTime;
        const finalEndTime = endTime !== undefined ? endTime : targetBooking.endTime;
        const finalPurpose = purpose !== undefined ? purpose : targetBooking.purpose;
        const finalAttendees = attendees !== undefined ? attendees : targetBooking.attendees;
        const finalVisibility = visibility !== undefined ? visibility : (targetBooking.visibility as "private" | "public");

        // Validate time format if provided
        if (startTime || endTime) {
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (startTime && !timeRegex.test(startTime)) {
            return res.status(400).json({ message: "Invalid start time format. Use HH:MM" });
          }
          if (endTime && !timeRegex.test(endTime)) {
            return res.status(400).json({ message: "Invalid end time format. Use HH:MM" });
          }
          if (startTime && endTime && endTime <= startTime) {
            return res.status(400).json({ message: "End time must be after start time" });
          }
        }

        // Check for conflicts on all dates (exclude the current booking being updated)
        const conflictingDates: string[] = [];
        for (const bookingDate of bookingDates) {
          const hasConflict = await storage.checkBookingConflict(
            finalRoomId,
            bookingDate,
            finalStartTime,
            finalEndTime,
            req.params.id // Exclude the current booking being updated
          );
          if (hasConflict) {
            conflictingDates.push(bookingDate.toLocaleDateString());
          }
        }

        if (conflictingDates.length > 0) {
          return res.status(409).json({ 
            message: `Conflicts found on: ${conflictingDates.join(', ')}`,
            conflictingDates 
          });
        }

        // Update the original booking to be the parent
        const updatedParent = await storage.updateBooking(req.params.id, {
          roomId: finalRoomId,
            organizationId: getOrgId(req),
          date: baseDate,
          startTime: finalStartTime,
          endTime: finalEndTime,
          purpose: finalPurpose,
          attendees: finalAttendees,
          visibility: finalVisibility,
          isRecurring: true,
          recurrencePattern: recurrencePattern,
          recurrenceEndDate: parsedRecurrenceEndDate,
          recurrenceDays: parsedRecurrenceDays.length > 0 ? parsedRecurrenceDays.map(String) : null,
          recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
          recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
          bookingGroupId: bookingGroupId,
          parentBookingId: null,
        });
        if (updatedParent) {
          updatedBookings.push(updatedParent);
        }

        // Create child bookings for remaining dates
        let parentBookingId = req.params.id;
        for (let i = 1; i < bookingDates.length; i++) {
          const bookingDate = bookingDates[i];
          const bookingData = {
            roomId: finalRoomId,
            organizationId: getOrgId(req),
            date: bookingDate,
            startTime: finalStartTime,
            endTime: finalEndTime,
            eventName: targetBooking.eventName || null,
            purpose: finalPurpose,
            attendees: finalAttendees,
            selectedItems: targetBooking.selectedItems || [],
            visibility: finalVisibility,
            isRecurring: true,
            recurrencePattern: recurrencePattern,
            recurrenceEndDate: parsedRecurrenceEndDate,
            recurrenceDays: parsedRecurrenceDays.length > 0 ? parsedRecurrenceDays.map(String) : null,
            recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
            recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
            parentBookingId: parentBookingId,
            bookingGroupId: bookingGroupId,
          };
          
          const result = insertBookingSchema.safeParse(bookingData);
          if (!result.success) {
            console.error("Recurring booking validation error:", JSON.stringify(result.error.errors, null, 2));
            return res.status(400).json({ 
              message: "Invalid recurring booking data", 
              errors: result.error.errors,
            });
          }

          const booking = await storage.createBooking(result.data, userId);
          updatedBookings.push(booking);
        }
      } else {
        // Update single booking (non-recurring fields only for customers)
        const booking = await storage.updateBooking(req.params.id, {
          date: parsedDate,
          startTime: startTime !== undefined ? startTime : undefined,
          endTime: endTime !== undefined ? endTime : undefined,
          purpose: purpose !== undefined ? purpose : undefined,
          attendees: attendees !== undefined ? attendees : undefined,
          visibility: visibility !== undefined ? visibility : undefined,
        });
        if (booking) {
          updatedBookings.push(booking);
        }
      }
      
      if (updatedBookings.length === 0) {
        return res.status(404).json({ message: "No bookings updated" });
      }
      
      res.json({ 
        bookings: updatedBookings,
        count: updatedBookings.length,
        isGroup: updatedBookings.length > 1
      });
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.patch("/api/bookings/:id/status", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { status, reason, updateGroup = false } = req.body;
      if (!["confirmed", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Get the booking to check for group ID
      const targetBooking = await storage.getBooking(req.params.id);
      if (!targetBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      let updatedBookings = [];

      // If updateGroup is true and booking has a group ID, update all bookings in the group
      if (updateGroup && targetBooking.bookingGroupId) {
        const allBookings = await storage.getBookings(undefined, undefined, undefined, getOrgId(req) ?? undefined);
        const groupBookings = allBookings.filter(b => b.bookingGroupId === targetBooking.bookingGroupId);
        
        // Update all bookings in the group
        for (const groupBooking of groupBookings) {
          const updated = await storage.updateBookingStatus(groupBooking.id, status);
          if (updated) {
            updatedBookings.push(updated);
          }
        }
      } else {
        // Update single booking
        const booking = await storage.updateBookingStatus(req.params.id, status);
        if (booking) {
          updatedBookings.push(booking);
        }
      }

      if (updatedBookings.length === 0) {
        return res.status(404).json({ message: "No bookings updated" });
      }
      
      // Send confirmation/rejection email for the first booking (representative of the group)
      const firstBooking = updatedBookings[0];
      const bookingUser = await storage.getUser(firstBooking.userId);
      const room = await storage.getRoom(firstBooking.roomId);
      if (bookingUser && room) {
        const notificationType = status === "confirmed" ? "approval" : status === "cancelled" ? "cancellation" : "rejection";
        sendBookingNotification(notificationType, firstBooking, room, bookingUser, reason).catch((err) => {
          console.error(`Failed to send ${notificationType} email:`, err);
        });
      }
      
      res.json({ 
        bookings: updatedBookings,
        count: updatedBookings.length,
        isGroup: updatedBookings.length > 1
      });
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  // Super admin endpoint to permanently delete bookings
  app.delete("/api/admin/bookings/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Super admin access required" });
      }

      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      await storage.deleteBooking(req.params.id);
      res.json({ message: "Booking deleted successfully" });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });

  app.delete("/api/bookings/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const booking = await storage.cancelBooking(req.params.id, userId);
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found or already cancelled" });
      }
      
      // Send cancellation email
      const bookingUser = await storage.getUser(booking.userId);
      const room = await storage.getRoom(booking.roomId);
      if (bookingUser && room) {
        sendBookingNotification("cancellation", booking, room, bookingUser).catch((err) => {
          console.error("Failed to send cancellation email:", err);
        });
      }
      
      res.json(booking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  // Add a specific date to an existing recurring booking series
  app.post("/api/bookings/:id/add-date", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      const targetBooking = await storage.getBooking(req.params.id);
      if (!targetBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (!targetBooking.bookingGroupId) {
        return res.status(400).json({ message: "This booking is not part of a recurring series" });
      }

      const isAdmin = user?.isAdmin || user?.isSuperAdmin;
      if (!isAdmin && targetBooking.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const parsedDate = new Date(date + "T00:00:00");
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const hasConflict = await storage.checkBookingConflict(
        targetBooking.roomId,
        parsedDate,
        targetBooking.startTime,
        targetBooking.endTime
      );
      if (hasConflict) {
        return res.status(409).json({ message: `Conflict: the time slot is already booked on ${date}` });
      }

      const parentBooking = targetBooking.parentBookingId
        ? await storage.getBooking(targetBooking.parentBookingId)
        : targetBooking;
      const parentId = parentBooking?.id || targetBooking.id;

      const bookingData = {
        roomId: targetBooking.roomId,
        organizationId: getOrgId(req),
        date: parsedDate,
        startTime: targetBooking.startTime,
        endTime: targetBooking.endTime,
        eventName: targetBooking.eventName || null,
        purpose: targetBooking.purpose,
        attendees: targetBooking.attendees,
        selectedItems: targetBooking.selectedItems || [],
        visibility: targetBooking.visibility as "private" | "public",
        isRecurring: true,
        recurrencePattern: targetBooking.recurrencePattern,
        recurrenceEndDate: targetBooking.recurrenceEndDate,
        recurrenceDays: targetBooking.recurrenceDays,
        recurrenceWeekOfMonth: targetBooking.recurrenceWeekOfMonth,
        recurrenceDayOfWeek: targetBooking.recurrenceDayOfWeek,
        parentBookingId: parentId,
        bookingGroupId: targetBooking.bookingGroupId,
        adminNotes: targetBooking.adminNotes,
      };

      const result = insertBookingSchema.safeParse(bookingData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid booking data", errors: result.error.errors });
      }

      const newBooking = await storage.createBooking(result.data, targetBooking.userId);
      if (!newBooking) {
        return res.status(500).json({ message: "Failed to create booking" });
      }

      res.json(newBooking);
    } catch (error) {
      console.error("Error adding date to series:", error);
      res.status(500).json({ message: "Failed to add date to series" });
    }
  });

  // Admin booking edit route
  app.patch("/api/admin/bookings/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { roomId, date, startTime, endTime, purpose, attendees, status, visibility, adminNotes, updateGroup = false, isRecurring, recurrencePattern, recurrenceEndDate, recurrenceDays, recurrenceWeekOfMonth, recurrenceDayOfWeek, extendRecurring, editRecurrencePattern } = req.body;
      
      // Parse and validate the date - normalize to local midnight to avoid timezone issues
      let parsedDate: Date | undefined = undefined;
      if (date) {
        // If date is a string like "2024-01-13", parse it as local date
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Parse as local date (YYYY-MM-DD format)
          const [year, month, day] = date.split('-').map(Number);
          parsedDate = new Date(year, month - 1, day);
        } else {
          parsedDate = new Date(date);
        }
        
        if (isNaN(parsedDate.valueOf())) {
          return res.status(400).json({ message: "Invalid date provided" });
        }
        
        // Normalize to start of day (local time) to avoid timezone shifts
        parsedDate.setHours(0, 0, 0, 0);
      }

      // Get the target booking to check for group ID
      const targetBooking = await storage.getBooking(req.params.id);
      if (!targetBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Handle recurring booking conversion
      const isRecurringBooking = isRecurring === true;
      const parsedRecurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
      const parsedRecurrenceDays = recurrenceDays ? recurrenceDays.map((d: string) => parseInt(d)) : [];
      const parsedRecurrenceWeekOfMonth = recurrenceWeekOfMonth ? parseInt(recurrenceWeekOfMonth) : null;
      const parsedRecurrenceDayOfWeek = recurrenceDayOfWeek !== undefined ? parseInt(recurrenceDayOfWeek) : null;

      // Check if we're converting a single booking to recurring
      const shouldCreateRecurringSeries = isRecurringBooking && !targetBooking.bookingGroupId && !updateGroup;
      // Check if we're extending an existing recurring series
      const shouldExtendRecurringSeries = extendRecurring === true && targetBooking.bookingGroupId && parsedRecurrenceEndDate;
      // Check if we're editing the recurrence pattern (nth day of month) for an existing recurring monthly series
      const shouldEditRecurrencePattern = editRecurrencePattern === true && updateGroup && targetBooking.bookingGroupId &&
        parsedRecurrenceWeekOfMonth !== null && parsedRecurrenceDayOfWeek !== null;

      console.log(`[Extend Recurring] Admin endpoint - extendRecurring=${extendRecurring}, editRecurrencePattern=${editRecurrencePattern}, bookingGroupId=${targetBooking.bookingGroupId}, parsedRecurrenceEndDate=${parsedRecurrenceEndDate?.toISOString()}, shouldExtend=${shouldExtendRecurringSeries}`);

      let updatedBookings = [];

      // If editing the recurrence pattern (e.g. change "second Saturday" to "third Saturday")
      if (shouldEditRecurrencePattern) {
        const allBookings = await storage.getBookings(undefined, undefined, undefined, getOrgId(req) ?? undefined);
        const groupBookings = allBookings.filter(b => b.bookingGroupId === targetBooking.bookingGroupId);
        const parentBooking = groupBookings.find(b => !b.parentBookingId) || targetBooking;

        if (parentBooking.recurrencePattern !== 'monthly') {
          return res.status(400).json({ message: "Edit recurrence pattern is only supported for monthly recurring bookings" });
        }
        if (!parentBooking.recurrenceEndDate) {
          return res.status(400).json({ message: "Recurring series has no end date" });
        }

        const baseDate = new Date(parentBooking.date);
        baseDate.setHours(0, 0, 0, 0);
        const endDate = new Date(parentBooking.recurrenceEndDate);
        endDate.setHours(0, 0, 0, 0);

        const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const firstDayOfWeek = firstDay.getDay();
          let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
          if (weekOfMonth === 5) {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const lastDayOfWeek = lastDay.getDay();
            const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
            return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
          }
          daysToAdd += (weekOfMonth - 1) * 7;
          const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
          if (targetDate.getMonth() !== date.getMonth()) return null;
          return targetDate;
        };

        const bookingDates: Date[] = [];
        let currentDate = new Date(baseDate);
        bookingDates.push(new Date(currentDate));

        while (true) {
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
          const nthDay = getNthDayOfMonth(currentDate, parsedRecurrenceWeekOfMonth!, parsedRecurrenceDayOfWeek!);
          if (nthDay) currentDate = nthDay;
          else continue;
          if (currentDate > endDate) break;
          bookingDates.push(new Date(currentDate));
        }

        // Check for conflicts
        const conflictingDates: string[] = [];
        for (const bookingDate of bookingDates) {
          const hasConflict = await storage.checkBookingConflict(
            parentBooking.roomId,
            bookingDate,
            parentBooking.startTime,
            parentBooking.endTime
          );
          if (hasConflict) {
            conflictingDates.push(bookingDate.toLocaleDateString());
          }
        }
        if (conflictingDates.length > 0) {
          return res.status(409).json({
            message: `Conflicts found on: ${conflictingDates.join(', ')}`,
            conflictingDates,
          });
        }

        // Delete all child bookings
        const childBookings = groupBookings.filter(b => b.parentBookingId);
        for (const child of childBookings) {
          await storage.deleteBooking(child.id);
        }

        // Update parent with new recurrence pattern
        const updatedParent = await storage.updateBooking(parentBooking.id, {
          date: baseDate,
          recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
          recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
        });
        if (updatedParent) updatedBookings.push(updatedParent);

        // Create new child bookings (skip first date - it's the parent)
        for (let i = 1; i < bookingDates.length; i++) {
          const bookingDate = bookingDates[i];
          const bookingData = {
            roomId: parentBooking.roomId,
            organizationId: getOrgId(req),
            date: bookingDate,
            startTime: parentBooking.startTime,
            endTime: parentBooking.endTime,
            eventName: parentBooking.eventName || null,
            purpose: parentBooking.purpose,
            attendees: parentBooking.attendees,
            selectedItems: parentBooking.selectedItems || [],
            visibility: parentBooking.visibility as "private" | "public",
            isRecurring: true,
            recurrencePattern: 'monthly',
            recurrenceEndDate: endDate,
            recurrenceDays: null,
            recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
            recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
            parentBookingId: parentBooking.id,
            bookingGroupId: targetBooking.bookingGroupId,
            adminNotes: parentBooking.adminNotes,
          };
          const result = insertBookingSchema.safeParse(bookingData);
          if (!result.success) {
            return res.status(400).json({ message: "Invalid booking data", errors: result.error.errors });
          }
          const booking = await storage.createBooking(result.data, parentBooking.userId);
          if (booking) updatedBookings.push(booking);
        }

        return res.json({
          bookings: updatedBookings,
          count: updatedBookings.length,
          isGroup: true,
        });
      }

      // If extending an existing recurring series
      if (shouldExtendRecurringSeries) {
        if (!parsedRecurrenceEndDate) {
          console.error(`[Extend Recurring] Admin endpoint - parsedRecurrenceEndDate is null/undefined`);
          return res.status(400).json({ message: "New end date is required to extend recurring booking" });
        }

        // Get all bookings in the series (scoped to org)
        const allBookings = await storage.getBookings(undefined, undefined, undefined, getOrgId(req) ?? undefined);
        const groupBookings = allBookings.filter(b => b.bookingGroupId === targetBooking.bookingGroupId);
        
        // Get the parent booking (the one without parentBookingId) - parent has the recurrence fields
        const parentBooking = groupBookings.find(b => !b.parentBookingId) || targetBooking;
        
        // Check if parent booking has recurrence fields (if not, it's not a proper recurring series)
        if (!parentBooking.recurrencePattern) {
          return res.status(400).json({ message: "Booking is not part of a recurring series" });
        }
        
        // Find the latest date in the existing series
        const latestDate = groupBookings.reduce((latest, b) => {
          const bookingDate = new Date(b.date);
          bookingDate.setHours(0, 0, 0, 0);
          const latestDateNorm = new Date(latest);
          latestDateNorm.setHours(0, 0, 0, 0);
          return bookingDate > latestDateNorm ? bookingDate : latestDateNorm;
        }, new Date(targetBooking.date));
        latestDate.setHours(0, 0, 0, 0);

        parsedRecurrenceEndDate.setHours(0, 0, 0, 0);

        // Validate that new end date is after the latest date in the series
        if (parsedRecurrenceEndDate <= latestDate) {
          return res.status(400).json({ message: "New end date must be after the latest date in the series" });
        }

        // Use existing recurrence pattern from parent booking
        const existingPattern = parentBooking.recurrencePattern;
        const existingRecurrenceDays = parentBooking.recurrenceDays ? parentBooking.recurrenceDays.map(d => parseInt(d)) : [];
        const existingRecurrenceWeekOfMonth = parentBooking.recurrenceWeekOfMonth;
        const existingRecurrenceDayOfWeek = parentBooking.recurrenceDayOfWeek;

        // Helper function to get the nth occurrence of a day in a month
        const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const firstDayOfWeek = firstDay.getDay();
          let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
          
          if (weekOfMonth === 5) {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const lastDayOfWeek = lastDay.getDay();
            const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
            return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
          }
          
          daysToAdd += (weekOfMonth - 1) * 7;
          const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
          
          if (targetDate.getMonth() !== date.getMonth()) {
            return null;
          }
          
          return targetDate;
        };

        // Calculate new booking dates starting from the day after the latest date
        const bookingDates: Date[] = [];
        let currentDate = new Date(latestDate);
        currentDate.setDate(currentDate.getDate() + 1); // Start from day after latest

        while (true) {
          if (existingPattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (existingPattern === 'weekly') {
            if (existingRecurrenceDays.length > 0) {
              // Move to next day and check if it's a selected day
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
              
              // Skip if this day is not in the selected days
              if (currentDate <= parsedRecurrenceEndDate && !existingRecurrenceDays.includes(currentDate.getDay())) {
                continue;
              }
            } else {
              // Default: same day next week
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else if (existingPattern === 'monthly') {
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            
            // For monthly by week (e.g., "second Saturday"), calculate the specific date
            if (existingRecurrenceWeekOfMonth !== null && existingRecurrenceDayOfWeek !== null) {
              const nthDay = getNthDayOfMonth(currentDate, existingRecurrenceWeekOfMonth, existingRecurrenceDayOfWeek);
              if (nthDay) {
                currentDate = nthDay;
              } else {
                // Skip this month if the occurrence doesn't exist
                continue;
              }
            }
          }
          
          if (currentDate > parsedRecurrenceEndDate) break;
          bookingDates.push(new Date(currentDate));
        }

        console.log(`[Extend Recurring] Calculated ${bookingDates.length} new booking dates (admin):`, bookingDates.map(d => d.toISOString().split('T')[0]).join(', '));

        if (bookingDates.length === 0) {
          return res.status(400).json({ message: "No additional dates found to extend the series" });
        }

        console.log(`[Extend Recurring] Creating ${bookingDates.length} new bookings for series ${targetBooking.bookingGroupId}`);

        // parentBooking was already determined above
        const finalRoomId = targetBooking.roomId;
        const finalStartTime = targetBooking.startTime;
        const finalEndTime = targetBooking.endTime;
        const finalPurpose = targetBooking.purpose;
        const finalAttendees = targetBooking.attendees;
        const finalVisibility = targetBooking.visibility as "private" | "public";
        const finalAdminNotes = targetBooking.adminNotes;

        // Check for conflicts on all new dates
        const conflictingDates: string[] = [];
        for (const bookingDate of bookingDates) {
          const hasConflict = await storage.checkBookingConflict(
            finalRoomId,
            bookingDate,
            finalStartTime,
            finalEndTime
          );
          if (hasConflict) {
            conflictingDates.push(bookingDate.toLocaleDateString());
          }
        }

        if (conflictingDates.length > 0) {
          return res.status(409).json({ 
            message: `Conflicts found on: ${conflictingDates.join(', ')}`,
            conflictingDates 
          });
        }

        // Create new child bookings (all should have the same parentBookingId as the existing series)
        for (const bookingDate of bookingDates) {
          const bookingData = {
            roomId: finalRoomId,
            organizationId: getOrgId(req),
            date: bookingDate,
            startTime: finalStartTime,
            endTime: finalEndTime,
            eventName: targetBooking.eventName || null,
            purpose: finalPurpose,
            attendees: finalAttendees,
            selectedItems: targetBooking.selectedItems || [],
            visibility: finalVisibility,
            isRecurring: true,
            recurrencePattern: existingPattern,
            recurrenceEndDate: parsedRecurrenceEndDate,
            recurrenceDays: existingRecurrenceDays.length > 0 ? existingRecurrenceDays.map(String) : null,
            recurrenceWeekOfMonth: existingRecurrenceWeekOfMonth,
            recurrenceDayOfWeek: existingRecurrenceDayOfWeek,
            parentBookingId: parentBooking.id,
            bookingGroupId: targetBooking.bookingGroupId,
            adminNotes: finalAdminNotes,
          };
          
          const result = insertBookingSchema.safeParse(bookingData);
          if (!result.success) {
            console.error("Extended recurring booking validation error:", JSON.stringify(result.error.errors, null, 2));
            return res.status(400).json({ 
              message: "Invalid extended recurring booking data", 
              errors: result.error.errors,
            });
          }

          try {
            const booking = await storage.createBooking(result.data, targetBooking.userId);
            if (booking) {
              updatedBookings.push(booking);
              console.log(`[Extend Recurring] Created new booking ${booking.id} for date ${bookingDate.toISOString().split('T')[0]}`);
            } else {
              console.error(`[Extend Recurring] createBooking returned null/undefined for date ${bookingDate.toISOString().split('T')[0]}`);
            }
          } catch (error: any) {
            console.error(`[Extend Recurring] Error creating booking for date ${bookingDate.toISOString().split('T')[0]}:`, error);
            // Continue with other bookings even if one fails
          }
        }

        // Update recurrenceEndDate on all existing bookings in the series
        for (const groupBooking of groupBookings) {
          const updated = await storage.updateBooking(groupBooking.id, {
            recurrenceEndDate: parsedRecurrenceEndDate,
          });
          if (updated) {
            updatedBookings.push(updated);
          }
        }

        const totalCount = updatedBookings.length;
        console.log(`[Extend Recurring] Extension complete: ${totalCount} total bookings (${updatedBookings.length - groupBookings.length} new, ${groupBookings.length} updated)`);

        res.json({ 
          bookings: updatedBookings,
          count: totalCount,
          isGroup: true,
          extended: true,
          newBookingsCount: totalCount - groupBookings.length
        });
        return;
      }

      // If converting to recurring, create the series
      if (shouldCreateRecurringSeries) {
        if (!recurrencePattern || !parsedRecurrenceEndDate) {
          return res.status(400).json({ message: "Recurring bookings require pattern and end date" });
        }

        // Use the booking's current date or the provided date
        const baseDate = parsedDate || new Date(targetBooking.date);
        baseDate.setHours(0, 0, 0, 0);

        // Helper function to get the nth occurrence of a day in a month (from POST endpoint)
        const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
          const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
          const firstDayOfWeek = firstDay.getDay();
          let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
          
          if (weekOfMonth === 5) {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const lastDayOfWeek = lastDay.getDay();
            const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
            return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
          }
          
          daysToAdd += (weekOfMonth - 1) * 7;
          const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
          
          if (targetDate.getMonth() !== date.getMonth()) {
            return null;
          }
          
          return targetDate;
        };

        // Calculate all booking dates for recurring bookings
        const bookingDates: Date[] = [baseDate];
        let currentDate = new Date(baseDate);
        
        while (true) {
          if (recurrencePattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrencePattern === 'weekly') {
            if (parsedRecurrenceDays.length > 0) {
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
              if (currentDate <= parsedRecurrenceEndDate && !parsedRecurrenceDays.includes(currentDate.getDay())) {
                continue;
              }
            } else {
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else if (recurrencePattern === 'monthly') {
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            if (parsedRecurrenceWeekOfMonth !== null && parsedRecurrenceDayOfWeek !== null) {
              const nthDay = getNthDayOfMonth(currentDate, parsedRecurrenceWeekOfMonth, parsedRecurrenceDayOfWeek);
              if (nthDay) {
                currentDate = nthDay;
              } else {
                continue;
              }
            }
          }
          
          if (currentDate > parsedRecurrenceEndDate) break;
          bookingDates.push(new Date(currentDate));
        }

        // Generate bookingGroupId
        const bookingGroupId = uuidv4();
        const finalRoomId = roomId !== undefined ? roomId : targetBooking.roomId;
        const finalStartTime = startTime !== undefined ? startTime : targetBooking.startTime;
        const finalEndTime = endTime !== undefined ? endTime : targetBooking.endTime;
        const finalPurpose = purpose !== undefined ? purpose : targetBooking.purpose;
        const finalAttendees = attendees !== undefined ? attendees : targetBooking.attendees;
        const finalVisibility = visibility !== undefined ? visibility : (targetBooking.visibility as "private" | "public");
        const finalAdminNotes = adminNotes !== undefined ? adminNotes : targetBooking.adminNotes;

        // Check for conflicts on all dates (exclude the current booking being updated)
        const conflictingDates: string[] = [];
        for (const bookingDate of bookingDates) {
          const hasConflict = await storage.checkBookingConflict(
            finalRoomId,
            bookingDate,
            finalStartTime,
            finalEndTime,
            req.params.id // Exclude the current booking being updated
          );
          if (hasConflict) {
            conflictingDates.push(bookingDate.toLocaleDateString());
          }
        }

        if (conflictingDates.length > 0) {
          return res.status(409).json({ 
            message: `Conflicts found on: ${conflictingDates.join(', ')}`,
            conflictingDates 
          });
        }

        // Update the original booking to be the parent
        const updatedParent = await storage.updateBooking(req.params.id, {
          roomId: finalRoomId,
            organizationId: getOrgId(req),
          date: baseDate,
          startTime: finalStartTime,
          endTime: finalEndTime,
          purpose: finalPurpose,
          attendees: finalAttendees,
          status: status || targetBooking.status,
          visibility: finalVisibility,
          adminNotes: finalAdminNotes,
          isRecurring: true,
          recurrencePattern: recurrencePattern,
          recurrenceEndDate: parsedRecurrenceEndDate,
          recurrenceDays: parsedRecurrenceDays.length > 0 ? parsedRecurrenceDays.map(String) : null,
          recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
          recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
          bookingGroupId: bookingGroupId,
          parentBookingId: null,
        });
        if (updatedParent) {
          updatedBookings.push(updatedParent);
        }

        // Create child bookings for remaining dates
        let parentBookingId = req.params.id;
        for (let i = 1; i < bookingDates.length; i++) {
          const bookingDate = bookingDates[i];
          const bookingData = {
            roomId: finalRoomId,
            organizationId: getOrgId(req),
            date: bookingDate,
            startTime: finalStartTime,
            endTime: finalEndTime,
            eventName: targetBooking.eventName || null,
            purpose: finalPurpose,
            attendees: finalAttendees,
            selectedItems: targetBooking.selectedItems || [],
            visibility: finalVisibility,
            isRecurring: true,
            recurrencePattern: recurrencePattern,
            recurrenceEndDate: parsedRecurrenceEndDate,
            recurrenceDays: parsedRecurrenceDays.length > 0 ? parsedRecurrenceDays.map(String) : null,
            recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth,
            recurrenceDayOfWeek: parsedRecurrenceDayOfWeek,
            parentBookingId: parentBookingId,
            bookingGroupId: bookingGroupId,
            adminNotes: finalAdminNotes,
          };
          
          const result = insertBookingSchema.safeParse(bookingData);
          if (!result.success) {
            console.error("Recurring booking validation error:", JSON.stringify(result.error.errors, null, 2));
            return res.status(400).json({ 
              message: "Invalid recurring booking data", 
              errors: result.error.errors,
            });
          }

          const booking = await storage.createBooking(result.data, targetBooking.userId);
          updatedBookings.push(booking);
        }
      } else if (updateGroup && targetBooking.bookingGroupId) {
        // If updateGroup is true and booking has a group ID, update all bookings in the group
        const allBookings = await storage.getBookings(undefined, undefined, undefined, getOrgId(req) ?? undefined);
        const groupBookings = allBookings.filter(b => b.bookingGroupId === targetBooking.bookingGroupId);
        
        // Update all bookings in the group with shared fields (date is per-booking, not shared)
        for (const groupBooking of groupBookings) {
          const groupUpdateData: any = {
            roomId: roomId !== undefined ? roomId : undefined,
            startTime: startTime !== undefined ? startTime : undefined,
            endTime: endTime !== undefined ? endTime : undefined,
            purpose: purpose !== undefined ? purpose : undefined,
            attendees: attendees !== undefined ? attendees : undefined,
            status: status !== undefined ? status : undefined,
            visibility: visibility !== undefined ? visibility : undefined,
            adminNotes: adminNotes !== undefined ? adminNotes : undefined,
          };
          // Apply date change only to the specific booking being edited
          if (groupBooking.id === req.params.id && parsedDate) {
            groupUpdateData.date = parsedDate;
          }
          const updated = await storage.updateBooking(groupBooking.id, groupUpdateData);
          if (updated) {
            updatedBookings.push(updated);
          }
        }
      } else {
        // Update single booking (including recurring fields if provided)
        const booking = await storage.updateBooking(req.params.id, {
          roomId: roomId !== undefined ? roomId : undefined,
          date: parsedDate,
          startTime: startTime !== undefined ? startTime : undefined,
          endTime: endTime !== undefined ? endTime : undefined,
          purpose: purpose !== undefined ? purpose : undefined,
          attendees: attendees !== undefined ? attendees : undefined,
          status: status !== undefined ? status : undefined,
          visibility: visibility !== undefined ? visibility : undefined,
          adminNotes: adminNotes !== undefined ? adminNotes : undefined,
          isRecurring: isRecurring !== undefined ? isRecurring : undefined,
          recurrencePattern: recurrencePattern !== undefined ? recurrencePattern : undefined,
          recurrenceEndDate: parsedRecurrenceEndDate !== null ? parsedRecurrenceEndDate : undefined,
          recurrenceDays: recurrenceDays !== undefined ? recurrenceDays : undefined,
          recurrenceWeekOfMonth: parsedRecurrenceWeekOfMonth !== null ? parsedRecurrenceWeekOfMonth : undefined,
          recurrenceDayOfWeek: parsedRecurrenceDayOfWeek !== null ? parsedRecurrenceDayOfWeek : undefined,
        });
        if (booking) {
          updatedBookings.push(booking);
        }
      }
      
      if (updatedBookings.length === 0) {
        return res.status(404).json({ message: "No bookings updated" });
      }
      
      res.json({ 
        bookings: updatedBookings,
        count: updatedBookings.length,
        isGroup: updatedBookings.length > 1
      });
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  // Admin booking creation route (on behalf of customer)
  app.post("/api/admin/bookings", requireAuth, attachUser, async (req: any, res) => {
    try {
      const adminUser = req.user;
      const orgId = getOrgId(req);
      
      if (!adminUser?.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { userId, roomId, date, startTime, endTime, eventName, purpose, attendees, selectedItems, visibility, isRecurring, recurrencePattern, recurrenceEndDate, recurrenceDays, recurrenceWeekOfMonth, recurrenceDayOfWeek, bookingGroupId = null, adminNotes = null, excludeDates = [] } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Customer selection is required" });
      }

      // Parse and validate the date
      const parsedDate = date ? new Date(date) : new Date();
      if (isNaN(parsedDate.valueOf())) {
        return res.status(400).json({ message: "Invalid date provided" });
      }
      parsedDate.setUTCHours(0, 0, 0, 0);
      
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ message: "Invalid time format. Use HH:MM" });
      }
      
      // Validate end time is after start time
      if (endTime <= startTime) {
        return res.status(400).json({ message: "End time must be after start time" });
      }

      // Handle recurring bookings
      const isRecurringBooking = isRecurring === true;
      const parsedRecurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
      const parsedRecurrenceDays = recurrenceDays ? recurrenceDays.map((d: string) => parseInt(d)) : [];
      const parsedRecurrenceWeekOfMonth = recurrenceWeekOfMonth ? parseInt(recurrenceWeekOfMonth) : null;
      const parsedRecurrenceDayOfWeek = recurrenceDayOfWeek !== undefined ? parseInt(recurrenceDayOfWeek) : null;

      if (isRecurringBooking && (!recurrencePattern || !parsedRecurrenceEndDate)) {
        return res.status(400).json({ message: "Recurring bookings require pattern and end date" });
      }

      // Helper function to get the nth occurrence of a day in a month
      const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstDayOfWeek = firstDay.getDay();
        
        // Calculate days to add to get to the first occurrence of the target day
        let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
        
        // Special case: "last" occurrence (weekOfMonth === 5)
        if (weekOfMonth === 5) {
          // Start from the last day of the month and work backwards
          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          const lastDayOfWeek = lastDay.getDay();
          const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
          return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - daysBack);
        }
        
        // Add weeks to get to the nth occurrence
        daysToAdd += (weekOfMonth - 1) * 7;
        const targetDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + daysToAdd);
        
        // Verify the date is still in the same month
        if (targetDate.getMonth() !== date.getMonth()) {
          return null; // This occurrence doesn't exist in this month
        }
        
        return targetDate;
      };

      // Calculate all booking dates for recurring bookings
      const bookingDates: Date[] = [parsedDate];
      
      if (isRecurringBooking && parsedRecurrenceEndDate) {
        let currentDate = new Date(parsedDate);
        
        while (true) {
          if (recurrencePattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrencePattern === 'weekly') {
            if (parsedRecurrenceDays.length > 0) {
              // Move to next day and check if it's a selected day
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
              
              // Skip if this day is not in the selected days
              if (currentDate <= parsedRecurrenceEndDate && !parsedRecurrenceDays.includes(currentDate.getDay())) {
                continue;
              }
            } else {
              // Default: same day next week
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 7);
            }
          } else if (recurrencePattern === 'monthly') {
            // Move to next month
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            
            // For monthly by week (e.g., "second Saturday"), calculate the specific date
            if (parsedRecurrenceWeekOfMonth !== null && parsedRecurrenceDayOfWeek !== null) {
              const nthDay = getNthDayOfMonth(currentDate, parsedRecurrenceWeekOfMonth, parsedRecurrenceDayOfWeek);
              if (nthDay) {
                currentDate = nthDay;
              } else {
                // Skip this month if the occurrence doesn't exist
                continue;
              }
            }
          }
          
          if (currentDate > parsedRecurrenceEndDate) break;
          bookingDates.push(new Date(currentDate));
        }
      }

      // Normalize excludeDates to ISO format (YYYY-MM-DD)
      const excludeSet = new Set(
        (Array.isArray(excludeDates) ? excludeDates : []).map((d: string) => {
          const parsed = new Date(d);
          return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
        }).filter(Boolean)
      );

      // Filter out excluded dates
      const filteredBookingDates = bookingDates.filter((d) => {
        const iso = d.toISOString().split('T')[0];
        return !excludeSet.has(iso);
      });

      // Check for conflicts on remaining dates
      const conflictingDates: string[] = [];
      for (const bookingDate of filteredBookingDates) {
        const hasConflict = await storage.checkBookingConflict(
          roomId,
          bookingDate,
          startTime,
          endTime
        );
        if (hasConflict) {
          conflictingDates.push(bookingDate.toISOString().split('T')[0]);
        }
      }

      // Return all dates in ISO format for conflict resolution UI
      const allDates = filteredBookingDates.map((d) => d.toISOString().split('T')[0]);

      if (conflictingDates.length > 0) {
        return res.status(409).json({ 
          message: `Conflicts found on: ${conflictingDates.join(', ')}`,
          conflictingDates,
          allDates
        });
      }

      // Use filtered dates for creation
      const bookingDatesToCreate = filteredBookingDates;

      // Generate a bookingGroupId for recurring bookings to link them together
      const finalBookingGroupId = isRecurringBooking ? (bookingGroupId || uuidv4()) : (bookingGroupId || null);
      
      // Create all bookings
      const createdBookings = [];
      let parentBookingId: string | null = null;
      
      for (let i = 0; i < bookingDatesToCreate.length; i++) {
        const bookingDate = bookingDatesToCreate[i];
        const bookingData = {
          roomId,
          organizationId: orgId,
          date: bookingDate,
          startTime,
          endTime,
          eventName,
          purpose,
          attendees,
          selectedItems: selectedItems || [],
          visibility: visibility || "private",
          isRecurring: isRecurringBooking,
          recurrencePattern: isRecurringBooking ? recurrencePattern : null,
          recurrenceEndDate: isRecurringBooking ? parsedRecurrenceEndDate : null,
          recurrenceDays: isRecurringBooking && parsedRecurrenceDays.length > 0 ? parsedRecurrenceDays.map(String) : null,
          recurrenceWeekOfMonth: isRecurringBooking && parsedRecurrenceWeekOfMonth !== null ? parsedRecurrenceWeekOfMonth : null,
          recurrenceDayOfWeek: isRecurringBooking && parsedRecurrenceDayOfWeek !== null ? parsedRecurrenceDayOfWeek : null,
          parentBookingId: i === 0 ? null : parentBookingId,
          bookingGroupId: finalBookingGroupId,
          adminNotes: adminNotes || null,
        };
        
        const result = insertBookingSchema.safeParse(bookingData);
        if (!result.success) {
          console.error("Admin booking validation error:", JSON.stringify(result.error.errors, null, 2));
          console.error("Admin booking data that failed:", JSON.stringify(bookingData, null, 2));
          return res.status(400).json({ 
            message: "Invalid booking data", 
            errors: result.error.errors,
            details: result.error.format()
          });
        }

        const booking = await storage.createBooking(result.data, userId);
        createdBookings.push(booking);
        
        // The first booking becomes the parent for subsequent bookings
        if (i === 0) {
          parentBookingId = booking.id;
        }
      }
      
      // Send confirmation email for the first booking
      const customer = await storage.getUser(userId);
      const room = await storage.getRoom(roomId);
      if (customer && room && createdBookings.length > 0) {
        const firstBooking = createdBookings[0];
        sendBookingNotification("confirmation", firstBooking, room, customer).catch((err) => {
          console.error("Failed to send confirmation email:", err);
        });
      }
      
      res.status(201).json(isRecurringBooking ? createdBookings : createdBookings[0]);
    } catch (error) {
      console.error("Error creating admin booking:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  // Site settings routes
  app.get("/api/settings", async (_req, res) => {
    try {
      let settings = await storage.getSiteSettings();
      if (!settings) {
        // Create default settings if none exist
        settings = await storage.updateSiteSettings({});
      }
      // Return public settings (exclude sensitive API keys)
      const publicSettings = {
        id: settings.id,
        centreName: settings.centreName,
        logoUrl: settings.logoUrl,
        authLogoUrl: settings.authLogoUrl,
        authHeroUrl: settings.authHeroUrl,
        authHeroUrlSecondary: settings.authHeroUrlSecondary,
        authHeadline: settings.authHeadline,
        authSubheadline: settings.authSubheadline,
        authFeature1: settings.authFeature1,
        authFeature2: settings.authFeature2,
        authFeature3: settings.authFeature3,
        authStatRooms: settings.authStatRooms,
        authStatMembers: settings.authStatMembers,
        authStatSatisfaction: settings.authStatSatisfaction,
        primaryColor: settings.primaryColor,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        address: settings.address,
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        timezone: settings.timezone,
        currency: settings.currency,
        paymentGateway: settings.paymentGateway,
        rentalFeesContent: settings.rentalFeesContent,
        agreementContent: settings.agreementContent,
        rentalFeesUrl: settings.rentalFeesUrl,
        agreementUrl: settings.agreementUrl,
      };
      res.json(publicSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.json({
        id: "default",
        centreName: "Community Centre",
        logoUrl: null,
        authLogoUrl: null,
        authHeroUrl: null,
        authHeroUrlSecondary: null,
        authHeadline: null,
        authSubheadline: null,
        authFeature1: null,
        authFeature2: null,
        authFeature3: null,
        authStatRooms: null,
        authStatMembers: null,
        authStatSatisfaction: null,
        primaryColor: "#16a34a",
        contactEmail: null,
        contactPhone: null,
        address: null,
        openingTime: "07:00",
        closingTime: "23:00",
        timezone: "America/Port_of_Spain",
        currency: "TTD",
        paymentGateway: "manual",
        rentalFeesContent: null,
        agreementContent: null,
        rentalFeesUrl: null,
        agreementUrl: null,
      });
    }
  });

  app.get("/api/admin/settings", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      let settings = await storage.getSiteSettings(orgId ?? undefined);
      if (!settings) {
        settings = await storage.updateSiteSettings({}, orgId ?? undefined);
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const settings = await storage.updateSiteSettings(req.body, orgId ?? undefined);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Enforce room limit per org plan
  app.post("/api/rooms", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      // Check room count limit (scoped to org)
      const roomCount = await storage.getRoomCount(orgId ?? undefined);
      if (roomCount >= 6) {
        return res.status(400).json({ message: "Maximum of 6 rooms allowed. Please delete a room before adding a new one." });
      }

      const result = insertRoomSchema.safeParse({ ...req.body, organizationId: orgId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid room data", errors: result.error });
      }

      const room = await storage.createRoom(result.data);
      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  // Additional items routes (public endpoint - active items only)
  app.get("/api/additional-items", async (_req, res) => {
    try {
      const items = await storage.getAdditionalItems();
      // Filter to only active items for public API
      res.json(items.filter(item => item.isActive));
    } catch (error) {
      console.error("Error fetching additional items:", error);
      res.status(500).json({ message: "Failed to fetch additional items" });
    }
  });

  // Admin routes for additional items (full CRUD)
  app.get("/api/admin/additional-items", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const items = await storage.getAdditionalItems(orgId ?? undefined);
      res.json(items);
    } catch (error) {
      console.error("Error fetching additional items:", error);
      res.status(500).json({ message: "Failed to fetch additional items" });
    }
  });

  app.post("/api/admin/additional-items", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const result = insertAdditionalItemSchema.safeParse({ ...req.body, organizationId: orgId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid item data", errors: result.error });
      }

      const item = await storage.createAdditionalItem(result.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating additional item:", error);
      res.status(500).json({ message: "Failed to create additional item" });
    }
  });

  app.patch("/api/admin/additional-items/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const item = await storage.updateAdditionalItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating additional item:", error);
      res.status(500).json({ message: "Failed to update additional item" });
    }
  });

  app.delete("/api/admin/additional-items/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      await storage.deleteAdditionalItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting additional item:", error);
      res.status(500).json({ message: "Failed to delete additional item" });
    }
  });

  // Amenities routes (public endpoint - active amenities only)
  app.get("/api/amenities", async (_req, res) => {
    try {
      const amenitiesList = await storage.getAmenities();
      res.json(amenitiesList.filter(a => a.isActive));
    } catch (error) {
      console.error("Error fetching amenities:", error);
      res.status(500).json({ message: "Failed to fetch amenities" });
    }
  });

  // Admin routes for amenities (full CRUD)
  app.get("/api/admin/amenities", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const amenitiesList = await storage.getAmenities(orgId ?? undefined);
      res.json(amenitiesList);
    } catch (error) {
      console.error("Error fetching amenities:", error);
      res.status(500).json({ message: "Failed to fetch amenities" });
    }
  });

  app.post("/api/admin/amenities", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      const orgId = getOrgId(req);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const result = insertAmenitySchema.safeParse({ ...req.body, organizationId: orgId });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid amenity data", errors: result.error });
      }

      const amenity = await storage.createAmenity(result.data);
      res.status(201).json(amenity);
    } catch (error) {
      console.error("Error creating amenity:", error);
      res.status(500).json({ message: "Failed to create amenity" });
    }
  });

  app.patch("/api/admin/amenities/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const amenity = await storage.updateAmenity(req.params.id, req.body);
      if (!amenity) {
        return res.status(404).json({ message: "Amenity not found" });
      }
      res.json(amenity);
    } catch (error) {
      console.error("Error updating amenity:", error);
      res.status(500).json({ message: "Failed to update amenity" });
    }
  });

  app.delete("/api/admin/amenities/:id", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      await storage.deleteAmenity(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting amenity:", error);
      res.status(500).json({ message: "Failed to delete amenity" });
    }
  });

  // Organization onboarding - creates org, links user, creates first room
  app.post("/api/organizations", requireAuth, attachUser, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { venueName, venueType, location, roomName, roomCapacity, plan } = req.body;

      if (!venueName || typeof venueName !== "string" || !venueName.trim()) {
        return res.status(400).json({ message: "Venue name is required" });
      }

      // Build a URL-friendly slug from the venue name
      const baseSlug = venueName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      const selectedPlan = plan === "paid" ? "paid" : plan === "premium" ? "premium" : "free";
      const maxRooms = selectedPlan === "free" ? 1 : 15;
      const isTrial = selectedPlan === "paid" || selectedPlan === "premium";
      const trialEndsAt = isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

      const [org] = await db
        .insert(organizations)
        .values({
          name: venueName.trim(),
          slug,
          plan: selectedPlan,
          maxRooms,
          subscriptionStatus: isTrial ? "trial" : "active",
          trialEndsAt,
        })
        .returning();

      // Link the current user to this organization and make them admin
      await db
        .update(usersTable)
        .set({
          organizationId: org.id,
          isAdmin: true,
          isSuperAdmin: true,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      // Create the first room
      const finalRoomName = (roomName && typeof roomName === "string" && roomName.trim()) ? roomName.trim() : "Main Hall";
      const finalCapacity = typeof roomCapacity === "number" && roomCapacity > 0 ? roomCapacity : 50;

      const [room] = await db
        .insert(roomsTable)
        .values({
          organizationId: org.id,
          name: finalRoomName,
          capacity: finalCapacity,
          isActive: true,
        })
        .returning();

      // Create default site settings for this organization
      await db
        .insert(siteSettingsTable)
        .values({
          organizationId: org.id,
          centreName: venueName.trim(),
        })
        .onConflictDoNothing();

      res.status(201).json({
        organization: org,
        room,
        message: "Organization created successfully",
      });
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
