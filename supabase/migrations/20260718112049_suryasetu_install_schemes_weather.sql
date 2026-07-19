/*
# SuryaSetu — install requests, govt schemes, weather, farmer address

1. New Columns
- farmers.address (text) — farmer's street/village address (replaces GPS for technician routing).

2. New Tables
- install_requests — a farmer raises a ticket to get a pump installed; vendor sees it as an order.
  Fields: id, farmer_name, phone, region, acres, pump_model, status, created_at, vendor_id (when accepted).
- govt_schemes — central/state solar pump subsidy schemes shown to farmers.
  Fields: id, name, description, subsidy_percent, region, eligibility.
- weather_alerts — simple rain/weather notices per region.
  Fields: id, region, forecast, rain_expected, date.

3. Security
- All new tables/columns open to anon (no-auth demo mode, shared data).
*/

ALTER TABLE farmers ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE IF NOT EXISTS install_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_name text NOT NULL,
  phone text NOT NULL,
  region text,
  acres numeric,
  pump_model text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','installed','rejected')),
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE install_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_install_status ON install_requests(status);
DROP POLICY IF EXISTS "install_anon_all" ON install_requests;
CREATE POLICY "install_anon_all" ON install_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS govt_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subsidy_percent integer,
  region text,
  eligibility text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE govt_schemes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schemes_anon_all" ON govt_schemes;
CREATE POLICY "schemes_anon_all" ON govt_schemes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS weather_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  forecast text NOT NULL,
  rain_expected boolean NOT NULL DEFAULT false,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE weather_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weather_anon_all" ON weather_alerts;
CREATE POLICY "weather_anon_all" ON weather_alerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);