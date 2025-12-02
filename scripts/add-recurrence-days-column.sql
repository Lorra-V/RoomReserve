-- Migration script to add recurrence_days column to bookings table
-- Run this script to add support for specific day selection in weekly recurring bookings

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS recurrence_days TEXT[];

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_recurrence_days ON bookings USING GIN (recurrence_days);

