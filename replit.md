# Multi-Tenant Community Centre Room Booking App

## Overview

This is a multi-tenant web-based room booking system designed for community centres, allowing community members to browse available rooms, view real-time availability calendars, and submit booking requests. Each deployment can be customized with unique branding, pricing, and payment configurations. The application features separate interfaces for regular users and administrators, with a clean, nature-inspired design emphasizing clarity and efficient workflows.

**Key Multi-Tenant Features:**
- Dynamic branding (centre name, logo) fetched from database
- Configurable payment gateways (WiPay, Stripe, Manual)
- Email notification system (SendGrid, Resend, SMTP/Gmail/Outlook) for booking lifecycle
- Additional items/equipment system with optional pricing for bookings
- Per-deployment customization via Admin Settings
- 6-room limit per deployment

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing

**UI Components:**
- shadcn/ui component library (Radix UI primitives) for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens
- "New York" style variant from shadcn/ui
- Responsive design with mobile-first approach

**State Management:**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- Custom hooks for authentication (`useAuth`) and theme management (`useTheme`)

**Design System:**
- Inter font family (Google Fonts) for modern, legible typography
- Consistent spacing scale using Tailwind units (2, 4, 6, 8)
- Color scheme with green accents (--primary: 142 70% 45%) reflecting community values
- Light/dark theme support via ThemeProvider context

**Key UI Patterns:**
- Calendar-first design with week-view scheduling interface
- Card-based layouts for rooms and bookings
- Grid layouts for room browsing (responsive: 1/2/3 columns)
- Sidebar navigation for admin interface
- Modal dialogs for booking forms and confirmations

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript for API routes and middleware
- Separate development (`index-dev.ts`) and production (`index-prod.ts`) entry points
- Development mode integrates Vite middleware for HMR and SSR

**Authentication & Authorization:**
- Replit OAuth integration via OpenID Connect (OIDC)
- Passport.js strategy for authentication flow
- Session-based authentication with PostgreSQL session store (`connect-pg-simple`)
- Cookie-based login intent tracking (`login_intent` cookie) to persist admin/user intent across OAuth redirects
- Role-based access control with `isAdmin` flag on user records
- Admin bootstrap endpoint for first-time setup (promotes first authenticated user)
- Public access: Browse Rooms and Room Calendar pages accessible without login
- Login prompt appears when unauthenticated users attempt to book a timeslot
- Separate login flows for users (/api/login) and admins (/api/admin/login) with cookie-based intent tracking
- Admin login redirects to /admin dashboard; user login redirects to /my-bookings

**API Structure:**
- RESTful endpoints under `/api` prefix
- Authentication routes: `/api/auth/user`, `/api/login`, `/api/logout`
- Resource routes: `/api/rooms`, `/api/bookings`
- Admin-specific routes: `/api/admin/bootstrap`
- Middleware: `isAuthenticated` guard for protected routes

**Data Layer:**
- Storage abstraction (`IStorage` interface) in `server/storage.ts`
- `DatabaseStorage` class implements all database operations
- Drizzle ORM for type-safe database queries with PostgreSQL
- Transaction support for critical operations (e.g., admin promotion to prevent race conditions)

**Database Schema (Drizzle):**
- `sessions` table for Express session storage
- `users` table with fields: id, email, firstName, lastName, phone, organization, profileImageUrl, isAdmin, profileComplete, timestamps
- `rooms` table with fields: id, name, description, capacity, imageUrl, amenities (text array), pricingType (hourly/fixed), hourlyRate, fixedRate, isActive, timestamps
- `bookings` table with fields: id, roomId, userId, date, startTime, endTime, status (pending/approved/cancelled/rejected), purpose, attendees, paymentStatus, paymentAmount, rejectionReason, timestamps
- `site_settings` table with fields: id, centreName, logoUrl (supports base64 encoded images), primaryColor, secondaryColor, currency, timezone, openTime, closeTime, email, phone, address, defaultHourlyRate, defaultFixedRate, paymentGateway (wipay/stripe/manual), wipayAccountNumber, wipayApiKey, stripeApiKey, emailProvider (sendgrid/resend), emailApiKey, timestamps

**Email Notifications (server/emailService.ts):**
- EmailService class supporting SendGrid, Resend, and SMTP (Gmail/Outlook) providers
- SMTP integration via nodemailer for Gmail, Outlook, and custom SMTP servers
- Templates: booking confirmation, approval, rejection (with reason), cancellation
- Emails include centre branding, booking details, and contact information
- Asynchronous sending (doesn't block booking operations)

**Additional Items/Equipment System:**
- `additional_items` table for managing bookable equipment (projectors, chairs, etc.)
- Admin can create, edit, delete items with name, description, and pricing
- Items displayed in booking form with checkboxes for selection
- Selected items stored as array in bookings table (`selectedItems` field)

**Business Logic:**
- Booking conflict detection by checking overlapping time slots
- Status workflow: pending → approved/cancelled
- Users can only cancel their own bookings
- Admins can approve/reject/edit any booking
- Profile completion required for new customers after first login (name, phone required; organization optional)

**Admin Features:**
- Customer management page with list view and CSV export
- Booking reports with revenue summaries and room utilization
- Admin can click any booking to edit details (date, time, purpose, attendees, status)
- Approved and Cancelled tabs in admin dashboard for better booking organization
- Logo upload via image file (base64 encoded, max 500KB) instead of URL field

### External Dependencies

**Database:**
- Neon PostgreSQL (serverless Postgres via `@neondatabase/serverless`)
- WebSocket support for serverless environments
- Connection pooling with `Pool` from Neon SDK
- Environment variable: `DATABASE_URL` (required)

**Authentication Service:**
- Replit OAuth/OIDC provider
- Environment variables: `ISSUER_URL` (defaults to https://replit.com/oidc), `REPL_ID`, `SESSION_SECRET`

**Third-Party UI Libraries:**
- Radix UI primitives for accessible components (accordion, dialog, dropdown, popover, etc.)
- Lucide React for icon system
- date-fns for date manipulation and formatting
- cmdk for command palette functionality
- react-day-picker for calendar date selection

**Development Tools:**
- Replit-specific Vite plugins: runtime error overlay, cartographer, dev banner
- ESBuild for production server bundling
- Drizzle Kit for database migrations and schema management

**Asset Management:**
- Static images stored in `attached_assets/generated_images/`
- Vite alias `@assets` for asset imports
- Image mapping logic in pages to associate room types with appropriate images

**Styling Dependencies:**
- Tailwind CSS with PostCSS and Autoprefixer
- clsx and tailwind-merge (via `cn` utility) for conditional class merging
- class-variance-authority for variant-based component styling