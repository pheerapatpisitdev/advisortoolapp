-- Clip editing, phase B1 (owner, 2026-10-02): the preview, the subtitle pictures and the
-- silence list live beside the clip in content-video; the owner picks the render service.
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'video/quicktime', 'image/png', 'text/plain']
 where id = 'content-video';

alter table public.ins_ai_settings
  add column if not exists video_engine text not null default 'rendi'
    check (video_engine in ('rendi', 'lambda')),
  add column if not exists video_fallback boolean not null default true,
  -- Rendi's free plan stops a command at 60 s; Pro allows 600
  add column if not exists rendi_max_seconds integer not null default 60
    check (rendi_max_seconds between 10 and 600);
