-- บัญชีสาธิต (owner chose 1ก 2ข 3ก, 2026-11-11, mockup https://claude.ai/artifact/Fm1t9EjkZfehYE743mqQqg):
-- one shared account, code 012345, for customers to try the system. It lives here, not in UnitOS (1ก); its AI is
-- free to the customer under a daily safety cap the owner sets (2ข, ฿300 to start, LINE at 80% and when full);
-- what it made is wiped every night at 03:00 Bangkok (3ก). Its id is fixed: src/lib/auth/demo.ts DEMO_ID.

create table if not exists public.ins_demo (
  id boolean primary key default true check (id),
  open boolean not null default true,
  daily_cap_satang integer not null default 30000 check (daily_cap_satang between 0 and 10000000),
  -- the Bangkok day the 80% and the full alerts went out, so each goes once a day
  warned_day date,
  full_day date,
  -- closing the account ends every session issued before it
  revoked_at timestamptz,
  wiped_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ins_demo enable row level security;
insert into public.ins_demo (id) values (true) on conflict (id) do nothing;

-- What the demo spent since a moment, summed in the database (a select would stop at 1,000 rows).
create or replace function public.ins_demo_spent(p_agent uuid, p_from timestamptz)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_thb), 0) from public.ins_usage_ledger where agent_id = p_agent::text and created_at >= p_from;
$$;
revoke all on function public.ins_demo_spent(uuid, timestamptz) from public, anon, authenticated;

-- Everything the demo made, gone: its pieces, people, clips, FHC customers, drafts and histories. The money
-- ledger, the audit and the sign-in log stay, so the owner can still see what it cost.
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
  update public.ins_demo set wiped_at = now() where id;
  return out;
end;
$$;
revoke all on function public.ins_demo_wipe() from public, anon, authenticated;

-- 03:00 Bangkok = 20:00 UTC
select cron.schedule('demo-wipe', '0 20 * * *', $cron$ select public.ins_demo_wipe(); $cron$);
