-- Studio wallet (owner, 2026-09-30; spec docs/superpowers/specs/2026-09-30-studio-wallet-topup-design.md).
--
-- An agent past the month's free AI rounds pays for more from a baht wallet they top up through
-- Stripe. Money is kept in satang, whole numbers only. Every change of a balance goes through the
-- functions below, which lock the agent's wallet row first, so two rounds started together — or
-- Stripe telling us twice that one payment went through — cannot spend or credit the same baht twice.

create table if not exists public.ins_wallets (
  agent_id       uuid primary key references public.agents(id) on delete cascade,
  balance_satang bigint not null default 0 check (balance_satang >= 0),
  updated_at     timestamptz not null default now()
);
comment on table public.ins_wallets is 'advisortool: an agent''s Studio wallet, in satang, less what running rounds hold. service_role only.';

create table if not exists public.ins_wallet_entries (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.agents(id) on delete cascade,
  kind              text not null check (kind in ('topup', 'charge', 'adjust')),
  amount_satang     bigint not null,
  cost_thb          numeric,
  round             text,
  stripe_session_id text unique,
  note              text,
  created_by        uuid,
  created_at        timestamptz not null default now()
);
create index if not exists ins_wallet_entries_agent on public.ins_wallet_entries (agent_id, created_at desc);
create index if not exists ins_wallet_entries_charge on public.ins_wallet_entries (created_at) where kind = 'charge';
comment on table public.ins_wallet_entries is 'advisortool: every baht in or out of a wallet; append only. service_role only.';

create table if not exists public.ins_wallet_holds (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  amount_satang bigint not null check (amount_satang > 0),
  round         text not null,
  created_at    timestamptz not null default now()
);
create index if not exists ins_wallet_holds_created on public.ins_wallet_holds (created_at);

create table if not exists public.ins_wallet_topups (
  stripe_session_id text primary key,
  agent_id          uuid not null references public.agents(id) on delete cascade,
  amount_satang     bigint not null check (amount_satang > 0),
  status            text not null default 'open' check (status in ('open', 'paid', 'failed', 'expired')),
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists ins_wallet_topups_agent on public.ins_wallet_topups (agent_id, created_at desc);

alter table public.ins_ai_settings add column if not exists wallet_enabled boolean not null default false;
alter table public.ins_ai_settings add column if not exists wallet_multiplier numeric not null default 2;
alter table public.ins_ai_settings drop constraint if exists ins_ai_settings_wallet_multiplier_range;
alter table public.ins_ai_settings add constraint ins_ai_settings_wallet_multiplier_range check (wallet_multiplier >= 1 and wallet_multiplier <= 10);

alter table public.ins_wallets enable row level security;
alter table public.ins_wallet_entries enable row level security;
alter table public.ins_wallet_holds enable row level security;
alter table public.ins_wallet_topups enable row level security;
revoke all on public.ins_wallets, public.ins_wallet_entries, public.ins_wallet_holds, public.ins_wallet_topups from public, anon, authenticated;
grant all on public.ins_wallets, public.ins_wallet_entries, public.ins_wallet_holds, public.ins_wallet_topups to service_role;

-- Stripe said this session was paid. 'duplicate' when it was credited already (Stripe sends
-- again, and completed + async_payment_succeeded both arrive for one PromptPay payment);
-- 'unknown' when no top-up was opened here for this session and agent.
create or replace function public.ins_wallet_credit_topup(p_session text, p_agent uuid, p_amount bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'top-up amount must be positive'; end if;
  if not exists (select 1 from ins_wallet_topups where stripe_session_id = p_session and agent_id = p_agent) then
    return 'unknown';
  end if;
  insert into ins_wallets (agent_id) values (p_agent) on conflict (agent_id) do nothing;
  perform 1 from ins_wallets where agent_id = p_agent for update;
  if exists (select 1 from ins_wallet_entries where stripe_session_id = p_session) then
    return 'duplicate';
  end if;
  insert into ins_wallet_entries (agent_id, kind, amount_satang, stripe_session_id)
    values (p_agent, 'topup', p_amount, p_session);
  update ins_wallets set balance_satang = balance_satang + p_amount, updated_at = now() where agent_id = p_agent;
  update ins_wallet_topups set status = 'paid', paid_at = now() where stripe_session_id = p_session;
  return 'credited';
end;
$$;

-- Sets money aside for a round about to start. null when the wallet has not got it.
create or replace function public.ins_wallet_hold(p_agent uuid, p_amount bigint, p_round text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_amount <= 0 then raise exception 'hold amount must be positive'; end if;
  update ins_wallets set balance_satang = balance_satang - p_amount, updated_at = now()
    where agent_id = p_agent and balance_satang >= p_amount;
  if not found then return null; end if;
  insert into ins_wallet_holds (agent_id, amount_satang, round) values (p_agent, p_amount, p_round)
    returning id into v_id;
  return v_id;
end;
$$;

-- The round is over: what it cost is charged (never more than was held) and the rest goes
-- back. null when the hold is gone already — swept after a request that died — so nothing is charged.
create or replace function public.ins_wallet_settle(p_hold uuid, p_charge bigint, p_cost_thb numeric)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
  v_charge bigint;
begin
  delete from ins_wallet_holds where id = p_hold returning * into h;
  if not found then return null; end if;
  v_charge := least(h.amount_satang, greatest(0, p_charge));
  update ins_wallets set balance_satang = balance_satang + h.amount_satang - v_charge, updated_at = now()
    where agent_id = h.agent_id;
  if v_charge > 0 or coalesce(p_cost_thb, 0) > 0 then
    insert into ins_wallet_entries (agent_id, kind, amount_satang, cost_thb, round)
      values (h.agent_id, 'charge', -v_charge, p_cost_thb, h.round);
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
  update ins_wallets set balance_satang = balance_satang + h.amount_satang, updated_at = now()
    where agent_id = h.agent_id;
end;
$$;

-- Holds of requests that died before giving them back (a Vercel timeout): returned in full
-- after fifteen minutes, the same lifetime as the content ceiling's reservations.
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
    update ins_wallets set balance_satang = balance_satang + h.amount_satang, updated_at = now()
      where agent_id = h.agent_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- The owner's hand: a refund made in Stripe, a gift, a correction. Always with a reason.
-- null when it would take the balance below zero.
create or replace function public.ins_wallet_adjust(p_agent uuid, p_amount bigint, p_note text, p_by uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 then raise exception 'adjustment must not be zero'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'adjustment needs a reason'; end if;
  insert into ins_wallets (agent_id) values (p_agent) on conflict (agent_id) do nothing;
  update ins_wallets set balance_satang = balance_satang + p_amount, updated_at = now()
    where agent_id = p_agent and balance_satang + p_amount >= 0
    returning balance_satang into v_balance;
  if not found then return null; end if;
  insert into ins_wallet_entries (agent_id, kind, amount_satang, note, created_by)
    values (p_agent, 'adjust', p_amount, btrim(p_note), p_by);
  return v_balance;
end;
$$;

-- What wallet rounds cost the providers since a moment, in baht: taken off the content
-- ceiling's count, since the agents paid for it. Summed here — a select returns at most a
-- thousand rows (see src/lib/ai/ledger.ts).
create or replace function public.ins_wallet_charged_thb(p_since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_thb), 0) from ins_wallet_entries where kind = 'charge' and created_at >= p_since;
$$;

-- One line per wallet for the owner's page.
create or replace function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, a.name, a.agent_code, w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint
  from ins_wallets w
  join agents a on a.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.name, a.agent_code, w.balance_satang
  order by w.balance_satang desc;
$$;

revoke all on function public.ins_wallet_credit_topup(text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.ins_wallet_hold(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.ins_wallet_settle(uuid, bigint, numeric) from public, anon, authenticated;
revoke all on function public.ins_wallet_release(uuid) from public, anon, authenticated;
revoke all on function public.ins_wallet_sweep_holds() from public, anon, authenticated;
revoke all on function public.ins_wallet_adjust(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.ins_wallet_charged_thb(timestamptz) from public, anon, authenticated;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_credit_topup(text, uuid, bigint) to service_role;
grant execute on function public.ins_wallet_hold(uuid, bigint, text) to service_role;
grant execute on function public.ins_wallet_settle(uuid, bigint, numeric) to service_role;
grant execute on function public.ins_wallet_release(uuid) to service_role;
grant execute on function public.ins_wallet_sweep_holds() to service_role;
grant execute on function public.ins_wallet_adjust(uuid, bigint, text, uuid) to service_role;
grant execute on function public.ins_wallet_charged_thb(timestamptz) to service_role;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
