-- Studio credit for outside members (owner, 2026-10-17; mockup 3NoZWL3bJ4VH2Msw7vDgQc).
--
-- The pass's free Studio rounds and free clips give way to baht: ฿15 with the 3-day trial and
-- ฿50 with every paid 30 days. Each grant is a lot tied to the pass row that earned it, spent
-- before the member's own money and gone when its period ends — nothing carries over, and a
-- refunded or disputed pass voids its lot. Lots are written by the app (src/lib/members/credit.ts)
-- the first time a member is seen with a trial or paid row that has none; the unique pass_id
-- makes two first visits write one lot.
--
-- ins_wallets.balance_satang stays the member's own money only, so refunds, clawbacks and the
-- entries adding up to the balance are untouched. A hold now takes from the lots first (soonest
-- to expire first) and from the balance for the rest, and remembers which lots it took from;
-- however the hold ends, the charge eats the credit part first and the rest goes back where it
-- came from. A charge entry's amount_satang is what the balance paid; credit_satang what the
-- credit paid.

create table if not exists public.ins_member_credits (
  id            bigserial primary key,
  member_id     uuid not null references public.ins_members(id) on delete cascade,
  pass_id       bigint not null unique references public.ins_member_passes(id) on delete cascade,
  amount_satang bigint not null check (amount_satang > 0),
  left_satang   bigint not null check (left_satang >= 0),
  starts_at     timestamptz not null,
  expires_at    timestamptz not null,
  voided_at     timestamptz,
  created_at    timestamptz not null default now(),
  constraint ins_member_credits_left_range check (left_satang <= amount_satang)
);
create index if not exists ins_member_credits_member on public.ins_member_credits (member_id, expires_at);
comment on table public.ins_member_credits is 'advisortool: Studio credit an outside member''s pass carries, one lot per trial or paid row. service_role only.';

alter table public.ins_member_credits enable row level security;
revoke all on public.ins_member_credits from public, anon, authenticated;
grant all on public.ins_member_credits to service_role;
grant usage, select on sequence public.ins_member_credits_id_seq to service_role;

alter table public.ins_wallet_holds add column if not exists credit_taken jsonb not null default '[]'::jsonb;
alter table public.ins_wallet_entries add column if not exists credit_satang bigint not null default 0;

-- the owner's two amounts (admin box on /admin/wallet); the pass's rounds and clips columns stay, unread
alter table public.ins_ai_settings
  add column if not exists member_trial_credit_satang int not null default 1500,
  add column if not exists member_pass_credit_satang int not null default 5000;
alter table public.ins_ai_settings drop constraint if exists ins_ai_settings_member_credit_range;
alter table public.ins_ai_settings add constraint ins_ai_settings_member_credit_range
  check (member_trial_credit_satang between 0 and 100000 and member_pass_credit_satang between 0 and 100000);

-- Sets money aside for a round about to start: the member's live credit first, then the
-- balance. null when the two together have not got it, or when the balance is needed and the
-- wallet is frozen. The wallet row, when there is one, is locked first, then the lots.
create or replace function public.ins_wallet_hold(p_agent uuid, p_amount bigint, p_round text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_need bigint := p_amount;
  v_take bigint;
  v_taken jsonb := '[]'::jsonb;
  v_bal bigint;
  v_frozen timestamptz;
  lot record;
begin
  if p_amount <= 0 then raise exception 'hold amount must be positive'; end if;
  select balance_satang, frozen_at into v_bal, v_frozen from ins_wallets where agent_id = p_agent for update;
  for lot in
    select id, left_satang from ins_member_credits
      where member_id = p_agent and voided_at is null and left_satang > 0
        and starts_at <= now() and expires_at > now()
      order by expires_at, id
      for update
  loop
    exit when v_need = 0;
    v_take := least(lot.left_satang, v_need);
    v_need := v_need - v_take;
    v_taken := v_taken || jsonb_build_array(jsonb_build_object('lot', lot.id, 'satang', v_take));
  end loop;
  if v_need > 0 and (v_bal is null or v_frozen is not null or v_bal < v_need) then
    return null;
  end if;
  update ins_member_credits c set left_satang = c.left_satang - (t->>'satang')::bigint
    from jsonb_array_elements(v_taken) t
    where c.id = (t->>'lot')::bigint;
  if v_need > 0 then
    update ins_wallets set balance_satang = balance_satang - v_need, updated_at = now() where agent_id = p_agent;
  end if;
  insert into ins_wallet_holds (agent_id, amount_satang, round, credit_taken) values (p_agent, p_amount, p_round, v_taken)
    returning id into v_id;
  return v_id;
end;
$$;

-- A hold ending, whichever way: p_charge (already within the hold) is paid from its credit part
-- first. The credit it did not use goes back to the lots it came from, last taken first — a lot
-- that has expired meanwhile takes it back and still counts for nothing; the own money it did
-- not use goes back through ins_wallet_give_back (which pays a shortfall first). Answers the
-- credit the charge used.
create or replace function public.ins_wallet_end_hold(h ins_wallet_holds, p_charge bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit bigint;
  v_used bigint;
  v_back bigint;
  v_give bigint;
  t jsonb;
begin
  select coalesce(sum((e->>'satang')::bigint), 0) into v_credit from jsonb_array_elements(h.credit_taken) e;
  v_used := least(v_credit, p_charge);
  v_back := v_credit - v_used;
  for t in select e from jsonb_array_elements(h.credit_taken) with ordinality as x(e, n) order by n desc loop
    exit when v_back <= 0;
    v_give := least((t->>'satang')::bigint, v_back);
    update ins_member_credits set left_satang = least(amount_satang, left_satang + v_give) where id = (t->>'lot')::bigint;
    v_back := v_back - v_give;
  end loop;
  perform ins_wallet_give_back(h.agent_id, (h.amount_satang - v_credit) - (p_charge - v_used));
  return v_used;
end;
$$;

create or replace function public.ins_wallet_settle(p_hold uuid, p_charge bigint, p_cost_thb numeric)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
  v_charge bigint;
  v_credit bigint;
begin
  delete from ins_wallet_holds where id = p_hold returning * into h;
  if not found then return null; end if;
  v_charge := least(h.amount_satang, greatest(0, p_charge));
  v_credit := ins_wallet_end_hold(h, v_charge);
  if v_charge > 0 or coalesce(p_cost_thb, 0) > 0 then
    insert into ins_wallet_entries (agent_id, kind, amount_satang, credit_satang, cost_thb, round)
      values (h.agent_id, 'charge', -(v_charge - v_credit), v_credit, p_cost_thb, h.round);
  end if;
  return v_charge;
end;
$$;

create or replace function public.ins_wallet_release(p_hold uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
begin
  delete from ins_wallet_holds where id = p_hold returning * into h;
  if not found then return; end if;
  perform ins_wallet_end_hold(h, 0);
end;
$$;

create or replace function public.ins_wallet_sweep_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
  n integer := 0;
begin
  for h in delete from ins_wallet_holds where created_at < now() - interval '15 minutes' returning * loop
    perform ins_wallet_end_hold(h, 0);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.ins_wallet_end_hold(ins_wallet_holds, bigint) from public, anon, authenticated;
grant execute on function public.ins_wallet_end_hold(ins_wallet_holds, bigint) to service_role;
