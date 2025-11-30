# Development Setup

## Environment Variables

This project requires the following environment variables to be set:

### Required Variables

- `DATABASE_URL` - PostgreSQL connection string (Neon database)
  - Format: `postgresql://user:password@host:port/database?sslmode=require`
  - Get your connection string from [Neon](https://neon.tech) or use a local PostgreSQL instance

- `SESSION_SECRET` - Secret key for session encryption
  - Generate a random string for production

### Optional Variables (for Replit)

- `REPL_ID` - Your Replit project ID
- `ISSUER_URL` - OIDC issuer URL (defaults to https://replit.com/oidc)

## Setting Environment Variables

### Windows PowerShell

**Option 1: Set in current session**
```powershell
$env:DATABASE_URL = "postgresql://user:password@host:port/database?sslmode=require"
$env:SESSION_SECRET = "your-secret-key"
npm run dev
```

**Option 2: Use the provided script**
```powershell
.\start-dev.ps1
```

**Option 3: Set permanently (PowerShell Profile)**
Add to your PowerShell profile (`$PROFILE`):
```powershell
$env:DATABASE_URL = "postgresql://user:password@host:port/database?sslmode=require"
```

### Linux/Mac

```bash
export DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
export SESSION_SECRET="your-secret-key"
npm run dev
```

## Running the Development Server

Once environment variables are set:

```bash
npm run dev
```

The server will start on port 5000 (or the port specified in the `PORT` environment variable).

