-- Migration script to update booking status from 'approved' to 'confirmed'
-- Run this script to update existing database records

UPDATE bookings
SET status = 'confirmed'
WHERE status = 'approved';

