-- OpenRouter as the seventh AI provider (owner, 2026-10-14, option ก: the same models we
-- already use, offered through OpenRouter, last in each tier's fallback chain; nothing that
-- runs today changes). Mockup: https://claude.ai/artifact/2F4uC8iSyYXMTwLX77SjHT
--
-- model_configs' provider check is widened again, nothing removed.
-- Prices from openrouter.ai/api/v1/models, checked 2026-10-14; the ~5% credit fee is not in them.

alter table public.model_configs drop constraint model_configs_provider_check;
alter table public.model_configs add constraint model_configs_provider_check
  check (provider = any (array['anthropic', 'openai', 'google', 'xai', 'zai', 'typhoon', 'moonshot', 'openrouter']));

insert into public.model_configs (id, provider, kind, model_name, enabled, price) values
  ('openrouter-small', 'openrouter', 'text', 'google/gemini-3.1-flash-lite', true, '{"inputPerMTokUsd": 0.25, "outputPerMTokUsd": 1.5}'),
  ('openrouter-large', 'openrouter', 'text', 'anthropic/claude-sonnet-5', true, '{"inputPerMTokUsd": 2, "outputPerMTokUsd": 10}')
on conflict (id) do nothing;
