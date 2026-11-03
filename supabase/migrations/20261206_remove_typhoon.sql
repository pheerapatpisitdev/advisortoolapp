-- Typhoon (SCB 10X) removed from the system with DeepSeek (owner, 2026-11-03, mockup v2
-- https://claude.ai/artifact/26D99aX8eHpMGF1R53vvBu). It never answered a job; its key row,
-- its model row and its entries in the saved lanes go. As with Kimi and DeepSeek, the provider
-- check on model_configs keeps 'typhoon' — loosening nothing.

delete from public.model_configs where provider = 'typhoon';
delete from public.ins_api_keys where provider = 'typhoon';
update public.ins_ai_settings s
set lanes = (
  select coalesce(jsonb_object_agg(lane.key, (
    select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
    from jsonb_array_elements(lane.value) with ordinality as x(e, i)
    where e->>'id' not like 'typhoon-%'
  )), '{}'::jsonb)
  from jsonb_each(s.lanes) as lane
)
where s.lanes::text like '%typhoon-%';
