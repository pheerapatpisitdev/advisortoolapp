-- The AI-down alert to the owner's LINE (owner chose ก ก, 2026-10-19; mockup
-- https://claude.ai/artifact/GG8y7e4CvaRW5gLn8nBXrx): every provider with a live key is asked one
-- word every 30 minutes, Gemini's voice every two hours; two failures in a row send one message,
-- and its return sends another. This table is each provider's standing between runs.
create table if not exists public.ins_ai_health (
  provider text primary key,
  ok boolean not null default true,
  fails integer not null default 0,
  down_since timestamptz,
  last_checked timestamptz,
  last_error text,
  alerted boolean not null default false
);
alter table public.ins_ai_health enable row level security;
revoke all on public.ins_ai_health from public, anon, authenticated;
grant all on public.ins_ai_health to service_role;

alter table public.ins_ai_settings
  add column if not exists notify_ai_down boolean not null default true;

select cron.schedule('ai-health', '*/30 * * * *', $cron$
  select net.http_post(
    url := 'https://www.advisortool.app/api/ai-health',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select secret from public.ins_cron_secret where name = 'followups')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$cron$);
