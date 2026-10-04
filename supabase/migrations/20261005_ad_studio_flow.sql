-- Ads Studio แบบ Monoko (owner, 2026-10-05; spec docs/superpowers/specs/2026-10-04-ads-studio-monoko-flow-design.md).
--
-- แคมเปญหนึ่งตัวเก็บ "มิติ" ที่ AI เสนอและเจ้าของเลือก (ฮุก กลุ่มคน มุม สไตล์ภาพ) เป็น jsonb ก้อนเดียว
-- กับน้ำเสียงแบรนด์ และ queue_pos คือตำแหน่งในคิวผสมมิติ: จำนวนแบบที่สร้างไปแล้ว คิวเดินต่อจากตรงนี้
-- เมื่อสร้างครั้งถัดไป แก้มิติระหว่างทางแล้วแบบเดิมไม่ถูกสร้างซ้ำ
-- แคมเปญเก่าที่ไม่มีมิติ dimensions เป็น null และ queue_pos เป็น 0 ไม่มีแถวไหนถูกแก้
--
-- ins_ad_send คือการส่งหนึ่งรอบ: แคมเปญ Meta หนึ่งตัว ชุดโฆษณาหนึ่งชุด และแอดหนึ่งตัวต่อหนึ่งชิ้น
-- (ins_ad_send_item) ทั้งหมดสร้างแบบ PAUSED เหมือน ins_ad_launch: เก็บ id ที่ Meta ให้มาทันทีที่มี
-- กับขั้นล่าสุดที่เสร็จ เพื่อให้ลองใหม่ต่อจากขั้นที่พังแทนที่จะสร้างแคมเปญซ้ำ
-- activated_at / paused_at ตั้งเมื่อเจ้าของกดเปิดใช้ / หยุดทั้งชุดเท่านั้น ไม่มีอะไรเปิดเองตอนส่ง
-- claimed_at คือกุญแจที่คำขอถือระหว่างรันขั้นตอน (เหมือน ins_ad_launch) ถือเกินเวลาที่กำหนดถือว่าคำขอตายแล้ว
-- superseded ใช้เลิกรอบที่เจ้าของเลือกเริ่มใหม่ ชิ้นในรอบนั้นกลับมาส่งได้อีก
--
-- campaign_id ของรอบส่ง และ piece_id ของ item เป็น set null เมื่อแคมเปญหรือชิ้นถูกลบ: แถวถือ id
-- โฆษณาจริงและประวัติค่าใช้จ่าย ต้องอยู่ต่อจากแคมเปญและชิ้น item ลบตามรอบส่งของมัน (cascade)
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

alter table public.ins_ad_campaign
  add column if not exists dimensions jsonb,
  add column if not exists queue_pos int not null default 0,
  add column if not exists brand_voice text;

comment on column public.ins_ad_campaign.dimensions is
  'มิติของแคมเปญ {hooks, personas, angles, styles} แต่ละอย่างเป็นรายการ {text, note}; null = แคมเปญเก่าที่ยังไม่มีมิติ';
comment on column public.ins_ad_campaign.queue_pos is
  'ตำแหน่งในคิวผสมมิติ: จำนวนแบบที่สร้างไปแล้ว คิวเดินต่อจากตรงนี้';

create table if not exists public.ins_ad_send (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id uuid references public.ins_ad_campaign(id) on delete set null,
  act_id text not null,
  page_id text not null,
  link text not null,
  currency text not null,
  -- minor units of the account's currency (satang for THB), as Meta takes them
  daily_budget_minor int not null,
  meta_campaign_id text,
  adset_id text,
  step text not null default 'none' check (step in ('none', 'campaign', 'adset', 'ads')),
  error text,
  claimed_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  superseded boolean not null default false,
  created_by uuid
);

create index if not exists ins_ad_send_campaign
  on public.ins_ad_send (campaign_id, created_at desc)
  where not superseded;

create table if not exists public.ins_ad_send_item (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.ins_ad_send(id) on delete cascade,
  piece_id uuid references public.ins_content(id) on delete set null,
  image_hash text,
  creative_id text,
  ad_id text,
  error text,
  -- a piece is in a send once; a retry resumes its item instead of making a second ad
  unique (send_id, piece_id)
);

alter table public.ins_ad_send enable row level security;
alter table public.ins_ad_send_item enable row level security;

-- as the wallet tables (20260930_wallet.sql): only the server's service role may touch them
revoke all on public.ins_ad_send from public, anon, authenticated;
grant all on public.ins_ad_send to service_role;
revoke all on public.ins_ad_send_item from public, anon, authenticated;
grant all on public.ins_ad_send_item to service_role;

comment on table public.ins_ad_send is
  'การส่งโฆษณาหนึ่งรอบจาก Ads Studio: แคมเปญ Meta หนึ่งตัว ชุดโฆษณาหนึ่งชุด แอดหนึ่งตัวต่อชิ้น (PAUSED) เก็บ id และขั้นล่าสุดที่เสร็จ เพื่อให้ลองใหม่ต่อจากขั้นที่พัง';
comment on table public.ins_ad_send_item is
  'ชิ้นหนึ่งในรอบส่ง: รูป ครีเอทีฟ และแอดของชิ้นนั้น กับเหตุผลถ้าชิ้นนั้นพัง';
