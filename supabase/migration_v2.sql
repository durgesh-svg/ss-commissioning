-- ============================================================
-- Migration v2 — Run in Supabase SQL Editor
-- Adds: status column, missing tables, fixed create-user function
-- ============================================================

-- 1. Add status column to punch_points (two-step closure)
ALTER TABLE punch_points
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'pending_closure', 'closed'));

-- Migrate existing closed=true rows to status='closed'
UPDATE punch_points SET status = 'closed' WHERE closed = true AND status = 'open';

-- 2. Add notes column to checklist_responses (if missing)
ALTER TABLE checklist_responses
  ADD COLUMN IF NOT EXISTS notes text;

-- 3. Create response_photos table (OK item photos)
CREATE TABLE IF NOT EXISTS response_photos (
  id           uuid primary key default uuid_generate_v4(),
  response_id  uuid not null references checklist_responses(id) on delete cascade,
  storage_path text not null,
  url          text not null,
  uploaded_at  timestamptz default now()
);
ALTER TABLE response_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rphotos_read"   ON response_photos;
DROP POLICY IF EXISTS "rphotos_insert" ON response_photos;
DROP POLICY IF EXISTS "rphotos_delete" ON response_photos;

CREATE POLICY "rphotos_read" ON response_photos FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM checklist_responses cr
    WHERE cr.id = response_photos.response_id AND cr.site_id = my_site_id()
  ));
CREATE POLICY "rphotos_insert" ON response_photos FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR EXISTS (
    SELECT 1 FROM checklist_responses cr
    WHERE cr.id = response_photos.response_id AND cr.site_id = my_site_id()
  ));
CREATE POLICY "rphotos_delete" ON response_photos FOR DELETE TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM checklist_responses cr
    WHERE cr.id = response_photos.response_id AND cr.site_id = my_site_id()
  ));

-- 4. Create contractor_assignments table
CREATE TABLE IF NOT EXISTS contractor_assignments (
  id              uuid primary key default uuid_generate_v4(),
  site_id         uuid not null references sites(id) on delete cascade,
  system_id       uuid not null references systems(id) on delete cascade,
  contractor_name text,
  unique (site_id, system_id)
);
ALTER TABLE contractor_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ca_read"   ON contractor_assignments;
DROP POLICY IF EXISTS "ca_insert" ON contractor_assignments;
DROP POLICY IF EXISTS "ca_update" ON contractor_assignments;
DROP POLICY IF EXISTS "ca_delete" ON contractor_assignments;

CREATE POLICY "ca_read"   ON contractor_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ca_insert" ON contractor_assignments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "ca_update" ON contractor_assignments FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "ca_delete" ON contractor_assignments FOR DELETE TO authenticated USING (is_admin());

-- 5. Create user_site_assignments table
CREATE TABLE IF NOT EXISTS user_site_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references sites(id)       on delete cascade,
  primary key (user_id, site_id)
);
ALTER TABLE user_site_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usa_read"  ON user_site_assignments;
DROP POLICY IF EXISTS "usa_write" ON user_site_assignments;

CREATE POLICY "usa_read"  ON user_site_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "usa_write" ON user_site_assignments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- 6. Create punch_comments table
CREATE TABLE IF NOT EXISTS punch_comments (
  id         uuid primary key default uuid_generate_v4(),
  punch_id   uuid not null references punch_points(id) on delete cascade,
  user_id    uuid references auth.users(id),
  email      text,
  comment    text not null,
  created_at timestamptz default now()
);
ALTER TABLE punch_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pc_read"   ON punch_comments;
DROP POLICY IF EXISTS "pc_insert" ON punch_comments;

CREATE POLICY "pc_read"   ON punch_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc_insert" ON punch_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. Fix admin_create_user function (use extensions schema for crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_user(
  p_email    text,
  p_password text,
  p_is_admin boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id,
    email, encrypted_password,
    email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  ) VALUES (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    'authenticated',
    'authenticated'
  );

  INSERT INTO profiles (id, email, is_admin)
  VALUES (new_id, p_email, p_is_admin)
  ON CONFLICT (id) DO UPDATE SET is_admin = p_is_admin;
END;
$$;
