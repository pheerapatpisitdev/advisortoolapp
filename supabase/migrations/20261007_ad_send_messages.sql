-- A send may also go up as a messages campaign: the ad's button opens a Messenger chat with the
-- Page (OUTCOME_ENGAGEMENT, ad set destination MESSENGER, optimised for conversations). It needs
-- no form and no button choice; its link is the Page's m.me address.
alter table public.ins_ad_send
  drop constraint if exists ins_ad_send_objective_check;
alter table public.ins_ad_send
  add constraint ins_ad_send_objective_check
    check (objective in ('traffic', 'leads', 'messages'));

comment on column public.ins_ad_send.objective is
  'วัตถุประสงค์ของรอบส่ง: traffic (ปุ่มพาไปลิงก์), leads (ปุ่มเปิดฟอร์มลีดของเพจ) หรือ messages (ปุ่มเปิดแชท Messenger ของเพจ)';
