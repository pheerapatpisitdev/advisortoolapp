-- ข้อความโพสต์ (owner, 2026-10-15, mockup https://claude.ai/artifact/8B39tj4VDgrd9RsdCC23RL, option ก):
-- the words an agent's AI wrote to go up with a clip — a Page post, or a chat message to the one
-- customer for a named clip or an FHC summary — kept with the clip with how many of its three
-- free writes are used: { text, tone, voice, kind, tries, writtenAt }. Additive only.
alter table ins_quote_videos add column if not exists post_text jsonb;
