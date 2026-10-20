-- สิทธิ์เข้าพิเศษ (owner, 2026-10-20; mockup KRqC5VJgr4vHirF6t12Ayx, ก): agents the owner lets in
-- although UnitClub's tier would keep them out (a basic agent, or a Premium past its date, in a
-- room that keeps advisortool for Premium), each with a monthly AI budget of their own. First
-- one: 139508 พี่กริช of 83G, ฿100 a month, no end date.
--
-- The budget is a credit lot like the members' pass lots and the starter lot
-- (20261120_member_credit.sql, 20261121_agent_starter_credit.sql), kind 'special', one per
-- Bangkok calendar month: it starts on the 1st, ends on the next 1st, and ins_wallet_hold spends
-- it before the starter lot (it ends sooner) and before the agent's own money. What is left at
-- the month's end goes with it.

create table if not exists public.ins_special_access (
  agent_id uuid primary key,
  monthly_satang int not null default 10000,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ins_special_access_monthly_range check (monthly_satang between 0 and 1000000)
);
comment on table public.ins_special_access is 'advisortool: agents let in past UnitClub''s Premium lock, with a monthly AI budget (credit lot kind special). service_role only';
alter table public.ins_special_access enable row level security;
revoke all on public.ins_special_access from public, anon, authenticated;
grant all on public.ins_special_access to service_role;

alter table public.ins_member_credits drop constraint if exists ins_member_credits_kind_check;
alter table public.ins_member_credits add constraint ins_member_credits_kind_check check (kind in ('trial', 'paid', 'starter', 'special'));
alter table public.ins_member_credits drop constraint if exists ins_member_credits_pass_or_starter;
alter table public.ins_member_credits add constraint ins_member_credits_pass_or_starter check ((kind in ('starter', 'special')) = (pass_id is null));
-- one special lot per agent per month
create unique index if not exists ins_member_credits_one_special on public.ins_member_credits (member_id, starts_at) where kind = 'special';

-- This month's special lot, written the first time it is asked for in the month: only while the
-- agent is on the list with an amount above ฿0. Anybody else is left as they are.
create or replace function public.ins_special_credit(p_agent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int;
  v_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
begin
  select monthly_satang into v_amount from ins_special_access where agent_id = p_agent;
  if coalesce(v_amount, 0) <= 0 then return; end if;
  insert into ins_member_credits (member_id, kind, amount_satang, left_satang, starts_at, expires_at)
    values (p_agent, 'special', v_amount, v_amount, v_start, v_start + interval '1 month')
    on conflict do nothing;
end;
$$;

-- As 20261121, with this month's special lot asked for first. ins_wallet_hold and the wallet's
-- read (ensureStarterCredit) both call this, so the special lot needs no call of its own.
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
  if not exists (select 1 from agents where id = p_agent) then return; end if;
  if exists (select 1 from ins_staff where agent_id = p_agent and is_owner) then return; end if;
  insert into ins_member_credits (member_id, kind, amount_satang, left_satang, starts_at, expires_at)
    values (p_agent, 'starter', v_amount, v_amount, now(), '9999-12-31T00:00:00Z')
    on conflict do nothing;
end;
$$;

-- The owner sets or changes an agent's monthly amount: the list row, and this month's lot if it
-- is written already, by the difference (never below ฿0 left).
create or replace function public.ins_special_access_set(p_agent uuid, p_satang int, p_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
begin
  insert into ins_special_access (agent_id, monthly_satang, created_by)
    values (p_agent, p_satang, p_by)
    on conflict (agent_id) do update set monthly_satang = excluded.monthly_satang, updated_at = now();
  update ins_member_credits
    set left_satang = greatest(0, left_satang + (p_satang - amount_satang)), amount_satang = p_satang
    where member_id = p_agent and kind = 'special' and starts_at = v_start and voided_at is null;
end;
$$;

-- The owner takes an agent off the list: the row goes and this month's lot is voided, so what is
-- left of it can no longer be spent. Holds already taken settle or release as usual.
create or replace function public.ins_special_access_remove(p_agent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from ins_special_access where agent_id = p_agent;
  update ins_member_credits set voided_at = now()
    where member_id = p_agent and kind = 'special' and voided_at is null and expires_at > now();
end;
$$;

revoke all on function public.ins_special_credit(uuid) from public, anon, authenticated;
grant execute on function public.ins_special_credit(uuid) to service_role;
revoke all on function public.ins_special_access_set(uuid, int, text) from public, anon, authenticated;
grant execute on function public.ins_special_access_set(uuid, int, text) to service_role;
revoke all on function public.ins_special_access_remove(uuid) from public, anon, authenticated;
grant execute on function public.ins_special_access_remove(uuid) to service_role;

-- the first one (owner, 2026-10-20): 139508 พี่กริช, 83G, ฿100 a month
insert into public.ins_special_access (agent_id, monthly_satang, created_by)
  select id, 10000, 'owner 2026-10-20' from public.agents where agent_code = '139508'
  on conflict (agent_id) do nothing;
