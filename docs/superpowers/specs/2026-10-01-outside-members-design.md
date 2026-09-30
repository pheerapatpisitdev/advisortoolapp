# สมาชิกทั่วไป (ลูกค้านอก UnitClub) สมัครและล็อกอินที่ advisortool — design

วันที่: 2026-10-01 · เจ้าของตอบในแชท: PIN 6 หลักลูกค้าตั้งเอง · ได้ใช้ Studio เท่าสมาชิก · ตารางสมาชิกของ advisortool เอง (แนวทาง A) · รอบฟรี 10 รอบทันที ยอมเสี่ยง กันด้วยจำกัดต่อ IP · ลูกค้านอกเริ่มต้นที่ advisortool เลย ไม่ผ่าน UnitOS

## เป้าหมาย

ตอนนี้คนที่เข้า Studio ได้มีแต่ตัวแทนที่อยู่ในห้อง UnitOS (`public.agents` บน UnitClub) เท่านั้น
ให้ตัวแทนนอก UnitOS สมัครเองที่ advisortool ด้วยเบอร์โทร + PIN 6 หลักที่ตั้งเอง แล้วใช้ Studio ได้เหมือนสมาชิก UnitOS:
รอบฟรี 10 รอบ แล้วเติมเงินกระเป๋าจ่ายต่อรอบ
UnitOS ไม่รู้จักคนกลุ่มนี้ และไม่มีอะไรเปลี่ยนสำหรับสมาชิก UnitOS

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| ใครคือลูกค้านอก | ใครก็ได้ที่สมัครที่ `/signup` — ไม่ต้องมีห้อง UnitOS |
| บัญชีอยู่ที่ไหน | ตารางใหม่ `ins_members` บน UnitClub — **ไม่** เพิ่มแถวใน `agents` (จะไปยิง trigger ของ UnitOS: seat limit, แจ้งสมัคร, ประกาศต้อนรับ และจะเข้า UnitOS ได้) |
| ล็อกอินด้วยอะไร | เบอร์โทร + PIN 6 หลักที่ลูกค้าตั้งเอง — ไม่ใช้ PIN อย่างเดียว เพราะคนละคนตั้งซ้ำกันได้ และหน้าสมัครจะบอกว่ารหัสไหนมีคนใช้ = บอกรหัสที่ล็อกอินได้ |
| ได้ใช้อะไร | Studio เท่าสมาชิก UnitOS ที่ไม่ใช่ staff: รอบฟรี `FREE_ROUNDS` (10) ครั้งเดียว แล้วจ่ายจากกระเป๋า · ไม่มีสิทธิ์ back office / ปฏิทิน / เพจ |
| กันสมัครหลายบัญชีเอารอบฟรี | ไม่มี OTP · จำกัดการสมัคร 3 บัญชีต่อ IP ต่อ 24 ชม. · เจ้าของยอมรับความเสี่ยงที่เหลือ |
| ลืม PIN | แอดมินตั้ง PIN ชั่วคราวให้ที่ `/admin/members` แล้วบอกลูกค้าเอง (LINE/โทร) |
| เปิดใช้เมื่อไร | สวิตช์ `member_signup_enabled` ค่าเริ่มต้นปิด — เจ้าของเปิดเองหลังลองบน production |
| สมาชิก UnitOS | ไม่เปลี่ยน: เข้าจากการ์ดใน UnitOS (SSO) หรือพิมพ์รหัสตัวแทนที่ `/login` |
| ไม่ทำรอบนี้ | OTP SMS · รีเซ็ต PIN เอง · ล็อกอินด้วย LINE · ลูกค้านอกเชื่อมเพจของตัวเอง |

## ข้อมูล

### ตารางใหม่ `ins_members`

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | รูปแบบเดียวกับ `agents.id` — cookie `ins_session` ไม่ต้องเปลี่ยน |
| `phone` | text not null unique | ตัวเลขล้วน 10 หลักขึ้นต้น 0 (`0812345678`) |
| `name` | text not null | 1–60 ตัวอักษร หลังตัดช่องว่าง |
| `pin_hash` | text not null | scrypt (`node:crypto`) + salt สุ่ม 16 byte เก็บเป็น `scrypt$N$r$p$salt$hash` |
| `status` | text not null default `'active'` | check `in ('active','suspended')` |
| `signup_ip` | text | ใช้นับการสมัครต่อ IP |
| `created_at` | timestamptz default now() | |
| `pin_changed_at` | timestamptz | ตั้งตอนเปลี่ยน/รีเซ็ต PIN — session ที่ออกก่อนเวลานี้ใช้ไม่ได้ (แบบเดียวกับ `key_epoch` ของห้อง UnitOS) |

RLS เปิด ไม่มี policy (อ่าน/เขียนผ่าน service role เท่านั้น เหมือนตาราง `ins_*` อื่น)

### ถอด foreign key ไป `agents` 7 ตัว

ให้ `agent_id` หมายถึง "ตัวแทน UnitOS หรือสมาชิกทั่วไป" ได้ (uuid ไม่ชนกัน):

`ins_content_agent_id_fkey` · `ins_people_agent_id_fkey` · `ins_audit_agent_id_fkey` · `ins_wallets_agent_id_fkey` · `ins_wallet_entries_agent_id_fkey` · `ins_wallet_holds_agent_id_fkey` · `ins_wallet_topups_agent_id_fkey`

คงไว้: `ins_staff` (agent_id, added_by) และ `ins_sso_tickets` — สองตารางนี้เป็นของสมาชิก UnitOS เท่านั้น

ผลข้างเคียง: เมื่อ UnitOS ลบตัวแทน ยอดกระเป๋าเงินและประวัติไม่ถูกลบตามแบบ cascade อีกแล้ว (ดีกว่าสำหรับเงินที่ลูกค้าจ่ายมา) · ชิ้นงาน/คนในคลังของตัวแทนที่ถูกลบจะยังมี `agent_id` เดิม แทนที่จะกลายเป็น null — มองไม่เห็นจากใคร ยกเว้น staff ที่เห็นเฉพาะ `agent_id` ของ staff และแถวไม่มีเจ้าของ จึงไม่รั่ว

`ins_content.tenant_id` และ `ins_people.tenant_id` เป็นค่าว่างได้อยู่แล้ว (เช็กแล้ว 2026-10-01) — สมาชิกทั่วไปเขียน `tenant_id = null`

### สวิตช์

`ins_ai_settings.member_signup_enabled boolean not null default false` — แถวเดียวกับ `wallet_enabled`
`ins_ai_settings.member_contact_url text` — ลิงก์ "ติดต่อแอดมิน" ที่หน้า `/login` (เช่น LINE OA ของเจ้าของ) ตั้งที่ `/admin/members`
ปิด = หน้า `/signup` บอกว่ายังไม่เปิดรับสมัคร · คนที่สมัครไว้แล้วยังล็อกอินได้

## ตัวตน (src/lib/auth/)

- `Viewer` เพิ่ม `kind: "unitos" | "member"` · `tenantId` เป็น `string | null`
  สมาชิกทั่วไป: `tenantId = null`, `tenantSlug = ""`, `tenantName = "สมาชิกทั่วไป"`, `trial = false`, `staff = null`, `code = phone`
- `admitMember(row, issuedAt)` ฟังก์ชันล้วนใน `access.ts`: `null` ถ้า `status !== 'active'` หรือ `issuedAt < pin_changed_at`
- `getViewer()`: อ่าน cookie → `agentById` → ถ้าไม่เจอ `memberById` → `admitMember` · ยังอ่านใหม่ทุก request เหมือนเดิม ระงับแล้วหลุดตั้งแต่คลิกถัดไป
- `Scope.owner.tenantId` เป็น `string | null`
- `placedBy()` เลิก embed `agent:agents(...)` ผ่าน FK — อ่าน `ins_audit` แล้วหาชื่อจาก `agents` และ `ins_members` ด้วย `in(id, ...)` แยก
- ไฟล์ใหม่ `src/lib/auth/member.ts`: `normalizePhone`, `validPin`, `hashPin`, `verifyPin` (ใช้ `timingSafeEqual`), `memberById`, `memberByPhone`, `createMember`, `setPin`, `setStatus`
- รอบฟรี (`quota.ts`) และกระเป๋าเงิน (`src/lib/wallet/`) นับด้วย `agent_id` อยู่แล้ว — ใช้กับสมาชิกทั่วไปได้โดยไม่ต้องแก้ ยกเว้นที่อ่าน `tenantId` ต้องรับ null

## หน้า

### `/signup` (ใหม่ ใครก็เข้าได้)

- ช่อง: ชื่อ · เบอร์โทร · PIN 6 หลัก · PIN อีกครั้ง · ติ๊กยอมรับ `/privacy`
- ลำดับตรวจใน server action:
  1. สวิตช์ปิด → "ยังไม่เปิดรับสมัคร"
  2. IP นี้สมัครครบ 3 บัญชีใน 24 ชม. (นับจาก `ins_members.signup_ip`) → "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้"
  3. ชื่อว่าง / เบอร์ไม่ใช่ 10 หลักขึ้นต้น 0 / PIN ไม่ใช่ 6 หลัก / PIN สองช่องไม่ตรง / ไม่ติ๊ก → บอกช่องที่ผิด
  4. PIN ที่เดาง่าย (ตัวเดียวซ้ำ `000000`, เรียง `123456` / `654321`) → "PIN นี้เดาง่ายเกินไป"
  5. เบอร์มีแล้ว → "เบอร์นี้สมัครไว้แล้ว" + ลิงก์ `/login` (บอกได้ เพราะเบอร์อย่างเดียวล็อกอินไม่ได้)
  6. insert (ชนกัน unique ระหว่างทาง = ข้อ 5) → `startSession(member.id)` → redirect `/studio`
- ลิงก์ "สมัครใช้ Studio" จากหน้าแรกและเมนูเมื่อยังไม่ล็อกอิน — แสดงเฉพาะเมื่อสวิตช์เปิด

### `/login` (แก้)

- สองแท็บ: **"สมาชิกทั่วไป"** (เบอร์ + PIN, แท็บแรก) · **"ตัวแทน UnitOS"** (รหัส 6 หลัก, action เดิม)
- ตัวนับเดิม `ins_login_attempts` ใช้ร่วมกันทั้งสองแท็บ: ผิด 5 ครั้งต่อ IP ใน 15 นาที → รอ
- ตัวนับเพิ่มต่อเบอร์: ผิด 5 ครั้งต่อเบอร์ใน 15 นาที (จากทุก IP) → รอ — เพิ่มคอลัมน์ `phone text` ใน `ins_login_attempts`
- ข้อความผิดข้อความเดียวสำหรับ "ไม่มีเบอร์นี้" / "PIN ผิด" / "ถูกระงับ": "เบอร์หรือ PIN ไม่ถูกต้อง เหลืออีก N ครั้ง"
- ลิงก์ "ยังไม่มีบัญชี? สมัครใช้ Studio" (เมื่อสวิตช์เปิด) · "ลืม PIN? ติดต่อแอดมิน" ลิงก์ไป `member_contact_url` (ว่าง = แสดงเป็นข้อความเฉย ๆ — ในแอปยังไม่มีลิงก์ LINE OA)

### `/account` (ใหม่ เฉพาะสมาชิกทั่วไป)

- เปลี่ยน PIN: PIN เดิม + PIN ใหม่สองครั้ง (กฎเดียวกับตอนสมัคร) → `setPin` ตั้ง `pin_changed_at = now()` แล้ว `startSession` ใหม่ให้เครื่องนี้ (เครื่องอื่นหลุด)
- แก้ชื่อที่แสดง
- สมาชิก UnitOS ที่เข้าหน้านี้ → redirect `/studio`

### `/admin/members` (ใหม่ ต้องสิทธิ์ `admin`)

- สวิตช์ "เปิดรับสมัครสมาชิกทั่วไป" (`member_signup_enabled`) · ช่อง "ลิงก์ติดต่อแอดมิน" (`member_contact_url`, ต้องขึ้นต้น `https://`)
- ตาราง: ชื่อ · เบอร์ · วันสมัคร · สถานะ · ยอดกระเป๋า · รอบฟรีที่ใช้ (x/10) · ค้นหาด้วยชื่อหรือเบอร์
- ปุ่มต่อแถว: **รีเซ็ต PIN** (แอดมินกรอก PIN ชั่วคราวตามกฎเดียวกัน → `setPin`) · **ระงับ / เปิดคืน**
- ทุกการกดเขียน `audit("member-pin-reset" | "member-suspend" | "member-reinstate" | "member-signup-switch", memberId)`
- เพิ่มในเมนู back office ถัดจาก "ทีมงาน"

### ส่วนอื่นที่แตะ

- แถบ Studio / เมนู: `whoOf()` ใช้ `tenantName` = "สมาชิกทั่วไป" · สมาชิกทั่วไปมีลิงก์ "บัญชีของฉัน" ไป `/account`
- `/studio/wallet` และ Stripe webhook: ไม่ต้องแก้ นอกจากรับ `tenantId` null (metadata ใช้ `agent_id`)
- `/sso`: ไม่แตะ (UnitOS เท่านั้น)

## ข้อผิดพลาด

- อ่านฐานข้อมูลไม่ได้ตอนล็อกอิน/สมัคร → "ระบบขัดข้อง ลองใหม่อีกครั้ง" ไม่บอกรายละเอียด · log ฝั่ง server
- hash PIN ช้าโดยตั้งใจ (scrypt N=16384) — ล็อกอินหนึ่งครั้ง ~50ms รับได้
- สมัครพร้อมกันเบอร์เดียว → unique ตัดสิน คนที่สองได้ข้อความ "เบอร์นี้สมัครไว้แล้ว"

## การทดสอบ (vitest, เขียนเทสต์ก่อน)

- `member.ts`: `normalizePhone` (ขีด/ช่องว่าง/+66 → 0…, ปฏิเสธที่ไม่ใช่ 10 หลัก) · `validPin` + PIN เดาง่าย · `hashPin`/`verifyPin` (ถูก, ผิด, hash เพี้ยน)
- `access.ts`: `admitMember` — active ผ่าน · suspended ไม่ผ่าน · session ออกก่อน `pin_changed_at` ไม่ผ่าน
- `getViewer`: เจอใน `agents` ใช้ UnitOS · ไม่เจอแล้วเจอใน `ins_members` ได้ `kind: "member"` · ไม่เจอทั้งคู่ได้ null
- กฎจำกัดต่อ IP / ต่อเบอร์ เป็นฟังก์ชันล้วนรับจำนวนนับ
- `scope`: สมาชิกทั่วไปเห็นเฉพาะแถวของตัวเอง · `owner.tenantId` เป็น null
- `quota.allowanceOf` กับ viewer สมาชิกทั่วไป: limit 10
- `placedBy`: ได้ชื่อทั้งจาก `agents` และ `ins_members`
- เทสต์เดิมทั้งหมดต้องผ่าน (`npm test`, `npx tsc --noEmit`, `npm run lint`)

## ลำดับการปล่อย

โค้ดเก่าบน production ใช้ `agent:agents(...)` ผ่าน FK ของ `ins_audit` ถ้าถอด FK ก่อน ปฏิทินจะอ่านชื่อ "โดย" ไม่ได้ จึงต้องเรียง:

1. **ปล่อยโค้ดชุด 1:** `placedBy()` ไม่พึ่ง FK (ใช้ได้ทั้งก่อนและหลังถอด) — เจ้าของ push `main`
2. **migration บน UnitClub** (`cenysylrzbwfrtuqoeqk`): สร้าง `ins_members` · ถอด FK 7 ตัว · `member_signup_enabled` + `member_contact_url` · `ins_login_attempts.phone`
3. **ปล่อยโค้ดชุด 2:** `/signup` `/login` `/account` `/admin/members` — สวิตช์ยังปิด — เจ้าของ push `main`
4. เจ้าของลองสมัครด้วยเบอร์ตัวเองบน production (ต้องเปิดสวิตช์ชั่วคราว) → ใช้รอบฟรี → เติมเงิน → ใช้ต่อ → เปิดสวิตช์ถาวรเมื่อพอใจ

ย้อนกลับ: ปิดสวิตช์ (ไม่มีคนสมัครเพิ่ม) · ระงับสมาชิกรายคนได้ · FK ใส่คืนได้ถ้ายังไม่มีแถวของสมาชิกทั่วไปในตารางเหล่านั้น

## ความเสี่ยงที่ยอมรับ

- **ฟาร์มรอบฟรี:** คนเดียวสมัครหลายเบอร์จากหลายเครือข่ายได้ — เจ้าของยอมรับ (2026-10-01) · ถ้าเกิดจริง ทางแก้ต่อไปคือ OTP หรือปลดรอบฟรีหลังเติมเงินครั้งแรก
- **เบอร์ไม่ได้ยืนยัน:** ใครจะใส่เบอร์คนอื่นสมัครก็ได้ เจ้าของเบอร์ตัวจริงจะสมัครไม่ได้ → ติดต่อแอดมินให้ระงับ/รีเซ็ต
- **PIN 6 หลัก:** 1 ล้านแบบ · ตัวนับต่อเบอร์ทำให้เดาได้ไม่เกิน ~480 ครั้งต่อวันต่อเบอร์ (~0.05%) · ห้าม PIN เดาง่าย
- **เงินในกระเป๋า:** ใช้ PIN อย่างเดียวคุมเงินที่เติม — ยอมรับได้ในระดับยอดเติม ฿50–500
