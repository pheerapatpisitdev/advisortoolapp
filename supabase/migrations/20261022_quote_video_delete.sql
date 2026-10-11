-- วิดีโอนำเสนอ: an agent deletes a clip of their own (owner, 2026-10-11). The file goes; the row
-- stays, marked, so a deleted free clip still counts as used and a charge stays on record.
-- Additive only.
alter table ins_quote_videos add column if not exists deleted_at timestamptz;
