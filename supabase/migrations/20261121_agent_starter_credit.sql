-- A starter credit for UnitClub agents (owner, 2026-10-18; mockup TFmpdUSVZcCMigCaziQYf6, ก ก):
-- ฿15 in Studio, once, never expiring, in place of the ten free rounds and two free clips.
-- Every agent gets the whole amount the first time their wallet is read or held after this
-- ships, whatever free rounds they had used. The owner is not given one: the owner pays nothing.
--
-- The lot lives beside the members' pass lots (20261120_member_credit.sql), so the wallet's hold
-- spends it the same way, before the agent's own money. Its owner column, member_id, now holds a
-- UnitOS agent's id too, so the foreign key to ins_members goes; a member's lots still go with
-- their pass rows (pass_id cascades). A starter lot has no pass row; `kind` tells the lots apart.

alter table public.ins_member_credits drop constraint if exists ins_member_credits_member_id_fkey;
alter table public.ins_member_credits alter column pass_id drop not null;
alter table public.ins_member_credits add column if not exists kind text not null default 'paid';
alter table public.ins_member_credits drop constraint if exists ins_member_credits_kind_check;
alter table public.ins_member_credits add constraint ins_member_credits_kind_check check (kind in ('trial', 'paid', 'starter'));
update public.ins_member_credits c set kind = 'trial'
  from public.ins_member_passes p where p.id = c.pass_id and p.kind = 'trial' and c.kind <> 'trial';
alter table public.ins_member_credits drop constraint if exists ins_member_credits_pass_or_starter;
alter table public.ins_member_credits add constraint ins_member_credits_pass_or_starter check ((kind = 'starter') = (pass_id is null));
-- once per agent, ever
create unique index if not exists ins_member_credits_one_starter on public.ins_member_credits (member_id) where kind = 'starter';
comment on column public.ins_member_credits.member_id is 'whose lot: an outside member (trial, paid) or a UnitOS agent (starter)';

alter table public.ins_ai_settings
  add column if not exists agent_starter_credit_satang int not null default 1500;
alter table public.ins_ai_settings drop constraint if exists ins_ai_settings_agent_starter_range;
alter table public.ins_ai_settings add constraint ins_ai_settings_agent_starter_range
  check (agent_starter_credit_satang between 0 and 100000);

-- The starter lot, written the first time it is asked for: only for a UnitOS agent who is not
-- the owner, only while the owner's amount is above ฿0, and only once (the unique index makes
-- two first asks write one). A member or anyone else is left as they are.
create or replace function public.ins_agent_starter_credit(p_agent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int;
begin
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

-- As 20261120, with the starter lot asked for first, so an agent's very first round finds it.
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
  perform ins_agent_starter_credit(p_agent);
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

revoke all on function public.ins_agent_starter_credit(uuid) from public, anon, authenticated;
grant execute on function public.ins_agent_starter_credit(uuid) to service_role;
