-- Add trial_ends_at column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at timestamp;
