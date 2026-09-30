-- The block never commits: it ends by raising, so everything it did is rolled back, on any database.
--   success = the exception "wallet smoke: all good (rolled back)"; anything else is a failure.
-- Run it as it is, with psql or execute_sql:  \i supabase/tests/wallet_smoke.sql
--
-- It borrows an agent that has no wallet rows yet, so it deletes nothing that is real. Step
-- "a dead hold is swept" calls ins_wallet_sweep_holds(), which releases every agent's holds
-- older than 15 minutes, not only this test's; that is harmless here because the rollback puts
-- them back exactly as they were.
do $$
declare
  a uuid := (select ag.id from agents ag where not exists (select 1 from ins_wallets w where w.agent_id = ag.id) limit 1);
  h1 uuid; h2 uuid; r text; c bigint; b bigint;
begin
  if a is null then raise exception 'wallet smoke: every agent already has a wallet, nothing safe to borrow'; end if;

  -- a session nobody opened is not credited
  r := ins_wallet_credit_topup('cs_test_smoke', a, 10000);
  if r <> 'unknown' then raise exception 'expected unknown, got %', r; end if;

  insert into ins_wallet_topups (stripe_session_id, agent_id, amount_satang) values ('cs_test_smoke', a, 10000);
  r := ins_wallet_credit_topup('cs_test_smoke', a, 10000);
  if r <> 'credited' then raise exception 'expected credited, got %', r; end if;
  r := ins_wallet_credit_topup('cs_test_smoke', a, 10000);
  if r <> 'duplicate' then raise exception 'expected duplicate, got %', r; end if;
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 10000 then raise exception 'credited twice: %', b; end if;

  -- two holds of ฿60 against ฿100: the second is refused
  h1 := ins_wallet_hold(a, 6000, 'ai-write');
  h2 := ins_wallet_hold(a, 6000, 'ai-write');
  if h1 is null or h2 is not null then raise exception 'hold race: % %', h1, h2; end if;

  -- a charge past the hold is cut to the hold; the rest of the hold comes back
  c := ins_wallet_settle(h1, 9999, 2.5);
  if c <> 6000 then raise exception 'charge not capped: %', c; end if;
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 4000 then raise exception 'after capped settle: %', b; end if;

  -- a normal settle gives the unspent part back
  h1 := ins_wallet_hold(a, 1000, 'ai-draw');
  c := ins_wallet_settle(h1, 480, 2.4);
  select balance_satang into b from ins_wallets where agent_id = a;
  if c <> 480 or b <> 3520 then raise exception 'settle: % %', c, b; end if;
  -- settling the same hold again charges nothing
  if ins_wallet_settle(h1, 480, 2.4) is not null then raise exception 'settled twice'; end if;

  -- release gives it all back
  h1 := ins_wallet_hold(a, 500, 'ai-draft');
  perform ins_wallet_release(h1);
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 3520 then raise exception 'release: %', b; end if;

  -- a dead hold is swept
  h1 := ins_wallet_hold(a, 500, 'ai-draft');
  update ins_wallet_holds set created_at = now() - interval '16 minutes' where id = h1;
  if ins_wallet_sweep_holds() < 1 then raise exception 'sweep found nothing'; end if;
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 3520 then raise exception 'sweep: %', b; end if;

  -- the owner cannot take it below zero
  if ins_wallet_adjust(a, -999999, 'test', a) is not null then raise exception 'adjust went negative'; end if;
  if ins_wallet_adjust(a, 2000, 'ของขวัญ', a) <> 5520 then raise exception 'adjust'; end if;

  if ins_wallet_charged_thb(now() - interval '1 hour') < 4.9 then raise exception 'charged_thb'; end if;
  raise exception 'wallet smoke: all good (rolled back)';
end $$;
