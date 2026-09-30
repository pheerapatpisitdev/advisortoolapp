# กระเป๋าเงิน Studio เติมผ่าน Stripe — design

วันที่: 2026-09-30 · เจ้าของตอบในแชท: กระเป๋าเงินบาทตัดตามต้นทุนจริง · ใช้ฟรีก่อน หมดแล้วตัดกระเป๋า · ต้นทุน × ตัวคูณ · PromptPay + บัตร · รายตัวแทน รวมห้องทดลอง · Stripe Checkout แบบ hosted (A) · ยอดเติม 50/100/150/200/500

## เป้าหมาย

ตัวแทนทั่วไปใช้ AI ใน Studio ได้เดือนละ 20 รอบ (ห้องทดลอง 5) แล้วต้องรอเดือนใหม่
ให้เขาเติมเงินเข้ากระเป๋าของตัวเองผ่าน Stripe และใช้ต่อได้ทันทีเมื่อโควตาฟรีหมด โดยจ่ายตามต้นทุนจริงของงาน × ตัวคูณที่เจ้าของตั้ง
เจ้าของไม่ต้องอนุมัติทีละคน และงบกลางของเจ้าของไม่ถูกใช้ไปกับงานที่ผู้ใช้จ่ายเอง

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| เงินซื้ออะไร | กระเป๋าเงินบาท ตัดตามต้นทุนจริงของรอบ AI นั้น |
| กับโควตาฟรี | ใช้โควตาฟรีรายเดือนก่อน หมดแล้วจึงตัดกระเป๋า — โควตาเดิมไม่เปลี่ยน |
| ราคา | `ต้นทุนจริง (cost_thb) × ตัวคูณ` ตัวคูณตั้งที่ /admin/ai ค่าเริ่มต้น ×2 |
| กระเป๋าของใคร | รายตัวแทน (`agents.id`) — ทุกคนที่เข้า Studio ได้ รวมห้อง trialing · staff ไม่มีกระเป๋า (ใช้ฟรีเหมือนเดิม) |
| ยอดเติม | ปุ่มสำเร็จรูป ฿50 · ฿100 · ฿150 · ฿200 · ฿500 (ไม่มีช่องกรอกยอดเอง) |
| ช่องทางจ่าย | PromptPay QR + บัตร ผ่าน Stripe Checkout แบบ hosted |
| บัตรกับยอดเล็ก | **ค่าเริ่มต้นที่เสนอ:** ฿50/฿100 จ่ายได้เฉพาะ PromptPay (ค่าธรรมเนียมบัตรมีส่วนคงที่ต่อรายการ กินยอดเล็กมาก) · ฿150 ขึ้นไปได้ทั้งคู่ — รอเจ้าของยืนยัน |
| หมดอายุ / คืนเงิน | ไม่หมดอายุ · ไม่คืนเป็นเงินสดในแอป — ถ้าต้องคืน เจ้าของ refund ใน Stripe Dashboard แล้วปรับยอดด้วยมือที่ /admin/ai |
| ยอดติดลบ | ไม่ได้ — ต้องมีเงินพอสำหรับยอดจองก่อนเริ่มรอบ |
| งบกลางเจ้าของ | รอบที่จ่ายจากกระเป๋า **ไม่นับ** ในเพดานคอนเทนต์ `content_budget_thb` · ยัง **นับ** ในงบรวมรายเดือน `monthly_budget_thb` (ดู "ความเสี่ยง") |
| ไม่เปลี่ยน | การนับโควตาฟรี · สิทธิ์ staff · ค่าสมาชิกห้องของ UnitOS · การโพสต์ Facebook |

## สิ่งที่ผู้ใช้เห็น

- **ป้ายยอดเงินบนแถบ Studio** "💳 ฿84.20" กดไป `/studio/wallet` — staff ไม่เห็น · ซ่อนเมื่อเจ้าของปิดการเติมเงิน
- **หน้า `/studio/wallet`**
  - ยอดคงเหลือ + "เหลือ 3/20 รอบฟรีเดือนนี้"
  - ปุ่มเติม 5 ปุ่ม (ปุ่ม ฿50/฿100 เขียนใต้ว่า "PromptPay")
  - ประวัติ 30 รายการล่าสุด: "เติม +฿100.00" · "เขียนโพสต์ −฿2.40" · "ปรับโดยเจ้าของ +฿20.00 (เหตุผล)"
- **เมื่อโควตาฟรีหมด** ข้อความปฏิเสธเดิมใน `overAllowance` เปลี่ยนเป็น
  - เงินพอ → ไม่ปฏิเสธ รอบเริ่มเลย จบแล้วบอก "ใช้จากกระเป๋า ฿2.40 · คงเหลือ ฿81.80"
  - เงินไม่พอ → "โควตาฟรีเดือนนี้หมดแล้ว — เติมเงินเพื่อใช้ต่อ (คงเหลือ ฿0.80)" + ปุ่ม **เติมเงิน** ไป `/studio/wallet`
  - เจ้าของปิดการเติมเงิน → ข้อความเดิมทุกคำ
- **กลับจาก Stripe**
  - สำเร็จ → `/studio/wallet?paid=<session_id>` แสดง "กำลังยืนยันการชำระเงิน…" ถามสถานะทุก 2 วินาที (สูงสุด 60 วินาที) จนรายการเติมเป็น `paid` แล้วแสดงยอดใหม่ · เกินเวลา → "ยังไม่ได้รับการยืนยัน ยอดจะเข้าเองเมื่อ Stripe แจ้ง"
  - ยกเลิก → `/studio/wallet` ไม่มีอะไรเปลี่ยน

**ฝั่งเจ้าของ (`/admin/ai`)** ส่วนใหม่ "กระเป๋าเงินตัวแทน"
- สวิตช์เปิด/ปิดการเติมเงินและการใช้กระเป๋า (ค่าเริ่มต้น **ปิด**)
- ตัวคูณราคา (ทศนิยม ≥ 1, ค่าเริ่มต้น 2)
- ตารางกระเป๋า: ชื่อตัวแทน · ยอดคงเหลือ · เติมรวมเดือนนี้ · ใช้รวมเดือนนี้ · ปุ่ม "ปรับยอด" (จำนวน ± + เหตุผลบังคับ)

## การทำงาน

### ข้อมูล — `supabase/migrations/20260930_wallet.sql`

เงินเก็บเป็น **สตางค์ (`bigint`)** ทุกที่ ไม่มีทศนิยม

```sql
-- ยอดคงเหลือ (available = ยอดที่ยังไม่ถูกจอง)
create table public.ins_wallets (
  agent_id       uuid primary key references public.agents(id) on delete cascade,
  balance_satang bigint not null default 0 check (balance_satang >= 0),
  updated_at     timestamptz not null default now()
);

-- สมุดบัญชี เพิ่มได้อย่างเดียว · balance = ผลรวม amount_satang ต่อคน − ยอดที่จองค้าง
create table public.ins_wallet_entries (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  kind          text not null check (kind in ('topup','charge','adjust')),
  amount_satang bigint not null,           -- + เข้า, − ออก
  cost_thb      numeric,                   -- charge: ต้นทุนจริงก่อนคูณ (ไว้หักออกจากเพดานคอนเทนต์)
  round         text,                      -- charge: ai-write, ai-draw, …
  stripe_session_id text unique,           -- topup: กันเติมซ้ำเมื่อ webhook ส่งซ้ำ
  note          text,                      -- adjust: เหตุผล (บังคับ)
  created_by    uuid,                      -- adjust: เจ้าของที่ปรับ
  created_at    timestamptz not null default now()
);
create index on public.ins_wallet_entries (agent_id, created_at desc);

-- เงินที่จองไว้ระหว่างรอบกำลังทำงาน
create table public.ins_wallet_holds (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  amount_satang bigint not null check (amount_satang > 0),
  round         text not null,
  created_at    timestamptz not null default now()
);

-- รายการเติมที่เปิดไว้ที่ Stripe (ไว้แสดงสถานะหลังกลับมา + ตรวจย้อน)
create table public.ins_wallet_topups (
  stripe_session_id text primary key,
  agent_id      uuid not null references public.agents(id) on delete cascade,
  amount_satang bigint not null,
  status        text not null default 'open' check (status in ('open','paid','failed','expired')),
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

alter table public.ins_ai_settings add column if not exists wallet_enabled boolean not null default false;
alter table public.ins_ai_settings add column if not exists wallet_multiplier numeric not null default 2 check (wallet_multiplier >= 1);
```

ทุกตารางเปิด RLS ไม่มี policy (อ่าน/เขียนผ่าน service role เหมือนตารางอื่น)

**ฟังก์ชัน Postgres** — การเปลี่ยนยอดทุกอย่างผ่านฟังก์ชันเหล่านี้เท่านั้น แต่ละตัว `select … for update` แถว `ins_wallets` ก่อน จึงปลอดภัยเมื่อหลายรอบเริ่มพร้อมกัน

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `ins_wallet_credit_topup(session_id, agent_id, amount)` | ถ้า `stripe_session_id` นี้มี entry แล้ว → ไม่ทำอะไร คืน false · ไม่งั้น upsert wallet, +balance, entry `topup`, topups.status = `paid` คืน true |
| `ins_wallet_hold(agent_id, amount, round)` | ถ้า balance ≥ amount → −balance, สร้าง hold คืน hold id · ไม่พอ → คืน null |
| `ins_wallet_settle(hold_id, cost_thb, multiplier)` | charge = min(ceil(cost_thb × multiplier × 100), hold) · balance += hold − charge · entry `charge` (−charge, cost_thb, round) · ลบ hold · คืน charge |
| `ins_wallet_release(hold_id)` | balance += hold · ลบ hold (ไม่มี entry) |
| `ins_wallet_adjust(agent_id, amount, note, by)` | ± balance (ต้องไม่ติดลบ) · entry `adjust` |
| `ins_wallet_sweep_holds()` | release ทุก hold ที่เก่ากว่า 15 นาที (คำขอที่ตายกลางทาง) — เรียกก่อนอ่านยอด เหมือน `sweepHolds` เดิม |

ต้นทุนเกินยอดจองไม่ตัดเพิ่ม เจ้าของรับส่วนเกินเอง ยอดจึงไม่มีวันติดลบ

### การจ่ายค่ารอบ — `src/lib/wallet/`

`takeRound()` ใน `src/lib/auth/quota.ts` วันนี้คืน `string | null` (ข้อความปฏิเสธ)
เปลี่ยนให้คืนว่ารอบนี้ใครจ่าย:

```ts
type RoundPass =
  | { ok: false; refusal: string; topUp: boolean }   // topUp: แสดงปุ่มเติมเงิน
  | { ok: true; paidBy: "staff" | "free" }
  | { ok: true; paidBy: "wallet"; holdId: string };
```

1. staff → `staff`
2. ยังมีโควตาฟรี → เขียน `ins_audit` เหมือนเดิม → `free`
3. โควตาหมด + `wallet_enabled` → `ins_wallet_hold(agent, ยอดจองของรอบ × ตัวคูณ)` ได้ → เขียน `ins_audit` (นับรอบไว้เป็นประวัติ) → `wallet` · ไม่ได้ → ปฏิเสธ `topUp: true`
4. โควตาหมด + ปิดกระเป๋า → ข้อความเดิม

**ยอดจองต่อรอบ** (บาท ก่อนคูณ) ค่าคงที่ใน `src/lib/wallet/holds.ts` ตั้งจาก ledger จริง เผื่อราว 3 เท่าของค่าเฉลี่ย — ตัวเลขจริงคำนวณตอนทำแผนจาก `ins_content.cost_thb` และ ledger เดือนกันยายน

**หลังรอบจบ** ทุกที่ที่เรียก `takeRound` (≈8 จุด: `studio/actions.ts` 191/293/310/325/681, `api/content-claim/route.ts` 51/80, recruit-run, claim-run, one-call-run) ต้องเรียกอย่างใดอย่างหนึ่งใน `finally`:
- สำเร็จ → `settleRound(pass, costThb)` — `costThb` คือผลรวมต้นทุนของรอบที่ runner รู้อยู่แล้ว (ชิ้นงานเก็บ `cost_thb` ไว้) · ตรวจตอนทำแผนว่า runner ทั้ง 6 แบบคืนต้นทุนรวมได้ ถ้าตัวไหนไม่ได้ ให้ส่งตัวสะสมต้นทุนผ่าน AI client
- ล้มเหลว / โยน error → `releaseRound(pass)` คืนเงินจองทั้งหมด
- `free` / `staff` → ไม่ทำอะไร

**เพดานคอนเทนต์ของเจ้าของ** — รอบ `wallet` ข้าม `holdContentBudget` · และ `contentSpentThisMonth()` หักผลรวม `cost_thb` ของ entry `charge` เดือนนี้ออก เพื่อให้เงินที่ผู้ใช้จ่ายไม่กินเพดาน ฿30 ของเจ้าของ (ไม่ต้องแก้ schema ของ `ins_usage_ledger`)

### Stripe

- แพ็กเกจ `stripe` (Node, `^22.6`) · API version `2026-08-26.dahlia` ตรึงไว้ในโค้ด · สร้าง client เป็น instance เดียวใน `src/lib/stripe/client.ts` (server-only)
- env: `STRIPE_SECRET_KEY` (ใช้ **restricted key `rk_…`** สิทธิ์ Checkout Sessions: write เท่านั้น) · `STRIPE_WEBHOOK_SECRET` · เพิ่มใน `.env.example`
- พัฒนาใน **Stripe sandbox แยก** ไม่ใช่ live · live key ใส่ใน Vercel ตอนปล่อยจริงเท่านั้น

**สร้างรายการเติม** — server action `startTopUp(amountThb)` ใน `src/app/studio/wallet/actions.ts`
1. `requireMember` · ตรวจ `wallet_enabled` · ตรวจยอดอยู่ในชุด 50/100/150/200/500 (ไม่รับยอดจาก client เป็นตัวเลขอิสระ)
2. `checkout.sessions.create`:
   - `mode: "payment"` · `currency: "thb"` · line item `price_data` แบบ inline (unit_amount สตางค์, ชื่อ "เติมเงิน Studio ฿100") — ไม่ต้องสร้าง Product ใน Dashboard
   - **ไม่ส่ง `payment_method_types`** — เปิด PromptPay + บัตรใน Dashboard (payment method settings) · ยอด ฿50/฿100 ส่ง `excluded_payment_method_types: ["card"]`
   - `client_reference_id: agentId` · `metadata: { agent_id, amount_satang }`
   - `success_url: {site}/studio/wallet?paid={CHECKOUT_SESSION_ID}` · `cancel_url: {site}/studio/wallet`
   - `integration_identifier: "studio-wallet-<8 ตัวอักษรสุ่ม>"`
   - ไม่เปิด `automatic_tax`
3. insert `ins_wallet_topups` (status `open`) · redirect ไป `session.url`

**Webhook** — `src/app/api/stripe/webhook/route.ts` (แบบเดียวกับ webhook Facebook)
- อ่าน raw body `req.text()` · ตรวจลายเซ็นด้วย `webhooks.constructEvent(body, stripe-signature, STRIPE_WEBHOOK_SECRET)` ไม่ผ่าน → 400
- `checkout.session.completed` และ `payment_status === "paid"` → credit
- `checkout.session.async_payment_succeeded` → credit
- `checkout.session.async_payment_failed` → topups.status = `failed`
- `checkout.session.expired` → topups.status = `expired`
- credit = `ins_wallet_credit_topup(session.id, session.client_reference_id, session.amount_total)` — ใช้ยอดที่ Stripe เก็บจริง ไม่ใช่ metadata · ตรวจว่า `currency === "thb"` และ agent_id ตรงกับแถว topups ที่เปิดไว้ ไม่ตรง → log แล้วไม่ credit
- ตอบ 200 เมื่อ credit แล้ว หรือเป็น event ที่ไม่สนใจ · DB ล้ม → 500 ให้ Stripe ส่งซ้ำ (ฟังก์ชัน credit กันซ้ำให้แล้ว)
- ตั้ง endpoint ใน Dashboard ให้ส่งเฉพาะ 4 event ข้างบน

**หน้า success ไม่เติมเงินเอง** — ถามแค่ `ins_wallet_topups.status` ของ session ที่เป็นของผู้ถามเท่านั้น

## ความผิดพลาดและกรณีขอบ

| กรณี | ผล |
|---|---|
| webhook ส่งซ้ำ / มาพร้อมกัน 2 event | `stripe_session_id unique` → เติมครั้งเดียว |
| ผู้ใช้กด 2 รอบพร้อมกัน เงินพอรอบเดียว | row lock ใน `ins_wallet_hold` → รอบที่สองได้ null → ปฏิเสธพร้อมปุ่มเติมเงิน |
| AI ล้มกลางรอบ | `finally` → release คืนเต็มจำนวน |
| คำขอตายก่อนถึง finally (Vercel timeout) | hold ค้าง → sweep คืนหลัง 15 นาที |
| ต้นทุนจริงเกินยอดจอง | ตัดเท่ายอดจอง เจ้าของรับส่วนเกิน · log ไว้ให้ปรับยอดจอง |
| เจ้าของปิดกระเป๋าระหว่างมี hold | hold ที่ค้างยัง settle/release ตามปกติ · รอบใหม่ใช้กระเป๋าไม่ได้ · ยอดยังอยู่ |
| ตัวแทนถูกลบจาก UnitOS | cascade ลบกระเป๋า — ยอดที่เหลือหายไป (ดู "ความเสี่ยง") |
| refund / dispute ใน Stripe | ไม่ทำอัตโนมัติ เจ้าของปรับยอดด้วยมือ |

## การทดสอบ

- **Vitest (pure)** `tests/wallet/`:
  - การปัดเงินเป็นสตางค์ (ceil) และ min กับยอดจอง
  - `takeRound` ตัดสินใจถูก 4 ทาง (staff / free / wallet / ปฏิเสธ + topUp)
  - แปลง Stripe event → การกระทำ (credit / failed / expired / ไม่สน) รวมกรณี `payment_status !== "paid"` และสกุลเงินผิด
  - ยอดเติมนอกชุด 5 ยอดถูกปฏิเสธ · ยอดเล็กได้ `excluded_payment_method_types: ["card"]`
- **ฟังก์ชัน SQL** ทดสอบกับ Supabase branch/local: credit ซ้ำ, hold ไม่พอ, settle เกินยอดจอง, sweep
- **ปลายทางจริงใน sandbox**:
  - `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  - จ่ายด้วยบัตรทดสอบ และ PromptPay ทดสอบ
  - ส่ง event ซ้ำด้วย `stripe events resend`
  - ตรวจยอด + ประวัติบนหน้า
- `npm run verify` ผ่านก่อน merge

## นอกขอบเขต

- ใบกำกับภาษี / VAT (ใช้ใบเสร็จอีเมลของ Stripe เท่านั้น)
- เติมเงินอัตโนมัติ, สมาชิกรายเดือน, ช่องกรอกยอดเอง
- โอนเงินระหว่างตัวแทน, กระเป๋าระดับห้อง
- รับ refund/dispute จาก Stripe อัตโนมัติ
- Checkout แบบฝังในหน้า (แบบ B) — ย้ายได้ทีหลังโดยใช้ backend/webhook เดิม

## ความเสี่ยงที่เจ้าของควรรู้

1. **งบรวมรายเดือน** `monthly_budget_thb` ยังนับต้นทุนรอบที่ผู้ใช้จ่ายเอง ถ้าคนเติมเงินใช้เยอะ บอท Messenger อาจเงียบเร็วขึ้น — ต้องขึ้นงบรวมตามรายรับกระเป๋า หรือตัดสินใจภายหลังให้ไม่นับ
2. **เงินค้างในกระเป๋าเมื่อตัวแทนออก** — cascade ลบ ยอดที่เหลือหาย · ถ้าต้องคืน ต้องทำก่อนลบใน UnitOS
3. **กฎหมาย** — การรับเงินล่วงหน้าเก็บไว้ในระบบ (stored value) อาจเข้าข่ายกฎ e-money ของ ธปท. แม้ใช้ได้กับบริการของตัวเองเท่านั้น และรายได้นี้มีภาระภาษี ควรถามผู้ให้คำปรึกษาก่อนเปิดใช้จริง
4. **บัญชี Stripe** ต้องเป็นบัญชีไทยและเปิด PromptPay ใน Dashboard แล้ว ไม่งั้น PromptPay จะไม่ขึ้นในหน้าจ่าย
