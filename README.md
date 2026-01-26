# RoomReserve

RoomReserve is a full-stack room and facility booking platform with role-based access for staff and admins. It lets organizations publish available rooms, accept booking requests, manage approvals, and give users a clean, modern booking experience.

## Features

- Authentication and user onboarding with Clerk
- Room listings with availability and amenities
- Booking requests with approval workflow
- User dashboard for upcoming and past bookings
- Admin dashboard to manage rooms, bookings, users, and site settings
- Email notifications for booking events
- Responsive UI with modern design system

## Tech Stack

- React + Vite (frontend)
- Express + Node.js (backend)
- PostgreSQL (database)
- Drizzle ORM + migrations
- Clerk (authentication)
- Neon (PostgreSQL hosting)
- Render (deployment)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- Clerk account (publishable + secret keys)
- Render account (for deployment)

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Sessions
SESSION_SECRET="replace-with-a-random-secret"

# Clerk (frontend)
VITE_CLERK_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxx"

# Clerk (server)
CLERK_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxxx"

# Optional email provider
RESEND_API_KEY="re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Optional server port (defaults to 5000)
PORT=5000
```

## Run Development Server

```bash
npm run dev
```

Windows PowerShell helper:

```powershell
.\start-dev.ps1
```

## Build for Production

```bash
npm run build
```

## Run Production Build

```bash
npm run start
```

## Database Setup (Neon)

1. Create a Neon project and database.
2. Copy the connection string and set `DATABASE_URL` in `.env`.
3. Apply schema changes:

```bash
npm run db:push
```

## Authentication Setup (Clerk)

1. Create a Clerk application.
2. Copy the Publishable Key and Secret Key.
3. Set `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env`.
4. Ensure your local and production URLs are added to Clerk's allowed origins.

## Deployment (Render)

1. Create a new Web Service on Render and connect this repo.
2. Set build command: `npm run build`
3. Set start command: `npm run start`
4. Add required environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `RESEND_API_KEY` (optional)
5. Deploy the service.

## Project Structure

- `client/` - React frontend (Vite)
- `server/` - Express API and server entry points
- `shared/` - Shared types and schema
- `migrations/` - Database migrations
- `scripts/` - Utility scripts
- `start-dev.ps1` - Windows dev helper

## License

MIT
