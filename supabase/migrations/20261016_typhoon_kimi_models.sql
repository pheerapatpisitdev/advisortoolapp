-- Typhoon (SCB 10X) and Kimi (Moonshot) as two more AI providers (owner, 2026-10-10, option ก:
-- offered on /admin/ai and at the end of the fallback chain; nothing that runs today changes).
--
-- model_configs only took the original five providers; the check is widened, nothing removed.
-- Typhoon publishes no price and is free at light use, so it is priced 0.
-- Kimi prices from platform.kimi.ai, cache-miss input, checked 2026-10-10.

alter table public.model_configs drop constraint model_configs_provider_check;
alter table public.model_configs add constraint model_configs_provider_check
  check (provider = any (array['anthropic', 'openai', 'google', 'xai', 'zai', 'typhoon', 'moonshot']));

insert into public.model_configs (id, provider, kind, model_name, enabled, price) values
  ('typhoon-small', 'typhoon', 'text', 'typhoon-v2.5-30b-a3b-instruct', true, '{"inputPerMTokUsd": 0, "outputPerMTokUsd": 0}'),
  ('kimi-small', 'moonshot', 'text', 'kimi-k2.6', true, '{"inputPerMTokUsd": 0.95, "outputPerMTokUsd": 4}'),
  ('kimi-large', 'moonshot', 'text', 'kimi-k3', true, '{"inputPerMTokUsd": 3, "outputPerMTokUsd": 15}')
on conflict (id) do nothing;
