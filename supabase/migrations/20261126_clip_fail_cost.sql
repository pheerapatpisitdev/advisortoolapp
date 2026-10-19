-- Remotion move, phase 0 (owner chose ก ก ก ก, 2026-10-19, mockup WiEBsFZauc5iQKzEaWGGdJ): each clip keeps
-- why it failed and what its making cost, part by part, so the old engine and Remotion can be compared.
-- fail_reason: the real reason behind "ทำวิดีโอไม่สำเร็จ" (the agent still sees only `error`), links taken out.
-- cost_parts: { voice, pictures, engine, prepSec, renderSec, renderThb } — renderThb from the run's seconds at
-- Cloud Run's list price, beside the fixed figure cost_thb and the AI ledger still take.
-- Read by the server alone (service role), never sent to an agent. Apply before the code that writes them.
alter table public.ins_quote_videos add column if not exists fail_reason text;
alter table public.ins_quote_videos add column if not exists cost_parts jsonb;
