-- Gemma 4 free through OpenRouter, as Studio's ทดลองฟรี writer for everyone (owner, 2026-10-14,
-- option ข, mockup https://claude.ai/artifact/JGLq4PPoks27spZiFeQAnD). Priced 0. The code keeps
-- every "…:free" model out of the fallback chains and the admin tier pickers, so it is reached
-- only when a Studio round picks it by name; switching the row off here turns that off too.

insert into public.model_configs (id, provider, kind, model_name, enabled, price) values
  ('openrouter-gemma-free', 'openrouter', 'text', 'google/gemma-4-31b-it:free', true, '{"inputPerMTokUsd": 0, "outputPerMTokUsd": 0}')
on conflict (id) do nothing;
