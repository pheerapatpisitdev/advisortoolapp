-- The Remotion switch on /admin/ai, one row a plan (owner chose 2ก, 2026-10-17, mockup Bz9r68ApXPeuzosx1yC69a):
-- Life Protect keeps remotion_for; the plans after it are here, plan → off / owner / all.
-- iHealthy starts with the owner only, to be opened to everyone from the page.
alter table public.ins_ai_settings add column if not exists remotion_plans jsonb not null default '{"IHEALTHY": "owner"}'::jsonb;
alter table public.ins_ai_settings drop constraint if exists ins_ai_settings_remotion_plans_check;
alter table public.ins_ai_settings add constraint ins_ai_settings_remotion_plans_check check (
  jsonb_typeof(remotion_plans) = 'object'
  and not jsonb_path_exists(remotion_plans, '$.* ? (@ != "off" && @ != "owner" && @ != "all")')
);
