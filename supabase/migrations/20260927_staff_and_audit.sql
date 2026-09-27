-- Who besides any UnitOS agent may do what in advisortool, and what they did.
--
-- Signing in is open to every agent of an open UnitOS room (the code is theirs already); what
-- this table adds is the Page and the back office, which belong to the owner and the assistants
-- the owner names. A row is keyed by the agent, not by the 6-digit code, so an assistant whose
-- code changes keeps their place, and one removed from UnitOS is gone from here too.
create table public.ins_staff (
  agent_id    uuid primary key references public.agents(id) on delete cascade,
  is_owner    boolean not null default false,
  -- the calendar, posting and scheduling to the Page
  can_publish boolean not null default true,
  -- connecting and disconnecting Pages
  can_connect boolean not null default false,
  -- the rest of the back office: customers, AI keys and budget, knowledge, ads, API keys
  can_admin   boolean not null default false,
  added_by    uuid references public.agents(id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on table public.ins_staff is 'advisortool staff: the owner and assistants, with what each may do. service_role only.';

-- What staff did to the Page and to the staff list: posted, scheduled, moved, withdrew,
-- connected, added. Kinds and ids, never a customer's words.
create table public.ins_audit (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  agent_id  uuid references public.agents(id) on delete set null,
  action    text not null,
  target    text,
  detail    jsonb
);
create index ins_audit_target_at on public.ins_audit (target, at desc);
comment on table public.ins_audit is 'advisortool: who posted, scheduled, connected or changed staff. service_role only.';

alter table public.ins_staff enable row level security;
alter table public.ins_audit enable row level security;
revoke all on public.ins_staff from anon, authenticated;
revoke all on public.ins_audit from anon, authenticated;

-- the owner, as agreed on 2026-09-27: agent 015495 of room 83g
insert into public.ins_staff (agent_id, is_owner, can_publish, can_connect, can_admin)
select a.id, true, true, true, true
from public.agents a join public.tenants t on t.id = a.tenant_id
where a.agent_code = '015495' and t.slug = '83g'
on conflict (agent_id) do nothing;
