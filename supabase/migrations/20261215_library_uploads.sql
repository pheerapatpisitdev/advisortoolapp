-- คลังแอนิเมชัน phase 3 (spec docs/superpowers/specs/2026-11-14-library-uploads-design.md, "Data"): what members
-- send to the library: a picture part, a style picture, or a request for a new piece. Files live in the private
-- content-media bucket under library/ (paths here). agent_id is not a foreign key: a สมาชิกทั่วไป's id is a row
-- of ins_members, and an approved upload stays in the library after its sender is gone.
-- Additive only. Locked to service_role like every other ins_* table. Applied to production only on the
-- owner's word, before the push.

create table if not exists public.ins_library_uploads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  kind text not null check (kind in ('part', 'style', 'ask')),
  name text not null,
  note text not null default '',
  paths text[] not null default '{}',
  state text not null default 'wait' check (state in ('wait', 'ok', 'no', 'queue', 'closed')),
  reason text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ins_library_uploads_agent_idx on public.ins_library_uploads (agent_id);
create index if not exists ins_library_uploads_state_idx on public.ins_library_uploads (state);
alter table public.ins_library_uploads enable row level security;
revoke all on public.ins_library_uploads from public, anon, authenticated;
grant all on public.ins_library_uploads to service_role;
comment on table public.ins_library_uploads is 'advisortool: a member''s upload to คลังแอนิเมชัน (part, style or ask) and the owner''s verdict. service_role only.';

-- ลบสมาชิกทั่วไป takes the member's uploads that are not approved, and returns their file paths (library) for
-- Storage to clear: the live function as 20261213_whats_new.sql left it, with those lines added.
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
