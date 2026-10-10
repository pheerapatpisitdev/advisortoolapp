-- Customers an agent saved from the Financial Health Check (owner, 2026-10-10): the name the
-- customer gave, how to reach them, and the check as it stood that day, kept in the account of the
-- agent who sat with them and shown to that agent alone (the owner sees every agent's).
--
-- The customer's consent is the row's reason to exist: consent_at is set by the server when the
-- agent ticked the box, and a save without it is refused. `gaps` is the light summary the list
-- reads (one entry per area: missing / short / ok, with what the plan offered); `snapshot` is the
-- whole result the page showed, read only when one customer is opened. Dependants' names never
-- reach the server, so they are in neither.
--
-- agent_id is not a foreign key, as ins_describe_history: a สมาชิกทั่วไป is a row of ins_members.
-- Additive only.
create table if not exists ins_fhc_customers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null default '',
  note text not null default '',
  consent_at timestamptz not null,
  age int not null,
  sex text not null,
  gaps jsonb not null,
  first_area text,
  input jsonb not null,
  snapshot jsonb not null
);
create index if not exists ins_fhc_customers_agent_recent
  on ins_fhc_customers (agent_id, created_at desc);
alter table ins_fhc_customers enable row level security;
-- no policies: the service role alone reads and writes it, like every ins_* table
