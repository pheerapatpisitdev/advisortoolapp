-- The people library split by Facebook Page (owner, 2026-09-28): the Page a person is drawn
-- for, as ins_channel_auth.page_id holds it. Null is every Page's, as everyone was before.
alter table ins_people add column if not exists page_id text;
