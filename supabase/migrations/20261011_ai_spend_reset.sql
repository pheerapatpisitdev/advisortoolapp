-- Owner's "reset spend" button on /admin/ai (2026-10-08): the month's figure, and the budget guards
-- that read it, count from this moment when it is later than the first of the month.
-- The ledger itself is untouched.
alter table public.ins_ai_settings add column if not exists spend_reset_at timestamptz;
