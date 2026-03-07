-- Data repair: Assign ArimaCC organization_id to any orphaned records.
-- This fixes the issue where new customer sign-ups received NULL organization_id
-- because the site_settings row lacked an organization_id value.

DO $$
DECLARE
  v_org_id VARCHAR;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'arimacc' LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No ArimaCC organization found – nothing to fix.';
    RETURN;
  END IF;

  RAISE NOTICE 'ArimaCC org id: %', v_org_id;

  -- 1. Ensure site_settings rows have the org id
  UPDATE site_settings
  SET    organization_id = v_org_id,
         updated_at      = now()
  WHERE  organization_id IS NULL;

  -- 2. Assign orphaned (non-admin) users to ArimaCC
  UPDATE users
  SET    organization_id = v_org_id,
         updated_at      = now()
  WHERE  organization_id IS NULL
    AND  is_admin = false;

  -- 3. Assign orphaned bookings to ArimaCC
  UPDATE bookings
  SET    organization_id = v_org_id,
         updated_at      = now()
  WHERE  organization_id IS NULL;

  -- 4. Assign orphaned rooms, amenities, additional_items
  UPDATE rooms
  SET    organization_id = v_org_id
  WHERE  organization_id IS NULL;

  UPDATE amenities
  SET    organization_id = v_org_id
  WHERE  organization_id IS NULL;

  UPDATE additional_items
  SET    organization_id = v_org_id
  WHERE  organization_id IS NULL;

  RAISE NOTICE 'Orphaned records repaired for org %', v_org_id;
END $$;
