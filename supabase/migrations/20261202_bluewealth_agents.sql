-- Bluewealth's agents (owner, 2026-10-24; mockup QtMeowzf8BfkaBXgSksLzY): a second copy of UnitOS
-- whose agents sign in with their 6-digit code and get what a UnitOS agent gets. Who may come in is
-- read live from Bluewealth on every request (src/lib/auth/bluewealth.ts); this table only remembers
-- each one's name, code, หน่วย and room as of their last sign-in, so the back office can name them
-- and the database can tell them from a stranger's id.

create table if not exists public.ins_bluewealth_agents (
  id          uuid primary key,
  agent_code  text not null,
  name        text,
  unit        text,
  tenant_id   uuid,
  tenant_name text,
  seen_at     timestamptz not null default now()
);
comment on table public.ins_bluewealth_agents is 'advisortool: Bluewealth agents as of their last sign-in, for names in the back office. service_role only';
alter table public.ins_bluewealth_agents enable row level security;
revoke all on public.ins_bluewealth_agents from public, anon, authenticated;
grant all on public.ins_bluewealth_agents to service_role;

-- the starter credit is every agent's, Bluewealth's too
create or replace function public.ins_agent_starter_credit(p_agent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int;
begin
  perform ins_special_credit(p_agent);
  if exists (select 1 from ins_member_credits where member_id = p_agent and kind = 'starter') then return; end if;
  select agent_starter_credit_satang into v_amount from ins_ai_settings limit 1;
  if coalesce(v_amount, 0) <= 0 then return; end if;
  if not exists (select 1 from agents where id = p_agent)
    and not exists (select 1 from ins_bluewealth_agents where id = p_agent) then return; end if;
  if exists (select 1 from ins_staff where agent_id = p_agent and is_owner) then return; end if;
  insert into ins_member_credits (member_id, kind, amount_satang, left_satang, starts_at, expires_at)
    values (p_agent, 'starter', v_amount, v_amount, now(), '9999-12-31T00:00:00Z')
    on conflict do nothing;
end;
$$;

-- /admin/wallet names Bluewealth's agents with their room and หน่วย like UnitOS's
create or replace function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint, tenant text, unit text, is_member boolean)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, coalesce(a.name, b.name, m.name), coalesce(a.agent_code, b.agent_code, m.email), w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint,
    coalesce(t.name, b.tenant_name), nullif(btrim(coalesce(a.unit, b.unit)), ''), a.id is null and b.id is null and m.id is not null
  from ins_wallets w
  left join agents a on a.id = w.agent_id
  left join tenants t on t.id = a.tenant_id
  left join ins_bluewealth_agents b on b.id = w.agent_id
  left join ins_members m on m.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.id, a.name, a.agent_code, a.unit, t.name, b.id, b.name, b.agent_code, b.unit, b.tenant_name, m.id, m.name, m.email, w.balance_satang
  order by w.balance_satang desc;
$$;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
