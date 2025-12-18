import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  organization: varchar("organization"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  permissions: jsonb("permissions").$type<{
    manageBookings?: boolean;
    manageRooms?: boolean;
    manageCustomers?: boolean;
    manageAdmins?: boolean;
    manageSettings?: boolean;
    viewReports?: boolean;
  }>(),
  profileComplete: boolean("profile_complete").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  phone: true,
  organization: true,
  profileImageUrl: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  organization: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Site settings table - for centre customization
export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centreName: text("centre_name").notNull().default("Community Centre"),
  logoUrl: text("logo_url"),
  authLogoUrl: text("auth_logo_url"),
  authHeroUrl: text("auth_hero_url"),
  authHeroUrlSecondary: text("auth_hero_url_secondary"),
  authHeadline: text("auth_headline"),
  authSubheadline: text("auth_subheadline"),
  authFeature1: text("auth_feature_1"),
  authFeature2: text("auth_feature_2"),
  authFeature3: text("auth_feature_3"),
  authStatRooms: text("auth_stat_rooms"),
  authStatMembers: text("auth_stat_members"),
  authStatSatisfaction: text("auth_stat_satisfaction"),
  primaryColor: text("primary_color").default("#16a34a"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  openingTime: text("opening_time").default("07:00"),
  closingTime: text("closing_time").default("23:00"),
  timezone: text("timezone").default("America/Port_of_Spain"),
  currency: text("currency").default("TTD"),
  paymentGateway: text("payment_gateway", { enum: ["wipay", "stripe", "manual"] }).default("manual"),
  wipayAccountId: text("wipay_account_id"),
  wipayApiKey: text("wipay_api_key"),
  stripePublicKey: text("stripe_public_key"),
  stripeSecretKey: text("stripe_secret_key"),
  emailProvider: text("email_provider", { enum: ["sendgrid", "resend", "smtp", "none"] }).default("none"),
  emailApiKey: text("email_api_key"),
  emailFromAddress: text("email_from_address"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  smtpSecure: boolean("smtp_secure").default(false),
  notifyOnNewBooking: boolean("notify_on_new_booking").default(true),
  notifyOnApproval: boolean("notify_on_approval").default(true),
  notifyOnCancellation: boolean("notify_on_cancellation").default(true),
  // Custom email templates
  emailConfirmationTemplate: text("email_confirmation_template"),
  emailApprovalTemplate: text("email_approval_template"),
  emailRejectionTemplate: text("email_rejection_template"),
  emailCancellationTemplate: text("email_cancellation_template"),
  emailAdminNotificationTemplate: text("email_admin_notification_template"),
  // Public information content
  rentalFeesContent: text("rental_fees_content"),
  agreementContent: text("agreement_content"),
  rentalFeesUrl: text("rental_fees_url"),
  agreementUrl: text("agreement_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Amenities table - for customizable amenity options
export const amenities = pgTable("amenities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  icon: text("icon").default("Star"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAmenitySchema = createInsertSchema(amenities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAmenity = z.infer<typeof insertAmenitySchema>;
export type Amenity = typeof amenities.$inferSelect;

export const insertSiteSettingsSchema = createInsertSchema(siteSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;
export type SiteSettings = typeof siteSettings.$inferSelect;

// Rooms table
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array().notNull().default(sql`'{}'::text[]`),
  amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").default(true).notNull(),
  pricingType: text("pricing_type", { enum: ["hourly", "fixed"] }).default("hourly"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).default("0"),
  fixedRate: numeric("fixed_rate", { precision: 10, scale: 2 }).default("0"),
  color: text("color").default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

// Bookings table
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  eventName: text("event_name"),
  purpose: text("purpose").notNull(),
  attendees: integer("attendees").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "cancelled"] }).default("pending").notNull(),
  visibility: text("visibility", { enum: ["private", "public"] }).default("private").notNull(),
  selectedItems: text("selected_items").array().notNull().default(sql`'{}'::text[]`),
  // Recurring booking fields
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrencePattern: text("recurrence_pattern", { enum: ["daily", "weekly", "monthly"] }),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  recurrenceDays: text("recurrence_days").array(), // Days of week for weekly recurrence (0=Sunday, 1=Monday, etc.)
  recurrenceWeekOfMonth: integer("recurrence_week_of_month"), // 1=first, 2=second, 3=third, 4=fourth, 5=last
  recurrenceDayOfWeek: integer("recurrence_day_of_week"), // 0=Sunday, 1=Monday, etc. (for monthly by week)
  parentBookingId: varchar("parent_booking_id"),
  bookingGroupId: varchar("booking_group_id"), // Links multi-room or recurring bookings together
  adminNotes: text("admin_notes"), // Private notes only visible to admins
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  eventName: z.string().optional().nullable(), // Make eventName explicitly optional
  visibility: z.enum(["private", "public"]).optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(["daily", "weekly", "monthly"]).optional().nullable(),
  recurrenceEndDate: z.coerce.date().optional().nullable(), // Coerce string dates to Date objects (for JSON input)
  recurrenceDays: z.array(z.string()).optional().nullable(), // Days of week for weekly recurrence
  recurrenceWeekOfMonth: z.number().int().min(1).max(5).optional().nullable(), // 1=first, 2=second, 3=third, 4=fourth, 5=last
  recurrenceDayOfWeek: z.number().int().min(0).max(6).optional().nullable(), // 0=Sunday, 1=Monday, etc.
  parentBookingId: z.string().optional().nullable(),
  selectedItems: z.array(z.string()).optional(),
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Enriched booking type with room and user metadata
export type BookingWithMeta = Booking & {
  roomName: string;
  userName: string;
  userEmail: string | null;
  userPhone: string | null;
  userOrganization: string | null;
  bookingGroupId?: string | null;
};

// Additional items/equipment table
export const additionalItems = pgTable("additional_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdditionalItemSchema = createInsertSchema(additionalItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdditionalItem = z.infer<typeof insertAdditionalItemSchema>;
export type AdditionalItem = typeof additionalItems.$inferSelect;
