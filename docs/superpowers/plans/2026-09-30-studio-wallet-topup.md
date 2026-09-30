# กระเป๋าเงิน Studio เติมผ่าน Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ตัวแทนทั่วไปเติมเงินบาทเข้ากระเป๋าของตัวเองผ่าน Stripe Checkout (PromptPay + บัตร) และใช้ AI ใน Studio ต่อได้เมื่อโควตาฟรีรายเดือนหมด โดยตัดตาม `ต้นทุนจริง × ตัวคูณ`

**Architecture:**
- **ข้อมูล:** 4 ตาราง `ins_wallet*` และฟังก์ชัน Postgres ที่เปลี่ยนยอดแบบ atomic เก็บเงินเป็นสตางค์
- **`takeRound()`** คืน `RoundPass` บอกว่ารอบนี้ staff / โควตาฟรี / กระเป๋าจ่าย ถ้าเป็นกระเป๋า ระบบจองเงินก่อน
- **`payRound()`** รันรอบภายใน `AsyncLocalStorage` ระหว่างนั้น
  - `record()` ของ AI client บวกต้นทุนจริงทุกการเรียกเข้ามิเตอร์
  - `contentCap()` คืน `Infinity` ให้รอบที่ผู้ใช้จ่ายเอง จึงไม่ถูกเพดานของเจ้าของปิดกั้น
  - จบรอบแล้ว settle หรือ release
- **Stripe:** Checkout แบบ hosted สร้างจาก server action · เติมเงินผ่าน webhook ที่ตรวจลายเซ็นและกันซ้ำด้วย session id

**Tech Stack:** Next.js 15 (App Router, server actions, route handlers), TypeScript, Supabase (service role, plpgsql RPC), `stripe` (Node) 22.6, vitest

**Spec:** `docs/superpowers/specs/2026-09-30-studio-wallet-topup-design.md`

## ต่างจาก spec (ตัดสินตอนเขียนแผน เพื่อให้เข้ากับโค้ดจริง)

- **ต้นทุนของรอบ** วัดด้วยมิเตอร์ใน `record()` ของ `src/lib/ai/client.ts` แทนการรวม `cost_thb` ของชิ้นงาน
  - เหตุผล: `ins_usage_ledger` ไม่มี agent_id และรอบวาดภาพไม่คืนต้นทุน มิเตอร์นับได้ทุกการเรียกจริงของรอบ
- **ข้ามเพดานคอนเทนต์ของเจ้าของ** ทำโดยให้ `contentCap()` คืน `Infinity` เมื่ออยู่ในรอบกระเป๋า แทนการส่งธงผ่าน runner ทั้ง 6 ตัว
- **หน้าแอดมินกระเป๋า** แยกเป็น `/admin/wallet` ไม่ยัดลง `AiClient.tsx` ที่ยาว 316 บรรทัดแล้ว
- **ยอดเงินในเมนู:** ไม่ทำป้ายยอดเงินบนแถบ เพราะ layout ไม่ render ใหม่ตอนเปลี่ยนหน้า ยอดจะค้าง
  - เมนู Studio มีลิงก์ "กระเป๋าเงิน" แทน
  - ยอดคงเหลือและลิงก์ "เติมเงิน" แสดงในบรรทัดใต้ปุ่มสร้างของทุกเครื่องมือ
- **ข้อความปฏิเสธ** เมื่อเงินไม่พอ บอกให้ไปเติมที่เมนู "กระเป๋าเงิน" ส่วนลิงก์กดได้อยู่ในบรรทัดใต้ปุ่ม

## Global Constraints

- เงินเป็น **สตางค์ (integer / `bigint`)** ทุกที่ที่เก็บหรือส่งต่อ · บาทใช้เฉพาะต้นทุน AI (`cost_thb`) และการแสดงผล
- ยอดเติมมีเท่านั้น: `[50, 100, 150, 200, 500]` บาท · ฿50/฿100 ส่ง `excluded_payment_method_types: ["card"]` · ห้ามส่ง `payment_method_types`
- ตัวคูณ ≥ 1 และ ≤ 10 · ค่าเริ่มต้น 2 · `wallet_enabled` ค่าเริ่มต้น `false`
- staff (`viewer.staff !== null`) ไม่มีกระเป๋า ใช้ฟรีเหมือนเดิม
- ยอดคงเหลือห้ามติดลบ · ตัดจริงไม่เกินยอดจอง · hold ค้างเกิน 15 นาทีถูก sweep คืน
- Stripe:
  - แพ็กเกจ `stripe@^22.6.2`
  - `apiVersion: "2026-08-26.dahlia"`
  - สร้าง client เป็น instance เดียว
  - env `STRIPE_SECRET_KEY` (restricted key `rk_…`) และ `STRIPE_WEBHOOK_SECRET`
  - `integration_identifier: "studio-wallet-qmxhrtvb"`
  - ไม่เปิด `automatic_tax`
- เติมเงินเฉพาะใน webhook เมื่อ `payment_status === "paid"` และ `currency === "thb"` · หน้า success แค่อ่านสถานะ
- ข้อความถึงผู้ใช้เป็นภาษาไทย · comment เป็นภาษาอังกฤษร้อยแก้ว บอกเหตุผล และใส่วันที่ที่เจ้าของตัดสินใจ (owner, 2026-09-30) ตามแบบไฟล์เดิม
- migration: `supabase/migrations/20260930_wallet.sql` · Supabase project `cenysylrzbwfrtuqoeqk`
  - **ห้าม apply จนกว่าเจ้าของอนุญาตในแชท**
- คำสั่งตรวจ: `npx vitest run <file>` · `npx tsc --noEmit` · `npx next lint` · `npm run verify`
- commit แบบ Conventional Commits มี scope เช่น `feat(studio): …` เนื้อความเป็นประโยค ลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- ทำงานบน branch `feat/studio-wallet` ในโฟลเดอร์หลัก ไม่ใช้ worktree · ตรวจ branch ก่อน commit ทุกครั้ง

## Review Focus

1. **webhook ส่งซ้ำหรือมาพร้อมกัน** (`completed` + `async_payment_succeeded` ของ session เดียว) → ต้องเติมครั้งเดียว — Task 1 smoke test (credit 2 ครั้ง) + Task 7 (`applyWalletAction` คืน duplicate)
2. **รอบล้มกลางทางหลังจองเงินแล้ว** (AI error, save ล้ม, คืน `{ok:false}` ไม่มีชิ้นงาน) → ผู้ใช้ไม่ถูกตัดเงิน — Task 3 tests "throws → release" และ "nothing delivered → release"
3. **กดสร้างสองแท็บพร้อมกัน ขณะเงินพอแค่รอบเดียว** → รอบที่สองถูกปฏิเสธ ยอดไม่ติดลบ — Task 1 smoke test (hold เกินยอด คืน null) + Task 4 test (hold null → refusal)
4. **ผู้ใช้แก้ `thb` จาก browser เป็นยอดแปลก** (เช่น 1, 49.5, "500") → ปฏิเสธโดยไม่สร้าง session — Task 6 test
5. **session ที่ `client_reference_id` ไม่ตรงกับแถว topups หรือเป็นสกุลเงินอื่น** → ไม่เติม และตอบ 200 (ไม่ให้ Stripe ส่งซ้ำไปเรื่อย ๆ) — Task 7 tests

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `supabase/migrations/20260930_wallet.sql` (ใหม่) | ตาราง, คอลัมน์ settings, ฟังก์ชัน RPC |
| `supabase/tests/wallet_smoke.sql` (ใหม่) | ทดสอบฟังก์ชันใน transaction ที่ rollback |
| `src/lib/wallet/money.ts` (ใหม่, browser-safe) | ยอดเติม, สตางค์, ยอดจองต่อรอบ, คำนวณยอดตัด |
| `src/lib/wallet/note.ts` (ใหม่, browser-safe) | ข้อความใต้ปุ่มสร้าง (`roundsNote`) |
| `src/lib/wallet/store.ts` (ใหม่, server) | ห่อ RPC / ตาราง กระเป๋า |
| `src/lib/wallet/round.ts` (ใหม่, server) | `RoundPass`, มิเตอร์ `AsyncLocalStorage`, `payRound` |
| `src/lib/wallet/checkout.ts` (ใหม่) | สร้างพารามิเตอร์ Checkout Session (pure) |
| `src/lib/wallet/events.ts` (ใหม่) | Stripe event → การกระทำ (pure) + apply |
| `src/lib/stripe/client.ts` (ใหม่, server) | Stripe client instance เดียว |
| `src/lib/auth/quota.ts` (แก้) | `takeRound` คืน `RoundPass` |
| `src/lib/ai/client.ts:113` (แก้) | `record()` เรียก `meterCost` |
| `src/lib/content/store.ts` (แก้) | `contentCap` Infinity ในรอบกระเป๋า · `contentSpentThisMonth` หักยอดที่ผู้ใช้จ่ายเอง |
| `src/app/studio/actions.ts` (แก้) | 5 จุดที่เรียก `takeRound` ใช้ `payRound` · `contentSpend` คืนข้อมูลกระเป๋า |
| `src/app/api/content-claim/route.ts` (แก้) | 2 จุด |
| `src/app/studio/ui/form-parts.tsx` (แก้) | `PressBar` มีลิงก์ "เติมเงิน" |
| `ContentStudio.tsx`, `recruit/RecruitTools.tsx`, `knowledge/KnowledgeTools.tsx`, `draft/DraftTools.tsx`, `claim/ClaimTools.tsx` (แก้) | ใช้ `roundsNote` |
| `src/app/studio/wallet/{page.tsx,actions.ts,WalletClient.tsx}` (ใหม่) | หน้ากระเป๋าของตัวแทน |
| `src/app/api/stripe/webhook/route.ts` (ใหม่) | webhook |
| `src/app/admin/wallet/{page.tsx,actions.ts,WalletAdmin.tsx}` (ใหม่) | หน้าแอดมิน |
| `src/lib/wallet/admin-input.ts` (ใหม่, pure) | อ่านค่าที่กรอกในหน้าแอดมิน |
| `src/lib/shell/menu.ts`, `src/components/shell/Sidebar.tsx` (แก้) | ลิงก์เมนู + ไอคอน `wallet` |
| `.env.example` (แก้) | STRIPE vars |

---

### Task 1: ตารางและฟังก์ชันกระเป๋าเงิน (migration)

**Files:**
- Create: `supabase/migrations/20260930_wallet.sql`
- Create: `supabase/tests/wallet_smoke.sql`

**Interfaces:**
- Produces (RPC ที่ Task 2 เรียก ชื่อและพารามิเตอร์ตรงตามนี้):
  - `ins_wallet_credit_topup(p_session text, p_agent uuid, p_amount bigint) returns text`: คืน `'credited'`, `'duplicate'` หรือ `'unknown'`
  - `ins_wallet_hold(p_agent uuid, p_amount bigint, p_round text) returns uuid`: คืน `null` เมื่อเงินไม่พอ
  - `ins_wallet_settle(p_hold uuid, p_charge bigint, p_cost_thb numeric) returns bigint`: คืนยอดที่ตัดจริง หรือ `null` เมื่อ hold ไม่อยู่แล้ว
  - `ins_wallet_release(p_hold uuid) returns void`
  - `ins_wallet_sweep_holds() returns integer`
  - `ins_wallet_adjust(p_agent uuid, p_amount bigint, p_note text, p_by uuid) returns bigint`: คืนยอดใหม่ หรือ `null` เมื่อจะติดลบ
  - `ins_wallet_charged_thb(p_since timestamptz) returns numeric`
  - `ins_wallet_summary(p_since timestamptz) returns table(agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint)`
  - ตาราง `ins_wallets`, `ins_wallet_entries`, `ins_wallet_holds`, `ins_wallet_topups` · `ins_ai_settings.wallet_enabled`, `ins_ai_settings.wallet_multiplier`

- [ ] **Step 1: เขียน migration**

`supabase/migrations/20260930_wallet.sql`:

```sql
-- Studio wallet (owner, 2026-09-30; spec docs/superpowers/specs/2026-09-30-studio-wallet-topup-design.md).
--
-- An agent past the month's free AI rounds pays for more from a baht wallet they top up through
-- Stripe. Money is kept in satang, whole numbers only. Every change of a balance goes through the
-- functions below, which lock the agent's wallet row first, so two rounds started together — or
-- Stripe telling us twice that one payment went through — cannot spend or credit the same baht twice.

create table if not exists public.ins_wallets (
  agent_id       uuid primary key references public.agents(id) on delete cascade,
  balance_satang bigint not null default 0 check (balance_satang >= 0),
  updated_at     timestamptz not null default now()
);
comment on table public.ins_wallets is 'advisortool: an agent''s Studio wallet, in satang, less what running rounds hold. service_role only.';

create table if not exists public.ins_wallet_entries (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.agents(id) on delete cascade,
  kind              text not null check (kind in ('topup', 'charge', 'adjust')),
  amount_satang     bigint not null,
  cost_thb          numeric,
  round             text,
  stripe_session_id text unique,
  note              text,
  created_by        uuid,
  created_at        timestamptz not null default now()
);
create index if not exists ins_wallet_entries_agent on public.ins_wallet_entries (agent_id, created_at desc);
create index if not exists ins_wallet_entries_charge on public.ins_wallet_entries (created_at) where kind = 'charge';
comment on table public.ins_wallet_entries is 'advisortool: every baht in or out of a wallet; append only. service_role only.';

create table if not exists public.ins_wallet_holds (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  amount_satang bigint not null check (amount_satang > 0),
  round         text not null,
  created_at    timestamptz not null default now()
);
create index if not exists ins_wallet_holds_created on public.ins_wallet_holds (created_at);

create table if not exists public.ins_wallet_topups (
  stripe_session_id text primary key,
  agent_id          uuid not null references public.agents(id) on delete cascade,
  amount_satang     bigint not null check (amount_satang > 0),
  status            text not null default 'open' check (status in ('open', 'paid', 'failed', 'expired')),
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists ins_wallet_topups_agent on public.ins_wallet_topups (agent_id, created_at desc);

alter table public.ins_ai_settings add column if not exists wallet_enabled boolean not null default false;
alter table public.ins_ai_settings add column if not exists wallet_multiplier numeric not null default 2;
alter table public.ins_ai_settings drop constraint if exists ins_ai_settings_wallet_multiplier_range;
alter table public.ins_ai_settings add constraint ins_ai_settings_wallet_multiplier_range check (wallet_multiplier >= 1 and wallet_multiplier <= 10);

alter table public.ins_wallets enable row level security;
alter table public.ins_wallet_entries enable row level security;
alter table public.ins_wallet_holds enable row level security;
alter table public.ins_wallet_topups enable row level security;
revoke all on public.ins_wallets, public.ins_wallet_entries, public.ins_wallet_holds, public.ins_wallet_topups from public, anon, authenticated;
grant all on public.ins_wallets, public.ins_wallet_entries, public.ins_wallet_holds, public.ins_wallet_topups to service_role;

-- Stripe said this session was paid. 'duplicate' when it was credited already (Stripe sends
-- again, and completed + async_payment_succeeded both arrive for one PromptPay payment);
-- 'unknown' when no top-up was opened here for this session and agent.
create or replace function public.ins_wallet_credit_topup(p_session text, p_agent uuid, p_amount bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'top-up amount must be positive'; end if;
  if not exists (select 1 from ins_wallet_topups where stripe_session_id = p_session and agent_id = p_agent) then
    return 'unknown';
  end if;
  insert into ins_wallets (agent_id) values (p_agent) on conflict (agent_id) do nothing;
  perform 1 from ins_wallets where agent_id = p_agent for update;
  if exists (select 1 from ins_wallet_entries where stripe_session_id = p_session) then
    return 'duplicate';
  end if;
  insert into ins_wallet_entries (agent_id, kind, amount_satang, stripe_session_id)
    values (p_agent, 'topup', p_amount, p_session);
  update ins_wallets set balance_satang = balance_satang + p_amount, updated_at = now() where agent_id = p_agent;
  update ins_wallet_topups set status = 'paid', paid_at = now() where stripe_session_id = p_session;
  return 'credited';
end;
$$;

-- Sets money aside for a round about to start. null when the wallet has not got it.
create or replace function public.ins_wallet_hold(p_agent uuid, p_amount bigint, p_round text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_amount <= 0 then raise exception 'hold amount must be positive'; end if;
  update ins_wallets set balance_satang = balance_satang - p_amount, updated_at = now()
    where agent_id = p_agent and balance_satang >= p_amount;
  if not found then return null; end if;
  insert into ins_wallet_holds (agent_id, amount_satang, round) values (p_agent, p_amount, p_round)
    returning id into v_id;
  return v_id;
end;
$$;

-- The round is over: what it cost is charged (never more than was held) and the rest goes
-- back. null when the hold is gone already — swept after a request that died — so nothing is charged.
create or replace function public.ins_wallet_settle(p_hold uuid, p_charge bigint, p_cost_thb numeric)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
  v_charge bigint;
begin
  delete from ins_wallet_holds where id = p_hold returning * into h;
  if not found then return null; end if;
  v_charge := least(h.amount_satang, greatest(0, p_charge));
  update ins_wallets set balance_satang = balance_satang + h.amount_satang - v_charge, updated_at = now()
    where agent_id = h.agent_id;
  if v_charge > 0 or coalesce(p_cost_thb, 0) > 0 then
    insert into ins_wallet_entries (agent_id, kind, amount_satang, cost_thb, round)
      values (h.agent_id, 'charge', -v_charge, p_cost_thb, h.round);
  end if;
  return v_charge;
end;
$$;

create or replace function public.ins_wallet_release(p_hold uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h ins_wallet_holds;
begin
  delete from ins_wallet_holds where id = p_hold returning * into h;
  if not found then return; end if;
  update ins_wallets set balance_satang = balance_satang + h.amount_satang, updated_at = now()
    where agent_id = h.agent_id;
end;
$$;

-- Holds of requests that died before giving them back (a Vercel timeout): returned in full
-- after fifteen minutes, the same lifetime as the content ceiling's reservations.
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
  for h in delete from ins_wallet_holds where created_at < now() - interval '15 minutes' returning * loop
    update ins_wallets set balance_satang = balance_satang + h.amount_satang, updated_at = now()
      where agent_id = h.agent_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- The owner's hand: a refund made in Stripe, a gift, a correction. Always with a reason.
-- null when it would take the balance below zero.
create or replace function public.ins_wallet_adjust(p_agent uuid, p_amount bigint, p_note text, p_by uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 then raise exception 'adjustment must not be zero'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'adjustment needs a reason'; end if;
  insert into ins_wallets (agent_id) values (p_agent) on conflict (agent_id) do nothing;
  update ins_wallets set balance_satang = balance_satang + p_amount, updated_at = now()
    where agent_id = p_agent and balance_satang + p_amount >= 0
    returning balance_satang into v_balance;
  if not found then return null; end if;
  insert into ins_wallet_entries (agent_id, kind, amount_satang, note, created_by)
    values (p_agent, 'adjust', p_amount, btrim(p_note), p_by);
  return v_balance;
end;
$$;

-- What wallet rounds cost the providers since a moment, in baht: taken off the content
-- ceiling's count, since the agents paid for it. Summed here — a select returns at most a
-- thousand rows (see src/lib/ai/ledger.ts).
create or replace function public.ins_wallet_charged_thb(p_since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_thb), 0) from ins_wallet_entries where kind = 'charge' and created_at >= p_since;
$$;

-- One line per wallet for the owner's page.
create or replace function public.ins_wallet_summary(p_since timestamptz)
returns table (agent_id uuid, name text, code text, balance_satang bigint, topped_up_satang bigint, charged_satang bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.agent_id, a.name, a.agent_code, w.balance_satang,
    coalesce(sum(e.amount_satang) filter (where e.kind = 'topup' and e.created_at >= p_since), 0)::bigint,
    coalesce(-sum(e.amount_satang) filter (where e.kind = 'charge' and e.created_at >= p_since), 0)::bigint
  from ins_wallets w
  join agents a on a.id = w.agent_id
  left join ins_wallet_entries e on e.agent_id = w.agent_id
  group by w.agent_id, a.name, a.agent_code, w.balance_satang
  order by w.balance_satang desc;
$$;

revoke all on function public.ins_wallet_credit_topup(text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.ins_wallet_hold(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.ins_wallet_settle(uuid, bigint, numeric) from public, anon, authenticated;
revoke all on function public.ins_wallet_release(uuid) from public, anon, authenticated;
revoke all on function public.ins_wallet_sweep_holds() from public, anon, authenticated;
revoke all on function public.ins_wallet_adjust(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.ins_wallet_charged_thb(timestamptz) from public, anon, authenticated;
revoke all on function public.ins_wallet_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_wallet_credit_topup(text, uuid, bigint) to service_role;
grant execute on function public.ins_wallet_hold(uuid, bigint, text) to service_role;
grant execute on function public.ins_wallet_settle(uuid, bigint, numeric) to service_role;
grant execute on function public.ins_wallet_release(uuid) to service_role;
grant execute on function public.ins_wallet_sweep_holds() to service_role;
grant execute on function public.ins_wallet_adjust(uuid, bigint, text, uuid) to service_role;
grant execute on function public.ins_wallet_charged_thb(timestamptz) to service_role;
grant execute on function public.ins_wallet_summary(timestamptz) to service_role;
```

- [ ] **Step 2: เขียน smoke test**

`supabase/tests/wallet_smoke.sql` เป็นสคริปต์ที่รันใน transaction แล้ว rollback ทุกครั้ง ถ้าผลไม่ตรง จะหยุดด้วย `raise exception`

```sql
-- Run inside one transaction and roll back: nothing it does stays.
--   begin; \i supabase/tests/wallet_smoke.sql  rollback;
-- or paste the do-block into execute_sql wrapped in begin/rollback.
do $$
declare
  a uuid := (select id from agents limit 1);
  h1 uuid; h2 uuid; r text; c bigint; b bigint;
begin
  delete from ins_wallet_entries where agent_id = a;
  delete from ins_wallet_holds where agent_id = a;
  delete from ins_wallets where agent_id = a;

  -- a session nobody opened is not credited
  r := ins_wallet_credit_topup('cs_test_smoke', a, 10000);
  if r <> 'unknown' then raise exception 'expected unknown, got %', r; end if;

  insert into ins_wallet_topups (stripe_session_id, agent_id, amount_satang) values ('cs_test_smoke', a, 10000);
  r := ins_wallet_credit_topup('cs_test_smoke', a, 10000);
  if r <> 'credited' then raise exception 'expected credited, got %', r; end if;
  r := ins_wallet_credit_topup('cs_test_smoke', a, 10000);
  if r <> 'duplicate' then raise exception 'expected duplicate, got %', r; end if;
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 10000 then raise exception 'credited twice: %', b; end if;

  -- two holds of ฿60 against ฿100: the second is refused
  h1 := ins_wallet_hold(a, 6000, 'ai-write');
  h2 := ins_wallet_hold(a, 6000, 'ai-write');
  if h1 is null or h2 is not null then raise exception 'hold race: % %', h1, h2; end if;

  -- a charge past the hold is cut to the hold; the rest of the hold comes back
  c := ins_wallet_settle(h1, 9999, 2.5);
  if c <> 6000 then raise exception 'charge not capped: %', c; end if;
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 4000 then raise exception 'after capped settle: %', b; end if;

  -- a normal settle gives the unspent part back
  h1 := ins_wallet_hold(a, 1000, 'ai-draw');
  c := ins_wallet_settle(h1, 480, 2.4);
  select balance_satang into b from ins_wallets where agent_id = a;
  if c <> 480 or b <> 3520 then raise exception 'settle: % %', c, b; end if;
  -- settling the same hold again charges nothing
  if ins_wallet_settle(h1, 480, 2.4) is not null then raise exception 'settled twice'; end if;

  -- release gives it all back
  h1 := ins_wallet_hold(a, 500, 'ai-draft');
  perform ins_wallet_release(h1);
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 3520 then raise exception 'release: %', b; end if;

  -- a dead hold is swept
  h1 := ins_wallet_hold(a, 500, 'ai-draft');
  update ins_wallet_holds set created_at = now() - interval '16 minutes' where id = h1;
  if ins_wallet_sweep_holds() < 1 then raise exception 'sweep found nothing'; end if;
  select balance_satang into b from ins_wallets where agent_id = a;
  if b <> 3520 then raise exception 'sweep: %', b; end if;

  -- the owner cannot take it below zero
  if ins_wallet_adjust(a, -999999, 'test', a) is not null then raise exception 'adjust went negative'; end if;
  if ins_wallet_adjust(a, 2000, 'ของขวัญ', a) <> 5520 then raise exception 'adjust'; end if;

  if ins_wallet_charged_thb(now() - interval '1 hour') < 4.9 then raise exception 'charged_thb'; end if;
  raise notice 'wallet smoke: all good';
end $$;
```

- [ ] **Step 3: ขออนุญาตเจ้าของก่อน apply**

migration นี้แค่เพิ่มตาราง คอลัมน์ และฟังก์ชัน `wallet_enabled` มีค่าเริ่มต้นเป็น false และยังไม่มีโค้ดตัวไหนอ่านมัน
ให้**ถามเจ้าของในแชทก่อน** ว่า apply ลง project `cenysylrzbwfrtuqoeqk` ได้หรือไม่ แล้วรอจนได้คำว่าได้

- [ ] **Step 4: apply แล้วรัน smoke test**

- ใช้ Supabase MCP `apply_migration` ตั้งชื่อว่า `20260930_wallet` และใช้เนื้อหาไฟล์ของ Step 1
- จากนั้นรัน `execute_sql` ด้วย `begin;` + do-block ของ Step 2 + `rollback;`
- Expected: ไม่มี exception และเห็น notice `wallet smoke: all good`
- ถ้าผลไม่ตรง ให้แก้ migration แล้ว apply ใหม่ (ทุกคำสั่งเขียนเป็น `create or replace` / `if not exists` ไว้แล้ว)

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # ต้องเป็น feat/studio-wallet
git add supabase/migrations/20260930_wallet.sql supabase/tests/wallet_smoke.sql
git commit -m "feat(studio): wallets keep an agent's baht and every change to it goes through one locked function

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: เงิน สตางค์ และ store ของกระเป๋า

**Files:**
- Create: `src/lib/wallet/money.ts`, `src/lib/wallet/store.ts`
- Test: `tests/wallet/money.test.ts`, `tests/wallet/store.test.ts`

**Interfaces:**
- Consumes: RPC จาก Task 1 · `AiRound` จาก `src/lib/auth/quota.ts` (type เท่านั้น)
- Produces:
  - `money.ts`:
    - `TOPUP_THB`, `type TopUpThb`, `isTopUpThb(v: unknown): v is TopUpThb`, `cardAllowed(thb: TopUpThb): boolean`
    - `toSatang(thb: number): number`, `formatBaht(satang: number): string`
    - `DEFAULT_MULTIPLIER = 2`, `ROUND_HOLD_THB: Record<AiRound, number>`
    - `holdSatang(round: AiRound, multiplier: number): number`, `chargeSatang(costThb: number, multiplier: number, heldSatang: number): number`
  - `store.ts`:
    - `walletSettings(): Promise<WalletSettings>` · `WalletSettings = { enabled: boolean; multiplier: number }`
    - `balanceSatang(agentId: string): Promise<number>`
    - `holdWallet(agentId: string, satang: number, round: string): Promise<string | null>`
    - `settleWallet(holdId: string, charge: number, costThb: number): Promise<number | null>`
    - `releaseWallet(holdId: string): Promise<void>`
    - `creditTopUp(sessionId: string, agentId: string, satang: number): Promise<"credited" | "duplicate" | "unknown">`
    - `adjustWallet(agentId: string, satang: number, note: string, by: string): Promise<number | null>`
    - `walletChargedThb(since: Date): Promise<number>`
    - `walletEntries(agentId: string, limit?: number): Promise<WalletEntry[]>`
    - `openTopUp(sessionId: string, agentId: string, satang: number): Promise<void>`
    - `topUpState(sessionId: string, agentId: string): Promise<TopUpStatus | null>` · `TopUpStatus = "open" | "paid" | "failed" | "expired"`
    - `markTopUp(sessionId: string, status: "failed" | "expired"): Promise<void>`
    - `walletSummary(since: Date): Promise<WalletRow[]>` · `WalletRow = { agentId: string; name: string; code: string; balanceSatang: number; toppedUpSatang: number; chargedSatang: number }`
    - `saveWalletSettings(s: WalletSettings): Promise<void>`
    - `walletView(agentId: string): Promise<{ satang: number; multiplier: number } | null>`
    - `WalletEntry = { id: string; kind: "topup" | "charge" | "adjust"; amountSatang: number; round: string | null; note: string | null; createdAt: string }`

- [ ] **Step 1: เขียนเทสต์ money ที่ยังไม่ผ่าน**

`tests/wallet/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cardAllowed, chargeSatang, formatBaht, holdSatang, isTopUpThb, ROUND_HOLD_THB, TOPUP_THB, toSatang,
} from "@/lib/wallet/money";
import { AI_ROUNDS } from "@/lib/auth/quota";

describe("top-up amounts", () => {
  it("are the five the owner chose, and nothing else", () => {
    expect(TOPUP_THB).toEqual([50, 100, 150, 200, 500]);
    for (const v of [50, 100, 150, 200, 500]) expect(isTopUpThb(v)).toBe(true);
    for (const v of [0, 1, 49.5, 51, 1000, "500", null, undefined, NaN]) expect(isTopUpThb(v)).toBe(false);
  });

  it("take a card only from ฿150: a card's fixed fee eats a small top-up", () => {
    expect(cardAllowed(50)).toBe(false);
    expect(cardAllowed(100)).toBe(false);
    expect(cardAllowed(150)).toBe(true);
    expect(cardAllowed(500)).toBe(true);
  });
});

describe("satang", () => {
  it("turns baht into whole satang", () => {
    expect(toSatang(100)).toBe(10000);
    expect(toSatang(0.1 + 0.2)).toBe(30);
  });

  it("shows satang as baht with two places", () => {
    expect(formatBaht(8420)).toBe("฿84.20");
    expect(formatBaht(0)).toBe("฿0.00");
    expect(formatBaht(123456)).toBe("฿1,234.56");
  });
});

describe("what a round holds", () => {
  it("has a hold for every kind of round", () => {
    for (const r of AI_ROUNDS) expect(ROUND_HOLD_THB[r]).toBeGreaterThan(0);
  });

  it("is the round's hold times the multiplier, rounded up to a satang", () => {
    expect(holdSatang("ai-write", 2)).toBe(Math.ceil(ROUND_HOLD_THB["ai-write"] * 2 * 100));
    expect(holdSatang("ai-draw", 1.5)).toBe(Math.ceil(ROUND_HOLD_THB["ai-draw"] * 1.5 * 100));
  });
});

describe("what a round is charged", () => {
  it("is the real cost times the multiplier, rounded up to a satang", () => {
    expect(chargeSatang(2.4, 2, 1000)).toBe(480);
    // 0.0001 baht of a call still costs a satang
    expect(chargeSatang(0.0001, 2, 1000)).toBe(1);
  });

  it("does not round a float's dust up into an extra satang", () => {
    // 1.2 * 2 * 100 is 240.00000000000003 in floating point
    expect(chargeSatang(1.2, 2, 1000)).toBe(240);
  });

  it("is never more than was held", () => {
    expect(chargeSatang(50, 2, 1000)).toBe(1000);
  });

  it("is nothing when nothing was spent, or the figure is not a number", () => {
    expect(chargeSatang(0, 2, 1000)).toBe(0);
    expect(chargeSatang(NaN, 2, 1000)).toBe(0);
    expect(chargeSatang(-1, 2, 1000)).toBe(0);
  });
});
```

- [ ] **Step 2: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/money.test.ts`
Expected: FAIL เพราะหาโมดูล `@/lib/wallet/money` ไม่เจอ

- [ ] **Step 3: เขียน `money.ts`**

`src/lib/wallet/money.ts`:

```ts
import type { AiRound } from "@/lib/auth/quota";

/**
 * The wallet's money rules, browser-safe: the wallet page shows the buttons and the prices
 * from here, and the server checks every request against the same lists.
 */

/** the top-ups on offer (owner, 2026-09-30); the server takes no other amount */
export const TOPUP_THB = [50, 100, 150, 200, 500] as const;
export type TopUpThb = (typeof TOPUP_THB)[number];

export const isTopUpThb = (v: unknown): v is TopUpThb =>
  typeof v === "number" && (TOPUP_THB as readonly number[]).includes(v);

/**
 * A card's fee in Thailand has a fixed part per payment, and on ฿50 that is close to a
 * quarter of it; PromptPay's is a percentage only. So the small top-ups are PromptPay only
 * (owner, 2026-09-30).
 */
export const CARD_FROM_THB = 150;
export const cardAllowed = (thb: TopUpThb): boolean => thb >= CARD_FROM_THB;

export const toSatang = (thb: number): number => Math.round(thb * 100);

export const formatBaht = (satang: number): string =>
  `฿${(satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** what the owner charges over the providers' price until they set otherwise on /admin/wallet */
export const DEFAULT_MULTIPLIER = 2;

/**
 * What a round sets aside before it starts, in baht before the multiplier: the dearest round
 * of its kind, from the prices in src/lib/content/models.ts on 2026-09-30. A written round is
 * at most five pieces (MAX_PIECES) or six ads at Sonnet 5's ฿0.61 and ฿0.03 overhead each, about
 * ฿3.84; หาทีม, ความรู้, เขียนเอง and รีวิวเคลม at most three pieces, about ฿1.92; a picture at most
 * Gemini's ฿2.41 with its translation. What is not spent comes back when the round is over.
 */
export const ROUND_HOLD_THB: Record<AiRound, number> = {
  "ai-write": 5,
  "ai-recruit": 3,
  "ai-knowledge": 3,
  "ai-draft": 3,
  "ai-claim": 3,
  "ai-draw": 3,
};

/** satang, rounded up; toFixed first so floating-point dust is not a satang of its own */
const upToSatang = (baht: number): number => Math.ceil(Number((baht * 100).toFixed(6)));

export const holdSatang = (round: AiRound, multiplier: number): number => upToSatang(ROUND_HOLD_THB[round] * multiplier);

/** what a round is charged: its real cost times the multiplier, never more than it held */
export function chargeSatang(costThb: number, multiplier: number, heldSatang: number): number {
  if (!Number.isFinite(costThb) || costThb <= 0) return 0;
  return Math.min(heldSatang, upToSatang(costThb * multiplier));
}
```

- [ ] **Step 4: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/money.test.ts`
Expected: PASS

- [ ] **Step 5: เขียนเทสต์ store ที่ยังไม่ผ่าน**

`tests/wallet/store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The wallet's database calls: the right function with the right names, and what a failure means. */

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  settings: { data: null as unknown, error: null as unknown },
  wallet: { data: null as unknown, error: null as unknown },
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: db.rpc,
    from: (table: string) => ({
      select: () => ({
        maybeSingle: async () => db.settings,
        eq: () => ({ maybeSingle: async () => db.wallet }),
      }),
    }),
  }),
}));

const store = await import("@/lib/wallet/store");

beforeEach(() => {
  vi.clearAllMocks();
  db.rpc.mockResolvedValue({ data: null, error: null });
  db.settings = { data: null, error: null };
  db.wallet = { data: null, error: null };
});

describe("walletSettings", () => {
  it("is off at ×2 when the owner never set it", async () => {
    expect(await store.walletSettings()).toEqual({ enabled: false, multiplier: 2 });
  });

  it("reads what the owner set", async () => {
    db.settings = { data: { wallet_enabled: true, wallet_multiplier: "1.5" }, error: null };
    expect(await store.walletSettings()).toEqual({ enabled: true, multiplier: 1.5 });
  });

  it("throws when the settings cannot be read, rather than guess", async () => {
    db.settings = { data: null, error: { message: "down" } };
    await expect(store.walletSettings()).rejects.toThrow("down");
  });
});

describe("holding and settling", () => {
  it("holds through ins_wallet_hold and gives back its id, or null when short", async () => {
    db.rpc.mockResolvedValueOnce({ data: "h1", error: null });
    expect(await store.holdWallet("a1", 1000, "ai-write")).toBe("h1");
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_hold", { p_agent: "a1", p_amount: 1000, p_round: "ai-write" });
    db.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await store.holdWallet("a1", 1000, "ai-write")).toBeNull();
  });

  it("settles with the charge and the real cost", async () => {
    db.rpc.mockResolvedValueOnce({ data: 480, error: null });
    expect(await store.settleWallet("h1", 480, 2.4)).toBe(480);
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_settle", { p_hold: "h1", p_charge: 480, p_cost_thb: 2.4 });
  });

  it("throws what the database said", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(store.releaseWallet("h1")).rejects.toThrow("boom");
  });
});

describe("crediting a top-up", () => {
  it("passes Stripe's session, the agent and the amount paid", async () => {
    db.rpc.mockResolvedValueOnce({ data: "credited", error: null });
    expect(await store.creditTopUp("cs_1", "a1", 10000)).toBe("credited");
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_credit_topup", { p_session: "cs_1", p_agent: "a1", p_amount: 10000 });
  });
});

describe("walletChargedThb", () => {
  it("is what agents paid for this month, as a number", async () => {
    db.rpc.mockResolvedValueOnce({ data: "4.25", error: null });
    expect(await store.walletChargedThb(new Date("2026-09-01T00:00:00+07:00"))).toBe(4.25);
  });

  it("is 0 when it cannot be read: the ceiling then counts agents' rounds too, and stops sooner, never later", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "no such function" } });
    expect(await store.walletChargedThb(new Date())).toBe(0);
  });
});

describe("balanceSatang", () => {
  it("sweeps dead holds first, then reads the balance; no wallet is ฿0", async () => {
    expect(await store.balanceSatang("a1")).toBe(0);
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_sweep_holds");
    db.wallet = { data: { balance_satang: "8420" }, error: null };
    expect(await store.balanceSatang("a1")).toBe(8420);
  });
});

describe("walletView", () => {
  it("is null while the owner has the wallet off", async () => {
    expect(await store.walletView("a1")).toBeNull();
  });

  it("is the balance and the multiplier while it is on", async () => {
    db.settings = { data: { wallet_enabled: true, wallet_multiplier: 2 }, error: null };
    db.wallet = { data: { balance_satang: 5000 }, error: null };
    expect(await store.walletView("a1")).toEqual({ satang: 5000, multiplier: 2 });
  });

  it("is null when anything cannot be read: the page then shows the free rounds only", async () => {
    db.settings = { data: null, error: { message: "down" } };
    expect(await store.walletView("a1")).toBeNull();
  });
});
```

- [ ] **Step 6: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/store.test.ts`
Expected: FAIL เพราะหาโมดูล `@/lib/wallet/store` ไม่เจอ

- [ ] **Step 7: เขียน `store.ts`**

`src/lib/wallet/store.ts`:

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_MULTIPLIER } from "./money";

/**
 * The wallet's reads and writes. Every change of a balance is one of the database functions
 * in supabase/migrations/20260930_wallet.sql, which lock the agent's row; nothing here adds or
 * takes money with a read and a write of its own.
 */

export interface WalletSettings { enabled: boolean; multiplier: number }
export type TopUpStatus = "open" | "paid" | "failed" | "expired";
export interface WalletEntry {
  id: string;
  kind: "topup" | "charge" | "adjust";
  amountSatang: number;
  round: string | null;
  note: string | null;
  createdAt: string;
}
export interface WalletRow {
  agentId: string;
  name: string;
  code: string;
  balanceSatang: number;
  toppedUpSatang: number;
  chargedSatang: number;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = args === undefined ? await supabaseAdmin().rpc(fn) : await supabaseAdmin().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function walletSettings(): Promise<WalletSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("wallet_enabled, wallet_multiplier").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่ากระเป๋าเงินไม่ได้: ${error.message}`);
  const m = Number(data?.wallet_multiplier);
  return { enabled: data?.wallet_enabled === true, multiplier: Number.isFinite(m) && m >= 1 ? m : DEFAULT_MULTIPLIER };
}

export async function saveWalletSettings(s: WalletSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, wallet_enabled: s.enabled, wallet_multiplier: s.multiplier, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่ากระเป๋าเงินไม่ได้: ${error.message}`);
}

/** the balance to spend, after holds of requests that died are given back */
export async function balanceSatang(agentId: string): Promise<number> {
  await call("ins_wallet_sweep_holds");
  const { data, error } = await supabaseAdmin().from("ins_wallets").select("balance_satang").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านยอดกระเป๋าไม่ได้: ${error.message}`);
  return Number(data?.balance_satang ?? 0);
}

/** what the round's note shows: null while the owner has the wallet off, or when it cannot be read */
export async function walletView(agentId: string): Promise<{ satang: number; multiplier: number } | null> {
  try {
    const settings = await walletSettings();
    if (!settings.enabled) return null;
    return { satang: await balanceSatang(agentId), multiplier: settings.multiplier };
  } catch (e) {
    console.error("wallet view unreadable:", e);
    return null;
  }
}

export const holdWallet = (agentId: string, satang: number, round: string) =>
  call<string | null>("ins_wallet_hold", { p_agent: agentId, p_amount: satang, p_round: round });

export async function settleWallet(holdId: string, charge: number, costThb: number): Promise<number | null> {
  const charged = await call<number | string | null>("ins_wallet_settle", { p_hold: holdId, p_charge: charge, p_cost_thb: costThb });
  return charged === null ? null : Number(charged);
}

export async function releaseWallet(holdId: string): Promise<void> {
  await call("ins_wallet_release", { p_hold: holdId });
}

export const creditTopUp = (sessionId: string, agentId: string, satang: number) =>
  call<"credited" | "duplicate" | "unknown">("ins_wallet_credit_topup", { p_session: sessionId, p_agent: agentId, p_amount: satang });

export async function adjustWallet(agentId: string, satang: number, note: string, by: string): Promise<number | null> {
  const balance = await call<number | string | null>("ins_wallet_adjust", { p_agent: agentId, p_amount: satang, p_note: note, p_by: by });
  return balance === null ? null : Number(balance);
}

/**
 * What agents' wallet rounds cost the providers since a moment. 0 when it cannot be read: the
 * content ceiling then counts those rounds as the owner's, and so stops sooner — never later.
 */
export async function walletChargedThb(since: Date): Promise<number> {
  try {
    return Number(await call<number | string>("ins_wallet_charged_thb", { p_since: since.toISOString() })) || 0;
  } catch (e) {
    console.error("wallet charges unreadable:", e);
    return 0;
  }
}

export async function walletEntries(agentId: string, limit = 30): Promise<WalletEntry[]> {
  const { data, error } = await supabaseAdmin().from("ins_wallet_entries")
    .select("id, kind, amount_satang, round, note, created_at")
    .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านประวัติกระเป๋าไม่ได้: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: String(r.id), kind: r.kind as WalletEntry["kind"], amountSatang: Number(r.amount_satang),
    round: (r.round as string | null) ?? null, note: (r.note as string | null) ?? null, createdAt: String(r.created_at),
  }));
}

export async function openTopUp(sessionId: string, agentId: string, satang: number): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_wallet_topups").insert({ stripe_session_id: sessionId, agent_id: agentId, amount_satang: satang });
  if (error) throw new Error(`บันทึกรายการเติมเงินไม่ได้: ${error.message}`);
}

/** the asker's own top-up only: another agent's session id reads as not found */
export async function topUpState(sessionId: string, agentId: string): Promise<TopUpStatus | null> {
  const { data, error } = await supabaseAdmin().from("ins_wallet_topups").select("status")
    .eq("stripe_session_id", sessionId).eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านสถานะการเติมเงินไม่ได้: ${error.message}`);
  return (data?.status as TopUpStatus | undefined) ?? null;
}

/** failed or expired, but never over a top-up already paid */
export async function markTopUp(sessionId: string, status: "failed" | "expired"): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_wallet_topups").update({ status })
    .eq("stripe_session_id", sessionId).eq("status", "open");
  if (error) throw new Error(`บันทึกสถานะการเติมเงินไม่ได้: ${error.message}`);
}

export async function walletSummary(since: Date): Promise<WalletRow[]> {
  const rows = await call<Record<string, unknown>[] | null>("ins_wallet_summary", { p_since: since.toISOString() });
  return (rows ?? []).map((r) => ({
    agentId: String(r.agent_id), name: String(r.name ?? ""), code: String(r.code ?? ""),
    balanceSatang: Number(r.balance_satang), toppedUpSatang: Number(r.topped_up_satang), chargedSatang: Number(r.charged_satang),
  }));
}
```

หมายเหตุ: mock ของ `from()` ในเทสต์ครอบคลุมเฉพาะ `select().maybeSingle()` และ `select().eq().maybeSingle()` ซึ่งพอสำหรับเคสที่ทดสอบ ส่วนฟังก์ชันที่ไม่มีเทสต์ใน Step 5 จะตรวจผ่าน `tsc` และ smoke test ใน Task 1

- [ ] **Step 8: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/`
Expected: PASS ทั้งสองไฟล์

- [ ] **Step 9: Commit**

```bash
git branch --show-current
git add src/lib/wallet/money.ts src/lib/wallet/store.ts tests/wallet/money.test.ts tests/wallet/store.test.ts
git commit -m "feat(studio): the wallet's money rules and its database calls, in satang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: มิเตอร์ต้นทุนของรอบ และ `payRound`

**Files:**
- Create: `src/lib/wallet/round.ts`
- Modify: `src/lib/ai/client.ts:113-117` (`record`)
- Modify: `src/lib/content/store.ts` (`contentCap`, `contentSpentThisMonth`)
- Test: `tests/wallet/round.test.ts`
- Modify test: `tests/content/budget-hold.test.ts` (mock `@/lib/wallet/store`)

**Interfaces:**
- Consumes: `settleWallet`, `releaseWallet`, `walletChargedThb` (Task 2) · `chargeSatang` (Task 2)
- Produces:
  - `type RoundPass = { ok: false; refusal: string } | { ok: true; paidBy: "staff" | "free" } | WalletPass`
  - `type WalletPass = { ok: true; paidBy: "wallet"; holdId: string; heldSatang: number; multiplier: number }`
  - `meterCost(thb: number): void`
  - `inWalletRound(): boolean`
  - `payRound<R extends Outcome>(pass: Extract<RoundPass, { ok: true }>, run: () => Promise<R>): Promise<R>` · `Outcome = { ok: boolean; items?: unknown[] }`
  - `delivered(r: Outcome): boolean`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/wallet/round.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A wallet round is charged what its calls really cost, times the owner's multiplier — and
 * nothing when it gave the agent nothing.
 */

const wallet = vi.hoisted(() => ({ settleWallet: vi.fn(), releaseWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { delivered, inWalletRound, meterCost, payRound } = await import("@/lib/wallet/round");

const pass = { ok: true as const, paidBy: "wallet" as const, holdId: "h1", heldSatang: 1000, multiplier: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  wallet.settleWallet.mockResolvedValue(0);
  wallet.releaseWallet.mockResolvedValue(undefined);
});

describe("payRound on a wallet round", () => {
  it("charges the calls' real cost times the multiplier", async () => {
    const r = await payRound(pass, async () => {
      meterCost(0.61);
      meterCost(0.59);
      return { ok: true, items: [1] };
    });
    expect(r).toEqual({ ok: true, items: [1] });
    expect(wallet.settleWallet).toHaveBeenCalledWith("h1", 240, expect.closeTo(1.2, 9));
    expect(wallet.releaseWallet).not.toHaveBeenCalled();
  });

  it("is a wallet round only inside the run", async () => {
    expect(inWalletRound()).toBe(false);
    await payRound(pass, async () => {
      expect(inWalletRound()).toBe(true);
      return { ok: true };
    });
    expect(inWalletRound()).toBe(false);
  });

  it("gives the whole hold back when the round throws, and throws on", async () => {
    await expect(payRound(pass, async () => {
      meterCost(1);
      throw new Error("model down");
    })).rejects.toThrow("model down");
    expect(wallet.releaseWallet).toHaveBeenCalledWith("h1");
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });

  it("gives the whole hold back when the round gave nothing", async () => {
    await payRound(pass, async () => {
      meterCost(1);
      return { ok: false, error: "บันทึกไม่สำเร็จ" };
    });
    expect(wallet.releaseWallet).toHaveBeenCalledWith("h1");
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });

  it("charges a round that stopped part way but saved pieces", async () => {
    await payRound(pass, async () => {
      meterCost(0.5);
      return { ok: false, error: "บันทึกได้ 2 จาก 3 ชิ้น", items: [1, 2] };
    });
    expect(wallet.settleWallet).toHaveBeenCalledWith("h1", 100, 0.5);
  });

  it("still answers when settling fails: the hold is swept back later", async () => {
    wallet.settleWallet.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await payRound(pass, async () => ({ ok: true }))).toEqual({ ok: true });
    err.mockRestore();
  });

  it("keeps two rounds running at once on their own meters", async () => {
    await Promise.all([
      payRound({ ...pass, holdId: "a" }, async () => { meterCost(1); await new Promise((r) => setTimeout(r, 5)); meterCost(1); return { ok: true }; }),
      payRound({ ...pass, holdId: "b" }, async () => { meterCost(0.1); return { ok: true }; }),
    ]);
    expect(wallet.settleWallet).toHaveBeenCalledWith("a", 400, 2);
    expect(wallet.settleWallet).toHaveBeenCalledWith("b", 20, 0.1);
  });
});

describe("payRound on a free or staff round", () => {
  it("just runs it, touching no wallet", async () => {
    expect(await payRound({ ok: true, paidBy: "free" }, async () => {
      expect(inWalletRound()).toBe(false);
      meterCost(5);
      return { ok: true };
    })).toEqual({ ok: true });
    expect(wallet.settleWallet).not.toHaveBeenCalled();
    expect(wallet.releaseWallet).not.toHaveBeenCalled();
  });
});

describe("delivered", () => {
  it("is a round that went through, or saved something before it stopped", () => {
    expect(delivered({ ok: true })).toBe(true);
    expect(delivered({ ok: false, items: [1] })).toBe(true);
    expect(delivered({ ok: false })).toBe(false);
    expect(delivered({ ok: false, items: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/round.test.ts`
Expected: FAIL เพราะหาโมดูล `@/lib/wallet/round` ไม่เจอ

- [ ] **Step 3: เขียน `round.ts`**

`src/lib/wallet/round.ts`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import { chargeSatang } from "./money";
import { releaseWallet, settleWallet } from "./store";

/**
 * Who pays for an AI round, and — when it is the agent's wallet — what the round really cost.
 *
 * The usage ledger says what each call cost but not whose round it was, and a round is many
 * calls (a planner, writers, a proofreader, a picture). So while a wallet round runs it carries
 * a meter in async context: the AI client adds every call's cost to it as it records the call
 * (src/lib/ai/client.ts), and when the round is over the meter is what is charged. Two rounds
 * running at once each have their own.
 */

export type WalletPass = { ok: true; paidBy: "wallet"; holdId: string; heldSatang: number; multiplier: number };
export type RoundPass = { ok: false; refusal: string } | { ok: true; paidBy: "staff" | "free" } | WalletPass;

interface Meter { spentThb: number }
const meters = new AsyncLocalStorage<Meter>();

/** a call's cost, added to the wallet round it belongs to; outside one it is only the owner's */
export function meterCost(thb: number): void {
  const meter = meters.getStore();
  if (meter && Number.isFinite(thb) && thb > 0) meter.spentThb += thb;
}

/** inside a round the agent pays for: the owner's content ceiling does not stand over it */
export const inWalletRound = (): boolean => meters.getStore() !== undefined;

export interface Outcome { ok: boolean; items?: unknown[] }

/** a round gave the agent something: it went through, or it saved pieces before it stopped */
export const delivered = (r: Outcome): boolean => r.ok || (Array.isArray(r.items) && r.items.length > 0);

/**
 * Runs a round and settles who paid. A round that throws, or gives the agent nothing, gives
 * the whole hold back: the providers' cost of a failure is the owner's, not the agent's.
 * A settle that fails is logged and the answer still goes out — the hold is swept back to the
 * agent in fifteen minutes (ins_wallet_sweep_holds), so the error is in the agent's favour.
 */
export async function payRound<R extends Outcome>(pass: Extract<RoundPass, { ok: true }>, run: () => Promise<R>): Promise<R> {
  if (pass.paidBy !== "wallet") return run();
  const meter: Meter = { spentThb: 0 };
  let result: R;
  try {
    result = await meters.run(meter, run);
  } catch (e) {
    await releaseWallet(pass.holdId).catch((err) => console.error("wallet release failed:", err));
    throw e;
  }
  try {
    if (delivered(result)) {
      await settleWallet(pass.holdId, chargeSatang(meter.spentThb, pass.multiplier, pass.heldSatang), meter.spentThb);
    } else {
      await releaseWallet(pass.holdId);
    }
  } catch (e) {
    console.error("wallet settle failed:", e);
  }
  return result;
}
```

- [ ] **Step 4: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/round.test.ts`
Expected: PASS

- [ ] **Step 5: ให้ `record()` ใน AI client บวกต้นทุนเข้ามิเตอร์**

ใน `src/lib/ai/client.ts` เพิ่ม import ที่หัวไฟล์:

```ts
import { meterCost } from "@/lib/wallet/round";
```

แก้ `record` (บรรทัดราว 113) ให้เป็น:

```ts
/** Records what a call cost. Never records the customer's words, only counts and money. */
async function record(model: string, task: string, inTok: number, outTok: number, costThb: number) {
  // a wallet round's meter (src/lib/wallet/round.ts); outside one this does nothing
  meterCost(costThb);
  await supabaseAdmin().from("ins_usage_ledger").insert({
    model, task, input_tokens: inTok, output_tokens: outTok, cost_thb: Number(costThb.toFixed(6)),
  });
}
```

- [ ] **Step 6: ให้เพดานคอนเทนต์ไม่ขวางรอบกระเป๋า และไม่นับยอดที่ผู้ใช้จ่ายเอง — เขียนเทสต์ก่อน**

ใน `tests/content/budget-hold.test.ts` เพิ่ม mock ใต้ `vi.mock("@/lib/supabase/admin", …)`:

```ts
const walletStore = vi.hoisted(() => ({ walletChargedThb: vi.fn(async () => 0) }));
vi.mock("@/lib/wallet/store", () => walletStore);
```

แล้วเพิ่มเทสต์ต่อท้ายไฟล์:

```ts
describe("rounds an agent pays for from the wallet", () => {
  it("are taken off what the content ceiling counts", async () => {
    ledger.monthSpend.mockResolvedValue(spent(10));
    walletStore.walletChargedThb.mockResolvedValueOnce(4);
    expect(await contentSpentThisMonth()).toBe(6);
  });

  it("are not stopped by the owner's ceiling", async () => {
    const { payRound } = await import("@/lib/wallet/round");
    settings.result = { data: { content_budget_thb: 30 }, error: null };
    const cap = await payRound(
      { ok: true, paidBy: "wallet", holdId: "h", heldSatang: 1, multiplier: 2 },
      async () => ({ ok: false, cap: await contentCap() }),
    );
    expect(cap.cap).toBe(Infinity);
    expect(await contentCap()).toBe(30);
  });
});
```

(`payRound` ในเทสต์นี้เรียก `releaseWallet` ของ mock `@/lib/wallet/store` จึงต้องเพิ่ม `releaseWallet: vi.fn(async () => {})` และ `settleWallet: vi.fn(async () => 0)` ลงใน `walletStore` ด้วย)

Run: `npx vitest run tests/content/budget-hold.test.ts`
Expected: FAIL 2 เทสต์ใหม่ (ได้ 10 แทน 6 และได้ 30 แทน Infinity)

- [ ] **Step 7: แก้ `src/lib/content/store.ts`**

เพิ่ม import:

```ts
import { inWalletRound } from "@/lib/wallet/round";
import { walletChargedThb } from "@/lib/wallet/store";
```

แก้ `contentCap`:

```ts
export async function contentCap(): Promise<number> {
  // a round the agent pays for from their wallet is not the owner's money (owner, 2026-09-30):
  // it is bounded by the wallet's hold instead (src/lib/wallet/round.ts)
  if (inWalletRound()) return Infinity;
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("content_budget_thb").maybeSingle();
  // ...บรรทัดที่เหลือเหมือนเดิม
}
```

แก้ `contentSpentThisMonth`:

```ts
/**
 * What content has spent this month, with the money running rounds have set aside — the one
 * reader that counts holds. Dead requests' holds are swept first so they do not count. What
 * agents paid for from their wallets is taken off: the ceiling guards the owner's money.
 */
export async function contentSpentThisMonth(): Promise<number> {
  await sweepHolds();
  const since = monthStart();
  const [spend, paidByAgents] = await Promise.all([monthSpend(since, { holds: true }), walletChargedThb(since)]);
  return Math.max(0, contentBaht(spend.lines) - paidByAgents);
}
```

- [ ] **Step 8: รันแล้วต้องผ่าน รวมเทสต์เดิมทั้งหมดด้วย**

Run: `npx vitest run tests/content/budget-hold.test.ts tests/wallet/ && npx tsc --noEmit`
Expected: PASS และ tsc ไม่มี error

ถ้าเทสต์อื่นใน `tests/content/` ที่ import `@/lib/content/store` แตก เพราะ `@/lib/wallet/store` เรียก supabase จริง ให้เพิ่ม mock แบบเดียวกับ Step 6 ในไฟล์นั้น ตรวจด้วย `npx vitest run tests/content/`

- [ ] **Step 9: Commit**

```bash
git branch --show-current
git add src/lib/wallet/round.ts src/lib/ai/client.ts src/lib/content/store.ts tests/wallet/round.test.ts tests/content/
git commit -m "feat(studio): a wallet round is metered call by call and stands outside the owner's content ceiling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `takeRound` บอกว่าใครจ่าย และทุกรอบจ่ายผ่าน `payRound`

**Files:**
- Modify: `src/lib/auth/quota.ts` (`takeRound`)
- Modify: `src/app/studio/actions.ts` (บรรทัด 191, 293, 310, 325, 681 และการ wrap)
- Modify: `src/app/api/content-claim/route.ts` (บรรทัด 51, 80)
- Test: `tests/auth/quota.test.ts` (เพิ่ม), `tests/wallet/take-round.test.ts` (ใหม่)

**Interfaces:**
- Consumes: `RoundPass`, `payRound` (Task 3) · `walletSettings`, `holdWallet` (Task 2) · `holdSatang`, `formatBaht` (Task 2)
- Produces: `takeRound(viewer: Viewer, round: AiRound, target?: string | null): Promise<RoundPass>` · `walletShort(neededSatang: number): string`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/wallet/take-round.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Who pays for a round: staff nobody, then the free month, then the agent's wallet (owner, 2026-09-30). */

const db = vi.hoisted(() => ({ used: 0, insert: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => table === "ins_ai_settings"
      ? { select: () => ({ maybeSingle: async () => ({ data: { member_ai_month: 20, trial_ai_month: 5 }, error: null }) }) }
      : {
        select: () => ({ eq: () => ({ in: () => ({ gte: async () => ({ count: db.used, error: null }) }) }) }),
        insert: db.insert,
      },
  }),
}));
const wallet = vi.hoisted(() => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { takeRound } = await import("@/lib/auth/quota");
const { holdSatang } = await import("@/lib/wallet/money");

const agent: Viewer = {
  agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.used = 0;
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 2 });
  wallet.holdWallet.mockResolvedValue("h1");
});

describe("takeRound", () => {
  it("lets staff through, counting nothing", async () => {
    expect(await takeRound({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }, "ai-write"))
      .toEqual({ ok: true, paidBy: "staff" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("uses the free month first, and counts the round", async () => {
    db.used = 19;
    expect(await takeRound(agent, "ai-write")).toEqual({ ok: true, paidBy: "free" });
    expect(db.insert).toHaveBeenCalledWith({ agent_id: agent.agentId, action: "ai-write", target: null });
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("holds the round's price in the wallet once the free month is used", async () => {
    db.used = 20;
    const held = holdSatang("ai-draw", 2);
    expect(await takeRound(agent, "ai-draw", "piece-1"))
      .toEqual({ ok: true, paidBy: "wallet", holdId: "h1", heldSatang: held, multiplier: 2 });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, held, "ai-draw");
    expect(db.insert).toHaveBeenCalledWith({ agent_id: agent.agentId, action: "ai-draw", target: "piece-1", detail: { wallet: true } });
  });

  it("refuses and sends the agent to top up when the wallet has not got it", async () => {
    db.used = 20;
    wallet.holdWallet.mockResolvedValueOnce(null);
    const r = await takeRound(agent, "ai-write");
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.refusal).toMatch(/เติมเงิน.*กระเป๋าเงิน/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("says the old words while the owner has the wallet off", async () => {
    db.used = 20;
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2 });
    const r = await takeRound(agent, "ai-write");
    expect(r.ok === false && r.refusal).toMatch(/20 ครั้งต่อเดือน/);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("says the old words when the wallet cannot be read, rather than letting the round through", async () => {
    db.used = 20;
    wallet.walletSettings.mockRejectedValueOnce(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await takeRound(agent, "ai-write");
    err.mockRestore();
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/take-round.test.ts`
Expected: FAIL เพราะ `takeRound` ยังคืน `string | null`

- [ ] **Step 3: แก้ `takeRound` ใน `src/lib/auth/quota.ts`**

เพิ่ม import:

```ts
import { formatBaht, holdSatang } from "@/lib/wallet/money";
import type { RoundPass } from "@/lib/wallet/round";
import { holdWallet, walletSettings } from "@/lib/wallet/store";
```

แทนที่ `takeRound` เดิมทั้งฟังก์ชันด้วย:

```ts
/** the refusal when the free month is used and the wallet has not got this round's price */
export const walletShort = (neededSatang: number): string =>
  `โควตาฟรีเดือนนี้หมดแล้ว — รอบนี้ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(neededSatang)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`;

/**
 * Asks for one round and says who pays for it: nobody for staff, the free month while it
 * lasts, then the agent's wallet (owner, 2026-09-30) — the round's price set aside first, so
 * rounds started together cannot spend the same baht. A round is written down before the
 * model is called either way, so rounds started together count each other.
 */
export async function takeRound(viewer: Viewer, round: AiRound, target: string | null = null): Promise<RoundPass> {
  // staff have no allowance to count against; the content ceiling covers them
  if (viewer.staff) return { ok: true, paidBy: "staff" };
  const db = supabaseAdmin();
  const refusal = overAllowance(await allowanceOf(viewer), viewer.trial);
  if (!refusal) {
    const { error } = await db.from("ins_audit").insert({ agent_id: viewer.agentId, action: round, target });
    if (error) console.error(`round ${round} not counted:`, error.message);
    return { ok: true, paidBy: "free" };
  }
  // an unreadable wallet is a closed one: the round is refused, never let through unpaid
  const settings = await walletSettings().catch((e) => {
    console.error("wallet settings unreadable:", e);
    return null;
  });
  if (!settings?.enabled) return { ok: false, refusal };
  const heldSatang = holdSatang(round, settings.multiplier);
  const holdId = await holdWallet(viewer.agentId, heldSatang, round).catch((e) => {
    console.error("wallet hold failed:", e);
    return null;
  });
  if (!holdId) return { ok: false, refusal: walletShort(heldSatang) };
  const { error } = await db.from("ins_audit").insert({ agent_id: viewer.agentId, action: round, target, detail: { wallet: true } });
  if (error) console.error(`round ${round} not counted:`, error.message);
  return { ok: true, paidBy: "wallet", holdId, heldSatang, multiplier: settings.multiplier };
}
```

- [ ] **Step 4: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/take-round.test.ts tests/auth/quota.test.ts`
Expected: PASS

- [ ] **Step 5: ให้ทุกจุดที่เรียก `takeRound` จ่ายผ่าน `payRound`**

`npx tsc --noEmit` จะชี้ครบทุกจุดที่ต้องแก้ เพราะ type ที่คืนเปลี่ยนแล้ว

ใน `src/app/studio/actions.ts` เพิ่ม import `import { payRound } from "@/lib/wallet/round";`

**generateContent (บรรทัดราว 190–283):** ห่อทุกอย่างตั้งแต่ `const adAngles` จนจบ `finally` ด้วย `payRound` เนื้อในไม่เปลี่ยนแม้แต่บรรทัดเดียว เปลี่ยนแค่การย่อหน้า:

```ts
  // the agent's own monthly allowance, then their wallet (src/lib/auth/quota.ts); staff are outside it
  const pass = await takeRound(viewer, "ai-write");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, async (): Promise<GenerateResult> => {
    const adAngles = Math.min(MAX_ANGLES, Math.max(1, Math.round(Number(input.adAngles) || 2)));
    const adTones = Math.min(MAX_TONES, Math.max(1, Math.round(Number(input.adTones) || 2)));

    let hold: string | null = null;
    try {
      // ... เนื้อเดิมทั้งหมด ไม่เปลี่ยน ...
    } catch (e) {
      // ... เดิม ...
    } finally {
      // the real costs are in the ledger by now, call by call
      if (hold) await releaseContentBudget(hold);
    }
  });
}
```

**generateRecruit / generateKnowledge / generateDraft:**

```ts
  const pass = await takeRound(viewer, "ai-recruit");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, () => writeRecruit(input, project.pageId));
```

ทำแบบเดียวกันกับ `"ai-knowledge"` → `writeKnowledge(input, project.pageId)` และ `"ai-draft"` → `writeDraft(input, project.pageId)`

**drawBackground (บรรทัดราว 681):** ห่อตั้งแต่ `let hold` จนจบ `finally` แบบเดียวกับ generateContent:

```ts
  const pass = await takeRound(viewer, "ai-draw", id);
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, async (): Promise<DrawBackgroundResult> => {
    let hold: string | null = null;
    try {
      // ... เนื้อเดิมทั้งหมด ไม่เปลี่ยน ...
    } catch (e) {
      // ... เดิม ...
    } finally {
      if (hold) await releaseContentBudget(hold);
    }
  });
}
```

ใน `src/app/api/content-claim/route.ts` เพิ่ม `import { payRound } from "@/lib/wallet/round";` แล้วแก้ POST:

```ts
  const pass = await takeRound(await requireMember(), "ai-claim");
  if (!pass.ok) return bad(pass.refusal, 429);
  const pics = await Promise.all(files.map(async (f) => ({ base64: Buffer.from(await f.arrayBuffer()).toString("base64"), mimeType: f.type })));
  return Response.json(await payRound(pass, () => readClaim(pics)));
```

แก้ PUT:

```ts
  const pass = await takeRound(await requireMember(), "ai-claim");
  if (!pass.ok) return bad(pass.refusal, 429);
  const papers = await Promise.all(files.map(async (f, i) => ({ bytes: Buffer.from(await f.arrayBuffer()), mimeType: f.type, ratio: ratios[i] })));
  return Response.json(await payRound(pass, () => writeClaim({
    // ... อาร์กิวเมนต์เดิมทั้งหมด ...
  }, project.pageId)));
```

**ข้อควรระวัง:** เงินที่จองไว้คืนได้ต่อเมื่อรอบเข้าไปถึง `payRound` แล้ว ห้ามมี `return` ระหว่าง `takeRound` กับ `payRound` ใน PUT ของ claim โค้ดอ่านไฟล์ (`Promise.all` สร้าง papers) อยู่ระหว่างสองจุดนั้น ถ้ามัน throw เงินจะค้างอยู่ 15 นาทีจนถูก sweep คืน ซึ่งรับได้ แต่ห้ามเพิ่ม `return` ตรงนั้น

- [ ] **Step 6: ตรวจ type และรันเทสต์ Studio ทั้งหมด**

Run: `npx tsc --noEmit && npx vitest run tests/content/ tests/auth/ tests/wallet/`
Expected: PASS

ถ้าเทสต์ที่ mock `@/lib/auth/quota` ด้วย `takeRound: async () => null` แตก (ค้นด้วย `grep -rn "takeRound" tests`) ให้เปลี่ยน mock เป็น `takeRound: async () => ({ ok: true, paidBy: "staff" })` ส่วนที่ mock ให้ปฏิเสธ ให้คืน `{ ok: false, refusal: "<ข้อความเดิม>" }`

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add src/lib/auth/quota.ts src/app/studio/actions.ts src/app/api/content-claim/route.ts tests/
git commit -m "feat(studio): past the free month an agent's round is paid from their wallet, and given back when it fails

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: บรรทัดใต้ปุ่มสร้างบอกยอดกระเป๋าและลิงก์ "เติมเงิน"

**Files:**
- Create: `src/lib/wallet/note.ts`
- Modify: `src/app/studio/actions.ts` (`contentSpend`, `ContentSpend`)
- Modify: `src/app/studio/ui/form-parts.tsx` (`PressBar`)
- Modify: `src/app/studio/ContentStudio.tsx:1213-1216`, `recruit/RecruitTools.tsx:44,199`, `knowledge/KnowledgeTools.tsx:40,182`, `draft/DraftTools.tsx:38,165`, `claim/ClaimTools.tsx:57,312`
- Test: `tests/wallet/note.test.ts`

**Interfaces:**
- Consumes: `walletView` (Task 2) · `formatBaht` (Task 2)
- Produces: `interface Rounds { used: number; limit: number; wallet?: { satang: number; multiplier: number } | null }` · `roundsNote(rounds: Rounds, estimate: string | number): { text: string; topUp: boolean }` · `PressBar` รับ prop `topUp?: boolean`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`tests/wallet/note.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { roundsNote } from "@/lib/wallet/note";

describe("the note under the make button", () => {
  it("counts the free rounds left while there are some", () => {
    expect(roundsNote({ used: 3, limit: 20, wallet: { satang: 5000, multiplier: 2 } }, "1.20"))
      .toEqual({ text: "ราว ฿1.20 · เดือนนี้สร้างด้วย AI ได้อีก 17 จาก 20 ครั้ง", topUp: false });
  });

  it("says the round comes from the wallet, at the wallet's price, once the free month is used", () => {
    expect(roundsNote({ used: 20, limit: 20, wallet: { satang: 8420, multiplier: 2 } }, "1.20"))
      .toEqual({ text: "ราว ฿2.40 จากกระเป๋า · โควตาฟรีเดือนนี้หมดแล้ว · คงเหลือ ฿84.20", topUp: true });
  });

  it("offers a top-up even at ฿0", () => {
    expect(roundsNote({ used: 20, limit: 20, wallet: { satang: 0, multiplier: 2 } }, 1).topUp).toBe(true);
  });

  it("is the old words when the owner has the wallet off", () => {
    expect(roundsNote({ used: 20, limit: 20, wallet: null }, "1.20"))
      .toEqual({ text: "ราว ฿1.20 · เดือนนี้สร้างด้วย AI ได้อีก 0 จาก 20 ครั้ง", topUp: false });
    expect(roundsNote({ used: 20, limit: 20 }, "1.20").topUp).toBe(false);
  });
});
```

- [ ] **Step 2: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/note.test.ts`
Expected: FAIL เพราะหาโมดูลไม่เจอ

- [ ] **Step 3: เขียน `note.ts`**

`src/lib/wallet/note.ts`:

```ts
import { formatBaht } from "./money";

/**
 * The line under every make button for an agent (not staff): the free rounds left, and once
 * they are used, the price from the wallet and what is in it. Browser-safe.
 */
export interface Rounds {
  used: number;
  limit: number;
  /** null while the owner has the wallet off (src/lib/wallet/store.ts walletView) */
  wallet?: { satang: number; multiplier: number } | null;
}

export function roundsNote(rounds: Rounds, estimate: string | number): { text: string; topUp: boolean } {
  const left = Math.max(0, rounds.limit - rounds.used);
  if (left > 0 || !rounds.wallet) {
    return { text: `ราว ฿${estimate} · เดือนนี้สร้างด้วย AI ได้อีก ${left} จาก ${rounds.limit} ครั้ง`, topUp: false };
  }
  const price = (Number(estimate) * rounds.wallet.multiplier).toFixed(2);
  return {
    text: `ราว ฿${price} จากกระเป๋า · โควตาฟรีเดือนนี้หมดแล้ว · คงเหลือ ${formatBaht(rounds.wallet.satang)}`,
    topUp: true,
  };
}
```

- [ ] **Step 4: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/note.test.ts`
Expected: PASS

- [ ] **Step 5: `contentSpend` ส่งข้อมูลกระเป๋ามาด้วย**

ใน `src/app/studio/actions.ts`:

```ts
import type { Rounds } from "@/lib/wallet/note";
import { walletView } from "@/lib/wallet/store";
```

```ts
export async function contentSpend(): Promise<ContentSpend> {
  const viewer = await requireMember();
  try {
    const [spent, cap, allowance, wallet] = await Promise.all([
      contentSpentThisMonth(), contentCap(), allowanceOf(viewer),
      viewer.staff ? Promise.resolve(null) : walletView(viewer.agentId),
    ]);
    return { spent, cap, rounds: allowance.limit === null ? null : { used: allowance.used, limit: allowance.limit, wallet } };
  } catch {
    return { spent: 0, cap: DEFAULT_CONTENT_CAP_THB, rounds: null };
  }
}

export interface ContentSpend {
  spent: number;
  cap: number;
  /** the agent's own AI rounds this month and their wallet (src/lib/auth/quota.ts); null for staff */
  rounds: Rounds | null;
}
```

- [ ] **Step 6: `PressBar` แสดงลิงก์เติมเงิน**

ใน `src/app/studio/ui/form-parts.tsx` เพิ่ม `topUp` ใน props และบรรทัด note:

```tsx
export function PressBar({ count, max, onCount, unit, label, onPress, disabled, note, warning, topUp }: {
  // ... props เดิม ...
  /** the free month is used and the wallet is on: a way to top it up beside the note */
  topUp?: boolean;
}) {
```

แทนบรรทัด `<p className="mt-2 text-xs text-[var(--ct-mute)]">{note}</p>` ด้วย:

```tsx
      <p className="mt-2 text-xs text-[var(--ct-mute)]">
        {note}
        {topUp && (
          <>
            {" · "}
            <a href="/studio/wallet" className="font-medium text-[var(--ct-ink)] underline underline-offset-2">เติมเงิน</a>
          </>
        )}
      </p>
```

- [ ] **Step 7: ห้าเครื่องมือใช้ `roundsNote`**

ในแต่ละไฟล์ `RecruitTools.tsx`, `KnowledgeTools.tsx`, `DraftTools.tsx`, `ClaimTools.tsx`:
- เปลี่ยน prop type `rounds?: { used: number; limit: number } | null;` เป็น `rounds?: Rounds | null;`
- เพิ่ม `import { roundsNote, type Rounds } from "@/lib/wallet/note";`
- ก่อน `return (` ของ component เพิ่ม `const quota = rounds ? roundsNote(rounds, estimate) : null;`
- แก้ PressBar:

```tsx
        note={blocked ?? (quota ? quota.text : `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`)}
        topUp={!blocked && Boolean(quota?.topUp)}
```

ใน `ContentStudio.tsx` บรรทัดราว 1213:
- เพิ่ม import เดียวกัน
- เพิ่ม `const quota = spend.rounds ? roundsNote(spend.rounds, estimate) : null;` ก่อน JSX ที่ใช้ (ข้าง `estimate`)
- แก้ PressBar:

```tsx
            note={quota
              // an agent's own allowance and wallet are what they can act on; the owner's baht is the owner's
              ? quota.text
              : `ราว ฿${estimate} · สร้างได้อีกราว ${more} ชิ้น · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)} จาก ฿${spend.cap}`}
            topUp={Boolean(quota?.topUp)}
```

ContentStudio ส่ง `rounds={spend.rounds}` ต่อให้เครื่องมืออื่นอยู่แล้ว (บรรทัด 995–1030) ไม่ต้องแก้

- [ ] **Step 8: ตรวจ**

Run: `npx tsc --noEmit && npx vitest run tests/wallet/ tests/content/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git branch --show-current
git add src/lib/wallet/note.ts src/app/studio/ tests/wallet/note.test.ts
git commit -m "feat(studio): once the free month is used the make button says the wallet's price and offers a top-up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Stripe client และการเริ่มเติมเงิน

**Files:**
- Modify: `package.json` (ติดตั้ง `stripe`) · `.env.example`
- Create: `src/lib/stripe/client.ts`, `src/lib/wallet/checkout.ts`, `src/app/studio/wallet/actions.ts`
- Test: `tests/wallet/checkout.test.ts`, `tests/wallet/topup-actions.test.ts`

**Interfaces:**
- Consumes: `isTopUpThb`, `toSatang`, `cardAllowed` (Task 2) · `walletSettings`, `openTopUp`, `topUpState`, `balanceSatang` (Task 2) · `siteOrigin()` จาก `src/lib/site-url.ts`
- Produces:
  - `stripe(): Stripe` · `STRIPE_API_VERSION`
  - `CHECKOUT_TAG = "studio-wallet-qmxhrtvb"`
  - `checkoutParams(a: { agentId: string; thb: TopUpThb; origin: string }): Stripe.Checkout.SessionCreateParams`
  - `startTopUp(thb: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }>`
  - `topUpStatus(sessionId: string): Promise<{ status: TopUpStatus | null; balanceSatang: number }>`

- [ ] **Step 1: ติดตั้ง stripe**

Run: `npm install stripe@^22.6.2`
Expected: `package.json` มี `"stripe": "^22.6.2"` ใน dependencies

เพิ่มท้าย `.env.example`:

```
# Stripe — the Studio wallet's top-ups (docs/superpowers/specs/2026-09-30-studio-wallet-topup-design.md).
# A restricted key (rk_…) with Checkout Sessions: write only. rk_test_ from a sandbox until launch.
STRIPE_SECRET_KEY=
# from `stripe listen` locally, from the Dashboard's webhook endpoint in production
STRIPE_WEBHOOK_SECRET=
```

- [ ] **Step 2: เขียนเทสต์ checkoutParams ที่ยังไม่ผ่าน**

`tests/wallet/checkout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHECKOUT_TAG, checkoutParams } from "@/lib/wallet/checkout";

const base = { agentId: "00000000-0000-4000-8000-000000000002", origin: "https://www.advisortool.app" };

describe("the Checkout Session for a top-up", () => {
  it("charges the amount in satang, in baht, once", () => {
    const p = checkoutParams({ ...base, thb: 150 });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([{ quantity: 1, price_data: { currency: "thb", unit_amount: 15000, product_data: { name: "เติมเงิน Studio ฿150" } } }]);
  });

  it("says whose wallet it is, and comes back to the wallet page", () => {
    const p = checkoutParams({ ...base, thb: 100 });
    expect(p.client_reference_id).toBe(base.agentId);
    expect(p.metadata).toEqual({ agent_id: base.agentId, amount_satang: "10000" });
    expect(p.success_url).toBe("https://www.advisortool.app/studio/wallet?paid={CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://www.advisortool.app/studio/wallet");
  });

  it("never names the payment methods, and leaves cards out below ฿150", () => {
    for (const thb of [50, 100, 150, 200, 500] as const) {
      const p = checkoutParams({ ...base, thb }) as Record<string, unknown>;
      expect(p.payment_method_types).toBeUndefined();
      expect(p.excluded_payment_method_types).toEqual(thb < 150 ? ["card"] : undefined);
    }
  });

  it("is tagged as this checkout, and asks Stripe for no tax", () => {
    const p = checkoutParams({ ...base, thb: 50 }) as Record<string, unknown>;
    expect(p.integration_identifier).toBe(CHECKOUT_TAG);
    expect(CHECKOUT_TAG).toMatch(/^studio-wallet-[a-z]{8}$/);
    expect(p.automatic_tax).toBeUndefined();
  });
});
```

- [ ] **Step 3: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/checkout.test.ts`
Expected: FAIL เพราะหาโมดูลไม่เจอ

- [ ] **Step 4: เขียน `stripe/client.ts` และ `checkout.ts`**

`src/lib/stripe/client.ts`:

```ts
import Stripe from "stripe";

/**
 * The one Stripe client, made on first use so a build without the key still builds. The API
 * version is fixed here: a Stripe upgrade is a change we make, not one that happens to us.
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key, { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });
  return client;
}
```

`src/lib/wallet/checkout.ts`:

```ts
import type Stripe from "stripe";
import { cardAllowed, toSatang, type TopUpThb } from "./money";

/** this checkout's label in the Stripe Dashboard, to tell its sessions from any other flow's */
export const CHECKOUT_TAG = "studio-wallet-qmxhrtvb";

/**
 * The Checkout Session for one top-up. The price is written inline — no Product to keep in the
 * Dashboard — and the payment methods are not named: PromptPay and cards are switched on in
 * the Dashboard, and a card is left out below ฿150, where its fixed fee eats the top-up.
 */
export function checkoutParams(a: { agentId: string; thb: TopUpThb; origin: string }): Stripe.Checkout.SessionCreateParams {
  const satang = toSatang(a.thb);
  const params: Stripe.Checkout.SessionCreateParams & { integration_identifier: string } = {
    mode: "payment",
    client_reference_id: a.agentId,
    line_items: [{ quantity: 1, price_data: { currency: "thb", unit_amount: satang, product_data: { name: `เติมเงิน Studio ฿${a.thb}` } } }],
    metadata: { agent_id: a.agentId, amount_satang: String(satang) },
    success_url: `${a.origin}/studio/wallet?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${a.origin}/studio/wallet`,
    integration_identifier: CHECKOUT_TAG,
  };
  if (!cardAllowed(a.thb)) params.excluded_payment_method_types = ["card"];
  return params;
}
```

ถ้า `tsc` บอกว่า `excluded_payment_method_types` ไม่มีใน type ของ stripe-node รุ่นนี้ ให้ตรวจชื่อพารามิเตอร์ใน API reference ของ Checkout Session ผ่าน skill `stripe:stripe-docs` ก่อน ห้ามเปลี่ยนไปใช้ `payment_method_types`

- [ ] **Step 5: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/checkout.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: เขียนเทสต์ action ที่ยังไม่ผ่าน**

`tests/wallet/topup-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Starting a top-up: only the five amounts, only an agent, only while the owner has it on. */

const AGENT: Viewer = {
  agentId: "00000000-0000-4000-8000-000000000002", code: "2", name: "ตัวแทน", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: true, staff: null,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
const wallet = vi.hoisted(() => ({
  walletSettings: vi.fn(), openTopUp: vi.fn(), topUpState: vi.fn(), balanceSatang: vi.fn(),
}));
vi.mock("@/lib/wallet/store", () => wallet);
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/client", () => ({ stripe: () => ({ checkout: { sessions: { create } } }) }));
vi.mock("@/lib/site-url", () => ({ siteOrigin: () => "https://x.test" }));

const { startTopUp, topUpStatus } = await import("@/app/studio/wallet/actions");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = AGENT;
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 2 });
  wallet.openTopUp.mockResolvedValue(undefined);
  create.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" });
});

describe("startTopUp", () => {
  it("opens a Checkout Session and remembers it for the agent", async () => {
    expect(await startTopUp(100)).toEqual({ ok: true, url: "https://checkout.stripe.com/c/cs_test_1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: AGENT.agentId, success_url: "https://x.test/studio/wallet?paid={CHECKOUT_SESSION_ID}" }));
    expect(wallet.openTopUp).toHaveBeenCalledWith("cs_test_1", AGENT.agentId, 10000);
  });

  it("refuses any amount but the five, and asks Stripe nothing", async () => {
    for (const v of [1, 49.5, 1000, "500", null]) expect(await startTopUp(v)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses while the owner has the wallet off", async () => {
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2 });
    expect(await startTopUp(100)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses staff, who write without a wallet", async () => {
    who.viewer = { ...AGENT, staff: { owner: false, publish: true, connect: false, admin: false } };
    expect(await startTopUp(100)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("says so in Thai when Stripe refuses", async () => {
    create.mockRejectedValueOnce(new Error("No valid payment method types"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await startTopUp(50)).toEqual({ ok: false, error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
    err.mockRestore();
  });
});

describe("topUpStatus", () => {
  it("reads the asker's own top-up and their balance", async () => {
    wallet.topUpState.mockResolvedValueOnce("paid");
    wallet.balanceSatang.mockResolvedValueOnce(10000);
    expect(await topUpStatus("cs_test_1")).toEqual({ status: "paid", balanceSatang: 10000 });
    expect(wallet.topUpState).toHaveBeenCalledWith("cs_test_1", AGENT.agentId);
  });

  it("does not look up a session id that is not one", async () => {
    expect(await topUpStatus("'; drop table")).toEqual({ status: null, balanceSatang: 0 });
    expect(wallet.topUpState).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/topup-actions.test.ts`
Expected: FAIL เพราะหาโมดูลไม่เจอ

- [ ] **Step 8: เขียน `src/app/studio/wallet/actions.ts`**

```ts
"use server";
import { requireMember } from "@/lib/auth/viewer";
import { siteOrigin } from "@/lib/site-url";
import { stripe } from "@/lib/stripe/client";
import { checkoutParams } from "@/lib/wallet/checkout";
import { isTopUpThb, toSatang } from "@/lib/wallet/money";
import { balanceSatang, openTopUp, topUpState, walletSettings, type TopUpStatus } from "@/lib/wallet/store";

/**
 * Starting a top-up and asking how it went. The money is added only by Stripe's webhook
 * (src/app/api/stripe/webhook/route.ts); the page coming back from Stripe only reads.
 */

export type StartResult = { ok: true; url: string } | { ok: false; error: string };

export async function startTopUp(thb: unknown): Promise<StartResult> {
  const viewer = await requireMember();
  if (viewer.staff) return { ok: false, error: "ทีมงานใช้ AI ได้โดยไม่ต้องเติมเงินครับ" };
  // only the five amounts on the page; a number sent by hand is not a price
  if (!isTopUpThb(thb)) return { ok: false, error: "เลือกยอดเติมจากปุ่มบนหน้านี้นะครับ" };
  const settings = await walletSettings().catch(() => null);
  if (!settings?.enabled) return { ok: false, error: "ตอนนี้ยังเติมเงินไม่ได้ครับ" };
  try {
    const session = await stripe().checkout.sessions.create(checkoutParams({ agentId: viewer.agentId, thb, origin: siteOrigin() }));
    if (!session.url) throw new Error(`session ${session.id} has no url`);
    await openTopUp(session.id, viewer.agentId, toSatang(thb));
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("top-up start failed:", e);
    return { ok: false, error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export async function topUpStatus(sessionId: string): Promise<{ status: TopUpStatus | null; balanceSatang: number }> {
  const viewer = await requireMember();
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return { status: null, balanceSatang: 0 };
  const [status, balance] = await Promise.all([topUpState(sessionId, viewer.agentId), balanceSatang(viewer.agentId)]);
  return { status, balanceSatang: balance };
}
```

- [ ] **Step 9: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/ && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git branch --show-current
git add package.json package-lock.json .env.example src/lib/stripe/client.ts src/lib/wallet/checkout.ts src/app/studio/wallet/actions.ts tests/wallet/
git commit -m "feat(studio): an agent opens a Stripe Checkout for one of five top-ups, PromptPay only below ฿150

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Stripe webhook เติมเงินเข้ากระเป๋า

**Files:**
- Create: `src/lib/wallet/events.ts`, `src/app/api/stripe/webhook/route.ts`
- Test: `tests/wallet/events.test.ts`, `tests/wallet/webhook-route.test.ts`

**Interfaces:**
- Consumes: `creditTopUp`, `markTopUp` (Task 2) · `stripe()` (Task 6)
- Produces:
  - `type WalletAction = { kind: "credit"; sessionId: string; agentId: string; satang: number } | { kind: "mark"; sessionId: string; status: "failed" | "expired" } | { kind: "ignore"; why: string }`
  - `actionFor(event: { type: string; data: { object: unknown } }): WalletAction`
  - `applyWalletAction(a: WalletAction): Promise<string>`

- [ ] **Step 1: เขียนเทสต์ events ที่ยังไม่ผ่าน**

`tests/wallet/events.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({ creditTopUp: vi.fn(), markTopUp: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { actionFor, applyWalletAction } = await import("@/lib/wallet/events");

const AGENT = "00000000-0000-4000-8000-000000000002";
const session = (over: object = {}) => ({
  id: "cs_test_1", object: "checkout.session", mode: "payment", currency: "thb", amount_total: 10000,
  payment_status: "paid", client_reference_id: AGENT, ...over,
});
const ev = (type: string, obj: object) => ({ type, data: { object: obj } });

beforeEach(() => vi.clearAllMocks());

describe("what a Stripe event does to a wallet", () => {
  it("credits a completed session that is paid, with what Stripe charged", () => {
    expect(actionFor(ev("checkout.session.completed", session())))
      .toEqual({ kind: "credit", sessionId: "cs_test_1", agentId: AGENT, satang: 10000 });
  });

  it("waits on a completed session not paid yet — a PromptPay QR still being scanned", () => {
    expect(actionFor(ev("checkout.session.completed", session({ payment_status: "unpaid" })))).toMatchObject({ kind: "ignore" });
  });

  it("credits the async success of a delayed payment", () => {
    expect(actionFor(ev("checkout.session.async_payment_succeeded", session()))).toMatchObject({ kind: "credit" });
  });

  it("marks a failed or expired session", () => {
    expect(actionFor(ev("checkout.session.async_payment_failed", session({ payment_status: "unpaid" }))))
      .toEqual({ kind: "mark", sessionId: "cs_test_1", status: "failed" });
    expect(actionFor(ev("checkout.session.expired", session({ payment_status: "unpaid" }))))
      .toEqual({ kind: "mark", sessionId: "cs_test_1", status: "expired" });
  });

  it("credits nothing in another currency, without an agent, or for no money", () => {
    expect(actionFor(ev("checkout.session.completed", session({ currency: "usd" })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ client_reference_id: null })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ client_reference_id: "not-a-uuid" })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ amount_total: 0 })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ mode: "subscription" })))).toMatchObject({ kind: "ignore" });
  });

  it("ignores every other event", () => {
    expect(actionFor(ev("payment_intent.succeeded", {}))).toMatchObject({ kind: "ignore" });
  });
});

describe("applying it", () => {
  it("credits through the locked function, and says a repeat was a repeat", async () => {
    wallet.creditTopUp.mockResolvedValueOnce("credited").mockResolvedValueOnce("duplicate");
    const credit = { kind: "credit" as const, sessionId: "cs_test_1", agentId: AGENT, satang: 10000 };
    expect(await applyWalletAction(credit)).toBe("credited");
    expect(await applyWalletAction(credit)).toBe("duplicate");
    expect(wallet.creditTopUp).toHaveBeenCalledWith("cs_test_1", AGENT, 10000);
  });

  it("logs a session nobody opened here and credits nothing", async () => {
    wallet.creditTopUp.mockResolvedValueOnce("unknown");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction({ kind: "credit", sessionId: "cs_x", agentId: AGENT, satang: 1 })).toBe("unknown");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("marks, and ignores", async () => {
    expect(await applyWalletAction({ kind: "mark", sessionId: "cs_test_1", status: "expired" })).toBe("expired");
    expect(wallet.markTopUp).toHaveBeenCalledWith("cs_test_1", "expired");
    expect(await applyWalletAction({ kind: "ignore", why: "x" })).toBe("ignored");
  });
});
```

- [ ] **Step 2: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/events.test.ts`
Expected: FAIL เพราะหาโมดูลไม่เจอ

- [ ] **Step 3: เขียน `events.ts`**

`src/lib/wallet/events.ts`:

```ts
import { creditTopUp, markTopUp } from "./store";

/**
 * What a Stripe event means for a wallet. Money is added here and nowhere else: when Stripe
 * says a Checkout Session is paid — on checkout.session.completed for a card, and on
 * async_payment_succeeded for a payment that settles later. The amount is what Stripe
 * charged (amount_total), never the metadata.
 */

export type WalletAction =
  | { kind: "credit"; sessionId: string; agentId: string; satang: number }
  | { kind: "mark"; sessionId: string; status: "failed" | "expired" }
  | { kind: "ignore"; why: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SessionLike {
  id?: unknown; mode?: unknown; currency?: unknown; amount_total?: unknown; payment_status?: unknown; client_reference_id?: unknown;
}

export function actionFor(event: { type: string; data: { object: unknown } }): WalletAction {
  const s = (event.data?.object ?? {}) as SessionLike;
  const sessionId = typeof s.id === "string" ? s.id : "";
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (s.payment_status !== "paid") return { kind: "ignore", why: `not paid yet (${String(s.payment_status)})` };
      if (s.mode !== "payment") return { kind: "ignore", why: `mode ${String(s.mode)}` };
      if (s.currency !== "thb") return { kind: "ignore", why: `currency ${String(s.currency)}` };
      if (typeof s.client_reference_id !== "string" || !UUID.test(s.client_reference_id)) return { kind: "ignore", why: "no agent" };
      if (typeof s.amount_total !== "number" || !Number.isInteger(s.amount_total) || s.amount_total <= 0) return { kind: "ignore", why: "no amount" };
      if (!sessionId) return { kind: "ignore", why: "no session id" };
      return { kind: "credit", sessionId, agentId: s.client_reference_id, satang: s.amount_total };
    }
    case "checkout.session.async_payment_failed":
      return sessionId ? { kind: "mark", sessionId, status: "failed" } : { kind: "ignore", why: "no session id" };
    case "checkout.session.expired":
      return sessionId ? { kind: "mark", sessionId, status: "expired" } : { kind: "ignore", why: "no session id" };
    default:
      return { kind: "ignore", why: event.type };
  }
}

/** Throws only when the database does: the webhook then answers 500 and Stripe sends it again. */
export async function applyWalletAction(a: WalletAction): Promise<string> {
  if (a.kind === "ignore") return "ignored";
  if (a.kind === "mark") {
    await markTopUp(a.sessionId, a.status);
    return a.status;
  }
  const r = await creditTopUp(a.sessionId, a.agentId, a.satang);
  // paid at Stripe, but not a top-up opened here for this agent: a person must look
  if (r === "unknown") console.error(`stripe session ${a.sessionId} paid for agent ${a.agentId}, but no top-up of theirs was opened here`);
  return r;
}
```

- [ ] **Step 4: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/events.test.ts`
Expected: PASS

- [ ] **Step 5: เขียนเทสต์ route ที่ยังไม่ผ่าน**

`tests/wallet/webhook-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const construct = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/client", () => ({ stripe: () => ({ webhooks: { constructEvent: construct } }) }));
const events = vi.hoisted(() => ({ actionFor: vi.fn(() => ({ kind: "ignore", why: "t" })), applyWalletAction: vi.fn(async () => "ignored") }));
vi.mock("@/lib/wallet/events", () => events);

const { POST } = await import("@/app/api/stripe/webhook/route");

const req = (body = "{}", sig: string | null = "t=1,v1=x") =>
  new Request("https://x.test/api/stripe/webhook", { method: "POST", body, headers: sig ? { "stripe-signature": sig } : {} }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  construct.mockReturnValue({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
});

describe("the Stripe webhook", () => {
  it("checks the signature over the exact body Stripe sent", async () => {
    const res = await POST(req('{"a":1}'));
    expect(res.status).toBe(200);
    expect(construct).toHaveBeenCalledWith('{"a":1}', "t=1,v1=x", "whsec_test");
  });

  it("refuses a body whose signature does not check out, and applies nothing", async () => {
    construct.mockImplementationOnce(() => { throw new Error("bad sig"); });
    expect((await POST(req())).status).toBe(400);
    expect(events.applyWalletAction).not.toHaveBeenCalled();
  });

  it("refuses when no signature came", async () => {
    expect((await POST(req("{}", null))).status).toBe(400);
  });

  it("answers 500 when the database fails, so Stripe sends it again", async () => {
    events.applyWalletAction.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req())).status).toBe(500);
    err.mockRestore();
  });

  it("answers 500 when the secret is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(req())).status).toBe(500);
    err.mockRestore();
  });
});
```

- [ ] **Step 6: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/webhook-route.test.ts`
Expected: FAIL เพราะหา route ไม่เจอ

- [ ] **Step 7: เขียน route**

`src/app/api/stripe/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { actionFor, applyWalletAction } from "@/lib/wallet/events";

/**
 * Stripe telling us about a top-up's Checkout Session. The only place money enters a wallet.
 * The Dashboard endpoint sends four events: checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and
 * checkout.session.expired. A repeat is harmless — the crediting function keys on the session.
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new NextResponse("not configured", { status: 500 });
  }
  // the signature is computed over the exact bytes Stripe sent, so the body is read as text
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("no signature", { status: 400 });
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch {
    return new NextResponse("bad signature", { status: 400 });
  }
  try {
    const done = await applyWalletAction(actionFor(event));
    return NextResponse.json({ received: true, done });
  } catch (e) {
    console.error(`stripe event ${event.id} (${event.type}) failed:`, e);
    return new NextResponse("retry", { status: 500 });
  }
}
```

- [ ] **Step 8: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/ && npx tsc --noEmit`
Expected: PASS

ถ้า middleware ของแอปบังคับให้ล็อกอินกับทุก `/api/*` ให้ตรวจ `src/middleware.ts` ว่า `/api/facebook/webhook` ถูกยกเว้นอย่างไร แล้วยกเว้น `/api/stripe/webhook` แบบเดียวกัน

- [ ] **Step 9: Commit**

```bash
git branch --show-current
git add src/lib/wallet/events.ts src/app/api/stripe/webhook/route.ts tests/wallet/ src/middleware.ts
git commit -m "feat(studio): Stripe's signed word that a top-up was paid is the one way money enters a wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: หน้ากระเป๋าเงินของตัวแทน `/studio/wallet` และลิงก์เมนู

**Files:**
- Create: `src/app/studio/wallet/page.tsx`, `src/app/studio/wallet/WalletClient.tsx`
- Modify: `src/lib/shell/menu.ts` (`MenuIcon`, `studioMenu`) · `src/components/shell/Sidebar.tsx` (ไอคอน `wallet`)
- Modify test: `tests/calc/shell-menu.test.ts`

**Interfaces:**
- Consumes: `startTopUp`, `topUpStatus` (Task 6) · `walletSettings`, `balanceSatang`, `walletEntries` (Task 2) · `allowanceOf` (quota) · `TOPUP_THB`, `cardAllowed`, `formatBaht` (Task 2)
- Produces: route `/studio/wallet` · `MenuIcon` มีค่า `"wallet"`

- [ ] **Step 1: แก้เทสต์เมนูให้คาดหวังลิงก์ใหม่ (ยังไม่ผ่าน)**

ใน `tests/calc/shell-menu.test.ts` ส่วน `describe("Studio's own menu")`:

```ts
  it("lists Studio's pages and a way back to the main system", () => {
    const links = studioMenu().flatMap((g) => g.links);
    expect(links.map((l) => l.href)).toEqual(["/studio", "/studio/write", "/studio/calendar", "/studio/hooks", "/studio/people", "/studio/wallet", "/"]);
  });

  it("keeps the front page for admins and posting staff; other agents start at the workbench", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
    const hrefs = (w: typeof who) => studioMenu(w).flatMap((g) => g.links).map((l) => l.href);
    // the calendar is every agent's: a Page's for those who post, a plan for the rest (owner, 2026-09-30)
    expect(hrefs(who)).toEqual(["/studio/write", "/studio/calendar", "/studio/hooks", "/studio/people", "/studio/wallet", "/"]);
    expect(hrefs({ ...who, admin: true, publish: true })).toContain("/studio");
    // posting staff choose among their own Pages there (owner, 2026-09-29)
    expect(hrefs({ ...who, publish: true })).toContain("/studio");
  });

  it("gives the wallet to agents only: staff write without one (owner, 2026-09-30)", () => {
    const who = { name: "a", room: "r", publish: false, connect: false, admin: false, owner: false };
    const hrefs = (w: typeof who) => studioMenu(w).flatMap((g) => g.links).map((l) => l.href);
    expect(hrefs({ ...who, publish: true })).not.toContain("/studio/wallet");
    expect(hrefs({ ...who, connect: true })).not.toContain("/studio/wallet");
    expect(hrefs({ ...who, admin: true })).not.toContain("/studio/wallet");
  });
```

Run: `npx vitest run tests/calc/shell-menu.test.ts`
Expected: FAIL (ไม่มี `/studio/wallet`)

- [ ] **Step 2: เพิ่มลิงก์เมนูและไอคอน**

ใน `src/lib/shell/menu.ts`:
- เพิ่ม `| "wallet"` ใน union `MenuIcon`
- ใน `studioMenu` เพิ่มลิงก์ท้าย array `links`:

```ts
    // an agent's own wallet, to write past the free month (owner, 2026-09-30); staff write without one
    { href: "/studio/wallet", label: "กระเป๋าเงิน", icon: "wallet", hue: "#2b736f" },
```

แก้ `hidden`:

```ts
  const staff = Boolean(who && (who.admin || who.publish || who.connect || who.owner));
  const hidden = new Set([
    ...(who && !who.admin && !who.publish ? ["/studio"] : []),
    ...(staff ? ["/studio/wallet"] : []),
  ]);
```

ใน `src/components/shell/Sidebar.tsx` เพิ่ม case ใน `switch (name)`:

```tsx
    // the agent's Studio wallet
    case "wallet":
      return <svg {...common}><path d="M4.5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8l11-3v2.5M16.5 13.5h.01" /></svg>;
```

- [ ] **Step 3: หน้า server**

`src/app/studio/wallet/page.tsx`:

```tsx
import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { allowanceOf } from "@/lib/auth/quota";
import { balanceSatang, walletEntries, walletSettings } from "@/lib/wallet/store";
import { WalletClient } from "./WalletClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงิน | Studio" };

/** An agent's wallet: what is in it, the free rounds left, the five top-ups, and what it was spent on. */
export default async function WalletPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const viewer = await gatePage("/studio/wallet");
  const { paid } = await searchParams;
  if (viewer.staff) {
    return <p className="text-sm text-[var(--ct-mute)]">ทีมงานใช้ AI ใน Studio ได้โดยไม่ต้องเติมเงินครับ</p>;
  }
  const [settings, balance, entries, allowance] = await Promise.all([
    walletSettings().catch(() => ({ enabled: false, multiplier: 2 })),
    balanceSatang(viewer.agentId).catch(() => 0),
    walletEntries(viewer.agentId).catch(() => []),
    allowanceOf(viewer),
  ]);
  return (
    <WalletClient
      enabled={settings.enabled}
      balanceSatang={balance}
      entries={entries}
      rounds={{ used: allowance.used, limit: allowance.limit ?? 0 }}
      paid={typeof paid === "string" ? paid : null}
    />
  );
}
```

- [ ] **Step 4: หน้า client**

`src/app/studio/wallet/WalletClient.tsx`:

```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { cardAllowed, formatBaht, TOPUP_THB, type TopUpThb } from "@/lib/wallet/money";
import type { WalletEntry } from "@/lib/wallet/store";
import { startTopUp, topUpStatus } from "./actions";

const ROUND_NAMES: Record<string, string> = {
  "ai-write": "เขียนโพสต์", "ai-recruit": "หาทีม", "ai-knowledge": "ความรู้", "ai-draft": "เขียนเอง",
  "ai-claim": "รีวิวเคลม", "ai-draw": "วาดภาพ",
};

const entryLabel = (e: WalletEntry) =>
  e.kind === "topup" ? "เติมเงิน" : e.kind === "charge" ? ROUND_NAMES[e.round ?? ""] ?? "ใช้ AI" : `ปรับโดยเจ้าของ${e.note ? ` (${e.note})` : ""}`;

const signed = (satang: number) => `${satang >= 0 ? "+" : "−"}${formatBaht(Math.abs(satang))}`;

/** polls every two seconds for up to a minute after Stripe sends the agent back */
const POLL_MS = 2000;
const POLL_TRIES = 30;

export function WalletClient({ enabled, balanceSatang, entries, rounds, paid }: {
  enabled: boolean;
  balanceSatang: number;
  entries: WalletEntry[];
  rounds: { used: number; limit: number };
  paid: string | null;
}) {
  const [balance, setBalance] = useState(balanceSatang);
  const [waiting, setWaiting] = useState<"checking" | "late" | "failed" | null>(paid ? "checking" : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!paid) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const r = await topUpStatus(paid).catch(() => null);
      if (r?.status === "paid") {
        setBalance(r.balanceSatang);
        setWaiting(null);
        // the history above was read before the money came: read the page again
        window.location.replace("/studio/wallet");
        return;
      }
      if (r?.status === "failed" || r?.status === "expired") return setWaiting("failed");
      if (++tries >= POLL_TRIES) return setWaiting("late");
      setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { stop = true; };
  }, [paid]);

  const topUp = (thb: TopUpThb) => start(async () => {
    setError(null);
    const r = await startTopUp(thb);
    if (r.ok) window.location.assign(r.url);
    else setError(r.error);
  });

  const freeLeft = Math.max(0, rounds.limit - rounds.used);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5">
        <p className="text-sm text-[var(--ct-mute)]">ยอดในกระเป๋า</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatBaht(balance)}</p>
        <p className="mt-2 text-sm text-[var(--ct-mute)]">
          เหลือ {freeLeft}/{rounds.limit} รอบฟรีเดือนนี้ · หมดแล้วจึงตัดจากกระเป๋าตามต้นทุนจริงของงาน
        </p>
        {waiting === "checking" && <p className="mt-3 text-sm font-medium" role="status">กำลังยืนยันการชำระเงิน…</p>}
        {waiting === "late" && <p className="mt-3 text-sm" role="status">ยังไม่ได้รับการยืนยันจาก Stripe — ยอดจะเข้าเองเมื่อ Stripe แจ้ง ลองเปิดหน้านี้ใหม่ภายหลังนะครับ</p>}
        {waiting === "failed" && <p className="mt-3 text-sm text-[var(--ct-warn-ink)]" role="status">การชำระเงินไม่สำเร็จ ยังไม่ได้ตัดเงินครับ</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">เติมเงิน</h2>
        {enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOPUP_THB.map((thb) => (
                <button key={thb} type="button" disabled={pending} onClick={() => topUp(thb)}
                  className="min-h-14 rounded-lg border border-[var(--ct-line)] px-3 py-2 text-left disabled:opacity-50">
                  <span className="block text-base font-semibold">฿{thb}</span>
                  <span className="block text-xs text-[var(--ct-mute)]">{cardAllowed(thb) ? "PromptPay / บัตร" : "PromptPay"}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-[var(--ct-warn-ink)]" role="alert">{error}</p>}
            <p className="text-xs text-[var(--ct-mute)]">ชำระผ่าน Stripe · เงินในกระเป๋าไม่มีวันหมดอายุ และใช้ได้กับ AI ใน Studio เท่านั้น</p>
          </>
        ) : (
          <p className="text-sm text-[var(--ct-mute)]">ตอนนี้ยังเติมเงินไม่ได้ครับ</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">ประวัติ</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)]">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{entryLabel(e)}</span>
                  <span className="block text-xs text-[var(--ct-mute)]">{new Date(e.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${e.amountSatang >= 0 ? "font-medium" : "text-[var(--ct-mute)]"}`}>{signed(e.amountSatang)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: ตรวจ**

Run: `npx vitest run tests/calc/shell-menu.test.ts && npx tsc --noEmit && npx next lint`
Expected: PASS (เทสต์ "is a page that exists" ผ่านเพราะมี `page.tsx` แล้ว)

- [ ] **Step 6: ดูหน้าจริงใน browser**

ใช้ skill `run` หรือ preview tools เปิด `/studio/wallet` ด้วยบัญชีตัวแทนทดสอบ (ไม่ใช่ staff) แล้วตรวจ:
- ถ้ายังไม่ได้ apply migration (Task 1) หน้าจะแสดง ฿0.00 และ "ยังเติมเงินไม่ได้" เพราะทุกการอ่านมี fallback
- กว้าง 375px ต้องไม่มี scroll แนวนอน
- ปุ่มสูงอย่างน้อย 44px

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add src/app/studio/wallet/ src/lib/shell/menu.ts src/components/shell/Sidebar.tsx tests/calc/shell-menu.test.ts
git commit -m "feat(studio): agents have a wallet page with its balance, five top-ups and what it was spent on

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: หน้าแอดมิน `/admin/wallet`

**Files:**
- Create: `src/lib/wallet/admin-input.ts`, `src/app/admin/wallet/page.tsx`, `src/app/admin/wallet/actions.ts`, `src/app/admin/wallet/WalletAdmin.tsx`
- Modify: `src/lib/shell/menu.ts` (เมนูแอดมิน + `BACK_OFFICE_PERM`)
- Test: `tests/wallet/admin-input.test.ts`, `tests/wallet/admin-actions.test.ts`

**Interfaces:**
- Consumes: `walletSettings`, `saveWalletSettings`, `walletSummary`, `adjustWallet` (Task 2) · `monthStart` (`@/lib/ai/ledger`) · `requireStaff`, `gatePage`, `audit` (`@/lib/auth/viewer`)
- Produces:
  - `readMultiplier(s: string): { ok: true; value: number } | { ok: false; error: string }`
  - `readAdjust(baht: string, note: string): { ok: true; satang: number; note: string } | { ok: false; error: string }`
  - `saveWallet(enabled: boolean, multiplier: string): Promise<Result>`
  - `adjustAgentWallet(agentId: string, baht: string, note: string): Promise<Result>` · `Result = { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: เขียนเทสต์ input ที่ยังไม่ผ่าน**

`tests/wallet/admin-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readAdjust, readMultiplier } from "@/lib/wallet/admin-input";

describe("the multiplier the owner types", () => {
  it("is a number from 1 to 10", () => {
    expect(readMultiplier("2")).toEqual({ ok: true, value: 2 });
    expect(readMultiplier(" 1.5 ")).toEqual({ ok: true, value: 1.5 });
    for (const s of ["0.9", "11", "", "abc", "NaN", "-2"]) expect(readMultiplier(s)).toMatchObject({ ok: false });
  });
});

describe("an adjustment the owner types", () => {
  it("is baht, plus or minus, with a reason, made into satang", () => {
    expect(readAdjust("20", "ของขวัญ")).toEqual({ ok: true, satang: 2000, note: "ของขวัญ" });
    expect(readAdjust("-12.5", " คืนเงินใน Stripe ")).toEqual({ ok: true, satang: -1250, note: "คืนเงินใน Stripe" });
  });

  it("refuses nothing, too much, a third decimal place, or no reason", () => {
    expect(readAdjust("0", "x")).toMatchObject({ ok: false });
    expect(readAdjust("10001", "x")).toMatchObject({ ok: false });
    expect(readAdjust("1.005", "x")).toMatchObject({ ok: false });
    expect(readAdjust("abc", "x")).toMatchObject({ ok: false });
    expect(readAdjust("10", "   ")).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/admin-input.test.ts`
Expected: FAIL เพราะหาโมดูลไม่เจอ

- [ ] **Step 3: เขียน `admin-input.ts`**

`src/lib/wallet/admin-input.ts`:

```ts
/**
 * What the owner types on /admin/wallet, read on the server: the browser is not the guard
 * (the same rule as src/app/admin/ai/budget.ts).
 */

export const MAX_MULTIPLIER = 10;
/** the most one adjustment moves, either way: a slip of the finger should not be ฿100,000 */
export const MAX_ADJUST_THB = 10000;

export function readMultiplier(s: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = String(s ?? "").trim();
  const v = Number(t);
  if (!t || !Number.isFinite(v) || v < 1 || v > MAX_MULTIPLIER) {
    return { ok: false, error: `ตัวคูณต้องเป็นตัวเลขตั้งแต่ 1 ถึง ${MAX_MULTIPLIER}` };
  }
  return { ok: true, value: v };
}

export function readAdjust(baht: string, note: string): { ok: true; satang: number; note: string } | { ok: false; error: string } {
  const t = String(baht ?? "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return { ok: false, error: "จำนวนเงินต้องเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง ใส่ - นำหน้าเพื่อหักออก" };
  const v = Number(t);
  if (v === 0 || Math.abs(v) > MAX_ADJUST_THB) return { ok: false, error: `ปรับได้ครั้งละไม่เกิน ฿${MAX_ADJUST_THB.toLocaleString("en-US")} และต้องไม่เป็น 0` };
  const reason = String(note ?? "").trim();
  if (!reason) return { ok: false, error: "ต้องใส่เหตุผลทุกครั้ง" };
  return { ok: true, satang: Math.round(v * 100), note: reason.slice(0, 200) };
}
```

- [ ] **Step 4: รันแล้วต้องผ่าน**

Run: `npx vitest run tests/wallet/admin-input.test.ts`
Expected: PASS

- [ ] **Step 5: เขียนเทสต์ actions ที่ยังไม่ผ่าน**

`tests/wallet/admin-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const wallet = vi.hoisted(() => ({ saveWalletSettings: vi.fn(async () => {}), adjustWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { adjustAgentWallet, saveWallet } = await import("@/app/admin/wallet/actions");
const { OWNER } = await import("../helpers/signed-in");
const AGENT = "00000000-0000-4000-8000-000000000002";

beforeEach(() => vi.clearAllMocks());

describe("saveWallet", () => {
  it("saves the switch and the multiplier", async () => {
    expect(await saveWallet(true, "1.5")).toEqual({ ok: true });
    expect(wallet.saveWalletSettings).toHaveBeenCalledWith({ enabled: true, multiplier: 1.5 });
  });

  it("refuses a multiplier out of range and saves nothing", async () => {
    expect(await saveWallet(true, "0.5")).toMatchObject({ ok: false });
    expect(wallet.saveWalletSettings).not.toHaveBeenCalled();
  });
});

describe("adjustAgentWallet", () => {
  it("moves the balance with the owner's name on it", async () => {
    wallet.adjustWallet.mockResolvedValueOnce(7000);
    expect(await adjustAgentWallet(AGENT, "20", "ของขวัญ")).toEqual({ ok: true });
    expect(wallet.adjustWallet).toHaveBeenCalledWith(AGENT, 2000, "ของขวัญ", OWNER.agentId);
  });

  it("says so when it would take the balance below zero", async () => {
    wallet.adjustWallet.mockResolvedValueOnce(null);
    expect(await adjustAgentWallet(AGENT, "-999", "คืนเงิน")).toEqual({ ok: false, error: "หักเกินยอดที่มีในกระเป๋า" });
  });

  it("refuses an agent id that is not one", async () => {
    expect(await adjustAgentWallet("x", "20", "a")).toMatchObject({ ok: false });
    expect(wallet.adjustWallet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: รันแล้วต้องไม่ผ่าน**

Run: `npx vitest run tests/wallet/admin-actions.test.ts`
Expected: FAIL เพราะหาโมดูลไม่เจอ

- [ ] **Step 7: เขียน actions, page, client**

`src/app/admin/wallet/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { readAdjust, readMultiplier } from "@/lib/wallet/admin-input";
import { adjustWallet, saveWalletSettings } from "@/lib/wallet/store";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveWallet(enabled: boolean, multiplier: string): Promise<Result> {
  await requireStaff("admin");
  const m = readMultiplier(multiplier);
  if (!m.ok) return m;
  try {
    await saveWalletSettings({ enabled: enabled === true, multiplier: m.value });
  } catch (e) {
    console.error("wallet settings not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("wallet-settings", null, { enabled: enabled === true, multiplier: m.value });
  revalidatePath("/admin/wallet");
  return { ok: true };
}

export async function adjustAgentWallet(agentId: string, baht: string, note: string): Promise<Result> {
  const viewer = await requireStaff("admin");
  if (typeof agentId !== "string" || !UUID.test(agentId)) return { ok: false, error: "ไม่พบตัวแทนนี้" };
  const a = readAdjust(baht, note);
  if (!a.ok) return a;
  try {
    const balance = await adjustWallet(agentId, a.satang, a.note, viewer.agentId);
    if (balance === null) return { ok: false, error: "หักเกินยอดที่มีในกระเป๋า" };
  } catch (e) {
    console.error("wallet adjust failed:", e);
    return { ok: false, error: "ปรับยอดไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("wallet-adjust", agentId, { satang: a.satang, note: a.note });
  revalidatePath("/admin/wallet");
  return { ok: true };
}
```

`src/app/admin/wallet/page.tsx`:

```tsx
import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { monthStart } from "@/lib/ai/ledger";
import { walletSettings, walletSummary } from "@/lib/wallet/store";
import { WalletAdmin } from "./WalletAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงินตัวแทน | advisortool" };

export default async function AdminWalletPage() {
  await gatePage("/admin/wallet", "admin");
  const [settings, rows] = await Promise.all([
    walletSettings().catch(() => null),
    walletSummary(monthStart()).catch((e) => {
      console.error("wallet summary unreadable:", e);
      return null;
    }),
  ]);
  return <WalletAdmin settings={settings} rows={rows} />;
}
```

`src/app/admin/wallet/WalletAdmin.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { formatBaht } from "@/lib/wallet/money";
import type { WalletRow, WalletSettings } from "@/lib/wallet/store";
import { adjustAgentWallet, saveWallet } from "./actions";

export function WalletAdmin({ settings, rows }: { settings: WalletSettings | null; rows: WalletRow[] | null }) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [multiplier, setMultiplier] = useState(String(settings?.multiplier ?? 2));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await saveWallet(enabled, multiplier);
    setMessage(r.ok ? "บันทึกแล้ว" : r.error);
  });

  if (!settings) return <p className="text-sm">อ่านการตั้งค่ากระเป๋าเงินไม่ได้ — ตรวจว่า migration 20260930_wallet ถูก apply แล้ว</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-3 rounded-xl border p-5">
        <h1 className="text-lg font-semibold">กระเป๋าเงินตัวแทน</h1>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5" />
          เปิดให้ตัวแทนเติมเงินและใช้ AI ต่อจากกระเป๋าเมื่อโควตาฟรีหมด
        </label>
        <label className="block text-sm">
          ตัวคูณราคา (ต้นทุนจริงของ AI × ตัวคูณ)
          <input inputMode="decimal" value={multiplier} onChange={(e) => setMultiplier(e.target.value)}
            className="mt-1 block min-h-11 w-32 rounded-lg border px-3" />
        </label>
        <button type="button" onClick={save} disabled={pending} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-50">บันทึก</button>
        {message && <p className="text-sm" role="status">{message}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">กระเป๋าของตัวแทน (ยอดเติม/ใช้ นับตั้งแต่ต้นเดือนนี้)</h2>
        {rows === null ? <p className="text-sm">อ่านรายการกระเป๋าไม่ได้</p>
          : rows.length === 0 ? <p className="text-sm">ยังไม่มีใครเติมเงิน</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left"><th className="py-2 pr-3">ตัวแทน</th><th className="pr-3 text-right">คงเหลือ</th><th className="pr-3 text-right">เติมเดือนนี้</th><th className="pr-3 text-right">ใช้เดือนนี้</th><th /></tr></thead>
                <tbody>{rows.map((r) => <Row key={r.agentId} row={r} />)}</tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}

function Row({ row }: { row: WalletRow }) {
  const [open, setOpen] = useState(false);
  const [baht, setBaht] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const apply = () => start(async () => {
    const r = await adjustAgentWallet(row.agentId, baht, note);
    setMessage(r.ok ? "ปรับแล้ว" : r.error);
    if (r.ok) { setBaht(""); setNote(""); setOpen(false); }
  });
  return (
    <>
      <tr className="border-t">
        <td className="py-2 pr-3">{row.name || "(ไม่มีชื่อ)"} <span className="text-xs opacity-60">{row.code}</span></td>
        <td className="pr-3 text-right tabular-nums">{formatBaht(row.balanceSatang)}</td>
        <td className="pr-3 text-right tabular-nums">{formatBaht(row.toppedUpSatang)}</td>
        <td className="pr-3 text-right tabular-nums">{formatBaht(row.chargedSatang)}</td>
        <td className="text-right"><button type="button" onClick={() => setOpen(!open)} className="min-h-11 px-2 underline">ปรับยอด</button></td>
      </tr>
      {(open || message) && (
        <tr><td colSpan={5} className="pb-3">
          {open && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">บาท (± )<input inputMode="decimal" value={baht} onChange={(e) => setBaht(e.target.value)} className="mt-1 block min-h-11 w-28 rounded-lg border px-2" /></label>
              <label className="min-w-48 flex-1 text-xs">เหตุผล<input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border px-2" /></label>
              <button type="button" onClick={apply} disabled={pending} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50">ยืนยัน</button>
            </div>
          )}
          {message && <p className="mt-1 text-xs" role="status">{message}</p>}
        </td></tr>
      )}
    </>
  );
}
```

ก่อนเขียน class ให้เปิด `src/app/admin/ai/AiClient.tsx` ดูคลาสสีและกรอบที่หน้าแอดมินใช้ แล้วใช้ชุดเดียวกัน (ในโค้ดข้างบนใช้ `border` เปล่า ๆ เป็นค่าตั้งต้น)

- [ ] **Step 8: เมนูแอดมิน**

ใน `src/lib/shell/menu.ts` กลุ่ม "ผู้ช่วย AI" เพิ่มลิงก์ต่อจาก `/admin/ai`:

```ts
          // the agents' Studio wallets: on or off, the multiplier, a hand on a balance (owner, 2026-09-30)
          { href: "/admin/wallet", label: "กระเป๋าเงินตัวแทน", icon: "wallet", hue: "#2b736f" },
```

และใน `BACK_OFFICE_PERM` เพิ่ม `"/admin/wallet": "admin",`

- [ ] **Step 9: ตรวจ**

Run: `npx vitest run tests/wallet/ tests/calc/shell-menu.test.ts && npx tsc --noEmit && npx next lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git branch --show-current
git add src/lib/wallet/admin-input.ts src/app/admin/wallet/ src/lib/shell/menu.ts tests/wallet/
git commit -m "feat(admin): the owner switches the wallet on, sets its multiplier and adjusts a balance with a reason

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: ทดสอบครบวงจรใน Stripe sandbox และตรวจทั้ง branch

**Files:** ไม่มีไฟล์ใหม่ นอกจากสิ่งที่ต้องแก้ตามที่พบ

- [ ] **Step 1: ตรวจทั้งโปรเจกต์**

Run: `npm run verify`
Expected: tsc, lint, vitest และ build ผ่านทั้งหมด

- [ ] **Step 2: เตรียม sandbox (เจ้าของทำเอง)**

บอกเจ้าของในแชทให้ทำขั้นตอนเหล่านี้ด้วยตัวเอง **ห้ามขอให้เจ้าของวาง key ในแชท**
1. สร้าง sandbox ใน Stripe Dashboard เปิด **PromptPay** และ **Cards** ที่ Settings → Payment methods
2. สร้าง restricted key (`rk_test_…`) ที่ให้สิทธิ์ **Checkout Sessions: Write** แล้วใส่ใน `.env.local` เป็น `STRIPE_SECRET_KEY`
3. รัน `stripe login` แล้ว `stripe listen --forward-to localhost:3000/api/stripe/webhook` แล้วใส่ `whsec_…` ที่ได้เป็น `STRIPE_WEBHOOK_SECRET` ใน `.env.local`
4. ยืนยันว่า migration ของ Task 1 apply แล้ว และเปิด `wallet_enabled` ที่ `/admin/wallet`

- [ ] **Step 3: ทดสอบครบวงจร (ด้วยบัญชีตัวแทนทดสอบที่ไม่ใช่ staff)**

- เปิด dev server ด้วย preview tools แล้วเปิด `/studio/wallet`
- เติม ฿150 ด้วยบัตรทดสอบ `4242 4242 4242 4242` (ดูรายการบัตรทดสอบจาก skill `stripe:test-cards`)
  - กลับมาต้องเห็น "กำลังยืนยัน…" แล้วยอดเป็น ฿150.00 และประวัติมี "เติมเงิน +฿150.00"
- เติม ฿50 → หน้า Stripe ต้องมีแค่ PromptPay ไม่มีช่องบัตร → จ่ายด้วย PromptPay ทดสอบ → ยอดเพิ่ม
- ส่ง event ซ้ำด้วย `stripe events resend <evt_id>` → ยอดต้องไม่เพิ่ม และ `stripe listen` ต้องเห็น 200
- ตั้ง `member_ai_month` ของห้องทดสอบให้โควตาหมด แล้วสร้างโพสต์ 1 รอบ
  - ยอดต้องลดประมาณ `ต้นทุน × 2`
  - ประวัติต้องมี "เขียนโพสต์ −฿x.xx"
  - บรรทัดใต้ปุ่มต้องบอก "จากกระเป๋า" และมีลิงก์เติมเงิน
- ทำให้ยอดเหลือน้อยกว่ายอดจอง (ใช้ `/admin/wallet` ปรับลด) แล้วกดสร้าง → ต้องได้ข้อความ `walletShort` และยอดไม่เปลี่ยน
- ที่ `/admin/wallet` ปรับ +฿20 พร้อมเหตุผล → ประวัติของตัวแทนต้องแสดง "ปรับโดยเจ้าของ (เหตุผล)"

ถ้าเจอข้อผิดพลาดตรงไหน ให้ใช้ skill `superpowers:systematic-debugging` แก้ แล้ว commit แยกเป็น `fix(studio): …`

- [ ] **Step 4: รายงานเจ้าของ และขั้นตอนก่อนปล่อยจริง (ไม่ทำเอง)**

รายงานผลของ Step 3 พร้อมหลักฐาน (screenshot / ข้อความจาก `stripe listen`) แล้วแจ้งสิ่งที่เจ้าของต้องทำก่อน merge เข้า main:
1. สร้าง restricted key **live** และ webhook endpoint `https://www.advisortool.app/api/stripe/webhook` ใน Dashboard (4 events)
2. ใส่ `STRIPE_SECRET_KEY` และ `STRIPE_WEBHOOK_SECRET` ใน Vercel (Production)
3. เปิด PromptPay และบัตรในบัญชี live
4. ตรวจเรื่องกฎหมาย/ภาษีของเงินที่รับล่วงหน้า (spec "ความเสี่ยง" ข้อ 3)
5. เปิด `wallet_enabled` ที่ `/admin/wallet` เมื่อพร้อม

การ push, merge และเปิด PR ต้องรอเจ้าของสั่งเท่านั้น
