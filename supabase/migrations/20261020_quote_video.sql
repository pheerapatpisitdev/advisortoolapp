-- วิดีโอนำเสนอ (owner, 2026-10-11): a narrated 9:16 clip of a Life Protect quote, made in Studio,
-- and the agent's own contact details its closing scene shows. Spec:
-- docs/superpowers/specs/2026-10-11-quote-video-design.md. Additive only.

-- How customers reach an agent: shown at the end of every clip the agent makes. The name is the
-- agent's display name (UnitOS or ins_members), so only what is not kept anywhere else is here.
-- agent_id is not a foreign key, as ins_fhc_customers: a สมาชิกทั่วไป is a row of ins_members.
create table if not exists ins_agent_contact (
  agent_id uuid primary key,
  phone text not null default '',
  line_id text not null default '',
  photo_path text,
  updated_at timestamptz not null default now()
);
alter table ins_agent_contact enable row level security;

-- One clip: what was quoted, where it is in the making, and the file once Cloud Run made it.
-- status: drawing (voice + pictures on Vercel) → rendering (Cloud Run) → done | failed.
-- job: the render's id, its token's sha256 and the input folder to clear; never the token itself.
create table if not exists ins_quote_videos (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  input jsonb not null,
  customer_name text not null default '',
  status text not null default 'drawing' check (status in ('drawing', 'rendering', 'done', 'failed')),
  job jsonb,
  video_path text,
  duration_sec numeric,
  error text
);
create index if not exists ins_quote_videos_agent_recent on ins_quote_videos (agent_id, created_at desc);
create index if not exists ins_quote_videos_job on ins_quote_videos ((job->>'id'));
alter table ins_quote_videos enable row level security;
-- no policies on either: the service role alone reads and writes them, like every ins_* table

-- Private. quote-video: "<video id>/in_N" job inputs (pictures, lists, the narration), cleared when
-- the render ends, and "<video id>/quote.mp4", kept. agent-contact: "<agent id>/<file id>.jpg".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-video', 'quote-video', false, 209715200,
  array['video/mp4', 'image/png', 'image/jpeg', 'audio/wav', 'text/plain'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-contact', 'agent-contact', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
