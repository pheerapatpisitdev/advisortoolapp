-- DeepSeek as an AI provider, and ลำดับหลักและสำรอง: the order each kind of work tries its models,
-- picture models and voice services, set on ตั้งค่า AI in four groups (Autobot, เขียน, รูปภาพ, เสียง).
-- Owner, 2026-10-21, mockup v3: https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey
--
-- Additive only. Until a lane is saved the code uses the order it used before, so nothing that
-- runs today changes when this lands.

-- model_configs' provider check is widened again, nothing removed.
alter table public.model_configs drop constraint model_configs_provider_check;
alter table public.model_configs add constraint model_configs_provider_check
  check (provider = any (array['anthropic', 'openai', 'google', 'xai', 'zai', 'typhoon', 'moonshot', 'openrouter', 'deepseek']));

-- Prices from api-docs.deepseek.com/quick_start/pricing, checked 2026-10-21: the peak rate, which is
-- Thai working hours on weekdays. Off-peak is half, so the ledger may read a little high.
insert into public.model_configs (id, provider, kind, model_name, enabled, price) values
  ('deepseek-small', 'deepseek', 'text', 'deepseek-flash', true, '{"inputPerMTokUsd": 0.3, "outputPerMTokUsd": 1.2}'),
  ('deepseek-large', 'deepseek', 'text', 'deepseek-v4-pro', true, '{"inputPerMTokUsd": 1.32, "outputPerMTokUsd": 3.96}')
on conflict (id) do nothing;

-- Each saved lane: {"bot-small": [{"id": "gemini-3.1-flash-lite", "on": true}, …], …}. A lane not
-- in it uses its defaults (src/lib/ai/lanes.ts).
alter table public.ins_ai_settings add column if not exists lanes jsonb not null default '{}'::jsonb;

-- How many times each model did each task since a time: the "30 วัน" column of the lanes card.
-- Summed in the database because a select returns at most 1,000 rows (see 20260922_ins_month_spend).
-- Same rules as ins_month_spend: SECURITY INVOKER, service_role only.
create or replace function public.ins_task_model_counts(p_since timestamptz)
returns table (task text, model text, calls bigint)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select l.task, l.model, count(*) as calls
  from public.ins_usage_ledger l
  where l.created_at >= p_since
  group by l.task, l.model
$$;

revoke execute on function public.ins_task_model_counts(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_task_model_counts(timestamptz) to service_role;
