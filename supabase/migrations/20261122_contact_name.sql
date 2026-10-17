-- ชื่อที่แสดง on the clip's closing card (owner, 2026-10-18, mockup AkgFFA9H72A9Mu2GvS6HNP): the name
-- a customer sees beside the phone and LINE, typed in บัญชีของฉัน. Empty means the account's own
-- display name (or UnitOS's), as before. Additive only: the code before this change never reads it.
alter table ins_agent_contact add column if not exists display_name text not null default '';
