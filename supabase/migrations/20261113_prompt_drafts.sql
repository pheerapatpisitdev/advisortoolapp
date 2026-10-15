-- คลิปตามโจทย์ (owner, 2026-10-16): every script the writer produces is kept as a draft, which
-- also gives the rolling-hour limit (20 scripts per agent) something to count.
-- agent_id is not a foreign key: a สมาชิกทั่วไป's id is a row of ins_members.
-- Additive only. Locked to service_role like every other ins_* table.

create table if not exists public.ins_prompt_drafts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  brief jsonb not null,
  script jsonb not null,
  -- the clip this draft was made into (ins_quote_videos.id): claimed by one conditional update, so a
  -- second press of สร้างคลิป is refused; given back when the clip fails or cannot be paid for
  made_clip_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ins_prompt_drafts_agent_created on public.ins_prompt_drafts (agent_id, created_at desc);
alter table public.ins_prompt_drafts enable row level security;
revoke all on public.ins_prompt_drafts from public, anon, authenticated;
grant all on public.ins_prompt_drafts to service_role;
comment on table public.ins_prompt_drafts is 'advisortool: a written คลิปตามโจทย์ script (brief + script), also the hourly limit''s count. service_role only.';
