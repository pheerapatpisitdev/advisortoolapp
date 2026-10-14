-- Opens of the calculator pages by signed-in people (owner, 2026-10-14), for /admin/stats
-- สถิติการใช้งาน: which tools people use most. Nothing recorded these opens before; counting
-- starts the day this ships. One row per person, page and open; the server skips a repeat of
-- the same page by the same person within ten minutes. Nobody signed in is never recorded.
-- Additive only.
create table if not exists public.ins_tool_opens (
  id bigint generated always as identity primary key,
  -- not a foreign key to agents: a สมาชิกทั่วไป's id is a row of ins_members
  agent_id uuid not null,
  tool text not null check (char_length(tool) <= 64),
  at timestamptz not null default now()
);
create index if not exists ins_tool_opens_at on public.ins_tool_opens (at);
create index if not exists ins_tool_opens_agent on public.ins_tool_opens (agent_id, tool, at desc);
alter table public.ins_tool_opens enable row level security;
revoke all on public.ins_tool_opens from public, anon, authenticated;
grant all on public.ins_tool_opens to service_role;
comment on table public.ins_tool_opens is 'advisortool: a signed-in person opened a calculator page. service_role only.';
