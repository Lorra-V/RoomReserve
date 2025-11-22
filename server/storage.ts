import {
  users,
  rooms,
  bookings,
  type User,
  type UpsertUser,
  type Room,
  type InsertRoom,
  type Booking,
  type InsertBooking,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, or, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  hasAnyAdmin(): Promise<boolean>;
  promoteToAdmin(id: string): Promise<User | undefined>;

  // Room operations
  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, room: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;

  // Booking operations
  getBookings(userId?: string): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByRoom(roomId: string, fromDate: Date): Promise<Booking[]>;
  checkBookingConflict(
    roomId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<boolean>;
  createBooking(booking: InsertBooking, userId: string): Promise<Booking>;
  updateBookingStatus(
    id: string,
    status: "pending" | "approved" | "cancelled"
  ): Promise<Booking | undefined>;
  cancelBooking(id: string, userId: string): Promise<Booking | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async hasAnyAdmin(): Promise<boolean> {
    const [admin] = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
    return !!admin;
  }

  async promoteToAdmin(id: string): Promise<User | undefined> {
    // Use a transaction to prevent race conditions
    // This ensures only one user can become admin even under concurrent requests
    return await db.transaction(async (tx) => {
      // Check if admin exists within the transaction
      const [existingAdmin] = await tx
        .select()
        .from(users)
        .where(eq(users.isAdmin, true))
        .limit(1);
      
      if (existingAdmin) {
        throw new Error("Admin already exists");
      }
      
      // Promote user to admin
      const [user] = await tx
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      
      return user;
    });
  }

  // Room operations
  async getRooms(): Promise<Room[]> {
    return await db.select().from(rooms).orderBy(rooms.name);
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async createRoom(roomData: InsertRoom): Promise<Room> {
    const [room] = await db.insert(rooms).values(roomData).returning();
    return room;
  }

  async updateRoom(
    id: string,
    roomData: Partial<InsertRoom>
  ): Promise<Room | undefined> {
    const [room] = await db
      .update(rooms)
      .set({ ...roomData, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return room;
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(rooms).where(eq(rooms.id, id));
  }

  // Booking operations
  async getBookings(userId?: string): Promise<Booking[]> {
    if (userId) {
      return await db
        .select()
        .from(bookings)
        .where(eq(bookings.userId, userId))
        .orderBy(desc(bookings.date));
    }
    return await db.select().from(bookings).orderBy(desc(bookings.date));
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getBookingsByRoom(roomId: string, fromDate: Date): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, roomId),
          gte(bookings.date, fromDate)
        )
      )
      .orderBy(bookings.date);
  }

  async checkBookingConflict(
    roomId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    // Check for any approved or pending bookings that overlap with the requested time slot
    const [conflict] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, roomId),
          eq(bookings.date, date),
          or(eq(bookings.status, "approved"), eq(bookings.status, "pending")),
          // Check time overlap: (start1 < end2) AND (end1 > start2)
          sql`${bookings.startTime} < ${endTime}`,
          sql`${bookings.endTime} > ${startTime}`
        )
      )
      .limit(1);
    
    return !!conflict;
  }

  async createBooking(
    bookingData: InsertBooking,
    userId: string
  ): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values({
        ...bookingData,
        userId,
      })
      .returning();
    return booking;
  }

  async updateBookingStatus(
    id: string,
    status: "pending" | "approved" | "cancelled"
  ): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async cancelBooking(
    id: string,
    userId: string
  ): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(bookings.id, id), eq(bookings.userId, userId)))
      .returning();
    return booking;
  }
}

export const storage = new DatabaseStorage();
