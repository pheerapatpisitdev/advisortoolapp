-- Clips agents filmed themselves, posted to their Page as Reels (owner, 2026-10-02).
-- A clip piece is format 'clip'; a script piece may carry a clip too. Either way the clip
-- lives in output.video — no table of its own.
alter table public.ins_content drop constraint if exists ins_content_format_check;
alter table public.ins_content add constraint ins_content_format_check
  check (format in ('post', 'script', 'ad', 'clip'));

-- Private: the browser uploads with a signed upload token the server hands out (TUS,
-- x-signature); Facebook and Gemini read through short signed URLs. Files are
-- "<piece id>/<file id>.<mp4|mov>", the only shape src/lib/content/clip.ts accepts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-video', 'content-video', false, 314572800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
