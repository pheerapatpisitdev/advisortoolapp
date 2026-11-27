-- เชื่อม LINE ของฉัน (owner chose ข, 2026-11-19; mockup https://claude.ai/artifact/DtxS7imFDnoq3EYjweC7aa):
-- each agent links their own LINE to the official account once, by typing "ผูก <6 digits>" shown on
-- ตั้งค่าส่วนตัว, and the account then pushes them their own alerts (clip done, clip failed, money
-- low). Additive only: the code before this change never reads it.
--
-- The LINE user id is kept as LINE gives it, because a push needs it, and only after the agent typed
-- their own code into the chat. agent_id is not a foreign key, as ins_agent_contact: it may be a
-- UnitOS agent, a สมาชิกทั่วไป, a Bluewealth or KingClub agent.
create table if not exists public.ins_agent_line (
  agent_id uuid primary key,
  line_user_id text,
  linked_at timestamptz,
  link_code text,
  link_expires timestamptz,
  notify_clip_done boolean not null default true,
  notify_clip_failed boolean not null default true,
  notify_money_low boolean not null default false,
  -- the money-low message went out and the balance has not come back above the line since
  money_low_sent boolean not null default false,
  updated_at timestamptz not null default now()
);
-- a code finds one agent: two agents never wait on the same six digits
create unique index if not exists ins_agent_line_code on public.ins_agent_line (link_code) where link_code is not null;
-- service_role only, as every per-agent table here
alter table public.ins_agent_line enable row level security;
revoke all on public.ins_agent_line from public, anon, authenticated;
grant all on public.ins_agent_line to service_role;
comment on table public.ins_agent_line is 'advisortool: an agent''s own LINE, linked by a code, for their alerts. service_role only.';

-- ลบสมาชิกทั่วไป takes the member's LINE link too: the live function as 20261215_library_uploads.sql
-- left it, with that line added.
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
