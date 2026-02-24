CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"max_rooms" integer DEFAULT 1 NOT NULL,
	"custom_subdomain" varchar(255),
	"subscription_status" text DEFAULT 'trial' NOT NULL,
	"subscription_ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "additional_items" ADD COLUMN "organization_id" varchar;--> statement-breakpoint
ALTER TABLE "amenities" ADD COLUMN "organization_id" varchar;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "organization_id" varchar;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "organization_id" varchar;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "organization_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_id" varchar;--> statement-breakpoint
ALTER TABLE "additional_items" ADD CONSTRAINT "additional_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
