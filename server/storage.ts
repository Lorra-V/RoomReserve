import {
  users,
  rooms,
  bookings,
  siteSettings,
  additionalItems,
  amenities,
  type User,
  type UpsertUser,
  type Room,
  type InsertRoom,
  type Booking,
  type InsertBooking,
  type BookingWithMeta,
  type SiteSettings,
  type InsertSiteSettings,
  type AdditionalItem,
  type InsertAdditionalItem,
  type UpdateUserProfile,
  type Amenity,
  type InsertAmenity,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, or, sql, count, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const padTime = (value: number) => value.toString().padStart(2, "0");

const normalizeTimeString = (value: string) => {
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
};

const toTimestampString = (date: Date | string, time: string) => {
  const normalized = normalizeTimeString(time);
  if (!normalized) {
    return time;
  }
  let datePart: string | null = null;
  if (date instanceof Date) {
    datePart = `${date.getUTCFullYear()}-${padTime(date.getUTCMonth() + 1)}-${padTime(date.getUTCDate())}`;
  } else if (typeof date === "string") {
    datePart = date.trim().split("T")[0].split(" ")[0] || null;
  }
  if (!datePart) {
    return time;
  }
  return `${datePart} ${normalized}:00`;
};

const toDateOnlyString = (value: Date | string | null | undefined): string => {
  if (value === null || value === undefined) {
    const today = new Date();
    return `${today.getUTCFullYear()}-${padTime(today.getUTCMonth() + 1)}-${padTime(today.getUTCDate())}`;
  }
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${padTime(value.getUTCMonth() + 1)}-${padTime(value.getUTCDate())}`;
  }
  const str = String(value).trim();
  return str.split("T")[0].split(" ")[0];
};

const toDisplayTime = (value: unknown) => {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return `${padTime(value.getHours())}:${padTime(value.getMinutes())}`;
  }
  const str = String(value);
  const normalized = normalizeTimeString(str);
  return normalized ?? str;
};

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUsers(organizationId?: string): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, profile: UpdateUserProfile): Promise<User | undefined>;
  hasAnyAdmin(): Promise<boolean>;
  promoteToAdmin(id: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  // Admin management operations
  getAdmins(organizationId?: string): Promise<User[]>;
  updateAdminUser(id: string, data: { isAdmin?: boolean; isSuperAdmin?: boolean; permissions?: any }): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Room operations
  getRooms(organizationId?: string): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, room: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;

  // Booking operations
  getBookings(userId?: string, fromDate?: Date, toDate?: Date, organizationId?: string): Promise<BookingWithMeta[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByRoom(roomId: string, fromDate: Date, toDate?: Date, organizationId?: string): Promise<Booking[]>;
  checkBookingConflict(
    roomId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean>;
  createBooking(booking: InsertBooking, userId: string): Promise<Booking>;
  updateBooking(id: string, data: Partial<InsertBooking & { status: "pending" | "confirmed" | "cancelled" }>): Promise<Booking | undefined>;
  updateBookingStatus(
    id: string,
    status: "pending" | "confirmed" | "cancelled"
  ): Promise<Booking | undefined>;
  cancelBooking(id: string, userId: string): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<void>;

  // Site settings operations
  getSiteSettings(organizationId?: string): Promise<SiteSettings | undefined>;
  updateSiteSettings(settings: Partial<InsertSiteSettings>, organizationId?: string): Promise<SiteSettings>;
  getRoomCount(organizationId?: string): Promise<number>;

  // Additional items operations
  getAdditionalItems(organizationId?: string): Promise<AdditionalItem[]>;
  getAdditionalItem(id: string): Promise<AdditionalItem | undefined>;
  createAdditionalItem(item: InsertAdditionalItem): Promise<AdditionalItem>;
  updateAdditionalItem(id: string, item: Partial<InsertAdditionalItem>): Promise<AdditionalItem | undefined>;
  deleteAdditionalItem(id: string): Promise<void>;

  // Amenities operations
  getAmenities(organizationId?: string): Promise<Amenity[]>;
  getAmenity(id: string): Promise<Amenity | undefined>;
  createAmenity(amenity: InsertAmenity): Promise<Amenity>;
  updateAmenity(id: string, amenity: Partial<InsertAmenity>): Promise<Amenity | undefined>;
  deleteAmenity(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Ensure new site_settings columns exist (idempotent)
  private async ensureSiteSettingsColumns() {
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_logo_url text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_hero_url text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_hero_url_secondary text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_headline text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_subheadline text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_feature_1 text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_feature_2 text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_feature_3 text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_stat_rooms text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_stat_members text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS auth_stat_satisfaction text`);
    await db.execute(sql`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS email_admin_notification_template text`);
  }

  private async ensureRoomsColumns() {
    await db.execute(sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description text`);
  }

  private async ensureUsersColumns() {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'dd-MMM-yyyy'`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id varchar(255)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique ON users (clerk_user_id)`);
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    await this.ensureUsersColumns();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(organizationId?: string): Promise<User[]> {
    await this.ensureUsersColumns();
    const conditions = [eq(users.isAdmin, false)];
    if (organizationId) {
      conditions.push(eq(users.organizationId, organizationId));
    }
    return await db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt));
  }

  async updateUserProfile(id: string, profile: UpdateUserProfile): Promise<User | undefined> {
    await this.ensureUsersColumns();
    const [user] = await db
      .update(users)
      .set({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || null,
        organization: profile.organization || null,
        profileImageUrl: profile.profileImageUrl || null,
        dateFormat: profile.dateFormat || null,
        profileComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    await this.ensureUsersColumns();
    const derivedName = [userData.firstName, userData.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const upsertData = {
      ...userData,
      name: userData.name || derivedName || userData.email || "Unknown User",
    };
    // Important: Don't overwrite isAdmin when updating existing users
    // Only update non-admin fields to preserve admin status
    const [user] = await db
      .insert(users)
      .values(upsertData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: upsertData.email,
          name: upsertData.name,
          firstName: upsertData.firstName,
          lastName: upsertData.lastName,
          profileImageUrl: upsertData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async hasAnyAdmin(): Promise<boolean> {
    await this.ensureUsersColumns();
    const [admin] = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
    return !!admin;
  }

  async promoteToAdmin(id: string): Promise<User | undefined> {
    await this.ensureUsersColumns();
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

  async getAdmins(organizationId?: string): Promise<User[]> {
    await this.ensureUsersColumns();
    const conditions = [eq(users.isAdmin, true)];
    if (organizationId) {
      conditions.push(eq(users.organizationId, organizationId));
    }
    return await db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt));
  }

  async updateAdminUser(id: string, data: { isAdmin?: boolean; isSuperAdmin?: boolean; permissions?: any }): Promise<User | undefined> {
    await this.ensureUsersColumns();
    const updateData: any = { updatedAt: new Date() };
    if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;
    if (data.isSuperAdmin !== undefined) updateData.isSuperAdmin = data.isSuperAdmin;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureUsersColumns();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await this.ensureUsersColumns();
    await db.delete(users).where(eq(users.id, id));
  }

  // Room operations
  async getRooms(organizationId?: string): Promise<Room[]> {
    await this.ensureRoomsColumns();
    if (organizationId) {
      return await db.select().from(rooms).where(eq(rooms.organizationId, organizationId)).orderBy(rooms.name);
    }
    return await db.select().from(rooms).orderBy(rooms.name);
  }

  async getRoom(id: string): Promise<Room | undefined> {
    await this.ensureRoomsColumns();
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
  async getBookings(userId?: string, fromDate?: Date, toDate?: Date, organizationId?: string): Promise<BookingWithMeta[]> {
    // Join with rooms and users to get enriched booking data
    const baseQuery = db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        userId: bookings.userId,
        date: sql<string>`${bookings.date}::text`,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        eventName: bookings.eventName,
        purpose: bookings.purpose,
        attendees: bookings.attendees,
        status: bookings.status,
        visibility: bookings.visibility,
        selectedItems: bookings.selectedItems,
        isRecurring: bookings.isRecurring,
        recurrencePattern: bookings.recurrencePattern,
        recurrenceEndDate: bookings.recurrenceEndDate,
        recurrenceDays: bookings.recurrenceDays,
        recurrenceWeekOfMonth: bookings.recurrenceWeekOfMonth,
        recurrenceDayOfWeek: bookings.recurrenceDayOfWeek,
        bookingGroupId: bookings.bookingGroupId,
        parentBookingId: bookings.parentBookingId,
        organizationId: bookings.organizationId,
        adminNotes: bookings.adminNotes,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        roomName: sql<string>`COALESCE(${rooms.name}, 'Unknown Room')`,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, 'Unknown User')`,
        userEmail: users.email,
        userPhone: users.phone,
        userOrganization: users.organization,
      })
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .orderBy(bookings.date);

    const result = await ((): Promise<BookingWithMeta[]> => {
      const conditions = [];
      if (organizationId) conditions.push(eq(bookings.organizationId, organizationId));
      if (userId) conditions.push(eq(bookings.userId, userId));
      if (fromDate) conditions.push(gte(bookings.date, fromDate));
      if (toDate) conditions.push(lte(bookings.date, toDate));

      if (conditions.length > 0) {
        return baseQuery.where(and(...conditions));
      }
      return baseQuery;
    })();

    console.log("[getBookings] raw DB result", result);

    return result.map((booking) => {
      console.log("[getBookings] booking.date before map", booking.date);
      const mapped = {
        ...booking,
        date: toDateOnlyString(booking.date),
        startTime: toDisplayTime(booking.startTime),
        endTime: toDisplayTime(booking.endTime),
      };
      console.log("[getBookings] mapped booking", mapped);
      return mapped;
    });
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        userId: bookings.userId,
        date: sql<string>`${bookings.date}::text`,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        eventName: bookings.eventName,
        purpose: bookings.purpose,
        attendees: bookings.attendees,
        status: bookings.status,
        visibility: bookings.visibility,
        selectedItems: bookings.selectedItems,
        isRecurring: bookings.isRecurring,
        recurrencePattern: bookings.recurrencePattern,
        recurrenceEndDate: bookings.recurrenceEndDate,
        recurrenceDays: bookings.recurrenceDays,
        recurrenceWeekOfMonth: bookings.recurrenceWeekOfMonth,
        recurrenceDayOfWeek: bookings.recurrenceDayOfWeek,
        bookingGroupId: bookings.bookingGroupId,
        parentBookingId: bookings.parentBookingId,
        organizationId: bookings.organizationId,
        adminNotes: bookings.adminNotes,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, id));
    if (!booking) {
      return booking;
    }
    return {
      ...booking,
      date: toDateOnlyString(booking.date),
      startTime: toDisplayTime(booking.startTime),
      endTime: toDisplayTime(booking.endTime),
    };
  }

  async getBookingsByRoom(roomId: string, fromDate: Date, toDate?: Date, organizationId?: string): Promise<Booking[]> {
    const conditions = [eq(bookings.roomId, roomId)];
    if (organizationId) {
      conditions.push(eq(bookings.organizationId, organizationId));
    }
    
    // If toDate is provided, filter by date range; otherwise, only filter by fromDate (for backward compatibility)
    if (toDate) {
      conditions.push(gte(bookings.date, fromDate));
      conditions.push(lte(bookings.date, toDate));
      console.log(`[Storage] Querying bookings for room ${roomId} with date range:`, {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        fromDateLocal: fromDate.toLocaleString(),
        toDateLocal: toDate.toLocaleString()
      });
    } else {
      conditions.push(gte(bookings.date, fromDate));
      console.log(`[Storage] Querying bookings for room ${roomId} from date:`, {
        fromDate: fromDate.toISOString(),
        fromDateLocal: fromDate.toLocaleString()
      });
    }
    
    const result = await db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        userId: bookings.userId,
        date: sql<string>`${bookings.date}::text`,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        eventName: bookings.eventName,
        purpose: bookings.purpose,
        attendees: bookings.attendees,
        status: bookings.status,
        visibility: bookings.visibility,
        selectedItems: bookings.selectedItems,
        isRecurring: bookings.isRecurring,
        recurrencePattern: bookings.recurrencePattern,
        recurrenceEndDate: bookings.recurrenceEndDate,
        recurrenceDays: bookings.recurrenceDays,
        recurrenceWeekOfMonth: bookings.recurrenceWeekOfMonth,
        recurrenceDayOfWeek: bookings.recurrenceDayOfWeek,
        bookingGroupId: bookings.bookingGroupId,
        parentBookingId: bookings.parentBookingId,
        organizationId: bookings.organizationId,
        adminNotes: bookings.adminNotes,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .where(and(...conditions))
      .orderBy(bookings.date);
    
    console.log(`[Storage] Raw database result: ${result.length} bookings`, 
      result.map(b => ({
        id: b.id,
        rawDate: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status
      }))
    );
    
    const mapped = result.map((booking) => ({
      ...booking,
      date: toDateOnlyString(booking.date),
      startTime: toDisplayTime(booking.startTime),
      endTime: toDisplayTime(booking.endTime),
    }));
    
    console.log(`[Storage] Mapped bookings: ${mapped.length} bookings`, 
      mapped.map(b => ({
        id: b.id,
        mappedDate: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status
      }))
    );
    
    return mapped;
  }

  async checkBookingConflict(
    roomId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    // Use date-only string to avoid timezone mismatches between JS Date and postgres timestamp
    const datePart = date instanceof Date
      ? `${date.getUTCFullYear()}-${padTime(date.getUTCMonth() + 1)}-${padTime(date.getUTCDate())}`
      : String(date).trim().split("T")[0].split(" ")[0];

    const normalizedStart = normalizeTimeString(startTime) || startTime;
    const normalizedEnd = normalizeTimeString(endTime) || endTime;

    const conditions = [
      eq(bookings.roomId, roomId),
      sql`${bookings.date}::date = ${datePart}::date`,
      or(eq(bookings.status, "confirmed"), eq(bookings.status, "pending")),
      sql`${bookings.startTime}::time < ${normalizedEnd}::time`,
      sql`${bookings.endTime}::time > ${normalizedStart}::time`
    ];
    
    if (excludeBookingId) {
      conditions.push(ne(bookings.id, excludeBookingId));
    }
    
    const [conflict] = await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .limit(1);

    console.log(`[checkBookingConflict] room=${roomId} date=${datePart} time=${normalizedStart}-${normalizedEnd} conflict=${!!conflict}`,
      conflict ? { id: conflict.id, date: conflict.date, start: conflict.startTime, end: conflict.endTime, status: conflict.status } : null
    );
    
    return !!conflict;
  }

  async createBooking(
    bookingData: InsertBooking,
    userId: string
  ): Promise<Booking> {
    const startTimeValue = toTimestampString(bookingData.date, bookingData.startTime);
    const endTimeValue = toTimestampString(bookingData.date, bookingData.endTime);
    const [booking] = await db
      .insert(bookings)
      .values({
        id: uuidv4(),
        ...bookingData,
        startTime: startTimeValue,
        endTime: endTimeValue,
        userId,
      })
      .returning();
    return {
      ...booking,
      date: toDateOnlyString(booking.date),
      startTime: toDisplayTime(booking.startTime),
      endTime: toDisplayTime(booking.endTime),
    };
  }

  async updateBooking(
    id: string,
    data: Partial<InsertBooking & { status: "pending" | "confirmed" | "cancelled" }>
  ): Promise<Booking | undefined> {
    let bookingDate: Date | string | undefined = data.date;
    if ((data.startTime || data.endTime) && !bookingDate) {
      const existing = await this.getBooking(id);
      bookingDate = existing?.date;
    }
    const updateData: any = { updatedAt: new Date() };
    if (data.roomId) updateData.roomId = data.roomId;
    if (data.date) updateData.date = data.date;
    if (data.startTime) {
      updateData.startTime = bookingDate
        ? toTimestampString(bookingDate, data.startTime)
        : data.startTime;
    }
    if (data.endTime) {
      updateData.endTime = bookingDate
        ? toTimestampString(bookingDate, data.endTime)
        : data.endTime;
    }
    if (data.purpose) updateData.purpose = data.purpose;
    if (data.attendees) updateData.attendees = data.attendees;
    if (data.status) updateData.status = data.status;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes;
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    if (data.recurrencePattern !== undefined) updateData.recurrencePattern = data.recurrencePattern;
    if (data.recurrenceEndDate !== undefined) updateData.recurrenceEndDate = data.recurrenceEndDate;
    if (data.recurrenceDays !== undefined) updateData.recurrenceDays = data.recurrenceDays;
    if (data.recurrenceWeekOfMonth !== undefined) updateData.recurrenceWeekOfMonth = data.recurrenceWeekOfMonth;
    if (data.recurrenceDayOfWeek !== undefined) updateData.recurrenceDayOfWeek = data.recurrenceDayOfWeek;
    if (data.bookingGroupId !== undefined) updateData.bookingGroupId = data.bookingGroupId;
    if (data.parentBookingId !== undefined) updateData.parentBookingId = data.parentBookingId;
    
    const [booking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, id))
      .returning();
    if (!booking) {
      return booking;
    }
    return {
      ...booking,
      date: toDateOnlyString(booking.date),
      startTime: toDisplayTime(booking.startTime),
      endTime: toDisplayTime(booking.endTime),
    };
  }

  async updateBookingStatus(
    id: string,
    status: "pending" | "confirmed" | "cancelled"
  ): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    if (!booking) {
      return booking;
    }
    return {
      ...booking,
      date: toDateOnlyString(booking.date),
    };
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
    if (!booking) {
      return booking;
    }
    return {
      ...booking,
      date: toDateOnlyString(booking.date),
    };
  }

  async deleteBooking(id: string): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  // Site settings operations
  async getSiteSettings(organizationId?: string): Promise<SiteSettings | undefined> {
    await this.ensureSiteSettingsColumns();
    if (organizationId) {
      const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.organizationId, organizationId)).limit(1);
      return settings;
    }
    const [settings] = await db.select().from(siteSettings).limit(1);
    return settings;
  }

  async updateSiteSettings(settingsData: Partial<InsertSiteSettings>, organizationId?: string): Promise<SiteSettings> {
    await this.ensureSiteSettingsColumns();
    const existing = await this.getSiteSettings(organizationId);
    
    if (existing) {
      const [updated] = await db
        .update(siteSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(siteSettings.id, existing.id))
        .returning();
      return updated;
    }

    throw new Error("Site settings not found; cannot update without an existing row.");
  }

  async getRoomCount(organizationId?: string): Promise<number> {
    if (organizationId) {
      const [result] = await db.select({ count: count() }).from(rooms).where(eq(rooms.organizationId, organizationId));
      return result?.count ?? 0;
    }
    const [result] = await db.select({ count: count() }).from(rooms);
    return result?.count ?? 0;
  }

  // Additional items operations
  async getAdditionalItems(organizationId?: string): Promise<AdditionalItem[]> {
    if (organizationId) {
      return await db.select().from(additionalItems).where(eq(additionalItems.organizationId, organizationId)).orderBy(additionalItems.name);
    }
    return await db.select().from(additionalItems).orderBy(additionalItems.name);
  }

  async getAdditionalItem(id: string): Promise<AdditionalItem | undefined> {
    const [item] = await db.select().from(additionalItems).where(eq(additionalItems.id, id));
    return item;
  }

  async createAdditionalItem(itemData: InsertAdditionalItem): Promise<AdditionalItem> {
    const [item] = await db.insert(additionalItems).values(itemData).returning();
    return item;
  }

  async updateAdditionalItem(id: string, itemData: Partial<InsertAdditionalItem>): Promise<AdditionalItem | undefined> {
    const [item] = await db
      .update(additionalItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(additionalItems.id, id))
      .returning();
    return item;
  }

  async deleteAdditionalItem(id: string): Promise<void> {
    await db.delete(additionalItems).where(eq(additionalItems.id, id));
  }

  // Amenities operations
  async getAmenities(organizationId?: string): Promise<Amenity[]> {
    if (organizationId) {
      return await db.select().from(amenities).where(eq(amenities.organizationId, organizationId)).orderBy(amenities.name);
    }
    return await db.select().from(amenities).orderBy(amenities.name);
  }

  async getAmenity(id: string): Promise<Amenity | undefined> {
    const [amenity] = await db.select().from(amenities).where(eq(amenities.id, id));
    return amenity;
  }

  async createAmenity(amenityData: InsertAmenity): Promise<Amenity> {
    const [amenity] = await db.insert(amenities).values(amenityData).returning();
    return amenity;
  }

  async updateAmenity(id: string, amenityData: Partial<InsertAmenity>): Promise<Amenity | undefined> {
    const [amenity] = await db
      .update(amenities)
      .set({ ...amenityData, updatedAt: new Date() })
      .where(eq(amenities.id, id))
      .returning();
    return amenity;
  }

  async deleteAmenity(id: string): Promise<void> {
    await db.delete(amenities).where(eq(amenities.id, id));
  }
}

export const storage = new DatabaseStorage();
