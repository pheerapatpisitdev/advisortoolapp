-- The block never commits: it ends by raising, so everything it did is rolled back, on any database.
--   success = the exception "member delete smoke: all good (rolled back)"; anything else is a failure.
-- Run it as it is, with psql or execute_sql:  \i supabase/tests/member_delete_smoke.sql
--
-- It makes its own two members (one suspended, one active) and their rows, so it deletes nothing
-- that is real. Needs 20261104_member_delete.sql (and 20261103_referrals.sql) applied.
do $$
declare
  gone uuid; kept uuid; r jsonb; n bigint;
begin
  insert into ins_members (google_sub, email, name, status) values ('smoke-delete-1', 'smoke-delete-1@example.com', 'smoke', 'suspended') returning id into gone;
  insert into ins_members (google_sub, email, name) values ('smoke-delete-2', 'smoke-delete-2@example.com', 'smoke') returning id into kept;

  insert into ins_wallets (agent_id, balance_satang) values (gone, 3500), (kept, 100);
  insert into ins_wallet_entries (agent_id, kind, amount_satang, note) values (gone, 'topup', 3500, 'smoke'), (kept, 'topup', 100, 'smoke');
  insert into ins_member_passes (member_id, kind, days) values (gone, 'trial', 3), (kept, 'trial', 3);
  insert into ins_audit (agent_id, action) values (gone, 'smoke'), (kept, 'smoke');
  insert into ins_audit (agent_id, action, target) values (null, 'member-suspend', gone::text);
  insert into ins_session_epochs (agent_id, not_before) values (gone, now());
  insert into ins_referral_codes (owner_id, owner_kind, code) values (gone, 'member', 'SMOKEDEL1');
  insert into ins_referrals (friend_id, referrer_id, referrer_kind) values (kept, gone, 'member');

  -- an active member is refused, and keeps everything
  begin
    perform ins_member_delete(kept);
    raise exception 'member delete smoke: an active member was deleted';
  exception when others then
    if sqlerrm <> 'member-not-suspended' then raise; end if;
  end;

  r := ins_member_delete(gone);
  if not (r ? 'pieces' and r ? 'people' and r ? 'videos' and r ? 'logos') then raise exception 'member delete smoke: files list %', r; end if;

  select (select count(*) from ins_members where id = gone)
       + (select count(*) from ins_wallets where agent_id = gone)
       + (select count(*) from ins_wallet_entries where agent_id = gone)
       + (select count(*) from ins_member_passes where member_id = gone)
       + (select count(*) from ins_audit where agent_id = gone or target = gone::text)
       + (select count(*) from ins_session_epochs where agent_id = gone)
       + (select count(*) from ins_referral_codes where owner_id = gone)
       + (select count(*) from ins_referrals where referrer_id = gone)
    into n;
  if n <> 0 then raise exception 'member delete smoke: % rows of the deleted member left', n; end if;

  select (select count(*) from ins_members where id = kept)
       + (select count(*) from ins_wallets where agent_id = kept)
       + (select count(*) from ins_wallet_entries where agent_id = kept)
       + (select count(*) from ins_member_passes where member_id = kept)
       + (select count(*) from ins_audit where agent_id = kept)
    into n;
  if n <> 5 then raise exception 'member delete smoke: the other member lost rows (% of 5 left)', n; end if;

  raise exception 'member delete smoke: all good (rolled back)';
end;
$$;
