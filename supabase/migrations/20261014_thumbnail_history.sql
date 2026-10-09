-- History of video covers (ภาพปกคลิป, owner 2026-10-09): each cover /studio/thumbnail draws is
-- kept for the owner who made it, with every setting that made it, latest 200, trimmed by the
-- server on each save. The picture lives in a private bucket the server alone reads; nothing here
-- is given a public URL (signed links of an hour). Additive only.
create table if not exists ins_thumbnail_history (
  id uuid primary key default gen_random_uuid(),
  -- not a foreign key to agents, as ins_describe_history: a member's id is a row of ins_members
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  settings jsonb not null,
  model text not null default '',
  cost_thb numeric not null default 0,
  image_path text not null
);
create index if not exists ins_thumbnail_history_agent_recent
  on ins_thumbnail_history (agent_id, created_at desc);
alter table ins_thumbnail_history enable row level security;
-- no policies: the service role alone reads and writes it, like every ins_* table

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnail-images', 'thumbnail-images', false, 8388608, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
