-- Two holes in the Studio wallet found in review (owner, 2026-10-01).
--
-- 1. The ten free rounds were counted in the app and written down after: ten requests sent at
--    9 of 10 used all read "9" and all ran free, and a round whose line failed to be written ran
--    free and uncounted. Taking a free round is now one function under a per-agent lock, and a
--    free round that gave the agent nothing is handed back.
-- 2. A top-up refunded in Stripe, or disputed by the card's bank, left the money in the wallet to
--    be spent. Now the refunded or disputed amount is taken back from the wallet — as far as the
--    balance goes, the rest written down as a shortfall — and the wallet is frozen until the owner
--    unfreezes it on /admin/wallet.
--
-- `agent_id` is a UnitOS agent's id or an outside member's (20261001_outside_members.sql), so
-- nothing here has a foreign key to agents.

-- ─── 1. free rounds ───────────────────────────────────────────────────────────────────────────

-- One free round for the agent, or null when their free rounds are used. Counts exactly what
-- allowanceOf (src/lib/auth/quota.ts) counts — every AI round of theirs in ins_audit since
-- p_from — under a transaction lock of that agent's, so two rounds started together are counted
-- one after the other. The line is written here, before the model is called; its id comes back
-- so a round that delivers nothing can be returned (ins_return_free_round). The limit, the
-- start date and the round names come from the code, the one place they are set. Staff never
-- reach this: they are let through in the code before it.
create or replace function public.ins_take_free_round(
  p_agent uuid, p_action text, p_target text, p_limit integer, p_from timestamptz, p_rounds text[]
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_id bigint;
begin
  if p_agent is null then raise exception 'no agent'; end if;
  if not (p_action = any (p_rounds)) then raise exception 'not an AI round: %', p_action; end if;
  perform pg_advisory_xact_lock(hashtextextended('ins_free_round:' || p_agent::text, 0));
  select count(*) into v_used from ins_audit
    where agent_id = p_agent and action = any (p_rounds) and at >= p_from;
  if v_used >= p_limit then return null; end if;
  insert into ins_audit (agent_id, action, target, detail)
    values (p_agent, p_action, p_target, jsonb_build_object('free', true))
    returning id into v_id;
  return v_id;
end;
$$;

-- A free round that threw or delivered nothing is given back. The line is kept — the attempt
-- happened — but renamed 'ai-returned', which no count of rounds looks for (allowanceOf, the
-- members' list in src/lib/auth/member-store.ts), with the round it was in its detail. Only a
-- free round's line: a wallet round's money is given back by ins_wallet_release instead.
create or replace function public.ins_return_free_round(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update ins_audit
    set action = 'ai-returned',
        detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('round', action, 'returned_at', now())
    where id = p_id and action like 'ai-%' and action <> 'ai-returned' and detail ->> 'free' = 'true';
  return found;
end;
$$;

revoke all on function public.ins_take_free_round(uuid, text, text, integer, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.ins_return_free_round(bigint) from public, anon, authenticated;
grant execute on function public.ins_take_free_round(uuid, text, text, integer, timestamptz, text[]) to service_role;
grant execute on function public.ins_return_free_round(bigint) to service_role;

-- ─── 2. refunds and disputes ──────────────────────────────────────────────────────────────────

-- A refund or a dispute names the charge's PaymentIntent, not the Checkout Session, so the
-- top-up keeps it from the moment it is paid. Top-ups paid before this have none; the webhook
-- looks those up in Stripe once and writes it here (src/lib/wallet/events.ts).
alter table public.ins_wallet_topups add column if not exists stripe_payment_intent text;
create unique index if not exists ins_wallet_topups_payment_intent
  on public.ins_wallet_topups (stripe_payment_intent) where stripe_payment_intent is not null;
-- what Stripe has said was refunded of this payment so far (a charge's amount_refunded is the
-- running total): a refund event takes back only what it adds to it, so a retried event takes
-- nothing and partial refunds each take their own part, in whatever order they arrive
alter table public.ins_wallet_topups add column if not exists refunded_satang bigint not null default 0;
-- what has been claimed back for this top-up, by refunds and disputes together: never more than it brought in
alter table public.ins_wallet_topups add column if not exists clawed_satang bigint not null default 0;
alter table public.ins_wallet_topups drop constraint if exists ins_wallet_topups_clawed_range;
alter table public.ins_wallet_topups add constraint ins_wallet_topups_clawed_range
  check (refunded_satang >= 0 and clawed_satang >= 0 and clawed_satang <= amount_satang);

-- A frozen wallet pays for no round and takes no new top-up until the owner unfreezes it. The
-- shortfall is what a refund or dispute could not take back because the money was spent: the
-- balance stays at zero or more (its CHECK), and the owner settles the rest by hand.
alter table public.ins_wallets add column if not exists frozen_at timestamptz;
alter table public.ins_wallets add column if not exists frozen_reason text;
alter table public.ins_wallets add column if not exists shortfall_satang bigint not null default 0;
alter table public.ins_wallets drop constraint if exists ins_wallets_shortfall_range;
alter table public.ins_wallets add constraint ins_wallets_shortfall_range check (shortfall_satang >= 0);

-- 'clawback': money taken back after a refund or a dispute. stripe_ref is the Stripe object it
-- answers (a dispute's id, or a charge's id with the refunded total), one entry each.
alter table public.ins_wallet_entries drop constraint if exists ins_wallet_entries_kind_check;
alter table public.ins_wallet_entries add constraint ins_wallet_entries_kind_check
  check (kind in ('topup', 'charge', 'adjust', 'clawback'));
alter table public.ins_wallet_entries add column if not exists stripe_ref text;
create unique index if not exists ins_wallet_entries_stripe_ref
  on public.ins_wallet_entries (stripe_ref) where stripe_ref is not null;

-- Crediting a top-up now keeps its PaymentIntent too (null when Stripe sent none). The old
-- three-argument function is dropped so a call by name cannot reach two; the code calls with
-- named arguments, and one sent without p_payment_intent still lands here.
drop function if exists public.ins_wallet_credit_topup(text, uuid, bigint);
create or replace function public.ins_wallet_credit_topup(p_session text, p_agent uuid, p_amount bigint, p_payment_intent text default null)
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
  if nullif(btrim(p_payment_intent), '') is not null then
    update ins_wallet_topups set stripe_payment_intent = p_payment_intent
      where stripe_session_id = p_session and stripe_payment_intent is null;
  end if;
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

-- A hold on a frozen wallet is refused like one on an empty wallet: null.
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
    where agent_id = p_agent and balance_satang >= p_amount and frozen_at is null;
  if not found then return null; end if;
  insert into ins_wallet_holds (agent_id, amount_satang, round) values (p_agent, p_amount, p_round)
    returning id into v_id;
  return v_id;
end;
$$;

-- Stripe says a top-up's payment was refunded (p_kind 'refund', p_amount the charge's refunded
-- total so far, p_ref the charge's id) or disputed (p_kind 'dispute', p_amount the disputed
-- amount, p_ref the dispute's id). Takes back what is new, as far as the balance goes, writes
-- the rest down as a shortfall, and freezes the wallet (owner, 2026-10-01). Under the wallet's
-- lock, the same as crediting, so a refund retried or two arriving together take back once.
-- Answers {result: 'clawed' | 'duplicate' | 'unknown', agent, claimed, debited, shortfall}.
create or replace function public.ins_wallet_clawback(p_payment_intent text, p_kind text, p_ref text, p_amount bigint, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t ins_wallet_topups;
  v_balance bigint;
  v_claim bigint;
  v_debit bigint;
  v_short bigint;
  v_ref text;
begin
  if p_kind not in ('refund', 'dispute') then raise exception 'unknown clawback kind: %', p_kind; end if;
  if p_amount is null or p_amount < 0 then raise exception 'clawback amount must not be negative'; end if;
  if coalesce(btrim(p_ref), '') = '' then raise exception 'clawback needs a Stripe reference'; end if;
  select * into t from ins_wallet_topups where stripe_payment_intent = p_payment_intent;
  if not found then return jsonb_build_object('result', 'unknown'); end if;
  insert into ins_wallets (agent_id) values (t.agent_id) on conflict (agent_id) do nothing;
  select balance_satang into v_balance from ins_wallets where agent_id = t.agent_id for update;
  -- read again under the wallet's lock: another event of this payment may have just finished
  select * into t from ins_wallet_topups where stripe_session_id = t.stripe_session_id for update;

  if p_kind = 'refund' then
    v_claim := p_amount - t.refunded_satang;
    if v_claim <= 0 then return jsonb_build_object('result', 'duplicate', 'agent', t.agent_id); end if;
    v_ref := 'refund:' || p_ref || ':' || p_amount;
    update ins_wallet_topups set refunded_satang = p_amount where stripe_session_id = t.stripe_session_id;
  else
    v_ref := 'dispute:' || p_ref;
    if exists (select 1 from ins_wallet_entries where stripe_ref = v_ref) then
      return jsonb_build_object('result', 'duplicate', 'agent', t.agent_id);
    end if;
    v_claim := p_amount;
  end if;

  -- a refund and a dispute of one payment never claim more than it brought in
  v_claim := greatest(0, least(v_claim, t.amount_satang - t.clawed_satang));
  v_debit := least(v_balance, v_claim);
  v_short := v_claim - v_debit;
  update ins_wallet_topups set clawed_satang = clawed_satang + v_claim where stripe_session_id = t.stripe_session_id;
  update ins_wallets set
      balance_satang = balance_satang - v_debit,
      shortfall_satang = shortfall_satang + v_short,
      frozen_at = coalesce(frozen_at, now()),
      frozen_reason = p_note,
      updated_at = now()
    where agent_id = t.agent_id;
  insert into ins_wallet_entries (agent_id, kind, amount_satang, stripe_session_id, stripe_ref, note)
    values (t.agent_id, 'clawback', -v_debit, null, v_ref, p_note);
  return jsonb_build_object('result', 'clawed', 'agent', t.agent_id, 'claimed', v_claim, 'debited', v_debit, 'shortfall', v_short);
end;
$$;

-- The owner's hand lifting a freeze, with a reason. The shortfall is cleared with it — collect
-- it first with an adjustment if it is to be collected — and comes back so the audit line
-- (written by the page's action, with who and why) says what was let go. null when the wallet
-- was not frozen.
create or replace function public.ins_wallet_unfreeze(p_agent uuid, p_note text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short bigint;
begin
  if coalesce(btrim(p_note), '') = '' then raise exception 'unfreezing needs a reason'; end if;
  select shortfall_satang into v_short from ins_wallets where agent_id = p_agent and frozen_at is not null for update;
  if not found then return null; end if;
  update ins_wallets set frozen_at = null, frozen_reason = null, shortfall_satang = 0, updated_at = now()
    where agent_id = p_agent;
  return v_short;
end;
$$;

revoke all on function public.ins_wallet_credit_topup(text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.ins_wallet_hold(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.ins_wallet_clawback(text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.ins_wallet_unfreeze(uuid, text) from public, anon, authenticated;
grant execute on function public.ins_wallet_credit_topup(text, uuid, bigint, text) to service_role;
grant execute on function public.ins_wallet_hold(uuid, bigint, text) to service_role;
grant execute on function public.ins_wallet_clawback(text, text, text, bigint, text) to service_role;
grant execute on function public.ins_wallet_unfreeze(uuid, text) to service_role;
