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
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Site settings table - for centre customization
export const siteSettings = pgTable("site_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  centreName: text("centre_name").notNull().default("Community Centre"),
  logoUrl: text("logo_url"),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array().notNull().default(sql`'{}'::text[]`),
  amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").default(true).notNull(),
  pricingType: text("pricing_type", { enum: ["hourly", "fixed"] }).default("hourly"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).default("0"),
  fixedRate: numeric("fixed_rate", { precision: 10, scale: 2 }).default("0"),
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
  purpose: text("purpose").notNull(),
  attendees: integer("attendees").notNull(),
  status: text("status", { enum: ["pending", "approved", "cancelled"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Enriched booking type with room and user metadata
export type BookingWithMeta = Booking & {
  roomName: string;
  userName: string;
  userEmail: string | null;
};
