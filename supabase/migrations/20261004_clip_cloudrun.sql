-- Clip editing on Google Cloud Run (owner, 2026-10-02): a third render service the owner can
-- pick in /admin/ai. The column check from 20261003_clip_editing.sql allowed only rendi and
-- lambda; it was declared inline, so Postgres named it ins_ai_settings_video_engine_check.
-- Verify that name in production before applying (\d ins_ai_settings): if it differs, the drop
-- below does nothing and the old check would still refuse 'cloudrun'.
alter table public.ins_ai_settings
  drop constraint if exists ins_ai_settings_video_engine_check;

alter table public.ins_ai_settings
  add constraint ins_ai_settings_video_engine_check
    check (video_engine in ('rendi', 'lambda', 'cloudrun'));
