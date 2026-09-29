-- Staff tied to the Facebook Pages they look after (owner, 2026-09-29): posting staff see and
-- post to these only; the owner and the back office's admins see every Page. Set on /admin/team.
create table if not exists public.ins_staff_pages (
  agent_id   uuid not null references public.ins_staff(agent_id) on delete cascade,
  page_id    text not null,
  created_at timestamptz not null default now(),
  primary key (agent_id, page_id)
);
alter table public.ins_staff_pages enable row level security;
-- no policies: the service role alone reads and writes it, like every ins_* table
