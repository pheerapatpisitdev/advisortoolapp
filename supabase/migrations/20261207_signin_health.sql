-- การเชื่อมต่อระบบเข้าใช้ (owner chose ก ก ก, 2026-11-03; mockup https://claude.ai/artifact/CM989D3EiZgrFKWHEwAksq):
-- the four ways in (UnitOS code, UnitOS menu, Bluewealth, Google) asked every 30 minutes, two failures in a row
-- send one LINE message to the owner and the return another (src/lib/signin-health). Written after Bluewealth's
-- agents were locked out for 19 hours unseen, 2026-11-02/03.

-- each way in's standing between runs, shaped like ins_ai_health plus how long the ask took
create table if not exists public.ins_signin_health (
  route text primary key,
  ok boolean not null default true,
  fails integer not null default 0,
  down_since timestamptz,
  last_checked timestamptz,
  last_error text,
  alerted boolean not null default false,
  last_ms integer
);
alter table public.ins_signin_health enable row level security;
revoke all on public.ins_signin_health from public, anon, authenticated;
grant all on public.ins_signin_health to service_role;

-- one row per outage the owner was told of; ended_at stays empty while it lasts
create table if not exists public.ins_signin_outages (
  id bigint generated always as identity primary key,
  route text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  error text
);
create index if not exists ins_signin_outages_started on public.ins_signin_outages (started_at desc);
alter table public.ins_signin_outages enable row level security;
revoke all on public.ins_signin_outages from public, anon, authenticated;
grant all on public.ins_signin_outages to service_role;
grant usage, select on sequence public.ins_signin_outages_id_seq to service_role;

-- the LINE OA page's switch for this alert, on unless the owner turns it off
alter table public.ins_ai_settings
  add column if not exists notify_signin_down boolean not null default true;

-- a quarter past and a quarter to, apart from ai-health on the hour and the half
select cron.schedule('signin-health', '15,45 * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/signin-health',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);
