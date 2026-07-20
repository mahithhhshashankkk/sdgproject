/*
# Add temperature column and 3-day weather forecast data

1. Modified Tables
- `weather_alerts`: added `temperature` integer column (current temperature in Celsius)
2. Data
- Seeds 3 days of weather forecast (today + next 2 days) for Kolar and Bengaluru regions
  with realistic temperatures, forecast text, and rain_expected flags.
3. Security
- No RLS changes — table already has anon read policies.
*/

ALTER TABLE weather_alerts
  ADD COLUMN IF NOT EXISTS temperature integer;

INSERT INTO weather_alerts (region, forecast, rain_expected, date, temperature)
VALUES
  ('Kolar', 'Sunny', false, CURRENT_DATE, 32),
  ('Kolar', 'Partly Cloudy', false, CURRENT_DATE + 1, 30),
  ('Kolar', 'Light Rain', true, CURRENT_DATE + 2, 27),
  ('Bengaluru', 'Cloudy', false, CURRENT_DATE, 28),
  ('Bengaluru', 'Thunderstorm', true, CURRENT_DATE + 1, 25),
  ('Bengaluru', 'Sunny', false, CURRENT_DATE + 2, 29)
ON CONFLICT DO NOTHING;
