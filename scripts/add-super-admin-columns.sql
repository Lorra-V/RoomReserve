-- Migration script to add isSuperAdmin and permissions columns to users table
-- Run this script on your database before using the super admin features

-- Add isSuperAdmin column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Add permissions column (JSONB for flexible permission storage)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Create an index on is_super_admin for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin);

-- Create an index on is_admin for faster queries (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

