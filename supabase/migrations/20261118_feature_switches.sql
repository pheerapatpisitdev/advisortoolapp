-- เปิด-ปิดฟังก์ชันชั่วคราว (owner chose ก ก ก, 2026-10-17; mockup
-- https://claude.ai/artifact/QHYvw2p19iTuj9LcnxWge7): the Super Admin switches a Studio tool off
-- while something it needs is down. One object per tool, { off, message, at }, beside the
-- other settings of the one ins_ai_settings row; a tool not named is on. Additive only.
alter table public.ins_ai_settings add column if not exists feature_switches jsonb not null default '{}'::jsonb;
