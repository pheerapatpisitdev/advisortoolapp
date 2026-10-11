-- วิดีโอนำเสนอ opened to every agent and paid for (owner, 2026-10-11): two free clips each, then
-- the Studio wallet at cost × the multiplier, held when the clip is asked for and settled when
-- Cloud Run answers. Additive only.
--   paid_by: staff (the owner, free) | free (one of the two) | wallet
--   hold_id / held_satang / multiplier: the wallet hold, while it stands
--   cost_thb: what the clip cost us (voice + render); charged_satang: what the wallet paid
alter table ins_quote_videos
  add column if not exists paid_by text check (paid_by in ('staff', 'free', 'wallet')),
  add column if not exists hold_id uuid,
  add column if not exists held_satang bigint,
  add column if not exists multiplier numeric,
  add column if not exists cost_thb numeric not null default 0,
  add column if not exists charged_satang bigint;
