-- เพื่อนชวนเพื่อน (owner, 2026-10-14; mockup https://claude.ai/artifact/1JrcFHPKDFAkEQLZvhatxk v5).
--
-- Every member and UnitOS agent has a link /r/CODE. A friend who opens it and signs up with
-- Google is tied to whoever invited them, once and for good. When that friend pays for their
-- first 30-day pass, the one who invited them is rewarded: a member gets free days on their own
-- pass (a 'referral' row in ins_member_passes), a UnitOS agent gets baht in their Studio wallet
-- (a 'referral' entry). Each has a monthly ceiling. A refund or dispute of the friend's payment
-- takes the reward back. Off until the owner turns it on.

create table if not exists public.ins_referral_codes (
  -- a member's id or a UnitOS agent's: no foreign key, as with the wallet since 20261001
  owner_id uuid primary key,
  owner_kind text not null check (owner_kind in ('member', 'unitos')),
  -- upper case; the address bar lowers it (src/middleware.ts) and the lookup raises it again
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.ins_referrals (
  -- one inviter per friend, ever
  friend_id uuid primary key references public.ins_members(id) on delete cascade,
  referrer_id uuid not null,
  referrer_kind text not null check (referrer_kind in ('member', 'unitos')),
  created_at timestamptz not null default now(),
  -- the friend's first paid pass, which earned the reward; unique so one payment rewards once
  paid_pass_id bigint unique references public.ins_member_passes(id),
  rewarded_at timestamptz,
  -- what was given: days to a member, satang to an agent; 0 when the month's ceiling was reached
  reward_days int check (reward_days >= 0),
  reward_satang bigint check (reward_satang >= 0),
  -- the 'referral' pass row given to a member, so a refund can cancel exactly it
  reward_pass_id bigint references public.ins_member_passes(id),
  revoked_at timestamptz,
  check (friend_id <> referrer_id)
);

create index if not exists ins_referrals_referrer_idx on public.ins_referrals(referrer_id, created_at);

alter table public.ins_referral_codes enable row level security;
alter table public.ins_referrals enable row level security;

-- the free days a member is given for a friend show in their history as their own kind
alter table public.ins_member_passes drop constraint if exists ins_member_passes_kind_check;
alter table public.ins_member_passes add constraint ins_member_passes_kind_check
  check (kind in ('trial', 'paid', 'granted', 'referral', 'revoked'));

-- and the baht an agent is given, in their wallet
alter table public.ins_wallet_entries drop constraint if exists ins_wallet_entries_kind_check;
alter table public.ins_wallet_entries add constraint ins_wallet_entries_kind_check
  check (kind in ('topup', 'charge', 'adjust', 'clawback', 'referral'));

-- The owner's switch and numbers (owner, 2026-10-14): 3 days a friend up to 30 a month for a
-- member, ฿10 a friend up to ฿100 a month for a UnitOS agent.
alter table public.ins_ai_settings
  add column if not exists referral_enabled boolean not null default false,
  add column if not exists referral_days int not null default 3,
  add column if not exists referral_days_cap int not null default 30,
  add column if not exists referral_satang int not null default 1000,
  add column if not exists referral_satang_cap int not null default 10000;

-- Rewards whoever invited this member, for the paid pass p_session just added. 'none' when
-- nobody did, 'not-first' when the friend had paid before, 'done' when already rewarded,
-- 'days' / 'satang' when given, 'capped' when the month's ceiling left nothing to give. The
-- inviter is locked while their month is counted, so two friends paying at once cannot pass
-- the ceiling together.
create or replace function public.ins_referral_reward(
  p_session text, p_since timestamptz,
  p_days int, p_days_cap int, p_satang bigint, p_satang_cap bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid ins_member_passes;
  r ins_referrals;
  v_friend text;
  v_used bigint;
  v_give bigint;
  v_pass bigint;
begin
  select * into v_paid from ins_member_passes where stripe_session_id = p_session and kind = 'paid';
  if not found then return 'none'; end if;
  select * into r from ins_referrals where friend_id = v_paid.member_id for update;
  if not found then return 'none'; end if;
  if r.rewarded_at is not null then return 'done'; end if;
  if exists (
    select 1 from ins_member_passes
    where member_id = v_paid.member_id and kind = 'paid' and (created_at, id) < (v_paid.created_at, v_paid.id)
  ) then return 'not-first'; end if;

  perform pg_advisory_xact_lock(hashtextextended('ins_referral:' || r.referrer_id::text, 0));
  select coalesce(nullif(btrim(name), ''), 'เพื่อน') into v_friend from ins_members where id = v_paid.member_id;

  if r.referrer_kind = 'member' then
    select coalesce(sum(reward_days), 0) into v_used from ins_referrals
      where referrer_id = r.referrer_id and rewarded_at >= p_since and revoked_at is null;
    v_give := least(p_days, greatest(p_days_cap - v_used, 0));
    if v_give > 0 then
      insert into ins_member_passes (member_id, kind, days, note)
        values (r.referrer_id, 'referral', v_give, v_friend)
        returning id into v_pass;
    end if;
    update ins_referrals set rewarded_at = now(), paid_pass_id = v_paid.id, reward_days = v_give, reward_pass_id = v_pass
      where friend_id = r.friend_id;
    return case when v_give > 0 then 'days' else 'capped' end;
  end if;

  select coalesce(sum(reward_satang), 0) into v_used from ins_referrals
    where referrer_id = r.referrer_id and rewarded_at >= p_since and revoked_at is null;
  v_give := least(p_satang, greatest(p_satang_cap - v_used, 0));
  if v_give > 0 then
    insert into ins_wallets (agent_id) values (r.referrer_id) on conflict (agent_id) do nothing;
    update ins_wallets set balance_satang = balance_satang + v_give, updated_at = now() where agent_id = r.referrer_id;
    insert into ins_wallet_entries (agent_id, kind, amount_satang, note)
      values (r.referrer_id, 'referral', v_give, v_friend);
  end if;
  update ins_referrals set rewarded_at = now(), paid_pass_id = v_paid.id, reward_satang = v_give
    where friend_id = r.friend_id;
  return case when v_give > 0 then 'satang' else 'capped' end;
end;
$$;

-- Takes back the reward a paid pass earned, after Stripe refunded or a bank disputed it. The
-- days are cancelled with a 'revoked' row; the baht come out of the wallet as far as its balance
-- goes (a small sum: the wallet is not frozen for it). 'none' when the payment earned nothing,
-- 'duplicate' when already taken back, else 'revoked'.
create or replace function public.ins_referral_revoke(p_payment_intent text, p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r ins_referrals;
  v_take bigint;
begin
  select f.* into r from ins_referrals f
    join ins_member_passes p on p.id = f.paid_pass_id
    where p.kind = 'paid' and p.payment_intent = p_payment_intent
    for update of f;
  if not found then return 'none'; end if;
  if r.revoked_at is not null then return 'duplicate'; end if;

  if r.reward_pass_id is not null then
    insert into ins_member_passes (member_id, kind, days, revokes, note)
      values (r.referrer_id, 'revoked', 0, r.reward_pass_id, p_note)
      on conflict (revokes) do nothing;
  end if;
  if coalesce(r.reward_satang, 0) > 0 then
    select least(balance_satang, r.reward_satang) into v_take from ins_wallets where agent_id = r.referrer_id for update;
    if coalesce(v_take, 0) > 0 then
      update ins_wallets set balance_satang = balance_satang - v_take, updated_at = now() where agent_id = r.referrer_id;
      insert into ins_wallet_entries (agent_id, kind, amount_satang, note)
        values (r.referrer_id, 'referral', -v_take, p_note);
    end if;
  end if;
  update ins_referrals set revoked_at = now() where friend_id = r.friend_id;
  return 'revoked';
end;
$$;

revoke all on function public.ins_referral_reward(text, timestamptz, int, int, bigint, bigint) from public, anon, authenticated;
revoke all on function public.ins_referral_revoke(text, text) from public, anon, authenticated;
grant execute on function public.ins_referral_reward(text, timestamptz, int, int, bigint, bigint) to service_role;
grant execute on function public.ins_referral_revoke(text, text) to service_role;
