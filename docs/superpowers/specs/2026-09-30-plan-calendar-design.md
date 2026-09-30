# ปฏิทินวางแผนสำหรับตัวแทนทั่วไป — design

วันที่: 2026-09-30 · เจ้าของอนุมัติในแชท (ส่วนที่ 1 และ 2: "โอเค")

## เป้าหมาย

ตัวแทนทั่วไป (ไม่อยู่ในทีมงาน ไม่มีเพจ) ยังไม่มีปฏิทิน เพราะปฏิทินตอนนี้คือการโพสต์/ตั้งเวลาลง Facebook จริง
ให้มีปฏิทิน **วางแผน**: วางชิ้นงานลงวันที่จะโพสต์ ระบบไม่โพสต์เอง ถึงวันตัวแทนคัดลอก/บันทึกรูปไปโพสต์เองแล้วกด "โพสต์แล้ว"

## สิ่งที่ตกลงกัน

| เรื่อง | ตัดสินใจ |
|---|---|
| ปฏิทินทำอะไร | วางแผนอย่างเดียว ไม่เชื่อม Facebook (การเชื่อมเพจของตัวแทนเองยังพักไว้) |
| ใครได้ | ผู้ที่ไม่มีสิทธิ์ลงโพสต์ (ตัวแทนทั่วไป) — ผู้ช่วยและเจ้าของใช้ปฏิทิน Facebook เดิม |
| เตือน | เห็นตอนเปิด Studio: แถบ "วันนี้มีงานตามแผน N ชิ้น" — ไม่มี LINE/อีเมล |
| ประเภทที่วางได้ | ทุกแบบ: โพสต์ สคริปต์ โฆษณา |
| วัน/เวลา | วันอย่างเดียว ไม่มีเวลา · วันละหลายชิ้นได้ · ชิ้นละ 1 วัน |
| เก็บที่ไหน | ช่องใหม่บนชิ้นงาน `plan_day`, `planned_done_at` (แนวทาง 1) — ไม่แตะช่องโพสต์ Facebook |
| ไม่เปลี่ยน | การโพสต์ Facebook · ปฏิทินของผู้ช่วย/เจ้าของ · การมองเห็น (ตัวแทนเห็นแค่ของตัวเอง) |

## สิ่งที่ผู้ใช้เห็น

- **เมนู Studio** มี "ปฏิทินโพสต์" ให้ทุกคน ของตัวแทนเปิดแล้วเป็นปฏิทินวางแผน (มุมมองเดือน + รายการ)
- **แถบข้าง** ชิ้นที่ยังไม่มีวัน (รอตรวจ + ใช้จริง, ทุกประเภท) — ลากลงวัน หรือกดวันแล้วเลือกชิ้น
- **ในวัน** ย้ายวัน · เอาออกจากแผน · เปิดชิ้นงาน · "โพสต์แล้ว" (กดซ้ำเพื่อยกเลิก)
- วางหรือย้ายไปวันที่ผ่านมาแล้วไม่ได้ · "เขียนโพสต์ใหม่สำหรับวันนี้" ไป `/studio/write?day=…`
- **สถานะบนการ์ด** วางไว้ · วันนี้ · ค้าง (เลยวันแล้วยังไม่กดโพสต์แล้ว) · โพสต์แล้ว
- **editor** ตัวแทนเห็นช่อง "วางแผน" (เลือกวัน / โพสต์แล้ว / เอาออก) แทนช่องลงเพจ; มาจาก `?day=` จะเลือกวันนั้นไว้ให้
- **หน้าเขียนงาน** แถบ "วันนี้มีงานตามแผน N ชิ้น" (ที่ยังไม่กดโพสต์แล้ว) กดเปิดชิ้นนั้นได้

## การทำงาน

### ข้อมูล — `supabase/migrations/20260930_content_plan.sql`

```sql
alter table public.ins_content add column if not exists plan_day date;
alter table public.ins_content add column if not exists planned_done_at timestamptz;
create index if not exists ins_content_plan_day on public.ins_content (plan_day) where plan_day is not null;
```

### กติกา — `src/lib/content/plan.ts` (ฟังก์ชันล้วน)

- `planState(day, doneAt, today)` → `"done"` ถ้ามี doneAt · `"overdue"` ถ้า day < today · `"today"` ถ้า day = today · `"planned"`
- `mayPlanOn(day, today)` → day เป็น `YYYY-MM-DD` ที่ถูกต้อง และ ≥ today (วันตามเวลาไทย จาก `todayKey()`)
- ชิ้นที่แสดงในปฏิทิน/แถบ = สถานะ `draft` หรือ `used` (ชิ้นในถังขยะไม่แสดง)

### store — `src/lib/content/store.ts` (ผ่าน `ownersFilter` เดิม)

- `ContentItem.plan: { day: string; doneAt: string | null } | null`
- `listPlanned(from: string, to: string)` · `listUnplanned(limit)` · `setPlan(id, day | null)` (ล้าง `planned_done_at` ด้วยเมื่อเอาออก) · `setPlanDone(id, done: boolean)`

### server actions — `src/app/studio/plan.ts` ("use server")

- `planPiece({ id, day })` · `unplanPiece(id)` · `markPlanDone({ id, done })`
- ทุกตัว: `requireMember()` → `getContent(id)` (ชิ้นของคนอื่นได้ null → "ไม่พบชิ้นงานนี้") → ตรวจ `mayPlanOn` (เฉพาะวาง/ย้าย) → เขียน
- คืน `{ ok: true, item } | { ok: false, error }` ข้อความไทย

### หน้าจอ

- `src/lib/shell/menu.ts` ไม่ซ่อน "ปฏิทินโพสต์" จากผู้ไม่มีสิทธิ์ลงโพสต์อีก
- `src/app/studio/calendar/page.tsx`: `can(viewer, "publish")` → ปฏิทิน Facebook เดิม; ไม่ใช่ → `PlanBoard` (ไม่เรียก `publishSetup`/`verifyDue`)
- `src/app/studio/calendar/PlanBoard.tsx` (client) ใช้ `monthGridDays` และมุมมองรายการร่วมกับของเดิม
- `PieceEditor`: ไม่มีสิทธิ์ลงโพสต์ → `PlanPanel` แทน `PublishPanel` (ทุกประเภท)
- `StudioPage` อ่านชิ้นตามแผนของวันนี้ (ยังไม่เสร็จ) ส่งให้ `ContentStudio` แสดงแถบ

## ลำดับขึ้นระบบ

1. รัน migration บน Supabase จริง (`cenysylrzbwfrtuqoeqk`) — เพิ่มช่องอย่างเดียว
2. push `main` → Vercel deploy · 3. เช็ก `/api/health`, runtime error

## การทดสอบ

unit: `planState` ทุกสถานะ · `mayPlanOn` (วันนี้ได้, เมื่อวานไม่ได้, รูปแบบผิดไม่ได้) · action ปฏิเสธชิ้นของคนอื่นและวันย้อนหลัง ·
`markPlanDone` · store กรองตามเจ้าของ + สถานะ draft/used · เมนูแสดงปฏิทินให้ตัวแทน · หน้าปฏิทินแยกตามสิทธิ์ ·
ตรวจรวม `tsc` → `eslint` → `vitest run` → `NEXT_DIST_DIR=.next-build next build`
