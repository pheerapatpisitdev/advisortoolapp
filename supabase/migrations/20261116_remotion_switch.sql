-- Who gets วิดีโอนำเสนอ's Motion Graphic clips drawn by Remotion on Cloud Run (owner, 2026-10-17):
-- off = the old engine for everyone, owner = the owner only, all = everyone (the owner's choice from the day it goes live).
alter table public.ins_ai_settings add column if not exists remotion_for text not null default 'all';
alter table public.ins_ai_settings drop constraint if exists ins_ai_settings_remotion_for_check;
alter table public.ins_ai_settings add constraint ins_ai_settings_remotion_for_check check (remotion_for in ('off', 'owner', 'all'));
