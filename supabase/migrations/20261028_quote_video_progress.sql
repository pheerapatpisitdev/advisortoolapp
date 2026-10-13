-- วิดีโอนำเสนอ: how far a clip is while it is being made (owner, 2026-10-13; spec
-- docs/superpowers/specs/2026-10-13-video-story-brief-design.md, round 0). produce writes
-- { step, done, of } as each line is spoken and each scene drawn; the board draws a bar from it.
-- Additive only.
alter table ins_quote_videos add column if not exists progress jsonb;
