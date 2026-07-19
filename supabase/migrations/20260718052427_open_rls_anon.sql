/*
# Open RLS policies to anon (no-auth demo mode)

1. Context
- The app now opens directly to a role-picker home page with no Supabase auth login.
- The frontend uses the anon key exclusively, so all policies must allow the `anon` role.
- This is a single-tenant demo: data is intentionally shared across demo roles.

2. Changes
- Replaces all existing per-role policies with anon+authenticated CRUD on every table.
- RLS stays enabled; `USING (true)` / `WITH CHECK (true)` is acceptable here because the
  data is intentionally public/shared in this no-auth demo app.

3. Tables affected
- users, farmers, technicians, vendors, pumps, complaints, jobs, spare_parts,
  maintenance_schedules, notifications
*/

-- users
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_anon_all" ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- farmers
DROP POLICY IF EXISTS "farmers_select_own" ON farmers;
DROP POLICY IF EXISTS "farmers_insert_own" ON farmers;
DROP POLICY IF EXISTS "farmers_update_own" ON farmers;
CREATE POLICY "farmers_anon_all" ON farmers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- technicians
DROP POLICY IF EXISTS "tech_select_own" ON technicians;
DROP POLICY IF EXISTS "tech_insert_own" ON technicians;
DROP POLICY IF EXISTS "tech_update_own" ON technicians;
CREATE POLICY "tech_anon_all" ON technicians FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- vendors
DROP POLICY IF EXISTS "vendors_select_own" ON vendors;
DROP POLICY IF EXISTS "vendors_insert_own" ON vendors;
DROP POLICY IF EXISTS "vendors_update_own" ON vendors;
CREATE POLICY "vendors_anon_all" ON vendors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- pumps
DROP POLICY IF EXISTS "pumps_select_owner" ON pumps;
DROP POLICY IF EXISTS "pumps_insert_owner" ON pumps;
CREATE POLICY "pumps_anon_all" ON pumps FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- complaints
DROP POLICY IF EXISTS "complaints_select_owner" ON complaints;
DROP POLICY IF EXISTS "complaints_insert_owner" ON complaints;
DROP POLICY IF EXISTS "complaints_update_owner" ON complaints;
CREATE POLICY "complaints_anon_all" ON complaints FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- jobs
DROP POLICY IF EXISTS "jobs_select_owner" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_own" ON jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON jobs;
CREATE POLICY "jobs_anon_all" ON jobs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- spare_parts
DROP POLICY IF EXISTS "parts_select_own" ON spare_parts;
DROP POLICY IF EXISTS "parts_insert_own" ON spare_parts;
DROP POLICY IF EXISTS "parts_update_own" ON spare_parts;
DROP POLICY IF EXISTS "parts_delete_own" ON spare_parts;
CREATE POLICY "parts_anon_all" ON spare_parts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- maintenance_schedules
DROP POLICY IF EXISTS "maint_select_own" ON maintenance_schedules;
DROP POLICY IF EXISTS "maint_insert_own" ON maintenance_schedules;
DROP POLICY IF EXISTS "maint_update_own" ON maintenance_schedules;
CREATE POLICY "maint_anon_all" ON maintenance_schedules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_anon_all" ON notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);