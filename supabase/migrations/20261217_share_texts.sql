-- ข้อความส่งให้ลูกค้า (owner, 2026-11-14, ง on mockup https://claude.ai/artifact/6v1b98UZnP7jpCa6AL6opV):
-- a member drafts their own message for a plan, an AI arranges it into a template of named
-- figure slots, and their calculator pages fill it per quote. Additive only.
-- agent_id is not a foreign key, as ins_agent_prefs: it may be a UnitOS agent, a สมาชิกทั่วไป,
-- a Bluewealth or KingClub agent.
create table if not exists ins_agent_share_texts (
  agent_id uuid not null,
  plan text not null,
  draft text not null default '',
  -- the latest arrangement of the draft
  template text not null default '',
  removed jsonb not null default '[]'::jsonb,
  own jsonb not null default '[]'::jsonb,
  -- the arrangement the member saved, which the pages send; null = the standard text
  live_template text,
  updated_at timestamptz not null default now(),
  primary key (agent_id, plan)
);
-- how many times a member asked the AI to arrange on a day (Thai date): the free daily allowance
create table if not exists ins_agent_share_arranges (
  agent_id uuid not null,
  day date not null,
  n integer not null default 0,
  primary key (agent_id, day)
);
-- service_role only, as every per-agent table here
alter table ins_agent_share_texts enable row level security;
alter table ins_agent_share_arranges enable row level security;
