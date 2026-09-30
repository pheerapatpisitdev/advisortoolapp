-- สมาชิกทั่วไป: people outside UnitOS who sign up at advisortool itself (owner, 2026-10-01).
--
-- Until now whoever used Studio was a row of UnitOS's `agents`. People with no UnitOS room get
-- an account here instead — never a row in `agents`, whose triggers (seat limit, signup notice,
-- welcome announcement) belong to UnitOS and which would let them into UnitOS itself. They sign
-- in with their phone and a 6-digit PIN they chose; the phone is the name, the PIN the secret.
create table public.ins_members (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null unique check (phone ~ '^0[0-9]{9}$'),
  name           text not null check (char_length(name) between 1 and 60),
  -- scrypt$N$r$p$salt$hash, src/lib/auth/member.ts
  pin_hash       text not null,
  status         text not null default 'active' check (status in ('active', 'suspended')),
  signup_ip      text,
  created_at     timestamptz not null default now(),
  -- a session issued before this is refused: changing or resetting the PIN signs out every other device
  pin_changed_at timestamptz
);
create index ins_members_signup_ip_idx on public.ins_members (signup_ip, created_at desc);
comment on table public.ins_members is 'advisortool members outside UnitOS: phone + hashed PIN. service_role only.';
alter table public.ins_members enable row level security;
revoke all on public.ins_members from anon, authenticated;

-- `agent_id` now holds a UnitOS agent's id or a member's. ins_staff and ins_sso_tickets keep
-- theirs: only UnitOS agents are staff or come in from UnitOS. Dropping the cascade on the
-- wallet tables also means money an agent paid in is no longer deleted with their UnitOS row.
alter table public.ins_content        drop constraint if exists ins_content_agent_id_fkey;
alter table public.ins_people         drop constraint if exists ins_people_agent_id_fkey;
alter table public.ins_audit          drop constraint if exists ins_audit_agent_id_fkey;
alter table public.ins_wallets        drop constraint if exists ins_wallets_agent_id_fkey;
alter table public.ins_wallet_entries drop constraint if exists ins_wallet_entries_agent_id_fkey;
alter table public.ins_wallet_holds   drop constraint if exists ins_wallet_holds_agent_id_fkey;
alter table public.ins_wallet_topups  drop constraint if exists ins_wallet_topups_agent_id_fkey;

-- signup is off until the owner has tried it on production
alter table public.ins_ai_settings
  add column if not exists member_signup_enabled boolean not null default false,
  add column if not exists member_contact_url text;

-- the per-phone lock: five wrong PINs for one phone from any number of addresses
alter table public.ins_login_attempts add column if not exists phone text;
create index if not exists ins_login_attempts_phone_idx
  on public.ins_login_attempts (phone, created_at desc) where phone is not null;

-- The owner's wallet page: members' wallets too, named by their name and phone.
create or replace function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, coalesce(a.name, m.name), coalesce(a.agent_code, m.phone), w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint
  from ins_wallets w
  left join agents a on a.id = w.agent_id
  left join ins_members m on m.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.name, a.agent_code, m.name, m.phone, w.balance_satang
  order by w.balance_satang desc;
$$;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
