-- Launching a Studio ad on Facebook (owner, 2026-10-04): one row per attempt to put one ad
-- piece into one ad account.
--
-- Facebook wants four things made in order — campaign, ad set, creative, ad — and any of them
-- can fail after the ones before it already exist on Meta. The row keeps each id as it is
-- made and the last step that finished, so a retry resumes at the step that broke instead of
-- creating a second campaign, and the page can say which step failed.
--
-- Everything is created PAUSED; activated_at is set only when the owner presses the separate
-- switch-on button. superseded retires an attempt the owner chose to start over, which frees
-- the (piece, account) pair for a new row.
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_ad_launch (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  piece_id uuid not null references public.ins_content(id),
  act_id text not null,
  page_id text not null,
  link text not null,
  currency text not null,
  -- minor units of the account's currency (satang for THB), as Meta takes them
  daily_budget_minor integer not null,
  headline text,
  primary_text text,
  description text,
  campaign_id text,
  adset_id text,
  image_hash text,
  creative_id text,
  ad_id text,
  step text not null default 'none' check (step in ('none', 'campaign', 'adset', 'creative', 'ad')),
  error text,
  activated_at timestamptz,
  superseded boolean not null default false,
  created_by uuid
);

-- The guard against a double click or two tabs: only one live attempt per piece and account.
create unique index if not exists ins_ad_launch_one_live
  on public.ins_ad_launch (piece_id, act_id)
  where not superseded;

alter table public.ins_ad_launch enable row level security;

comment on table public.ins_ad_launch is
  'การยิงแอด Facebook จาก Studio หนึ่งแถวต่อหนึ่งครั้งที่พยายาม: เก็บ id ของแคมเปญ ชุดโฆษณา ครีเอทีฟ และแอด กับขั้นล่าสุดที่เสร็จ เพื่อให้ลองใหม่ต่อจากขั้นที่พัง';
