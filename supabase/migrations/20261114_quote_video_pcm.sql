-- คลิปตามโจทย์ keeps each scene's raw voice as "<video id>/voice-N.pcm" (application/octet-stream)
-- so a scene can be redrawn later. The bucket refused that type, so every prompt-story clip failed
-- right after the voice step ("mime type application/octet-stream is not supported").
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'image/png', 'image/jpeg', 'audio/wav', 'text/plain', 'application/octet-stream']
 where id = 'quote-video';
