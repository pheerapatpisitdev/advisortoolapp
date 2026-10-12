-- The owner's fixed prices for the wallet (owner, 2026-10-12): pictures, reading a picture into
-- a prompt and the วิดีโอนำเสนอ clips, in satang, keyed as src/lib/wallet/prices.ts names them.
-- Empty means the defaults written there; the app reads this apart from the other settings, so
-- a deploy that arrives before this column still opens the wallet.
alter table public.ins_ai_settings
  add column if not exists wallet_prices jsonb not null default '{}'::jsonb;
