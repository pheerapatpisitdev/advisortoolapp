-- คลังแอนิเมชัน (spec docs/superpowers/specs/2026-11-14-animation-library-menu-design.md, "Saved pieces and
-- votes"): each viewer's saved pieces (save) and their votes for pieces not built yet (want). item is a
-- catalogue id (src/lib/scene-library/catalog.ts); a card's vote count is the number of want rows for it.
-- agent_id is not a foreign key: a สมาชิกทั่วไป's id is a row of ins_members.
-- Additive only. Locked to service_role like every other ins_* table. Applied to production only on the
-- owner's word, before the push.

create table if not exists public.ins_library_marks (
  agent_id uuid not null,
  item text not null,
  kind text not null check (kind in ('save', 'want')),
  created_at timestamptz not null default now(),
  primary key (agent_id, item, kind)
);
alter table public.ins_library_marks enable row level security;
revoke all on public.ins_library_marks from public, anon, authenticated;
grant all on public.ins_library_marks to service_role;
comment on table public.ins_library_marks is 'advisortool: a viewer''s saved piece (save) or vote for an unbuilt piece (want) in คลังแอนิเมชัน. service_role only.';

-- ลบสมาชิกทั่วไป takes the member's marks too: the live function as 20261113_prompt_drafts.sql left it,
-- with the one delete added. Its return (what Storage must clear) is unchanged.
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
  -- คลังแอนิเมชัน's saved pieces and votes (20261210): no files either
  delete from ins_library_marks where agent_id = p_member;

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

-- The nightly demo wipe takes the demo's marks too: the live function as 20261209_demo_account.sql left it,
-- with the one delete added. Its schedule (cron job demo-wipe) is unchanged and not made again here.
create or replace function public.ins_demo_wipe()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  demo constant uuid := '00000000-0000-4000-8000-000000012345';
  n int;
  out jsonb := '{}'::jsonb;
begin
  delete from public.ins_content where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('content', n);
  delete from public.ins_people where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('people', n);
  delete from public.ins_quote_videos where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('clips', n);
  delete from public.ins_fhc_customers where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('fhc', n);
  delete from public.ins_prompt_drafts where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('drafts', n);
  delete from public.ins_describe_history where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('describe', n);
  delete from public.ins_thumbnail_history where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('thumbnails', n);
  delete from public.ins_ai_asks where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('asks', n);
  delete from public.ins_logos where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('logos', n);
  delete from public.ins_agent_contact where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('contact', n);
  delete from public.ins_library_marks where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('marks', n);
  update public.ins_demo set wiped_at = now() where id;
  return out;
end;
$$;
revoke all on function public.ins_demo_wipe() from public, anon, authenticated;
