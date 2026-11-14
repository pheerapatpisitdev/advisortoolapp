-- มีอะไรใหม่ (owner chose 1ข 2ก 3ก, 2026-11-14, mockup https://claude.ai/artifact/NW7M5MzvhWiZHymbyU34hs): what
-- changed in the app, told to the agents. Claude writes a draft row on each push (2ก); the Super Admin reads it,
-- edits the words and publishes it on /admin/updates. A published row shows on /whats-new, counts in the menu's
-- red number and in the bar on /home until the viewer has read it (1ข). No LINE message (3ก).
-- agent_id is not a foreign key: a สมาชิกทั่วไป's id is a row of ins_members.
-- Additive only. Locked to service_role like every other ins_* table. Applied to production only on the
-- owner's word, before the push.

create table if not exists public.ins_updates (
  id uuid primary key default gen_random_uuid(),
  -- the day it went live in Bangkok, as the list groups it
  day date not null default (now() at time zone 'Asia/Bangkok')::date,
  kind text not null check (kind in ('new', 'better', 'fix')),
  -- the filter chip it sits under (src/lib/updates/rules.ts GROUPS)
  grp text not null check (grp in ('studio', 'calc', 'plan', 'account', 'other')),
  -- the page or tool named on the line, "Studio · คลิปเล่าเรื่อง"
  place text not null default '',
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 500),
  -- where ลองเลย goes: a path in this app, or null for no button
  link text check (link is null or link ~ '^/[^/]'),
  -- all: everyone signed in; owner: the owner alone (a tool only the owner has)
  audience text not null default 'all' check (audience in ('all', 'owner')),
  -- draft: waiting for the Super Admin; live: shown; skip: not worth telling
  status text not null default 'draft' check (status in ('draft', 'live', 'skip')),
  -- the push the draft was written from, for the Super Admin's eye
  source text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists ins_updates_live on public.ins_updates (status, day desc);
alter table public.ins_updates enable row level security;
revoke all on public.ins_updates from public, anon, authenticated;
grant all on public.ins_updates to service_role;
comment on table public.ins_updates is 'advisortool: มีอะไรใหม่, one row per change told to the agents. service_role only.';

create table if not exists public.ins_update_reads (
  agent_id uuid not null,
  update_id uuid not null references public.ins_updates (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (agent_id, update_id)
);
create index if not exists ins_update_reads_update on public.ins_update_reads (update_id);
alter table public.ins_update_reads enable row level security;
revoke all on public.ins_update_reads from public, anon, authenticated;
grant all on public.ins_update_reads to service_role;
comment on table public.ins_update_reads is 'advisortool: which viewer has read which มีอะไรใหม่ row. service_role only.';

-- ลบสมาชิกทั่วไป takes the member's reads too, and the nightly demo wipe the demo's: both functions as
-- 20261210_library_marks.sql left them, with the one delete added to each.
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
  -- มีอะไรใหม่'s reads (20261213)
  delete from ins_update_reads where agent_id = p_member;

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
  -- มีอะไรใหม่ shows as unread again to the next customer trying the system (20261213)
  delete from public.ins_update_reads where agent_id = demo; get diagnostics n = row_count; out := out || jsonb_build_object('reads', n);
  update public.ins_demo set wiped_at = now() where id;
  return out;
end;
$$;
revoke all on function public.ins_demo_wipe() from public, anon, authenticated;
