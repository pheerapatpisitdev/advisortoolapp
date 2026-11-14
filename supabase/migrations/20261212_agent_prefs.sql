-- ตั้งค่าส่วนตัว (owner, 2026-11-14, ข ก ก on mockup https://claude.ai/artifact/VKTji2SfSz7cCXiCQKJCf4):
-- each agent's own display choices. First ones: show the monthly and the half-yearly premium on
-- the quotes they make. No row = everything shown, as before the setting. Additive only.
-- agent_id is not a foreign key, as ins_agent_contact: it may be a UnitOS agent, a สมาชิกทั่วไป,
-- a Bluewealth or KingClub agent.
create table if not exists ins_agent_prefs (
  agent_id uuid primary key,
  show_monthly boolean not null default true,
  show_semi boolean not null default true,
  updated_at timestamptz not null default now()
);
-- service_role only, as every per-agent table here
alter table ins_agent_prefs enable row level security;
