-- A clip's hold lives 30 minutes, every other round's 15 (owner chose 1ก, 2026-10-18, mockup
-- MMwYEyqh6TjKGteZMDn5qU). A วิดีโอนำเสนอ / คลิปเล่าเรื่อง / คลิปตามโจทย์ may draw for 20 minutes
-- and render until 25 (src/lib/quote-video/make.ts, RENDER_TIMEOUT_MS); a hold swept at 15 left a
-- clip finished after that unpaid and its line "กันเงินไว้ระหว่างทำ" for good.
-- Same body as 20261120_member_credit.sql but for the age; the code before this change is unaffected.
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
    where created_at < now() - case when round = 'quote-video' then interval '30 minutes' else interval '15 minutes' end
    returning * loop
    perform ins_wallet_end_hold(h, 0);
    n := n + 1;
  end loop;
  return n;
end;
$$;
