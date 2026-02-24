-- Data migration: Create Arima Community Centre organization and link existing data
-- Run this AFTER 0002_add_multi_tenancy.sql has been applied

-- 1. Create Arima's organization
INSERT INTO organizations (
  id,
  name,
  slug,
  plan,
  max_rooms,
  custom_subdomain,
  subscription_status,
  subscription_ends_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Arima Community Centre',
  'arimacc',
  'premium',
  15,
  'arimacc',
  'active',
  NULL,
  now(),
  now()
);

-- 2. Link users (where email contains 'arimacommunitycentre.com')
UPDATE users
SET organization_id = (SELECT id FROM organizations WHERE slug = 'arimacc' LIMIT 1)
WHERE email ILIKE '%arimacommunitycentre.com%';

-- 3. Link all rooms
UPDATE rooms
SET organization_id = (SELECT id FROM organizations WHERE slug = 'arimacc' LIMIT 1);

-- 4. Link all bookings
UPDATE bookings
SET organization_id = (SELECT id FROM organizations WHERE slug = 'arimacc' LIMIT 1);

-- 5. Link site_settings
UPDATE site_settings
SET organization_id = (SELECT id FROM organizations WHERE slug = 'arimacc' LIMIT 1);

-- 6. Link amenities
UPDATE amenities
SET organization_id = (SELECT id FROM organizations WHERE slug = 'arimacc' LIMIT 1);

-- 7. Link additional_items
UPDATE additional_items
SET organization_id = (SELECT id FROM organizations WHERE slug = 'arimacc' LIMIT 1);
