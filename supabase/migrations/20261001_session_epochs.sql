-- Signing out everywhere, and the site-wide ceiling on wrong agent codes (review, 2026-10-01).
--
-- 1. ins_session_epochs: one row per agent who has signed out. A session cookie issued before
--    `not_before` is refused (src/lib/auth/epoch.ts, read in getViewer), so signing out ends the
--    copies of the cookie on every other device too — what UnitOS's key_epoch does for a whole
--    room, for one person. `agent_id` is a UnitOS agent's id or an outside member's
--    (ins_members), so there is no foreign key to either. A row missing means never signed out.
create table if not exists public.ins_session_epochs (
  agent_id    uuid primary key,
  not_before  timestamptz not null,
  updated_at  timestamptz not null default now()
);
comment on table public.ins_session_epochs is
  'advisortool: sessions issued before not_before are refused (sign out everywhere). agent_id is a UnitOS agent or an ins_members id, no FK. service_role only.';
alter table public.ins_session_epochs enable row level security;
revoke all on public.ins_session_epochs from anon, authenticated;
grant all on public.ins_session_epochs to service_role;

-- 2. The agent code's sign-in counts wrong codes from every address together
--    (src/app/login/actions.ts SITE_CODE_FAILURES) on every attempt: the code's attempts are the
--    ones with no phone. A small partial index keeps that count off the members' rows and the
--    successes.
create index if not exists ins_login_attempts_code_failures_idx
  on public.ins_login_attempts (created_at desc) where phone is null and ok = false;
