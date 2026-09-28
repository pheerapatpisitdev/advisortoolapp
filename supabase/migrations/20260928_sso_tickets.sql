-- One-time tickets from UnitOS's menu into advisortool (2026-09-28).
--
-- UnitOS and advisortool share this database, so the ticket needs no signature: UnitOS's edge
-- function unitos-sso checks the agent's own UnitOS key, writes a row here with a random id,
-- and sends the browser to advisortool.app/sso?t=<id>. advisortool deletes the row as it reads
-- it (one use) and signs the agent in if the row was still young. An id is 122 random bits;
-- a minute is all it lives. Nobody but service_role reaches the table.
create table public.ins_sso_tickets (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.agents(id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '60 seconds',
  created_at  timestamptz not null default now()
);
comment on table public.ins_sso_tickets is 'advisortool: one-time sign-in tickets written by UnitOS unitos-sso, deleted on use. service_role only.';
alter table public.ins_sso_tickets enable row level security;
revoke all on public.ins_sso_tickets from anon, authenticated;
create index ins_sso_tickets_expires on public.ins_sso_tickets (expires_at);
