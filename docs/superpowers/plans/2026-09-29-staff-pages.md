# ผูกทีมงานกับเพจ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ทีมงานลงโพสต์เห็นและจัดการได้เฉพาะเพจที่เจ้าของผูกไว้; เจ้าของตั้งค่าที่หน้าทีมงาน

**Architecture:** ตาราง `ins_staff_pages` + ฟังก์ชันกลาง `myPages()` ใน `src/lib/auth/pages.ts`; ทุกจุดใน Studio ที่อ่านเพจหรือโพสต์ใช้ตัวนี้; หน้ารวมเปิดให้ทีมงานลงโพสต์

**Tech Stack:** Next.js 15, TypeScript, Supabase (service role), vitest

**Spec:** `docs/superpowers/specs/2026-09-29-staff-pages-design.md`

## Global Constraints

- เจ้าของและ `can_admin` = ทุกเพจ; `can_publish` = เพจที่ผูก; ยังไม่ผูก = ไม่มีเพจ; ไม่มีสิทธิ์ลงโพสต์ = ไม่มีเพจ
- ตั้งต้น: 118880 = ทุกเพจ (105982528649026, 1431905706931225, 103716981993581, 102297731679773) · 112514 และ 117685 = 102297731679773
- ตั้งเพจได้เฉพาะเจ้าของ, เฉพาะเพจที่เชื่อมอยู่, ไม่แตะแถวเจ้าของ, บันทึก `audit("staff-pages", agentId, { pages })`

## Review Focus

1. ทีมงานส่ง pageId ของเพจอื่นมาเอง (ไม่ผ่านหน้าจอ) ตอนโพสต์/ตั้งเวลา/ย้าย → ต้องถูกปฏิเสธที่เซิร์ฟเวอร์ — Task 2
2. ทีมงานยกเลิกคิวหรือลบชิ้นที่ตั้งเวลาไว้บนเพจอื่น → ปฏิเสธ — Task 2
3. ทีมงานที่ถูกเอาเพจออกระหว่างเปิดหน้าไว้ → คำขอถัดไปถูกปฏิเสธ (อ่านสิทธิ์สดทุกคำขอ) — Task 1
4. เพจที่ตัดการเชื่อมไปแล้วแต่ยังผูกอยู่ → ไม่แสดง — Task 1
5. ทีมงานไม่มีเพจเลยเปิด /studio → ได้หน้ารวมที่บอกว่ายังไม่มีเพจ ไม่ error — Task 3

---

### Task 1: ตาราง + `myPages()`

**Files:** Create `supabase/migrations/20260929_staff_pages.sql`, `src/lib/auth/pages.ts`, `tests/auth/pages.test.ts`

**Produces:** `myPages(): Promise<PageConnection[]>`, `myPageIds(): Promise<Set<string>>`, `seesEveryPage(viewer: Viewer | null): boolean`, `staffPageIds(agentId: string): Promise<string[]>`

- [ ] เทสต์ที่ fail: เจ้าของ/แอดมินได้ทุกเพจ; ทีมงานได้เฉพาะที่ผูกและยังเชื่อมอยู่; ไม่ผูก = []; ไม่มีสิทธิ์ลงโพสต์ = []; ไม่ล็อกอิน = [] (mock `getViewer`, `pageConnections`, `supabaseAdmin`)
- [ ] migration:
```sql
create table if not exists public.ins_staff_pages (
  agent_id uuid not null references public.ins_staff(agent_id) on delete cascade,
  page_id text not null,
  created_at timestamptz not null default now(),
  primary key (agent_id, page_id)
);
alter table public.ins_staff_pages enable row level security;
```
- [ ] `pages.ts`:
```ts
export const seesEveryPage = (v: Viewer | null) => can(v, "admin");
export async function staffPageIds(agentId: string): Promise<string[]> // select page_id where agent_id
export async function myPages(): Promise<PageConnection[]> {
  const v = await getViewer(); if (!v) return [];
  const all = await pageConnections();
  if (seesEveryPage(v)) return all;
  if (!can(v, "publish")) return [];
  const mine = new Set(await staffPageIds(v.agentId));
  return all.filter((p) => mine.has(p.pageId));
}
export async function myPageIds() { return new Set((await myPages()).map((p) => p.pageId)); }
```
- [ ] apply migration to Supabase + seed (Global Constraints) — ใช้ agent_id จาก `agents.agent_code`
- [ ] รันเทสต์ผ่าน · commit

### Task 2: บังคับที่เซิร์ฟเวอร์

**Files:** Modify `src/app/studio/publish.ts` (publishSetup), `src/lib/content/publish-flow.ts` (clear, withdraw), `src/lib/content/logo-store.ts`, `src/app/api/content-people/route.ts`, `src/app/studio/people/page.tsx`, `src/app/studio/StudioPage.tsx`, `src/app/studio/calendar/page.tsx`, `src/app/studio/page.tsx`; Tests: `tests/content/publish-flow.test.ts`, `tests/content/logo-store.test.ts`

- [ ] เทสต์ที่ fail: `publish()` กับเพจที่ไม่อยู่ใน `myPages` → `{ ok:false }` ไม่เรียก Facebook; `withdraw()` ของชิ้นบนเพจอื่น → ปฏิเสธ; `mayUseLogo` โลโก้ของเพจที่ไม่ใช่ของตน (ทีมงาน) → false; `logoOwner(pageอื่น)` → agent เอง
- [ ] `clear()`: `(await myPages().catch(() => [])).find(...)` แทน `pageConnections()`; ข้อความเมื่อไม่พบ: "ไม่พบเพจนี้ในเพจที่คุณดูแล — เลือกเพจก่อน"
- [ ] `withdraw()`: ถ้า `!(await myPageIds()).has(p.pageId)` → `{ ok:false, error: "โพสต์นี้อยู่ในเพจที่คุณไม่ได้ดูแล" }`
- [ ] `publishSetup` / `logoOwner` / `mayUseLogo` (page logo: `myPageIds().has(page_id)`; agent logo: ตัวเองหรือ `seesEveryPage`) / people route + page / StudioPage: ใช้ `myPages()`
- [ ] ปฏิทิน + หน้ารวม: กรอง `listPublished` ด้วย `pageId ∈ myPageIds` (pageId null แสดงเมื่อ `seesEveryPage`)
- [ ] รันเทสต์ + tsc · commit

### Task 3: หน้ารวมและเมนูสำหรับทีมงาน

**Files:** Modify `src/app/studio/page.tsx`, `src/lib/shell/menu.ts`, `src/app/studio/layout.tsx`, `src/lib/content/studio-home.ts`; Tests: `tests/calc/shell-menu.test.ts`, `tests/content/studio-home.test.ts`

- [ ] เทสต์ที่ fail: เมนูของทีมงานลงโพสต์ (ไม่ใช่ admin) มี "/studio"; ของ agent ทั่วไปไม่มี · `homeCards` ของทีมงานที่ไม่มีเพจ → การ์ดห้องพร้อมข้อความ "ยังไม่มีเพจที่ดูแล — ให้เจ้าของเพิ่มที่หน้าทีมงาน"
- [ ] `/studio`: redirect ไป /studio/write เฉพาะคนที่ไม่มีทั้ง admin และ publish; brand + เมนู "หน้ารวม" ตามกันนั้น
- [ ] `homeCards`: `pages = []` ของทีมงาน (ไม่ใช่ admin) → subtitle บอกให้ขอเจ้าของ และไม่มีช่องการตั้งค่า (การตั้งค่าเพจเป็นของหลังบ้าน)
- [ ] รันเทสต์ · commit

### Task 4: หน้าทีมงาน — ติ๊กเพจต่อคน

**Files:** Modify `src/app/admin/team/actions.ts`, `src/app/admin/team/Team.tsx`, `src/app/admin/team/page.tsx`; Test: `tests/admin/team-pages.test.ts`

- [ ] เทสต์ที่ fail: `setStaffPages(agentId, ids)` — ไม่ใช่เจ้าของ → throw; เพจที่ไม่ได้เชื่อม → ปฏิเสธ; แถวเจ้าของ → ปฏิเสธ; สำเร็จ → ลบของเดิม ใส่ชุดใหม่ + audit
- [ ] `listStaff` คืน `pages: string[]` ต่อคน; `page.tsx` ส่งรายชื่อเพจที่เชื่อม (`pageConnections`) ให้ `Team`
- [ ] `Team.tsx`: แถวละกลุ่ม checkbox ชื่อเพจ (เมื่อ `publish` ติ๊ก และไม่ใช่ `admin`); admin แสดง "เห็นทุกเพจ"
- [ ] รันเทสต์ · commit

### Task 5: ตรวจทั้งหมด

- [ ] `npx tsc --noEmit` → `npx eslint src tests` → `npx vitest run` → `NEXT_DIST_DIR=.next-build npx next build` ทีละคำสั่ง
- [ ] query ยืนยันข้อมูลตั้งต้นในฐานข้อมูล
