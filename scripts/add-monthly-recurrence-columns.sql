-- Add columns for monthly recurrence by week (e.g., "second Saturday", "third Sunday")
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_week_of_month INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_day_of_week INTEGER;

