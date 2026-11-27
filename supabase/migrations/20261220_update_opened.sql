-- ป้าย New on the menu (owner chose ก ก ก, 2026-11-24): a published มีอะไรใหม่ row marks its page's menu item
-- until the person opens that page. ins_update_reads already says who read which row in the list; this adds
-- whether they also opened the page the row is about. A row written by opening /whats-new keeps opened false,
-- so New stays on the menu until the page itself is opened (or 14 days pass, which the code counts).
-- The member delete and the demo wipe already clear this table by agent_id, so neither function changes.
alter table public.ins_update_reads
  add column if not exists opened boolean not null default false;
comment on column public.ins_update_reads.opened is 'advisortool: the viewer opened the page this row is about (the menu''s New goes).';
