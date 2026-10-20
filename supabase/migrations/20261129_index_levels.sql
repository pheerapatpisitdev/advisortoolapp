-- The Citi Grandmaster RC 5 Index level every Monday, read each morning from Krungthai-AXA's
-- weekly report (owner chose ก, 2026-10-20; mockup https://claude.ai/artifact/7Y9hw3W7n372ejfzjcqFQh).
-- Every week read is kept, so the line under the Global Savings calculator grows past the 14 weeks
-- the report itself carries.
create table if not exists public.ins_index_levels (
  index_code text not null,
  price_date date not null,
  level numeric(12, 4) not null,
  fx numeric(10, 4) not null,
  read_at timestamptz not null default now(),
  primary key (index_code, price_date)
);
alter table public.ins_index_levels enable row level security;
revoke all on public.ins_index_levels from public, anon, authenticated;
grant all on public.ins_index_levels to service_role;

-- How the daily read last went: the report's address that worked, and a failing streak, so the
-- owner's LINE hears once when the read has failed two mornings running and once when it works again.
create table if not exists public.ins_index_feed (
  index_code text primary key,
  report_url text,
  last_ok_at timestamptz,
  last_error text,
  failing_since timestamptz,
  fails integer not null default 0,
  alerted boolean not null default false
);
alter table public.ins_index_feed enable row level security;
revoke all on public.ins_index_feed from public, anon, authenticated;
grant all on public.ins_index_feed to service_role;
