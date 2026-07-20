/*
# Add voice recording, GPS tracking, and rating columns

1. Modified Tables
- `complaints`: add `voice_url` (text) for stored audio recording URL, `rating` (int) for farmer's 1-5 star rating of technician, `review_text` (text) for optional review comment.
- `jobs`: add `tech_lat` (double precision) and `tech_lng` (double precision) for real-time technician GPS position.

2. Storage
- Create public bucket `media` for farmer picture and voice uploads.
- Policies allow anon+authenticated to upload and read (no-auth demo app).

3. Security
- RLS already enabled on complaints and jobs; existing anon policies cover the new columns automatically.
- Storage bucket policies: allow anon+authenticated read and write.
*/

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS voice_url text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS rating int;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS review_text text;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_lat double precision;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_lng double precision;

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "media_read" ON storage.objects;
CREATE POLICY "media_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media_insert" ON storage.objects;
CREATE POLICY "media_insert" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media_update" ON storage.objects;
CREATE POLICY "media_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'media') WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "media_delete" ON storage.objects;
CREATE POLICY "media_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'media');
