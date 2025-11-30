import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertRoomSchema, insertBookingSchema, insertSiteSettingsSchema, insertAdditionalItemSchema, insertAmenitySchema, updateUserProfileSchema } from "@shared/schema";
import { sendBookingNotification } from "./emailService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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

  // Admin customers list route
  app.get("/api/admin/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }
      
      const customers = await storage.getUsers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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

      if (isRecurring && (!recurrencePattern || !recurrenceEndDate)) {
        return res.status(400).json({ message: "Recurring bookings require pattern and end date" });
      }

      // Calculate all booking dates for recurring bookings
      const bookingDates: Date[] = [parsedDate];
      
      if (isRecurring && recurrenceEndDate) {
        let currentDate = new Date(parsedDate);
        
        while (true) {
          if (recurrencePattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrencePattern === 'weekly') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (recurrencePattern === 'monthly') {
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
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
          parentBookingId: i === 0 ? null : parentBookingId,
        };
        
        const result = insertBookingSchema.safeParse(bookingData);
        if (!result.success) {
          return res.status(400).json({ message: "Invalid booking data", errors: result.error });
        }

        const booking = await storage.createBooking(result.data, userId);
        createdBookings.push(booking);
        
        // The first booking becomes the parent for subsequent bookings
        if (i === 0) {
          parentBookingId = booking.id;
        }
      }
      
      // Send confirmation email for the first booking (async, don't await to avoid blocking response)
      const user = await storage.getUser(userId);
      const room = await storage.getRoom(req.body.roomId);
      if (user && room && createdBookings.length > 0) {
        const firstBooking = createdBookings[0];
        const emailContent = isRecurring 
          ? { ...firstBooking, _recurringInfo: `This is a recurring booking (${recurrencePattern}) with ${createdBookings.length} occurrences.` }
          : firstBooking;
        sendBookingNotification("confirmation", emailContent, room, user).catch((err) => {
          console.error("Failed to send confirmation email:", err);
        });
      }
      
      // Return first booking for single, or array for recurring
      res.status(201).json(isRecurring ? createdBookings : createdBookings[0]);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.patch("/api/bookings/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      const { status, reason } = req.body;
      if (!["approved", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const booking = await storage.updateBookingStatus(req.params.id, status);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Send approval/rejection email
      const bookingUser = await storage.getUser(booking.userId);
      const room = await storage.getRoom(booking.roomId);
      if (bookingUser && room) {
        const notificationType = status === "approved" ? "approval" : "rejection";
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
      
      if (!user?.isAdmin) {
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

      const { userId, roomId, date, startTime, endTime, eventName, purpose, attendees, selectedItems, visibility, isRecurring, recurrencePattern, recurrenceEndDate } = req.body;

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

      if (isRecurringBooking && (!recurrencePattern || !parsedRecurrenceEndDate)) {
        return res.status(400).json({ message: "Recurring bookings require pattern and end date" });
      }

      // Calculate all booking dates for recurring bookings
      const bookingDates: Date[] = [parsedDate];
      
      if (isRecurringBooking && parsedRecurrenceEndDate) {
        let currentDate = new Date(parsedDate);
        
        while (true) {
          if (recurrencePattern === 'daily') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (recurrencePattern === 'weekly') {
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (recurrencePattern === 'monthly') {
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
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
          parentBookingId: i === 0 ? null : parentBookingId,
        };
        
        const result = insertBookingSchema.safeParse(bookingData);
        if (!result.success) {
          return res.status(400).json({ message: "Invalid booking data", errors: result.error });
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
      
      if (!user?.isAdmin) {
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
