-- Ads Studio campaigns (owner, 2026-10-04; spec docs/superpowers/specs/2026-10-04-ads-studio-campaigns-design.md).
--
-- Ads move out of Organic Studio into their own room organised by campaign: one insurance
-- product on one Facebook Page, with the angles and tones the owner wants written for it. A
-- campaign here is Studio's own grouping, not Meta's — the Meta campaign is still made per
-- launch (ins_ad_launch).
--
-- campaign_id on ins_content files each ad piece under its campaign. It is set null when a
-- campaign row goes, so a piece is never lost with it (the page offers no delete today).
--
-- The backfill files the ad pieces written before this table existed: one campaign per
-- (Page, product) that has any, then every unfiled piece pointed at the oldest campaign for
-- its pair. Both statements only look at pieces still unfiled and pairs still without a
-- campaign, so running it again — after a piece was written between this migration and the
-- deploy — files the stragglers and makes no second campaign. A piece with no Page has no
-- project to belong to and is left alone. Pieces are grouped by page_id (the project's Page),
-- not fb_page_id (where it was posted).
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_ad_campaign (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_id text not null,
  plan_href text not null,
  name text,
  angles int not null default 2,
  tones int not null default 2,
  theme text,
  hint text,
  agent_id uuid
);

create index if not exists ins_ad_campaign_page on public.ins_ad_campaign (page_id, created_at desc);

alter table public.ins_ad_campaign enable row level security;

-- as the wallet tables (20260930_wallet.sql): only the server's service role may touch it
revoke all on public.ins_ad_campaign from public, anon, authenticated;
grant all on public.ins_ad_campaign to service_role;

comment on table public.ins_ad_campaign is
  'แคมเปญโฆษณาใน Ads Studio: แผนประกันหนึ่งตัวต่อหนึ่งเพจ Facebook พร้อมจำนวนมุมและโทนที่ให้เขียน ชิ้นแอดทุกชิ้นสังกัดแคมเปญหนึ่งตัว';

alter table public.ins_content
  add column if not exists campaign_id uuid references public.ins_ad_campaign(id) on delete set null;

create index if not exists ins_content_campaign on public.ins_content (campaign_id);

-- One campaign per (Page, product) that has unfiled ad pieces and no campaign yet; it belongs
-- to whoever wrote the oldest of them.
insert into public.ins_ad_campaign (page_id, plan_href, agent_id, created_at)
select distinct on (c.page_id, c.plan_href) c.page_id, c.plan_href, c.agent_id, c.created_at
from public.ins_content c
where c.format = 'ad' and c.page_id is not null and c.plan_href is not null and c.campaign_id is null
  and not exists (
    select 1 from public.ins_ad_campaign k where k.page_id = c.page_id and k.plan_href = c.plan_href
  )
order by c.page_id, c.plan_href, c.created_at;

-- File each unfiled piece under the oldest campaign for its Page and product.
update public.ins_content c
set campaign_id = (
  select k.id from public.ins_ad_campaign k
  where k.page_id = c.page_id and k.plan_href = c.plan_href
  order by k.created_at, k.id
  limit 1
)
where c.format = 'ad' and c.page_id is not null and c.campaign_id is null;
