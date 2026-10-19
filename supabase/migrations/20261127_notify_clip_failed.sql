-- The owner's LINE is told the moment any clip fails (owner chose ก ก, 2026-10-19; mockup
-- https://claude.ai/artifact/GR5tJgN4VsT9jc5533VThz): every failed clip, the owner's own too.
-- This is its switch on /admin/line, on from the start.
alter table public.ins_ai_settings
  add column if not exists notify_clip_failed boolean not null default true;
