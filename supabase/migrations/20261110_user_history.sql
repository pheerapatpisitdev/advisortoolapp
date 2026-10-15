-- ประวัติผู้ใช้ for the Super Admin (owner, 2026-10-15; mockup
-- https://claude.ai/artifact/2uzD38rmUBZ223o6SPG3M1): every person's whole history in the back
-- office. Two things nothing kept before, both recorded from the day this ships (owner chose
-- 1 = start now, 2 = ก show the words):
--
-- ins_logins: one row per sign-in — UnitOS's menu (sso), the agent code on the front page
-- (code), a member's Google (google), a Super Admin's Google (super). agent_id is not a foreign
-- key: a สมาชิกทั่วไป's id is a row of ins_members, a Super Admin's of ins_super_admins.
--
-- ins_ai_asks: one row per question asked on ถาม AI, with the answer it got. id is the ask_id
-- the AI ledger writes on each call the question made (20261015_usage_ledger_who.sql), so the
-- page puts the words beside what they cost.
--
-- Additive only. Locked to service_role like every other ins_* table.

create table if not exists public.ins_logins (
  id bigint generated always as identity primary key,
  agent_id uuid not null,
  how text not null check (how in ('sso', 'code', 'google', 'super')),
  ip text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  at timestamptz not null default now()
);
create index if not exists ins_logins_agent_at on public.ins_logins (agent_id, at desc);
create index if not exists ins_logins_at on public.ins_logins (at desc);
alter table public.ins_logins enable row level security;
revoke all on public.ins_logins from public, anon, authenticated;
grant all on public.ins_logins to service_role;
comment on table public.ins_logins is 'advisortool: one sign-in of a person, for the Super Admin''s ประวัติผู้ใช้. service_role only.';

create table if not exists public.ins_ai_asks (
  id uuid primary key,
  agent_id uuid not null,
  question text not null check (char_length(question) <= 2000),
  answer text not null default '' check (char_length(answer) <= 8000),
  model text,
  failed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ins_ai_asks_agent_created on public.ins_ai_asks (agent_id, created_at desc);
create index if not exists ins_ai_asks_created on public.ins_ai_asks (created_at desc);
alter table public.ins_ai_asks enable row level security;
revoke all on public.ins_ai_asks from public, anon, authenticated;
grant all on public.ins_ai_asks to service_role;
comment on table public.ins_ai_asks is 'advisortool: a question asked on ถาม AI and its answer, for the Super Admin''s ประวัติผู้ใช้. service_role only.';
