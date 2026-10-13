# Member Monthly Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google members (`viewer.kind === "member"`) need a live 30-day pass (฿99, PromptPay, 3-day trial) to use /home and Studio; a live pass gives unlimited ถาม AI and 10 free Studio rounds per period.

**Architecture:** An append-only ledger `ins_member_passes` from which a pure function derives the periods; one resolver `memberAccess(viewer)` answers "is this member let in, and which period are they in", used by `gatePage`, `askCopilot`, `takeRound`/`allowanceOf` and `createVideo`. Passes are bought through their own Stripe Checkout and credited/revoked by the existing webhook.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (PostgREST via `supabaseAdmin()`), Stripe Checkout, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-member-monthly-pass-design.md`

## Global Constraints

- Only `viewer.kind === "member"` is ever gated or given per-period rounds; UnitOS agents, assistants, staff and the owner behave exactly as today.
- Switch `member_pass_enabled` off (the default) = members behave exactly as today (no gate, one-time 10 rounds from `FREE_ROUNDS_FROM`).
- Defaults: price 9900 satang (฿99), trial 3 days, 10 rounds per period, pass length `PASS_DAYS = 30`.
- Card offered only when the price ≥ `CARD_FROM_THB` (฿150) — i.e. not at ฿99.
- Free วิดีโอนำเสนอ clips stay `FREE_VIDEOS` (2) once; unchanged.
- Thai user-facing copy exactly as written in this plan; comments in the codebase's style (why + owner date).
- Server actions return `{ ok: false, error }` rather than throwing (see `src/app/admin/members/actions.ts`).
- Stage files with explicit `git add <paths>` only — never `-A` (another session shares the folder).
- `.env.local` points at the prod database: do not submit forms locally.

## Review Focus

1. **Pass state unreadable** (DB error, settings missing): never let a member in free and never loop — pages throw to the error page, actions return `PASS_UNREADABLE`. Test in Task 2 (`memberAccess` throws) and Task 3 (`takeRound` → refusal).
2. **Stripe retries a paid pass event**: one `paid` row only (`stripe_session_id` unique → `"duplicate"`). Test in Task 4.
3. **A refund of an ordinary wallet top-up** still claws the wallet back after the pass lookup finds nothing. Test in Task 4.
4. **Switch off**: a member's rounds window is `FREE_ROUNDS`/`FREE_ROUNDS_FROM` and nothing is gated. Test in Task 3.
5. **Two first visits at once**: one trial row (partial unique index; `23505` ignored). Test in Task 2.

---

### Task 1: Migration and the pass model

**Files:**
- Create: `supabase/migrations/20261027_member_pass.sql`
- Create: `src/lib/members/pass.ts`
- Test: `tests/members/pass.test.ts`

**Interfaces:**
- Produces (browser-safe, no imports from server code):
  - `type PassKind = "trial" | "paid" | "granted" | "revoked"`
  - `interface PassRow { id: number; kind: PassKind; days: number; revokes: number | null; createdAt: string; amountSatang: number | null; note: string | null }`
  - `interface Period { rowId: number; kind: "trial" | "paid" | "granted"; start: Date; end: Date }`
  - `type PassState = { status: "live"; period: Period; end: Date } | { status: "expired"; end: Date } | { status: "none" }` — `end` of `live` is the last period's end (stacked renewals included)
  - `passPeriods(rows: PassRow[]): Period[]`
  - `passState(rows: PassRow[], now: Date): PassState`
  - `daysLeft(end: Date, now: Date): number` — `Math.ceil((end - now) / DAY_MS)`, never below 0
  - `interface PassSettings { enabled: boolean; satang: number; trialDays: number; rounds: number }`
  - `DEFAULT_PASS_SETTINGS: PassSettings = { enabled: false, satang: 9900, trialDays: 3, rounds: 10 }`
  - constants `PASS_DAYS = 30`, `REMIND_DAYS = 3`, `DAY_MS = 86_400_000`, `PASS_PAGE = "/membership"`
  - `roundsFrom(state: PassState, settings: PassSettings): { limit: number; from: Date } | null` — `{ limit: settings.rounds, from: state.period.start }` when `settings.enabled` and `state.status === "live"`, else `null` (callers fall back to the one-time 10). Shared by Task 3 (`freeWindow`) and Task 6 (`listMembers`).

- [ ] **Step 1: Write the migration** `20261027_member_pass.sql`: table `public.ins_member_passes` with the columns in the spec's Data table (`member_id uuid not null references public.ins_members(id) on delete cascade`, `kind text not null check (kind in ('trial','paid','granted','revoked'))`, `days int not null check (days >= 0)`, `revokes bigint unique references public.ins_member_passes(id)`, `stripe_session_id text unique`, `payment_intent text`), index on `(member_id, created_at)` and on `payment_intent`, `create unique index ins_member_passes_one_trial on public.ins_member_passes(member_id) where kind = 'trial'`, RLS enabled with no policies (server-only, like the wallet tables); and `alter table public.ins_ai_settings add column if not exists member_pass_enabled boolean not null default false, add column if not exists member_pass_satang int not null default 9900, add column if not exists member_trial_days int not null default 3, add column if not exists member_pass_rounds int not null default 10;`

- [ ] **Step 2: Write the failing tests** in `tests/members/pass.test.ts`. Use `const at = (d: string) => new Date(\`${d}T10:00:00+07:00\`)` and rows built by a helper `row(id, kind, days, createdAt, revokes = null)`:
  - `trial only`: `[trial 3d @10-13]` → one period 10-13 → 10-16; `passState(…, at("2026-10-14"))` is `live`, `period.kind === "trial"`, `end` = 10-16.
  - `paid during the trial stacks after it`: trial @10-13 + paid 30d @10-14 → periods `[10-13→10-16, 10-16→11-15]`; at 10-14 the live period is the trial and `end` is 11-15; at 10-17 the live period is the paid one.
  - `renew after expiry starts on the day paid`: trial @10-01 (ends 10-04) + paid @10-20 → second period starts 10-20; `passState` at 10-10 is `{ status: "expired", end: 10-04 }`.
  - `a revoked pass drops out and later periods move up`: trial @10-01, paid#2 @10-02, paid#3 @10-03, revoked(revokes: 2) → periods are trial and #3 only, #3 runs 10-04 → 11-03.
  - `granted days are a period of their own`: granted 5d after a paid period starts at the paid end.
  - `no rows is none`; `daysLeft` is 0 once past, 1 for any part of a day left.
  - `roundsFrom`: live + enabled → `{ limit: 10, from: period.start }`; expired, none, or `enabled: false` → `null`.

- [ ] **Step 3: Run** `npx vitest run tests/members/pass.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/members/pass.ts`.** `passPeriods`: drop `revoked` rows and every row whose id a `revoked` row names; sort the rest by `createdAt` then `id`; walk keeping `prevEnd`: `start = max(prevEnd, createdAt)`, `end = start + days * DAY_MS`. `passState`: `none` when there are no rows at all; else the period with `start <= now < end` is `live` (with `end` = last period's end); else `expired` with `end` = the last period whose `end <= now` (or the last period's end).

- [ ] **Step 5: Run** the test — Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/20261027_member_pass.sql src/lib/members/pass.ts tests/members/pass.test.ts
git commit -m "feat(members): pass ledger and its periods"
```

### Task 2: Pass store and the access resolver

**Files:**
- Create: `src/lib/members/pass-store.ts`
- Create: `src/lib/members/access.ts`
- Test: `tests/members/pass-store.test.ts`, `tests/members/access.test.ts`

**Interfaces:**
- Consumes: Task 1 types and `DEFAULT_PASS_SETTINGS`, `PASS_DAYS`.
- Produces — `pass-store.ts` (server only, `supabaseAdmin()`):
  - `passSettings(): Promise<PassSettings>` — reads the 4 columns from `ins_ai_settings`; throws on error; missing row → `DEFAULT_PASS_SETTINGS`
  - `savePassSettings(s: PassSettings): Promise<void>` — upsert `{ id: true, …, updated_at }` like `saveMemberSettings`
  - `passRows(memberId: string): Promise<PassRow[]>`
  - `passRowsOf(memberIds: string[]): Promise<Map<string, PassRow[]>>` — one query (`in`), for the admin list
  - `ensureTrial(memberId: string, days: number): Promise<void>` — insert `{ kind: "trial", days }`; Postgres code `23505` is success; any other error throws
  - `addPaidPass(a: { sessionId: string; memberId: string; satang: number; paymentIntent: string | null }): Promise<"added" | "duplicate" | "unknown">` — `days: PASS_DAYS`; `23505` → `"duplicate"`; `23503` (no such member) → `"unknown"`
  - `grantPass(memberId: string, days: number, note: string, by: string): Promise<void>`
  - `revokePaidPass(a: { paymentIntent: string; reason: "refund" | "dispute"; ref: string }): Promise<"revoked" | "duplicate" | "unknown">` — finds the `paid` row by `payment_intent` (none → `"unknown"`), inserts `{ kind: "revoked", days: 0, revokes: <id>, member_id, note: "<reason> <ref>" }`; `23505` on `revokes` → `"duplicate"`
  - `passPaid(sessionId: string, memberId: string): Promise<boolean>` — a `paid` row with that session and member exists
  - `passRevenueSatang(since: Date): Promise<number>` — sum of `amount_satang` of `paid` rows created since, minus those a `revoked` row names
- Produces — `access.ts`:
  - `type MemberAccess = { gated: false } | { gated: true; state: PassState; settings: PassSettings }`
  - `memberAccess(viewer: Viewer, now?: Date): Promise<MemberAccess>` — not a member, or switch off → `{ gated: false }`; else rows, and when there are none: `ensureTrial(id, settings.trialDays)` (only if `trialDays > 0`) and read again. Throws when the store does.
  - `passOpen(a: MemberAccess): boolean` — `!a.gated || a.state.status === "live"`
  - `PASS_EXPIRED = "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อใช้งานต่อได้ที่หน้า สมาชิก"`
  - `PASS_EXPIRED_CHAT = "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อถามต่อได้เลย\n\n[ต่ออายุสมาชิก](/membership)"`
  - `PASS_UNREADABLE = "อ่านสถานะสมาชิกไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะครับ"`

- [ ] **Step 1: Write failing store tests** (mock `@/lib/supabase/admin` as in `tests/wallet/take-round.test.ts`): `ensureTrial` swallows `{ code: "23505" }` and throws on `{ code: "XX000" }`; `addPaidPass` maps `23505` → `"duplicate"`, `23503` → `"unknown"`, success → `"added"` and inserts `days: 30`, `kind: "paid"`; `revokePaidPass` with no row → `"unknown"` and no insert; with a row → inserts `revokes: <row id>`, `days: 0`.
- [ ] **Step 2: Write failing access tests** (mock `@/lib/members/pass-store`): UnitOS viewer → `{ gated: false }` and no store call; member + switch off → `{ gated: false }`; member + switch on + no rows → `ensureTrial(id, 3)` called once, then the re-read rows decide the state; member with an expired pass → `passOpen` false; `passSettings` rejecting → `memberAccess` rejects (Review Focus 1); `ensureTrial` resolving after a `23505` race still yields one live trial (Review Focus 5 — re-read returns the one row).
- [ ] **Step 3: Run** `npx vitest run tests/members` — Expected: FAIL.
- [ ] **Step 4: Implement** both files.
- [ ] **Step 5: Run** — Expected: PASS.
- [ ] **Step 6: Commit** `git add src/lib/members/pass-store.ts src/lib/members/access.ts tests/members/pass-store.test.ts tests/members/access.test.ts && git commit -m "feat(members): pass store and member access"`

### Task 3: The gates and the per-period rounds

**Files:**
- Modify: `src/lib/auth/viewer.ts` (`gatePage`)
- Modify: `src/app/actions.ts` (`askCopilot`)
- Modify: `src/lib/auth/quota.ts` (`takeRound`, `takeFreeRound`, `allowanceOf`)
- Modify: `src/lib/quote-video/make.ts` (`createVideo`)
- Test: `tests/members/gates.test.ts`; extend `tests/wallet/take-round.test.ts`, `tests/auth/quota.test.ts`

**Interfaces:**
- Consumes: `memberAccess`, `passOpen`, `PASS_EXPIRED`, `PASS_EXPIRED_CHAT`, `PASS_UNREADABLE`, `PASS_PAGE`.
- Produces: `freeWindow(viewer: Viewer): Promise<{ limit: number; from: Date }>` exported from `quota.ts` — gated member → `roundsFrom(access.state, access.settings)` when not null; otherwise `{ limit: FREE_ROUNDS, from: FREE_ROUNDS_FROM }`. `allowanceOf` and `takeFreeRound` use it (the RPC already takes `p_limit`/`p_from`).

- [ ] **Step 1: Write failing tests:**
  - `gatePage("/home")` and `gatePage("/studio/write")` for an expired member call `redirect("/membership?expired=1")`; `gatePage("/membership")` and `gatePage("/admin/members")` never consult `memberAccess`; a UnitOS viewer is never redirected (mock `next/navigation`, `next/headers`, `@/lib/members/access`).
  - `askCopilot` for an expired member returns `{ text: PASS_EXPIRED_CHAT, model: "—" }` and asks no model; `memberAccess` rejecting → `{ text: PASS_UNREADABLE, model: "—", failed: true }`.
  - `takeRound` for an expired member → `{ ok: false, refusal: PASS_EXPIRED }` and no RPC; unreadable → `{ ok: false, refusal: PASS_UNREADABLE }`; live member → RPC called with `p_limit: 10`, `p_from: <period start ISO>`; switch off → `p_limit: FREE_ROUNDS`, `p_from: FREE_ROUNDS_FROM.toISOString()` (Review Focus 4).
  - `createVideo` for an expired member → `{ refusal: PASS_EXPIRED }`.
- [ ] **Step 2: Run** the four test files — Expected: FAIL.
- [ ] **Step 3: Implement.** In `gatePage`, after the sign-in check: when `viewer.kind === "member"` and `next` is `/home` or under `/studio`, `const access = await memberAccess(viewer)`; not `passOpen` → `redirect(\`${PASS_PAGE}?expired=1\`)`. In `askCopilot`, after the burst check. In `takeRound`, first line after the owner check. In `createVideo`, before counting free clips.
- [ ] **Step 4: Run** `npx vitest run tests/members tests/wallet tests/auth` — Expected: PASS (the existing `studio-pages-gated` test still passes: every Studio page already calls `gatePage`).
- [ ] **Step 5: Commit** `git add src/lib/auth/viewer.ts src/app/actions.ts src/lib/auth/quota.ts src/lib/quote-video/make.ts tests/members/gates.test.ts tests/wallet/take-round.test.ts tests/auth/quota.test.ts && git commit -m "feat(members): expired members are turned to the membership page; rounds per period"`

### Task 4: Checkout and the webhook

**Files:**
- Create: `src/lib/members/pass-checkout.ts`
- Modify: `src/lib/wallet/events.ts`, `src/app/api/stripe/webhook/route.ts` (doc comment only)
- Test: `tests/members/pass-checkout.test.ts`; extend `tests/wallet/events.test.ts`

**Interfaces:**
- Produces: `PASS_PURPOSE = "member_pass"`, `PASS_CHECKOUT_TAG = "member-pass-r7kq2wne"`, `passCheckoutParams(a: { memberId: string; satang: number; origin: string }): Stripe.Checkout.SessionCreateParams` — `mode: "payment"`, `client_reference_id: memberId`, one line `{ currency: "thb", unit_amount: satang, product_data: { name: "ค่าสมาชิก AdvisorTool 30 วัน" } }`, `metadata: { purpose: "member_pass", member_id }`, `success_url: \`${origin}/membership?paid={CHECKOUT_SESSION_ID}\``, `cancel_url: \`${origin}/membership\``, `integration_identifier: PASS_CHECKOUT_TAG`, `excluded_payment_method_types: ["card"]` when `satang < CARD_FROM_THB * 100`.
- Produces: `WalletAction` gains `{ kind: "pass"; sessionId: string; memberId: string; satang: number; paymentIntent: string | null }`.

- [ ] **Step 1: Write failing tests:** params at 9900 exclude the card, at 15000 do not; metadata/urls/name as above. `actionFor` of a paid `checkout.session.completed` with `metadata.purpose: "member_pass"` → `kind: "pass"` with `satang = amount_total`; the same without metadata stays `kind: "credit"`; unpaid → ignore. `applyWalletAction(pass)` calls `addPaidPass` once and returns its result; a second identical event returns `"duplicate"` (Review Focus 2). Refund: `revokePaidPass` → `"revoked"` returns `"pass-revoked"` and `clawBack` is not called; `revokePaidPass` → `"unknown"` → `clawBack` is called as today (Review Focus 3).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** In `actionFor`, after the `paid` check, read `metadata.purpose`; for a pass apply the same currency/uuid/amount/session checks (loud on failure) and return `kind: "pass"`. In `applyWalletAction`, `pass` → `addPaidPass`; `"unknown"` → `console.error` loud. In `applyClawback`, call `revokePaidPass` first; anything but `"unknown"` returns `\`pass-${r}\``.
- [ ] **Step 4: Run** `npx vitest run tests/members tests/wallet` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/members/pass-checkout.ts src/lib/wallet/events.ts src/app/api/stripe/webhook/route.ts tests/members/pass-checkout.test.ts tests/wallet/events.test.ts && git commit -m "feat(members): buy a pass through Stripe; refunds take it back"`

### Task 5: The membership page, the reminder and the menus

**Files:**
- Create: `src/app/membership/page.tsx`, `src/app/membership/MembershipClient.tsx`, `src/app/membership/actions.ts`
- Create: `src/components/shell/PassReminder.tsx`
- Modify: `src/app/home/page.tsx`, `src/app/studio/layout.tsx`, `src/lib/shell/menu.ts`
- Test: `tests/members/membership-actions.test.ts`; extend `tests/calc/shell-menu.test.ts`

**Interfaces:**
- Produces: `startPass(): Promise<{ ok: true; url: string } | { ok: false; error: string }>` — refuses non-members ("หน้านี้สำหรับสมาชิกทั่วไปครับ"), switch off ("ตอนนี้สมาชิกใช้งานได้ฟรี ยังไม่ต้องต่ออายุครับ"), Stripe failure ("เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); price from `passSettings()`.
- Produces: `passConfirmed(sessionId: string): Promise<boolean>` — validates `/^cs_(test|live)_[A-Za-z0-9]+$/`, then `passPaid(sessionId, viewer.agentId)`.
- Produces: `PassReminder({ end, now, priceSatang }: { end: string; now: string; priceSatang: number })` — renders only when `0 < daysLeft ≤ REMIND_DAYS`: "สมาชิกเหลืออีก {n} วัน (ถึง {d MMM})" + link "ต่ออายุ ฿{price}" to `/membership`.
- `Who` gains nothing; menus read `who.member`.

- [ ] **Step 1: Write failing tests:** `startPass` for a UnitOS agent, switch off, and a member (Stripe mocked → url; params built with the settings' satang); `passConfirmed` rejects a malformed id without a DB call. Menu: `menuGroups(true, { …, member: true })` contains `/membership` labelled "สมาชิก"; without `member` it does not; `studioMenu({ …, member: true, wallet: true })` contains `/membership`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `page.tsx`: `gatePage("/membership")`; not a member → `redirect("/home")`; read `memberAccess`, rows, `passSettings`, `allowanceOf`, `balanceSatang`; wrap in `AppShell who={whoOf(viewer)}`. States and copy as in the mockup (https://claude.ai/artifact/MadFA5nKvS2M2pb4Eg2krP): trial "ทดลองใช้ฟรีถึง {date}", paid "ใช้ได้ถึง {date}", expired "หมดอายุแล้ว" + "เงินในกระเป๋า Studio {balance} ยังอยู่ครบ ใช้ได้อีกเมื่อต่ออายุ"; rounds box "Studio ฟรีเหลือ {left}/{limit} รอบ"; button "ต่ออายุ 30 วัน ฿{price}" with "จ่ายด้วยพร้อมเพย์" below ฿150 else "พร้อมเพย์ หรือ บัตร"; history list (ทดลองใช้ฟรี · +3 วัน / จ่าย ฿99 · +30 วัน / เพิ่มให้โดยเจ้าของ · +N วัน · note / ยกเลิกเพราะคืนเงิน); switch off → "ตอนนี้สมาชิกใช้งานได้ฟรี". Dates in `th-TH`, `Asia/Bangkok`.
  - `MembershipClient.tsx`: the button calls `startPass` and assigns `window.location`; with `?paid=` it polls `passConfirmed` every 2 s up to 30 s showing "กำลังยืนยันการชำระเงิน…", then `router.refresh()` (the pattern in `WalletClient.tsx`).
  - `/home` and Studio layout: compute `memberAccess` (the page's `gatePage` already let the viewer in) and render `PassReminder` above the content when `gated` and live.
  - `menu.ts`: `{ href: "/membership", label: "สมาชิก", icon: "key", hue: "#2b736f" }` in the first main-menu group when `who?.member`, and in `studioMenu` before "บัญชีของฉัน" for members.
- [ ] **Step 4: Run** `npx vitest run tests/members tests/calc/shell-menu.test.ts && npx tsc --noEmit -p .` — Expected: PASS, no type errors outside `tests/scratch`.
- [ ] **Step 5: Commit** `git add src/app/membership src/components/shell/PassReminder.tsx src/app/home/page.tsx src/app/studio/layout.tsx src/lib/shell/menu.ts tests/members/membership-actions.test.ts tests/calc/shell-menu.test.ts && git commit -m "feat(members): membership page, reminder bar, menu item"`

### Task 6: The owner's settings and member list

**Files:**
- Modify: `src/lib/wallet/admin-input.ts`, `src/app/admin/wallet/actions.ts`, `src/app/admin/wallet/page.tsx`, `src/app/admin/wallet/WalletAdmin.tsx`
- Modify: `src/lib/auth/member-store.ts` (`listMembers`, `MemberSummary`), `src/app/admin/members/actions.ts`, `src/app/admin/members/page.tsx`, `src/app/admin/members/MembersAdmin.tsx`
- Test: extend `tests/wallet/admin-input.test.ts`, `tests/wallet/admin-actions.test.ts`; `tests/members/admin-members.test.ts`

**Interfaces:**
- Produces: `readPassSettings(raw: { enabled: boolean; baht: string; trialDays: string; rounds: string }): { ok: true; value: PassSettings } | { ok: false; error: string }` — baht a whole or 2-decimal number 1–1000 → satang; trial days integer 0–30; rounds integer 0–100.
- Produces: `saveMemberPass(raw)` action in `admin/wallet/actions.ts` (named apart from the store's `savePassSettings`) — **owner only** (`requireStaff("owner")`), audit `"member-pass-settings"`, revalidate `/admin/wallet` and `/admin/members`.
- Produces: `MemberSummary` gains `pass: { status: "none" | "live" | "expired"; end: string | null; trial: boolean } | null` (null when the switch is off) and `freeLimit: number`; `freeUsed` counts from each member's window: `roundsFrom(passState(rows, now), settings)` from `passRowsOf`, falling back to `FREE_ROUNDS`/`FREE_ROUNDS_FROM` (not one `memberAccess` per member).
- Produces: `grantPassDays(id: string, days: string, note: string)` action in `admin/members/actions.ts` — `requireStaff("admin")`, days integer 1–365, note trimmed ≤ 200 chars and required, `grantPass(id, n, note, viewer.agentId)`, audit `"member-pass-grant"`.

- [ ] **Step 1: Write failing tests:** `readPassSettings` accepts `"99"` → 9900, rejects `"0"`, `"1001"`, `"9.999"`, trial `"31"`, rounds `"-1"`; `saveMemberPass` refuses an admin who is not the owner; `grantPassDays` rejects `"0"`, `"366"`, an empty note, a bad uuid, and saves `30` with the note.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** `WalletAdmin.tsx`: box "ค่าสมาชิกทั่วไป" with the switch "เก็บค่าสมาชิกทั่วไป (ปิดอยู่ = สมาชิกทุกคนใช้ฟรีเหมือนวันนี้)", fields "ราคาต่อ 30 วัน (บาท)", "ทดลองใช้ฟรี (วัน)", "Studio ฟรีต่อ 30 วัน (รอบ)", note "ราคาต่ำกว่า ฿150 จ่ายได้แค่พร้อมเพย์", editable only when `canPrice`. `MembersAdmin.tsx`: tiles จ่ายอยู่ / ทดลองใช้ / หมดอายุ / ค่าสมาชิกเดือนนี้ (from `passRevenueSatang(monthStart())`), column "ใช้ได้ถึง" as chips (green paid/granted live, amber trial or ≤ 3 days, red expired), "รอบฟรี" as `{used}/{limit}`, and a "เพิ่มวัน" inline form (days, note). Hint on `/admin/members` reads the switch state.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit -p .` — Expected: whole suite PASS.
- [ ] **Step 5: Commit** `git add <each modified file and test listed above> && git commit -m "feat(members): owner sets the pass and grants days"`

### Task 7: Verify and hand over

- [ ] **Step 1:** `npx vitest run` and `npx tsc --noEmit -p .` — all pass.
- [ ] **Step 2:** Browser check what can be seen without signing in: `/membership` signed out redirects to `/?next=%2Fmembership`; `/lifeprotect` still 200. Signed-in screens need the owner; say so.
- [ ] **Step 3:** Compare the built screens with the mockup; list any difference for the owner before pushing (e.g. the menu item reads "สมาชิก" without the days left).
- [ ] **Step 4:** Report: migration `20261027_member_pass.sql` to apply to prod before push; switch stays off; Stripe webhook needs no new event types.
