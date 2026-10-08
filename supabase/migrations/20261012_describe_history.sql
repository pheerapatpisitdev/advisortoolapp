-- History of pictures read into prompts (owner, 2026-10-08): each successful read of
-- /studio/describe is kept for the member who made it — a small thumbnail, the prompt, its
-- Thai summary and its measured colours — latest 200 each, trimmed by the server on every save.
-- The thumbnail lives in a private bucket the server alone reads; nothing here is ever given a
-- public URL (the server hands out signed links of an hour). Additive only.
create table if not exists ins_describe_history (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt text not null check (char_length(prompt) <= 2500),
  summary_th text not null check (char_length(summary_th) <= 300),
  palette jsonb not null default '[]'::jsonb,
  thumb_path text not null
);
create index if not exists ins_describe_history_agent_recent
  on ins_describe_history (agent_id, created_at desc);
alter table ins_describe_history enable row level security;
-- no policies: the service role alone reads and writes it, like every ins_* table

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('describe-thumbs', 'describe-thumbs', false, 102400, array['image/jpeg'])
on conflict (id) do nothing;
