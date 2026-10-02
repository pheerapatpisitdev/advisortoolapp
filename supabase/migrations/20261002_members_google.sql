-- สมาชิกทั่วไป sign in with Google (owner, 2026-10-02), in place of the phone and PIN of
-- 20261001_outside_members.sql. docs/superpowers/specs/2026-10-02-google-member-signin-design.md
--
-- The one PIN account there was a test (owner: delete it, nobody is carried over). What it made
-- goes with it; ins_hook_templates' link to a piece is set null by its own foreign key.
delete from public.ins_content where agent_id in (select id from public.ins_members);
delete from public.ins_people  where agent_id in (select id from public.ins_members);
delete from public.ins_members;

alter table public.ins_members
  drop column phone,
  drop column pin_hash,
  -- Google's own id for the account, which never changes; the email can
  add column google_sub text not null unique,
  add column email      text not null check (char_length(email) between 3 and 320);
-- still stamped on suspension: a session issued before it is over (src/lib/auth/access.ts)
alter table public.ins_members rename column pin_changed_at to revoked_at;
comment on table public.ins_members is 'advisortool members outside UnitOS, signed in with Google. service_role only.';

-- The owner's wallet page names members by email now.
create or replace function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, coalesce(a.name, m.name), coalesce(a.agent_code, m.email), w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint
  from ins_wallets w
  left join agents a on a.id = w.agent_id
  left join ins_members m on m.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.name, a.agent_code, m.name, m.email, w.balance_satang
  order by w.balance_satang desc;
$$;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
