-- Which Facebook Page each advertisement promotes.
--
-- The nightly sync reads every ad in the connected ad accounts, including the campaigns the
-- owner builds in Meta Ads Manager by hand. Ads Studio is laid out by Page, and the insights
-- Meta returns name the campaign and the account but not the Page, so the sync now asks each
-- new ad's creative which Page it speaks for and writes it here (src/lib/ads/ad-pages.ts).
--
-- null: not looked up yet. '': looked up, and the ad names no Page (deleted, or a creative
-- Meta will not describe) — so it is not asked about again every night.
--
-- The table already has row level security on and is read only by the service role; a new
-- column inherits both, so nothing is granted here.

alter table public.ins_ad_daily
  add column if not exists page_id text;

create index if not exists ins_ad_daily_page_date on public.ins_ad_daily (page_id, date);

comment on column public.ins_ad_daily.page_id is
  'เพจที่โฆษณานี้โปรโมต — null ยังไม่ได้ถาม Meta, ว่าง = ถามแล้วไม่พบเพจ';
