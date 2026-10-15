-- เสียงของฉัน (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m): an agent
-- records their own voice in Studio, ElevenLabs clones it, the Super Admin approves it, and the
-- agent's clips are read in it. Additive only.

-- Who may clone during the pilot: the agents the owner invites (5–10 to start).
-- agent_id is not a foreign key, as ins_fhc_customers: a สมาชิกทั่วไป is a row of ins_members.
create table if not exists ins_agent_voice_invites (
  agent_id uuid primary key,
  invited_at timestamptz not null default now(),
  invited_by uuid
);
alter table ins_agent_voice_invites enable row level security;

-- One cloned voice, from the first take to its deletion.
-- status: recording (takes going up) → preview (cloned, the agent listens) → review (waiting
-- for the Super Admin) → active | rejected; deleted when the agent removes it or a newer voice
-- replaces it. eleven_voice_id is cleared once the voice is gone from ElevenLabs.
-- consent_path keeps the take the agent read the consent sentence in, as the record of it,
-- until the voice is deleted; the other takes are removed once the clone is made.
create table if not exists ins_agent_voices (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'recording' check (status in ('recording', 'preview', 'review', 'active', 'rejected', 'deleted')),
  sex text not null check (sex in ('F', 'M')),
  code text not null,
  consent_text text not null,
  consented_at timestamptz not null default now(),
  redo_used int not null default 0,
  -- a re-recording of an active voice, free twice a year
  redo_of uuid,
  eleven_voice_id text,
  consent_path text,
  preview_path text,
  paid_by text check (paid_by in ('staff', 'free', 'wallet', 'redo')),
  charged_satang int not null default 0,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reason text
);
create index if not exists ins_agent_voices_agent_recent on ins_agent_voices (agent_id, created_at desc);
create index if not exists ins_agent_voices_status on ins_agent_voices (status);
alter table ins_agent_voices enable row level security;
-- no policies on either: the service role alone reads and writes them, like every ins_* table

-- Private. "<agent id>/<voice id>/take-N.wav": the takes, 16-bit mono WAV made in the browser;
-- "<agent id>/<voice id>/preview.wav": the clone reading a line, for the agent and the reviewer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-voice', 'agent-voice', false, 4194304, array['audio/wav'])
on conflict (id) do nothing;
