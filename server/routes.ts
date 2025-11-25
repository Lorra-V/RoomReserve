import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertRoomSchema, insertBookingSchema, insertSiteSettingsSchema } from "@shared/schema";
import { sendBookingNotification } from "./emailService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes - returns user data if authenticated, otherwise null (no 401)
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.json(null);
      }
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
      const parsedDate = req.body.date ? new Date(req.body.date) : new Date();
      
      // Explicitly check for invalid dates
      if (isNaN(parsedDate.valueOf())) {
        return res.status(400).json({ message: "Invalid date provided" });
      }
      
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(req.body.startTime) || !timeRegex.test(req.body.endTime)) {
        return res.status(400).json({ message: "Invalid time format. Use HH:MM" });
      }
      
      // Validate end time is after start time
      if (req.body.endTime <= req.body.startTime) {
        return res.status(400).json({ message: "End time must be after start time" });
      }
      
      const bookingData = {
        ...req.body,
        date: parsedDate,
      };
      
      const result = insertBookingSchema.safeParse(bookingData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid booking data", errors: result.error });
      }

      // Check for booking conflicts
      const hasConflict = await storage.checkBookingConflict(
        result.data.roomId,
        result.data.date,
        result.data.startTime,
        result.data.endTime
      );
      
      if (hasConflict) {
        return res.status(409).json({ message: "This time slot is already booked or pending approval" });
      }

      const booking = await storage.createBooking(result.data, userId);
      
      // Send confirmation email (async, don't await to avoid blocking response)
      const user = await storage.getUser(userId);
      const room = await storage.getRoom(result.data.roomId);
      if (user && room) {
        sendBookingNotification("confirmation", booking, room, user).catch((err) => {
          console.error("Failed to send confirmation email:", err);
        });
      }
      
      res.status(201).json(booking);
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

  const httpServer = createServer(app);
  return httpServer;
}
