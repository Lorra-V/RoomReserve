# PowerShell script to start the development server with DATABASE_URL
$env:DATABASE_URL = "postgresql://neondb_owner:npg_u4rYhHfRVOd6@ep-silent-moon-af0pb450.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require"

# Set other required environment variables if needed
if (-not $env:SESSION_SECRET) {
    $env:SESSION_SECRET = "dev-session-secret-change-in-production"
}

if (-not $env:REPL_ID) {
    $env:REPL_ID = "your-repl-id"
}

Write-Host "Starting development server..."
Write-Host "DATABASE_URL is set: $($env:DATABASE_URL.Substring(0, [Math]::Min(50, $env:DATABASE_URL.Length)))..."

npm run dev

