-- Who made each AI call, so the owner can see who uses AI and how much (owner, 2026-10-10).
--
-- Asking the AI is still free. The owner wants the numbers before deciding on a price, and the
-- ledger said what each call cost but not whose it was. agent_id is the signed-in person behind
-- the call (an agent or a Google member, so no foreign key, as with the wallet tables). ask_id
-- groups the several calls one question or one Studio round makes. Both stay null for the
-- customer bots and for every row written before this.

alter table public.ins_usage_ledger
  add column if not exists agent_id text,
  add column if not exists ask_id uuid;

create index if not exists ins_usage_ledger_agent_created_idx
  on public.ins_usage_ledger (agent_id, created_at);

-- One line per person and kind of work since p_since: Studio (tasks starting with "content")
-- or chat (everything else). asks counts distinct ask_id, so a question is one, however many
-- calls it took. Reservation rows are left out, as monthSpend leaves them out.
create or replace function public.ins_spend_by_agent(p_since timestamptz)
returns table (agent_id text, studio boolean, asks bigint, calls bigint, cost_thb numeric)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select l.agent_id,
         l.task like 'content%' as studio,
         count(distinct l.ask_id) as asks,
         count(*) as calls,
         coalesce(sum(l.cost_thb), 0) as cost_thb
  from public.ins_usage_ledger l
  where l.created_at >= p_since and l.model is distinct from 'reservation'
  group by l.agent_id, l.task like 'content%'
$$;

revoke execute on function public.ins_spend_by_agent(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_spend_by_agent(timestamptz) to service_role;
