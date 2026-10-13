-- Monthly pass for outside members (owner, 2026-10-13): an append-only ledger. The live end
-- date is never stored; it is derived from these rows (src/lib/members/pass.ts), so it cannot
-- drift. A refund adds a 'revoked' row naming the paid row it cancels instead of editing it.
-- Server-only like the wallet tables: RLS on, no policies.
create table if not exists public.ins_member_passes (
  id bigserial primary key,
  member_id uuid not null references public.ins_members(id) on delete cascade,
  kind text not null check (kind in ('trial','paid','granted','revoked')),
  days int not null check (days >= 0),
  -- the paid row a revoked row cancels; unique so one pass is cancelled once
  revokes bigint unique references public.ins_member_passes(id),
  amount_satang int,
  -- idempotency for Stripe webhook retries
  stripe_session_id text unique,
  -- to find the pass again on a refund or dispute
  payment_intent text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists ins_member_passes_member_idx
  on public.ins_member_passes(member_id, created_at);
create index if not exists ins_member_passes_intent_idx
  on public.ins_member_passes(payment_intent);

-- One trial per member, ever: two first visits at once write one trial.
create unique index if not exists ins_member_passes_one_trial
  on public.ins_member_passes(member_id) where kind = 'trial';

alter table public.ins_member_passes enable row level security;

-- Owner's switches and numbers; pass stays off until the owner turns it on.
alter table public.ins_ai_settings
  add column if not exists member_pass_enabled boolean not null default false,
  add column if not exists member_pass_satang int not null default 9900,
  add column if not exists member_trial_days int not null default 3,
  add column if not exists member_pass_rounds int not null default 10;
