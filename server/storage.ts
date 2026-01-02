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
import { eq, and, gte, desc, or, sql, count, ne } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, profile: UpdateUserProfile): Promise<User | undefined>;
  hasAnyAdmin(): Promise<boolean>;
  promoteToAdmin(id: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  // Admin management operations
  getAdmins(): Promise<User[]>;
  updateAdminUser(id: string, data: { isAdmin?: boolean; isSuperAdmin?: boolean; permissions?: any }): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Room operations
  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, room: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;

  // Booking operations
  getBookings(userId?: string): Promise<BookingWithMeta[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByRoom(roomId: string, fromDate: Date): Promise<Booking[]>;
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
  getSiteSettings(): Promise<SiteSettings | undefined>;
  updateSiteSettings(settings: Partial<InsertSiteSettings>): Promise<SiteSettings>;
  getRoomCount(): Promise<number>;

  // Additional items operations
  getAdditionalItems(): Promise<AdditionalItem[]>;
  getAdditionalItem(id: string): Promise<AdditionalItem | undefined>;
  createAdditionalItem(item: InsertAdditionalItem): Promise<AdditionalItem>;
  updateAdditionalItem(id: string, item: Partial<InsertAdditionalItem>): Promise<AdditionalItem | undefined>;
  deleteAdditionalItem(id: string): Promise<void>;

  // Amenities operations
  getAmenities(): Promise<Amenity[]>;
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
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    await this.ensureUsersColumns();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(): Promise<User[]> {
    await this.ensureUsersColumns();
    return await db.select().from(users).where(eq(users.isAdmin, false)).orderBy(desc(users.createdAt));
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
    // Important: Don't overwrite isAdmin when updating existing users
    // Only update non-admin fields to preserve admin status
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
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

  async getAdmins(): Promise<User[]> {
    await this.ensureUsersColumns();
    return await db.select().from(users).where(eq(users.isAdmin, true)).orderBy(desc(users.createdAt));
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
  async getRooms(): Promise<Room[]> {
    await this.ensureRoomsColumns();
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
  async getBookings(userId?: string): Promise<BookingWithMeta[]> {
    // Join with rooms and users to get enriched booking data
    const baseQuery = db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        userId: bookings.userId,
        date: bookings.date,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        eventName: bookings.eventName,
        purpose: bookings.purpose,
        attendees: bookings.attendees,
        status: bookings.status,
        visibility: bookings.visibility,
        selectedItems: bookings.selectedItems,
        bookingGroupId: bookings.bookingGroupId,
        parentBookingId: bookings.parentBookingId,
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

    if (userId) {
      return await baseQuery.where(eq(bookings.userId, userId));
    }
    return await baseQuery;
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
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    // Check for any confirmed or pending bookings that overlap with the requested time slot
    const conditions = [
      eq(bookings.roomId, roomId),
      eq(bookings.date, date),
      or(eq(bookings.status, "confirmed"), eq(bookings.status, "pending")),
      // Check time overlap: (start1 < end2) AND (end1 > start2)
      sql`${bookings.startTime} < ${endTime}`,
      sql`${bookings.endTime} > ${startTime}`
    ];
    
    // Exclude the current booking if provided (for updates)
    if (excludeBookingId) {
      conditions.push(ne(bookings.id, excludeBookingId));
    }
    
    const [conflict] = await db
      .select()
      .from(bookings)
      .where(and(...conditions))
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

  async updateBooking(
    id: string,
    data: Partial<InsertBooking & { status: "pending" | "confirmed" | "cancelled" }>
  ): Promise<Booking | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.roomId) updateData.roomId = data.roomId;
    if (data.date) updateData.date = data.date;
    if (data.startTime) updateData.startTime = data.startTime;
    if (data.endTime) updateData.endTime = data.endTime;
    if (data.purpose) updateData.purpose = data.purpose;
    if (data.attendees) updateData.attendees = data.attendees;
    if (data.status) updateData.status = data.status;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
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
    return booking;
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

  async deleteBooking(id: string): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  // Site settings operations
  async getSiteSettings(): Promise<SiteSettings | undefined> {
    await this.ensureSiteSettingsColumns();
    const [settings] = await db.select().from(siteSettings).limit(1);
    return settings;
  }

  async updateSiteSettings(settingsData: Partial<InsertSiteSettings>): Promise<SiteSettings> {
    await this.ensureSiteSettingsColumns();
    // Get existing settings or create new
    const existing = await this.getSiteSettings();
    
    if (existing) {
      const [updated] = await db
        .update(siteSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(siteSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(siteSettings)
        .values(settingsData as InsertSiteSettings)
        .returning();
      return created;
    }
  }

  async getRoomCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(rooms);
    return result?.count ?? 0;
  }

  // Additional items operations
  async getAdditionalItems(): Promise<AdditionalItem[]> {
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
  async getAmenities(): Promise<Amenity[]> {
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
