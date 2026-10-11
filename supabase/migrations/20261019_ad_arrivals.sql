-- advisortool: an advert clicked by someone already in a thread, held for their next message
-- (review, 2026-10-11).
--
-- Meta sends a returning customer's Click-to-Messenger tap as a referral event of its own, with
-- no words; the message they type next carries no referral. The bot answered only events with
-- words, so the advert was dropped: the customer got the generic menu instead of the plan they
-- clicked, and the conversation was not counted against the advert. One row per customer, the
-- newest tap; taken (deleted) by the next message, and worth nothing after an hour.

create table if not exists public.ins_ad_arrivals (
  channel   text not null check (channel in ('facebook', 'line')),
  user_hash text not null,
  page_id   text,
  referral  jsonb not null,
  at        timestamptz not null default now(),
  primary key (channel, user_hash)
);
alter table public.ins_ad_arrivals enable row level security;
revoke all on public.ins_ad_arrivals from public, anon, authenticated;
grant all on public.ins_ad_arrivals to service_role;
comment on table public.ins_ad_arrivals is 'advisortool: an advert tapped mid-thread, held for the next message; service_role only.';
