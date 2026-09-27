-- Studio's rows get an owner, now that every UnitOS agent may write in it (2026-09-27).
--
-- A piece is its writer's: an agent sees and changes their own; the staff who post to the Page
-- see every piece the staff wrote, which is the pool the calendar draws from. A person in the
-- people library is likewise the agent's who added them (the owner chose not to share within a
-- room); tenant_id is kept for reference only. Everything written before today was the owner's,
-- and is marked so.
alter table public.ins_content
  add column agent_id  uuid references public.agents(id) on delete set null,
  add column tenant_id uuid references public.tenants(id) on delete set null;
alter table public.ins_people
  add column agent_id  uuid references public.agents(id) on delete set null,
  add column tenant_id uuid references public.tenants(id) on delete set null;

update public.ins_content c set agent_id = s.agent_id, tenant_id = a.tenant_id
from public.ins_staff s join public.agents a on a.id = s.agent_id
where s.is_owner and c.agent_id is null;
update public.ins_people p set agent_id = s.agent_id, tenant_id = a.tenant_id
from public.ins_staff s join public.agents a on a.id = s.agent_id
where s.is_owner and p.agent_id is null;

create index ins_content_agent_created on public.ins_content (agent_id, created_at desc);
create index ins_people_tenant on public.ins_people (tenant_id);

-- how many AI rounds (write, หาทีม, draw) an agent may start in a month; null = the code's default
alter table public.ins_ai_settings
  add column member_ai_month integer check (member_ai_month >= 0),
  add column trial_ai_month  integer check (trial_ai_month >= 0);

-- the quota counts an agent's rounds this month from the audit log, which a deleted piece does not undo
create index ins_audit_agent_action_at on public.ins_audit (agent_id, action, at desc);
