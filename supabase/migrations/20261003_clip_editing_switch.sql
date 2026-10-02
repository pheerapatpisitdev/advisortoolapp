-- Clip editing switch (owner, 2026-10-02): off until a render service is live; agents see no ตัดต่อ button while it is off.
alter table public.ins_ai_settings add column if not exists video_edit_enabled boolean not null default false;
