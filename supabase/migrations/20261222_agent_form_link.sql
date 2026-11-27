-- ลิงก์ฟอร์มใบคำขอของฉัน (owner chose ค ก ก, 2026-11-27, mockup https://claude.ai/artifact/7sJchDbGgkax2iM1ndUSwH):
-- the application-form link an agent set by hand in ตั้งค่าส่วนตัว. The LINE OA bot sends it when
-- that agent, linked by เชื่อม LINE ของฉัน, asks for a form. Null = no link of their own: a UnitClub
-- agent then gets their UnitClub /apply/<handle> link, worked out each time (src/lib/line/agent-form.ts).
-- Additive only. ins_agent_prefs was never in ins_member_delete; it is now (below).
alter table ins_agent_prefs add column if not exists form_link text;
alter table ins_agent_prefs drop constraint if exists ins_agent_prefs_form_link_check;
alter table ins_agent_prefs add constraint ins_agent_prefs_form_link_check
  check (form_link is null or (length(form_link) <= 500 and form_link ~ '^https://'));

-- ลบสมาชิกทั่วไป now takes the member's ตั้งค่าส่วนตัว row too (it holds the form link they typed):
-- the live function as 20261218_agent_line.sql left it (checked against prod 2026-11-27), with that line added.
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
  v_library jsonb;
begin
  select status into v_status from ins_members where id = p_member for update;
  if not found then raise exception 'member-not-found'; end if;
  if v_status <> 'suspended' then raise exception 'member-not-suspended'; end if;

  select coalesce(jsonb_agg(id), '[]') into v_pieces from ins_content where agent_id = p_member;
  select coalesce(jsonb_agg(id), '[]') into v_people from ins_people where agent_id = p_member;
  select coalesce(jsonb_agg(id), '[]') into v_videos from ins_quote_videos where agent_id = p_member;
  select coalesce(jsonb_agg(path), '[]') into v_logos from ins_logos where agent_id = p_member;
  -- uploads still waiting or refused go with the member; approved ones stay in the library for everyone
  select coalesce(jsonb_agg(p), '[]') into v_library
    from ins_library_uploads u, unnest(u.paths) p where u.agent_id = p_member and u.state <> 'ok';

  delete from ins_content where agent_id = p_member;
  delete from ins_people where agent_id = p_member;
  delete from ins_quote_videos where agent_id = p_member;
  delete from ins_agent_contact where agent_id = p_member;
  delete from ins_fhc_customers where agent_id = p_member;
  delete from ins_describe_history where agent_id = p_member;
  delete from ins_thumbnail_history where agent_id = p_member;
  delete from ins_logos where agent_id = p_member;
  -- คลิปตามโจทย์'s written scripts (20261113): no files of their own, so nothing to return for Storage
  delete from ins_prompt_drafts where agent_id = p_member;
  -- คลังแอนิเมชัน's saved pieces and votes (20261210): no files either
  delete from ins_library_marks where agent_id = p_member;
  -- มีอะไรใหม่'s reads (20261213)
  delete from ins_update_reads where agent_id = p_member;
  -- เชื่อม LINE ของฉัน (20261218)
  delete from ins_agent_line where agent_id = p_member;
  -- ตั้งค่าส่วนตัว, with ลิงก์ฟอร์มใบคำขอของฉัน (20261212, 20261222)
  delete from ins_agent_prefs where agent_id = p_member;
  -- คลังแอนิเมชัน's uploads (20261215): the ones not approved; their files are returned for Storage
  delete from ins_library_uploads where agent_id = p_member and state <> 'ok';

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

  return jsonb_build_object('pieces', v_pieces, 'people', v_people, 'videos', v_videos, 'logos', v_logos, 'library', v_library);
end;
$$;

revoke all on function public.ins_member_delete(uuid) from public, anon, authenticated;
grant execute on function public.ins_member_delete(uuid) to service_role;
