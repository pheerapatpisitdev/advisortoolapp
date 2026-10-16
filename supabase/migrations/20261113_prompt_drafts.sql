-- คลิปตามโจทย์ (owner, 2026-10-16): every script the writer produces is kept as a draft, which
-- also gives the rolling-hour limit (20 scripts per agent) something to count.
-- agent_id is not a foreign key: a สมาชิกทั่วไป's id is a row of ins_members.
-- Additive only. Locked to service_role like every other ins_* table.

create table if not exists public.ins_prompt_drafts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  brief jsonb not null,
  script jsonb not null,
  -- the clip this draft was made into (ins_quote_videos.id): claimed by one conditional update, so a
  -- second press of สร้างคลิป is refused; given back when the clip fails or cannot be paid for
  made_clip_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ins_prompt_drafts_agent_created on public.ins_prompt_drafts (agent_id, created_at desc);
alter table public.ins_prompt_drafts enable row level security;
revoke all on public.ins_prompt_drafts from public, anon, authenticated;
grant all on public.ins_prompt_drafts to service_role;
comment on table public.ins_prompt_drafts is 'advisortool: a written คลิปตามโจทย์ script (brief + script), also the hourly limit''s count. service_role only.';

-- ลบสมาชิกทั่วไป (20261104_member_delete.sql) takes the member's drafts too: the live function as it
-- stands, with the one delete added. Its return (what Storage must clear) is unchanged.
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
  -- คลิปตามโจทย์'s written scripts (20261113): no files of their own, so nothing to return for Storage
  delete from ins_prompt_drafts where agent_id = p_member;

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
