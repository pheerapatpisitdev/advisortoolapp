-- advisortool: money coming back from a hold pays a clawback's shortfall first (review, 2026-10-11).
--
-- A refund or dispute claws back from the balance only, and the balance leaves out what running
-- rounds are holding. A top-up of ฿10 with ฿6 held, then refunded: ฿4 was debited and ฿6 written
-- as shortfall; the round settled at ฿1 and ฿5 went back into the frozen wallet, so lifting the
-- freeze (which clears the shortfall) left the agent ฿5 of refunded money.
--
-- Every way a hold ends — settle, release, the 15-minute sweep — now gives its money back through
-- ins_wallet_give_back, which pays any shortfall before the balance and books what it paid as a
-- clawback, so the entries still add up to the balance.

create or replace function public.ins_wallet_give_back(p_agent uuid, p_amount bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_short bigint;
  v_pay bigint;
begin
  if p_amount is null or p_amount <= 0 then return; end if;
  select shortfall_satang into v_short from ins_wallets where agent_id = p_agent for update;
  if not found then return; end if;
  v_pay := least(coalesce(v_short, 0), p_amount);
  update ins_wallets set
      balance_satang = balance_satang + p_amount - v_pay,
      shortfall_satang = shortfall_satang - v_pay,
      updated_at = now()
    where agent_id = p_agent;
  if v_pay > 0 then
    insert into ins_wallet_entries (agent_id, kind, amount_satang, note)
      values (p_agent, 'clawback', -v_pay, 'หักคืนส่วนที่ขาด จากเงินที่กันไว้ให้รอบที่ทำอยู่ตอนคืนเงิน');
  end if;
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
begin
  delete from ins_wallet_holds where id = p_hold returning * into h;
  if not found then return null; end if;
  v_charge := least(h.amount_satang, greatest(0, p_charge));
  perform ins_wallet_give_back(h.agent_id, h.amount_satang - v_charge);
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
  perform ins_wallet_give_back(h.agent_id, h.amount_satang);
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
    perform ins_wallet_give_back(h.agent_id, h.amount_satang);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.ins_wallet_give_back(uuid, bigint) from public, anon, authenticated;
grant execute on function public.ins_wallet_give_back(uuid, bigint) to service_role;
