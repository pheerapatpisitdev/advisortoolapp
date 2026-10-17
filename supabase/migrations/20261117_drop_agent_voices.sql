-- เสียงของฉัน (the agent's own cloned voice) out (owner, 2026-10-17; mockup
-- https://claude.ai/artifact/9RRMjVz4VfqqfZN3iCctaB). Prod held one voice still at 'recording',
-- never cloned and with no files, so nothing is lost and nothing waits on ElevenLabs. The empty
-- private bucket agent-voice is removed through the Storage API, which refuses SQL deletes.
drop table if exists public.ins_agent_voices;
drop table if exists public.ins_agent_voice_invites;
