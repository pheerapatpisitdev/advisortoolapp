-- ภาพและโมเดลของแคมเปญ Ads Studio (owner, 2026-10-05): แผงเดียวกับ Organic Studio แต่จำแยกตามแคมเปญ
-- แอดทุกชิ้นในแคมเปญเดียวกันจึงเขียนและวาดแบบเดียวกัน โทนสีโปสเตอร์มีคอลัมน์ theme อยู่แล้ว
--
-- writer / painter เก็บแค่ id จากรายการใน src/lib/content/models.ts (ตรวจที่ server ใน
-- src/lib/ads/picture-picks.ts) null = อัตโนมัติ ไม่มี "none" เพราะแอดที่ไม่มีภาพส่งขึ้น Facebook ไม่ได้
-- person คือ {id, pose} ของคนในคลังบุคคล null = ไม่ใส่ คนที่ถูกลบไปแล้วจะวาดโดยไม่มีคน
-- picture_brief คือบรีฟภาพเพิ่มเติม ต่อท้ายสไตล์ภาพของแต่ละแบบตอนวาด null = ไม่มี
-- แคมเปญเดิมทุกตัวได้ null ทั้งหมด = อัตโนมัติ ไม่มีแถวไหนถูกแก้
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql. Adding columns keeps the table's RLS and grants.

alter table public.ins_ad_campaign
  add column if not exists writer text,
  add column if not exists painter text,
  add column if not exists person jsonb,
  add column if not exists picture_brief text;

alter table public.ins_ad_campaign
  drop constraint if exists ins_ad_campaign_writer_check,
  add constraint ins_ad_campaign_writer_check check (writer is null or writer in ('best', 'balanced', 'cheap')),
  drop constraint if exists ins_ad_campaign_painter_check,
  add constraint ins_ad_campaign_painter_check check (painter is null or painter in ('standard', 'sharp', 'gemini')),
  drop constraint if exists ins_ad_campaign_picture_brief_check,
  add constraint ins_ad_campaign_picture_brief_check check (picture_brief is null or char_length(picture_brief) <= 2500);

comment on column public.ins_ad_campaign.writer is 'โมเดลเขียน: best | balanced | cheap; null = อัตโนมัติ';
comment on column public.ins_ad_campaign.painter is 'ภาพประกอบ: standard | sharp | gemini; null = อัตโนมัติ';
comment on column public.ins_ad_campaign.person is 'คนในภาพ {id, pose} จากคลังบุคคล; null = ไม่ใส่';
comment on column public.ins_ad_campaign.picture_brief is 'บรีฟภาพเพิ่มเติม ต่อท้ายสไตล์ภาพตอนวาด; null = ไม่มี';
