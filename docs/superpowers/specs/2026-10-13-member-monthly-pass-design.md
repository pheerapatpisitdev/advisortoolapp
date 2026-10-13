# สมาชิกทั่วไปรายเดือน (member monthly pass) — design

Date: 2026-10-13 · Owner decisions in this conversation (all chosen by the owner).

## Goal

Outside members (`viewer.kind === "member"`, Google sign-in, `ins_members`) pay ฿199 for 30 days
to use the system. Without a live pass they cannot open ถาม AI (/home) or Studio. With one, ถาม AI
is unlimited; Studio stays as today (10 free rounds, then the wallet at the fixed prices).

Supersedes the per-question pricing mockup of the same day (free 5/day then ฿0.50): not built.

## Owner decisions

| Question | Choice |
|---|---|
| What the fee buys | Entry to /home + Studio, ถาม AI unlimited; Studio work still from the wallet |
| How members pay | A 30-day pass bought each time (PromptPay or card), no auto-renew |
| Collect how | ก: its own Stripe Checkout, not from the wallet balance |
| Price | ฿199 / 30 days, owner-editable |
| Trial | 3 days, for new signups and for every existing member from launch day |

## Who is affected

- Affected: members only (`viewer.kind === "member"`).
- Never gated: UnitOS agents, assistants, staff, the owner.
- Untouched and public: calculators, sales pages, /other-plans, Messenger/LINE bots.
- Master switch `member_pass_enabled` off = every member uses the system free, as today.

## Member side

**/membership** (new page, always reachable by a signed-in member, outside the gate):
- Status line: "ใช้ได้ถึง 12 พ.ย. 2569 · เหลือ 30 วัน" / "ทดลองใช้ฟรีถึง …" / "หมดอายุแล้ว".
- Button "ต่ออายุ 30 วัน ฿199" → Stripe Checkout. Card allowed because ฿199 ≥ `CARD_FROM_THB` (฿150);
  if the owner sets a price under ฿150 the card is left out, as with top-ups.
- History: each pass (trial / paid / added by the owner / taken back) with dates.
- Return from Stripe: same "กำลังยืนยันการชำระเงิน…" waiting pattern as the wallet page.

**Gate**: /home, every /studio page, and the server actions behind them (`askCopilot`, Studio
rounds via `takeRound`, clip/picture actions) refuse an expired member. Pages redirect to
`/membership?expired=1`, which shows "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อใช้งานต่อ". Actions return a
refusal with a link to /membership. Wallet money stays; the wallet page is not reachable while
expired (it lives under /studio), /membership says the balance is kept.

**Reminder**: from 3 days before the end, a bar on /home and Studio: "สมาชิกเหลืออีก 2 วัน · ต่ออายุ".
No email, LINE or push (not asked for).

**Renew early**: the new 30 days start at the current end, not today. Two payments = 60 days.

**Sign-in landing**: unchanged (/home). An expired member is sent on to /membership by the gate.

## Owner side

**/admin/wallet** — new box "ค่าสมาชิกทั่วไป": price per 30 days (฿199), trial days (3),
on/off switch. Owner-only to edit, like the price table.

**/admin/members** — existing table gains:
- column "ใช้ได้ถึง", coloured: green paid, amber trial or ≤3 days left, red expired;
- button "เพิ่มวัน": days + note (e.g. "โอนพร้อมเพย์ตรง", "แจกโปรโมชั่น"), written to the pass ledger
  and `ins_audit`;
- summary above the table: paying · on trial · expired · pass revenue this month.

## Data

New table `ins_member_passes` (append-only ledger; the live end date is derived):

| column | type | note |
|---|---|---|
| id | bigserial pk | |
| member_id | uuid not null → ins_members.id | |
| kind | text | `trial` · `paid` · `granted` · `revoked` |
| days | int | +30, +3, +N; `revoked` rows carry the negative days of the pass they cancel |
| amount_satang | int null | what Stripe charged, for `paid` |
| stripe_session_id | text unique null | idempotency for webhook retries |
| payment_intent | text null | to find the pass on refund/dispute |
| note | text null | owner's note for `granted`, reason for `revoked` |
| created_by | uuid null | owner for `granted` |
| created_at | timestamptz default now() | |

**End date** = fold over rows in `created_at` order: `end = max(end, created_at) + days` for
positive rows; a `revoked` row subtracts its days from `end` (never below its own `created_at`).
One pure function `passEnd(rows, now)` in `src/lib/members/pass.ts`, unit-tested; no stored end
column to drift. A member's rows are few (one per month), read per request with the viewer.

Settings in `ins_ai_settings`: `member_pass_enabled bool default false`,
`member_pass_satang int default 19900`, `member_trial_days int default 3`.

Trial: a `trial` row is written the first time `passOf(member)` finds no rows (new signup, or an
existing member on first visit after launch), so the 3 days count from that visit. One trial per
member, ever: written only when the member has no rows at all.

## Payment flow

1. /membership "ต่ออายุ" → server action → Checkout Session, `mode: "payment"`,
   `client_reference_id = member id`, `metadata: { purpose: "member_pass", days: "30" }`, inline
   price from settings, its own `integration_identifier` so the Dashboard tells it from top-ups.
2. Webhook (`src/app/api/stripe/webhook/route.ts`): `checkout.session.completed` /
   `async_payment_succeeded` with `metadata.purpose === "member_pass"` → new action kind
   `pass` → insert a `paid` row (+30, `amount_total`, session id unique). Top-up sessions keep
   their current path; `actionFor` branches on `purpose` first.
3. `charge.refunded` / `charge.dispute.created` whose payment intent belongs to a `paid` pass row →
   insert a `revoked` row (−30) with the reason. Partial refunds revoke the whole pass (simplest,
   owner can grant days back). Unknown intents fall through to the wallet clawback path as today.

Failures: a paid session that cannot be matched is logged `loud` like the wallet path.

## Testing

- `passEnd`: trial only, paid on top of trial, renew early, renew after expiry, revoke, grant.
- `actionFor`: pass sessions vs top-up sessions, unpaid, wrong currency, refund of a pass intent.
- Gate: member expired/live/switch off, UnitOS agent never gated (`/home`, a Studio page,
  `askCopilot`, `takeRound`).
- Menu: no change for agents; members get "สมาชิก" in the main menu.
- Browser: /membership as a member needs the owner's sign-in; Stripe test-mode checkout locally.

## Rollout

1. Migration (table + 3 settings) applied to prod before push; switch stays **off**.
2. Push; owner checks /admin/wallet and /admin/members.
3. Owner turns the switch on → every existing member gets 3 trial days from their next visit.

## Out of scope

Auto-renew, email/LINE reminders, coupons, yearly plans, per-question pricing, charging
UnitOS agents.
