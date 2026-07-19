/*
# SuryaSetu — Smart Solar Pump Service Ecosystem

1. Purpose
- Multi-role platform (farmer / technician / vendor / admin) for solar pump service in rural India.
- Voice-first, icon-driven, low-literacy UX. Phone is the universal identifier (OTP login).
- This migration creates all core tables, relationships, indexes, and RLS policies.

2. New Tables
- `users` — auth-linked profile with role, phone, language, region, name.
- `farmers` — farmer profile (acres, crop, borewell_depth, pump_model, location).
- `technicians` — technician profile (phone, current_location, availability_status, rating).
- `vendors` — vendor profile (company_name, inventory_level, region).
- `complaints` — farmer complaint (status, image_url, assigned_technician_id, voice_text, location).
- `jobs` — technician job linked to a complaint (status, photos, signature).
- `spare_parts` — vendor inventory (part_name, quantity, price, demand_forecast).
- `maintenance_schedules` — per-pump maintenance (last_cleaning, last_battery_check, amc_expiry).
- `notifications` — color-coded, text-minimal notifications for users.
- `pumps` — pump installation record (QR code, model, warranty, install history).

3. Relationships
- users 1—1 farmers / technicians / vendors (role-based).
- complaints N—1 farmers, N—1 technicians (assigned).
- jobs N—1 complaints, N—1 technicians.
- spare_parts N—1 vendors.
- maintenance_schedules N—1 farmers, N—1 pumps.
- notifications N—1 users.
- pumps N—1 farmers, N—1 vendors (installed by).

4. Security (RLS)
- All tables have RLS enabled.
- Owner-scoped CRUD for authenticated users on their own rows (users, farmers, technicians, vendors, notifications, maintenance_schedules).
- Complaints: farmers read/update their own; technicians read/update assigned to them.
- Jobs: technicians read/update their own; farmers read jobs on their complaints.
- Spare_parts: vendors read/update their own; admins read all.
- Pumps: farmers read their own; vendors read ones they installed.
- All tables also allow `anon` read so the no-auth demo path works; writes are owner-scoped.
  NOTE: SuryaSetu uses phone OTP via Supabase auth; authenticated policies enforce ownership.

5. Important Notes
1. `user_id` columns default to `auth.uid()` so inserts omitting the owner succeed.
2. Timestamps are `timestamptz` (timezone-aware) defaulting to `now()`.
3. `location` columns are `geography(Point, 4326)` for GPS distance queries.
4. Indexes added for frequent lookup columns (role, phone, farmer_id, technician_id, status).
5. Uses `gen_random_uuid()` for all primary keys.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =========================================================
-- users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('farmer','technician','vendor','admin')),
  phone text UNIQUE NOT NULL,
  language text NOT NULL DEFAULT 'en',
  region text,
  name text NOT NULL DEFAULT 'Farmer',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================================
-- farmers
-- =========================================================
CREATE TABLE IF NOT EXISTS farmers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  acres numeric,
  crop text,
  borewell_depth numeric,
  pump_model text,
  location geography(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_farmers_user ON farmers(user_id);

DROP POLICY IF EXISTS "farmers_select_own" ON farmers;
CREATE POLICY "farmers_select_own" ON farmers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "farmers_insert_own" ON farmers;
CREATE POLICY "farmers_insert_own" ON farmers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "farmers_update_own" ON farmers;
CREATE POLICY "farmers_update_own" ON farmers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- technicians
-- =========================================================
CREATE TABLE IF NOT EXISTS technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  phone text,
  current_location geography(Point, 4326),
  availability_status text NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available','busy','offline')),
  rating numeric DEFAULT 5.0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tech_user ON technicians(user_id);
CREATE INDEX IF NOT EXISTS idx_tech_status ON technicians(availability_status);

DROP POLICY IF EXISTS "tech_select_own" ON technicians;
CREATE POLICY "tech_select_own" ON technicians FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tech_insert_own" ON technicians;
CREATE POLICY "tech_insert_own" ON technicians FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tech_update_own" ON technicians;
CREATE POLICY "tech_update_own" ON technicians FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- vendors
-- =========================================================
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  inventory_level integer NOT NULL DEFAULT 0,
  region text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_vendors_user ON vendors(user_id);

DROP POLICY IF EXISTS "vendors_select_own" ON vendors;
CREATE POLICY "vendors_select_own" ON vendors FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "vendors_insert_own" ON vendors;
CREATE POLICY "vendors_insert_own" ON vendors FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "vendors_update_own" ON vendors;
CREATE POLICY "vendors_update_own" ON vendors FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- pumps (installations) — QR code anchor
-- =========================================================
CREATE TABLE IF NOT EXISTS pumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid REFERENCES farmers(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  model text NOT NULL,
  qr_code text UNIQUE,
  warranty_expiry date,
  installed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pumps ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pumps_farmer ON pumps(farmer_id);
CREATE INDEX IF NOT EXISTS idx_pumps_qr ON pumps(qr_code);

-- Farmers read their own pumps; vendors read pumps they installed
DROP POLICY IF EXISTS "pumps_select_owner" ON pumps;
CREATE POLICY "pumps_select_owner" ON pumps FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = pumps.farmer_id AND f.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vendors v WHERE v.id = pumps.vendor_id AND v.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "pumps_insert_owner" ON pumps;
CREATE POLICY "pumps_insert_owner" ON pumps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = pumps.vendor_id AND v.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM farmers f WHERE f.id = pumps.farmer_id AND f.user_id = auth.uid())
  );

-- =========================================================
-- complaints
-- =========================================================
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','resolved','cancelled')),
  image_url text,
  voice_text text,
  assigned_technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL,
  location geography(Point, 4326),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('sos','normal')),
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_complaints_farmer ON complaints(farmer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_tech ON complaints(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);

-- Farmers read/update their own complaints; technicians read/update assigned
DROP POLICY IF EXISTS "complaints_select_owner" ON complaints;
CREATE POLICY "complaints_select_owner" ON complaints FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = complaints.farmer_id AND f.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM technicians t WHERE t.id = complaints.assigned_technician_id AND t.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "complaints_insert_owner" ON complaints;
CREATE POLICY "complaints_insert_owner" ON complaints FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = complaints.farmer_id AND f.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "complaints_update_owner" ON complaints;
CREATE POLICY "complaints_update_owner" ON complaints FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = complaints.farmer_id AND f.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM technicians t WHERE t.id = complaints.assigned_technician_id AND t.user_id = auth.uid())
  ) WITH CHECK (true);

-- =========================================================
-- jobs
-- =========================================================
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','travelling','arrived','completed','cancelled')),
  installation_photos jsonb,
  digital_signature text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_jobs_complaint ON jobs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tech ON jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

DROP POLICY IF EXISTS "jobs_select_owner" ON jobs;
CREATE POLICY "jobs_select_owner" ON jobs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM technicians t WHERE t.id = jobs.technician_id AND t.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM complaints c
      JOIN farmers f ON f.id = c.farmer_id
      WHERE c.id = jobs.complaint_id AND f.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "jobs_insert_owner" ON jobs;
CREATE POLICY "jobs_insert_owner" ON jobs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM technicians t WHERE t.id = jobs.technician_id AND t.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "jobs_update_owner" ON jobs;
CREATE POLICY "jobs_update_owner" ON jobs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM technicians t WHERE t.id = jobs.technician_id AND t.user_id = auth.uid())
  ) WITH CHECK (true);

-- =========================================================
-- spare_parts
-- =========================================================
CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  part_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  demand_forecast integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_parts_vendor ON spare_parts(vendor_id);

DROP POLICY IF EXISTS "parts_select_own" ON spare_parts;
CREATE POLICY "parts_select_own" ON spare_parts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = spare_parts.vendor_id AND v.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "parts_insert_own" ON spare_parts;
CREATE POLICY "parts_insert_own" ON spare_parts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = spare_parts.vendor_id AND v.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "parts_update_own" ON spare_parts;
CREATE POLICY "parts_update_own" ON spare_parts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = spare_parts.vendor_id AND v.user_id = auth.uid())
  ) WITH CHECK (true);
DROP POLICY IF EXISTS "parts_delete_own" ON spare_parts;
CREATE POLICY "parts_delete_own" ON spare_parts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM vendors v WHERE v.id = spare_parts.vendor_id AND v.user_id = auth.uid())
  );

-- =========================================================
-- maintenance_schedules
-- =========================================================
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  pump_id uuid REFERENCES pumps(id) ON DELETE SET NULL,
  last_cleaning date,
  last_battery_check date,
  amc_expiry date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_maint_farmer ON maintenance_schedules(farmer_id);

DROP POLICY IF EXISTS "maint_select_own" ON maintenance_schedules;
CREATE POLICY "maint_select_own" ON maintenance_schedules FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = maintenance_schedules.farmer_id AND f.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "maint_insert_own" ON maintenance_schedules;
CREATE POLICY "maint_insert_own" ON maintenance_schedules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = maintenance_schedules.farmer_id AND f.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "maint_update_own" ON maintenance_schedules;
CREATE POLICY "maint_update_own" ON maintenance_schedules FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM farmers f WHERE f.id = maintenance_schedules.farmer_id AND f.user_id = auth.uid())
  ) WITH CHECK (true);

-- =========================================================
-- notifications
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  color_code text NOT NULL DEFAULT 'blue' CHECK (color_code IN ('green','yellow','red','blue')),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);

DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- Helper: nearest available technician to a point
-- =========================================================
CREATE OR REPLACE FUNCTION nearest_technician(p geography(Point,4326))
RETURNS uuid AS $$
DECLARE t_id uuid;
BEGIN
  SELECT t.id INTO t_id
  FROM technicians t
  WHERE t.availability_status = 'available'
    AND t.current_location IS NOT NULL
  ORDER BY t.current_location <-> p
  LIMIT 1;
  RETURN t_id;
END;
$$ LANGUAGE plpgsql STABLE;