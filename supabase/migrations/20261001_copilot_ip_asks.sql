-- ถาม AI on the home page: a per-address daily count kept in the database (review, 2026-10-01).
--
-- Somebody not signed in gets three answers, counted in a signed cookie
-- (src/lib/auth/free-asks.ts). A caller that sends no cookie has used none, every time, so the
-- only other stop was an in-memory eight a minute per address — per server instance, and gone
-- on every cold start. This is the count that survives both: so many asks per address per
-- Bangkok day, claimed before the model is asked so a burst of parallel calls counts itself.
--
-- One row per address per day and nothing about what was asked. Rows older than yesterday are
-- deleted by the claim itself, so the table holds two days at most.
create table if not exists public.ins_copilot_asks (
  day  date    not null,
  ip   text    not null check (char_length(ip) <= 64),
  asks integer not null default 0 check (asks >= 0),
  primary key (day, ip)
);
comment on table public.ins_copilot_asks is
  'Home-page assistant asks by people not signed in, per address per Bangkok day (src/lib/chat/web-asks.ts). service_role only.';
alter table public.ins_copilot_asks enable row level security;
revoke all on public.ins_copilot_asks from anon, authenticated;
grant all on public.ins_copilot_asks to service_role;

-- True and counted when the address has asked fewer than p_max times today; false, and not
-- counted, when it has reached p_max. One statement, so two calls at once cannot both take the
-- last one.
create or replace function public.ins_copilot_claim_ask(p_ip text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day  date := (now() at time zone 'Asia/Bangkok')::date;
  v_asks integer;
begin
  if coalesce(p_max, 0) <= 0 then
    return false;
  end if;
  delete from ins_copilot_asks where day < v_day - 1;
  insert into ins_copilot_asks as a (day, ip, asks)
    values (v_day, left(coalesce(nullif(p_ip, ''), 'unknown'), 64), 1)
  on conflict (day, ip) do update set asks = a.asks + 1 where a.asks < p_max
  returning a.asks into v_asks;
  return v_asks is not null;
end;
$$;
revoke all on function public.ins_copilot_claim_ask(text, integer) from public, anon, authenticated;
grant execute on function public.ins_copilot_claim_ask(text, integer) to service_role;
