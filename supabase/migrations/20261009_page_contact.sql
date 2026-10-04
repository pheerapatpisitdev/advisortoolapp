-- How an agent can be reached from the ads on one Facebook Page (owner, 2026-10-09).
--
-- One row per Page, kept once and appended to every long-form ad written for that Page.
-- All three fields are optional; a Page with nothing set has no row, and its ads end with
-- "ทักแชทได้เลย" instead. inbox_url is the Page's own Messenger / Inbox link and must be https.
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_page_contact (
  page_id text primary key,
  agent_name text check (char_length(agent_name) <= 60),
  line_id text check (char_length(line_id) <= 40),
  inbox_url text check (char_length(inbox_url) <= 200 and inbox_url ~ '^https://'),
  updated_at timestamptz not null default now()
);

alter table public.ins_page_contact enable row level security;
revoke all on public.ins_page_contact from public, anon, authenticated;
grant all on public.ins_page_contact to service_role;
