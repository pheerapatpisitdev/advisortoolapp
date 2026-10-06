-- Ads Studio ยิงโพสต์จาก Organic (owner, 2026-10-07; spec docs/superpowers/specs/2026-10-07-ads-studio-from-organic-design.md).
--
-- ins_ad_standing คือแคมเปญประจำบน Meta หนึ่งตัวต่อเพจต่อบัญชีโฆษณา (ทักแชท) ทุกโพสต์ที่ยิงเข้าแคมเปญนี้
-- ไม่สร้างแคมเปญใหม่ทุกรอบเหมือน ins_ad_send ถ้าแคมเปญถูกลบใน Ads Manager ระบบสร้างใหม่แล้วเขียนทับ id
--
-- ins_ad_run คือการยิงโพสต์หนึ่งโพสต์: ชุดโฆษณาหนึ่งชุด (งบต่อวันและวันจบของมันเอง) กับแอดหนึ่งตัว
-- สร้างแบบ ACTIVE ทันที (เจ้าของเลือก 2026-10-07) path บอกว่าบูสต์โพสต์เดิม (boost) ทำแอดใหม่จากร่าง (new)
-- หรือบูสต์ไม่ได้จึงทำแอดใหม่จากโพสต์แทน (fallback) เก็บ id ที่ Meta ให้มาทันทีที่มี กับขั้นล่าสุดที่เสร็จ
-- เพื่อให้ลองใหม่ต่อจากขั้นที่พังแทนที่จะสร้างซ้ำ claimed_at คือกุญแจที่คำขอถือระหว่างรัน (เหมือน ins_ad_send)
-- paused_at ตั้งเมื่อเจ้าของกดหยุด และล้างเมื่อกดเปิดต่อ
--
-- content_id เป็น set null เมื่อโพสต์ถูกลบ: แถวถือ id โฆษณาจริงและประวัติค่าใช้จ่าย ต้องอยู่ต่อ
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_ad_standing (
  page_id text not null,
  act_id text not null,
  meta_campaign_id text not null,
  updated_at timestamptz not null default now(),
  primary key (page_id, act_id)
);

create table if not exists public.ins_ad_run (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_id text not null,
  act_id text not null,
  content_id uuid references public.ins_content(id) on delete set null,
  path text not null check (path in ('boost', 'new', 'fallback')),
  story_id text,
  daily_budget_minor int not null check (daily_budget_minor > 0),
  end_at timestamptz not null,
  meta_campaign_id text not null,
  adset_id text,
  image_hash text,
  creative_id text,
  ad_id text,
  step text not null default 'none' check (step in ('none', 'adset', 'creative', 'ad')),
  error text,
  claimed_at timestamptz,
  paused_at timestamptz,
  created_by uuid
);
create index if not exists ins_ad_run_page on public.ins_ad_run (page_id, created_at desc);
create index if not exists ins_ad_run_content on public.ins_ad_run (content_id);

alter table public.ins_ad_standing enable row level security;
alter table public.ins_ad_run enable row level security;

-- as the wallet tables (20260930_wallet.sql): only the server's service role may touch them
revoke all on public.ins_ad_standing from public, anon, authenticated;
grant all on public.ins_ad_standing to service_role;
revoke all on public.ins_ad_run from public, anon, authenticated;
grant all on public.ins_ad_run to service_role;

comment on table public.ins_ad_standing is
  'แคมเปญทักแชทประจำบน Meta หนึ่งตัวต่อเพจต่อบัญชีโฆษณา ทุกโพสต์ที่ยิงจาก Ads Studio เข้าแคมเปญนี้';
comment on table public.ins_ad_run is
  'การยิงโพสต์หนึ่งโพสต์จาก Ads Studio: ชุดโฆษณาหนึ่งชุดกับแอดหนึ่งตัว (ACTIVE) เก็บ id และขั้นล่าสุดที่เสร็จ เพื่อให้ลองใหม่ต่อจากขั้นที่พัง';
