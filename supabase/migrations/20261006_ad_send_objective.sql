-- A send goes up as traffic (the button opens a link) or as a lead campaign whose ads open a
-- Page's Instant Form. The objective, the form and the button are kept on the send so a retry
-- rebuilds the same objects. Every existing send was traffic, which the default keeps.
alter table public.ins_ad_send
  add column if not exists objective text not null default 'traffic'
    check (objective in ('traffic', 'leads')),
  add column if not exists lead_form_id text,
  add column if not exists cta text
    check (cta is null or cta in ('GET_QUOTE', 'SIGN_UP', 'LEARN_MORE'));

alter table public.ins_ad_send
  drop constraint if exists ins_ad_send_leads_form;
alter table public.ins_ad_send
  add constraint ins_ad_send_leads_form
    check (objective <> 'leads' or (lead_form_id is not null and cta is not null));

comment on column public.ins_ad_send.objective is
  'วัตถุประสงค์ของรอบส่ง: traffic (ปุ่มพาไปลิงก์) หรือ leads (ปุ่มเปิดฟอร์มลีดของเพจ)';
comment on column public.ins_ad_send.lead_form_id is
  'ไอดีฟอร์มลีด (Instant Form) ของเพจที่แอดในรอบนี้เปิด; null สำหรับแบบทราฟฟิก';
comment on column public.ins_ad_send.cta is
  'ปุ่มบนแอดแบบฟอร์มลีด: GET_QUOTE / SIGN_UP / LEARN_MORE; null สำหรับแบบทราฟฟิก';
