-- รายละเอียดเพิ่มเติม (owner, 2026-10-14, option ข): a short free text the agent adds to their
-- contact, shown under the card in a วิดีโอนำเสนอ's closing scene. At most 2 lines, 80 characters.
-- Additive only: the code before this change never reads it.
alter table ins_agent_contact add column if not exists more text not null default '';
