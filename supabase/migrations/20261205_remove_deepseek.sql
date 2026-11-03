-- DeepSeek removed from the system (owner, 2026-11-03, mockup https://claude.ai/artifact/26D99aX8eHpMGF1R53vvBu).
-- The account was never funded (402 Insufficient Balance), so it never ran a job; its key row,
-- two model rows and its entries in the saved lanes go. As with Kimi, the provider check on
-- model_configs keeps 'deepseek' — loosening nothing.

delete from public.model_configs where provider = 'deepseek';
delete from public.ins_api_keys where provider = 'deepseek';
update public.ins_ai_settings s
set lanes = (
  select coalesce(jsonb_object_agg(lane.key, (
    select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
    from jsonb_array_elements(lane.value) with ordinality as x(e, i)
    where e->>'id' not like 'deepseek-%'
  )), '{}'::jsonb)
  from jsonb_each(s.lanes) as lane
)
where s.lanes::text like '%deepseek-%';
