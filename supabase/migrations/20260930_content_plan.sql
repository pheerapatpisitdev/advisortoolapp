-- A planning calendar for agents with no Page (owner, 2026-09-30): a piece is put on a day and
-- the agent posts it themselves. Nothing here reaches Facebook; the publish_* columns are untouched.
alter table public.ins_content add column if not exists plan_day date;
alter table public.ins_content add column if not exists planned_done_at timestamptz;
create index if not exists ins_content_plan_day on public.ins_content (plan_day) where plan_day is not null;
