-- A Page's logo on its posters (owner, 2026-09-29): uploaded once per Facebook Page, or once per
-- agent for an agent with no Pages. Every upload is a row of its own and the newest is the one
-- in use; the older files stay, so a piece already on a Page still draws the logo it went up with.
-- The files are in the private content-media bucket under logos/, read only by the server.
create table if not exists ins_logos (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  page_id text,
  agent_id uuid,
  created_at timestamptz not null default now(),
  check ((page_id is null) <> (agent_id is null))
);
create index if not exists ins_logos_page on ins_logos (page_id, created_at desc) where page_id is not null;
create index if not exists ins_logos_agent on ins_logos (agent_id, created_at desc) where agent_id is not null;
alter table ins_logos enable row level security;
-- no policies: the service role alone reads and writes it, like every ins_* table
