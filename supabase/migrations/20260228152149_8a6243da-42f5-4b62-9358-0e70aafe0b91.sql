-- Make voice-recordings bucket public so family recordings can be played back in elder view
UPDATE storage.buckets SET public = true WHERE id = 'voice-recordings';

-- Add public SELECT policy for voice-recordings
CREATE POLICY "Public read access for voice recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-recordings');