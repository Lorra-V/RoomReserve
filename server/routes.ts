import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertRoomSchema, insertBookingSchema, insertSiteSettingsSchema, insertAdditionalItemSchema, insertAmenitySchema, updateUserProfileSchema } from "@shared/schema";
import { sendBookingNotification } from "./emailService";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Configure multer for file uploads (must be before routes that use it)
  const upload = multer({ storage: multer.memoryStorage() });

  // Auth routes - returns user data if authenticated, otherwise null (no 401)
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        console.log("[Auth User] Not authenticated or no user");
        return res.json(null);
      }
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      console.log("[Auth User] Returning user:", {
        userId,
        email: user?.email,
        isAdmin: user?.isAdmin,
        isSuperAdmin: user?.isSuperAdmin,
      });
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile update route
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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
  app.post("/api/user/profile/image", isAuthenticated, upload.single("image"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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
  app.get("/api/admin/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      
      const customers = await storage.getUsers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Admin create customer route
  app.post("/api/admin/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { email, firstName, lastName, phone, organization } = req.body;

      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Generate a unique ID for the new user
      const newUserId = `admin_created_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newUser = await storage.upsertUser({
        id: newUserId,
        email,
        firstName,
        lastName,
        phone: phone || null,
        organization: organization || null,
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

  // Admin update customer route
  app.patch("/api/admin/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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
  app.delete("/api/admin/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Super admin access required" });
      }
      next();
    } catch (error) {
      console.error("Error checking super admin:", error);
      res.status(500).json({ message: "Failed to verify super admin status" });
    }
  };

  // Endpoint to promote a user to super admin by email (for initial setup)
  app.post("/api/admin/promote-super-admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      // Only allow if current user is already a super admin, or if no super admin exists
      const admins = await storage.getAdmins();
      const hasSuperAdmin = admins.some(a => a.isSuperAdmin);
      
      if (!hasSuperAdmin || currentUser?.isSuperAdmin) {
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
  app.get("/api/admin/admins", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const admins = await storage.getAdmins();
      res.json(admins);
    } catch (error) {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: "Failed to fetch admins" });
    }
  });

  app.post("/api/admin/admins", isAuthenticated, isSuperAdmin, async (req: any, res) => {
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

  app.patch("/api/admin/admins/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const adminId = req.params.id;
      const { isAdmin, isSuperAdmin: isSuper, permissions } = req.body;

      // Prevent super admins from demoting themselves
      const currentUserId = req.user.claims.sub;
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

  app.delete("/api/admin/admins/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const adminId = req.params.id;
      const currentUserId = req.user.claims.sub;

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
  app.post("/api/admin/customers/import", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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
          const allUsers = await storage.getUsers();
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
  app.post("/api/admin/bookings/import", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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

      // Get all rooms and users for lookup
      const allRooms = await storage.getRooms();
      const allUsers = await storage.getUsers();

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
            date: bookingDate,
            startTime,
            endTime,
            status: (status === "confirmed" || status === "cancelled" ? status : "pending") as "pending" | "confirmed" | "cancelled",
            purpose: purpose || undefined,
            eventName: eventName || undefined,
            attendees: attendees || undefined,
            visibility: visibility === "public" ? "public" : "private",
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
  app.post("/api/admin/bootstrap", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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

  app.patch("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const room = await storage.updateRoom(req.params.id, req.body);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ message: "Failed to update room" });
    }
  });

  app.delete("/api/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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
  app.get("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Admins can see all bookings, users see only their own
      const bookings = user?.isAdmin
        ? await storage.getBookings()
        : await storage.getBookings(userId);
        
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/rooms/:roomId/bookings", async (req, res) => {
    try {
      const { roomId } = req.params;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : new Date();
      
      const bookings = await storage.getBookingsByRoom(roomId, fromDate);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching room bookings:", error);
      res.status(500).json({ message: "Failed to fetch room bookings" });
    }
  });

  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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
      
      // Ensure date is set to start of day to avoid timezone issues
      parsedDate.setHours(0, 0, 0, 0);
      
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

      // Create all bookings
      const createdBookings = [];
      let parentBookingId: string | null = null;
      
      for (let i = 0; i < bookingDates.length; i++) {
        const date = bookingDates[i];
        const bookingData = {
          roomId: req.body.roomId,
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
      const user = await storage.getUser(userId);
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

  app.patch("/api/bookings/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { status, reason } = req.body;
      if (!["confirmed", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const booking = await storage.updateBookingStatus(req.params.id, status);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Send confirmation/rejection email
      const bookingUser = await storage.getUser(booking.userId);
      const room = await storage.getRoom(booking.roomId);
      if (bookingUser && room) {
        const notificationType = status === "confirmed" ? "approval" : "rejection";
        sendBookingNotification(notificationType, booking, room, bookingUser, reason).catch((err) => {
          console.error(`Failed to send ${notificationType} email:`, err);
        });
      }
      
      res.json(booking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  // Super admin endpoint to permanently delete bookings
  app.delete("/api/admin/bookings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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

  app.delete("/api/bookings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Admin booking edit route
  app.patch("/api/admin/bookings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { date, startTime, endTime, purpose, attendees, status, visibility } = req.body;
      
      // Parse and validate the date
      const parsedDate = date ? new Date(date) : undefined;
      if (parsedDate && isNaN(parsedDate.valueOf())) {
        return res.status(400).json({ message: "Invalid date provided" });
      }

      const booking = await storage.updateBooking(req.params.id, {
        date: parsedDate,
        startTime,
        endTime,
        purpose,
        attendees,
        status,
        visibility,
      });
      
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      res.json(booking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  // Admin booking creation route (on behalf of customer)
  app.post("/api/admin/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const adminUserId = req.user.claims.sub;
      const adminUser = await storage.getUser(adminUserId);
      
      if (!adminUser?.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { userId, roomId, date, startTime, endTime, eventName, purpose, attendees, selectedItems, visibility, isRecurring, recurrencePattern, recurrenceEndDate, recurrenceDays, recurrenceWeekOfMonth, recurrenceDayOfWeek } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Customer selection is required" });
      }

      // Parse and validate the date
      const parsedDate = date ? new Date(date) : new Date();
      if (isNaN(parsedDate.valueOf())) {
        return res.status(400).json({ message: "Invalid date provided" });
      }
      
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

      // Check for conflicts on all dates
      const conflictingDates: string[] = [];
      for (const bookingDate of bookingDates) {
        const hasConflict = await storage.checkBookingConflict(
          roomId,
          bookingDate,
          startTime,
          endTime
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

      // Create all bookings
      const createdBookings = [];
      let parentBookingId: string | null = null;
      
      for (let i = 0; i < bookingDates.length; i++) {
        const bookingDate = bookingDates[i];
        const bookingData = {
          roomId,
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
        primaryColor: settings.primaryColor,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        address: settings.address,
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        timezone: settings.timezone,
        currency: settings.currency,
        paymentGateway: settings.paymentGateway,
      };
      res.json(publicSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/admin/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      let settings = await storage.getSiteSettings();
      if (!settings) {
        settings = await storage.updateSiteSettings({});
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const settings = await storage.updateSiteSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Enforce 6-room limit in room creation
  app.post("/api/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      // Check room count limit
      const roomCount = await storage.getRoomCount();
      if (roomCount >= 6) {
        return res.status(400).json({ message: "Maximum of 6 rooms allowed. Please delete a room before adding a new one." });
      }

      const result = insertRoomSchema.safeParse(req.body);
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
  app.get("/api/admin/additional-items", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const items = await storage.getAdditionalItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching additional items:", error);
      res.status(500).json({ message: "Failed to fetch additional items" });
    }
  });

  app.post("/api/admin/additional-items", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const result = insertAdditionalItemSchema.safeParse(req.body);
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

  app.patch("/api/admin/additional-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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

  app.delete("/api/admin/additional-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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
  app.get("/api/admin/amenities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const amenitiesList = await storage.getAmenities();
      res.json(amenitiesList);
    } catch (error) {
      console.error("Error fetching amenities:", error);
      res.status(500).json({ message: "Failed to fetch amenities" });
    }
  });

  app.post("/api/admin/amenities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin && !user?.isSuperAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const result = insertAmenitySchema.safeParse(req.body);
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

  app.patch("/api/admin/amenities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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

  app.delete("/api/admin/amenities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
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

  const httpServer = createServer(app);
  return httpServer;
}
