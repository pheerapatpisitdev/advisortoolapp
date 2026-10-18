-- Each clip tool charges under its own round so the wallet's history names it (owner, 2026-10-18,
-- mockup 7A3Dvd4cibRSsVHyRs3TB4): quote-video (วิดีโอนำเสนอ), quote-video-story (คลิปเล่าเรื่อง),
-- quote-video-prompt (คลิปตามโจทย์). The hold sweep keeps every one of them 30 minutes, as
-- 20261123_clip_hold_life.sql kept quote-video. Apply before the code that holds the new rounds.
create or replace function public.ins_wallet_sweep_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
  n integer := 0;
begin
  for h in delete from ins_wallet_holds
    where created_at < now() - case when round like 'quote-video%' then interval '30 minutes' else interval '15 minutes' end
    returning * loop
    perform ins_wallet_end_hold(h, 0);
    n := n + 1;
  end loop;
  return n;
end;
$$;
