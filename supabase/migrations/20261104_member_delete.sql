-- ลบสมาชิกทั่วไป (owner, 2026-10-14; mockup https://claude.ai/artifact/FfJbMNuPTwXHFhy1y7NZwn).
--
-- One transaction takes a suspended member out of every table their id is in: their work,
-- customers, wallet and payment history (owner chose 1ข: payments go too), pass, referrals,
-- histories and audit trail. Only a suspended member can go (2ข), and the function checks it
-- again under the row lock, so a reinstate in between wins. The AI cost ledger keeps its rows
-- with the name taken off, so /admin/ai still adds up to what the providers bill.
--
-- `agent_id` has no foreign key on most of these (20261001_outside_members.sql), so nothing
-- cascades by itself. Returns what the caller must clear from Storage afterwards: the folders of
-- the pieces, the poster people and the quote videos, and the logo files.
create or replace function public.ins_member_delete(p_member uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_pieces jsonb;
  v_people jsonb;
  v_videos jsonb;
  v_logos jsonb;
begin
  select status into v_status from ins_members where id = p_member for update;
  if not found then raise exception 'member-not-found'; end if;
  if v_status <> 'suspended' then raise exception 'member-not-suspended'; end if;

  select coalesce(jsonb_agg(id), '[]') into v_pieces from ins_content where agent_id = p_member;
  select coalesce(jsonb_agg(id), '[]') into v_people from ins_people where agent_id = p_member;
  select coalesce(jsonb_agg(id), '[]') into v_videos from ins_quote_videos where agent_id = p_member;
  select coalesce(jsonb_agg(path), '[]') into v_logos from ins_logos where agent_id = p_member;

  delete from ins_content where agent_id = p_member;
  delete from ins_people where agent_id = p_member;
  delete from ins_quote_videos where agent_id = p_member;
  delete from ins_agent_contact where agent_id = p_member;
  delete from ins_fhc_customers where agent_id = p_member;
  delete from ins_describe_history where agent_id = p_member;
  delete from ins_thumbnail_history where agent_id = p_member;
  delete from ins_logos where agent_id = p_member;

  delete from ins_wallet_holds where agent_id = p_member;
  delete from ins_wallet_entries where agent_id = p_member;
  delete from ins_wallet_topups where agent_id = p_member;
  delete from ins_wallets where agent_id = p_member;

  -- before the passes: a referrer's reward_pass_id points at their own pass rows
  delete from ins_referrals where friend_id = p_member or referrer_id = p_member;
  delete from ins_referral_codes where owner_id = p_member;

  delete from ins_session_epochs where agent_id = p_member;
  delete from ins_audit where agent_id = p_member or target = p_member::text;
  update ins_usage_ledger set agent_id = null where agent_id = p_member::text;

  -- ins_member_passes goes with it (on delete cascade)
  delete from ins_members where id = p_member;

  return jsonb_build_object('pieces', v_pieces, 'people', v_people, 'videos', v_videos, 'logos', v_logos);
end;
$$;

revoke all on function public.ins_member_delete(uuid) from public, anon, authenticated;
grant execute on function public.ins_member_delete(uuid) to service_role;
