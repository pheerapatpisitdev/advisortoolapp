-- A piece is its Page's from the moment it is written (owner, 2026-09-30): the workbench, the
-- calendar's rail and the front page show one Page's project at a time. page_id is that
-- project; fb_page_id stays where it was actually sent.
alter table public.ins_content add column if not exists page_id text;
-- a piece already on a Page, or held for one, is that Page's
update public.ins_content set page_id = fb_page_id where page_id is null and fb_page_id is not null;
-- the staff's pieces on no Page yet (two หาทีม pieces): LuckyPlanner โชคดีที่มีแพลน's, the owner's call
update public.ins_content set page_id = '105982528649026'
  where page_id is null and agent_id in (select agent_id from public.ins_staff);
create index if not exists ins_content_page_status on public.ins_content (page_id, status, created_at desc);
