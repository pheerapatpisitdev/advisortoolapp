# ปฏิทินวางแผนสำหรับตัวแทนทั่วไป — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ตัวแทนที่ไม่มีสิทธิ์ลงโพสต์ได้ปฏิทินวางแผน: วางชิ้นงานลงวัน, กด "โพสต์แล้ว", และเห็นงานของวันนี้ตอนเปิด Studio — โดยไม่แตะการโพสต์ Facebook

**Architecture:** สองช่องใหม่บน `ins_content` (`plan_day`, `planned_done_at`) · กติกาเป็นฟังก์ชันล้วนใน `src/lib/content/day-plan.ts` · store อ่าน/เขียนผ่านขอบเขตเดิม (`ownersFilter`, `getContent`) · server actions ใน `src/app/studio/plan.ts` · `/studio/calendar` แยกตามสิทธิ์: ลงโพสต์ได้ = ปฏิทิน Facebook เดิม, ไม่ได้ = `PlanCalendar` · editor แสดง `PlanPanel` แทน `PublishPanel` ให้ผู้ไม่มีสิทธิ์ลงโพสต์

**Tech Stack:** Next.js 15 (App Router, server actions), TypeScript, Supabase (service role, PostgREST), vitest

**Spec:** `docs/superpowers/specs/2026-09-30-plan-calendar-design.md`

## Global Constraints

- ปฏิทินวางแผนไม่เรียก Facebook เลย: ไม่ใช้ `publishSetup`, `verifyDue`, `publish-flow`
- ใครได้: ผู้ที่ `can(viewer, "publish")` เป็นเท็จ · ผู้ช่วยและเจ้าของ (ลงโพสต์ได้) ใช้ปฏิทิน Facebook เดิม
- วางได้ทุกประเภท (post, script, ad) · ชิ้นสถานะ `draft`/`used` เท่านั้น · ชิ้นละ 1 วัน · วันละหลายชิ้น · ไม่มีเวลา
- วางหรือย้ายไปวันก่อน `todayKey()` (เวลาไทย) ไม่ได้ — ตรวจที่ server · "โพสต์แล้ว" กดได้ทุกเมื่อ กดซ้ำเพื่อยกเลิก
- เอาออกจากแผน หรือย้ายวัน = ล้าง `planned_done_at`
- การมองเห็นเหมือนเดิม: ทุกการอ่าน/เขียนผ่าน `ownersFilter` / `getContent` (src/lib/auth/scope.ts)
- migration: `supabase/migrations/20260930_content_plan.sql` · Supabase project `cenysylrzbwfrtuqoeqk`
- ข้อความถึงผู้ใช้ภาษาไทย · comment ภาษาอังกฤษตามแบบไฟล์ พร้อมวันที่ของเจ้าของ
- คำสั่งตรวจ: `npx vitest run <file>` · `npx tsc --noEmit` · `npx eslint` · `NEXT_DIST_DIR=.next-build npx next build`

## Review Focus

1. ชิ้นที่วางไว้แล้วถูกทิ้งลงถังขยะ → หายจากปฏิทินและแถบวันนี้ ไม่ค้าง — Task 1 (test store กรอง `draft`/`used`)
2. ตัวแทนส่ง id ชิ้นของคนอื่นมาเอง → ปฏิเสธ "ไม่พบชิ้นงานนี้" ไม่เขียนอะไร — Task 2
3. วันรูปแบบผิดหรือวันที่ไม่มีจริง (`2026-02-30`) → ปฏิเสธ ไม่บันทึก — Task 1 (`mayPlanOn`) และ Task 2
4. ย้ายชิ้นที่กด "โพสต์แล้ว" ไปวันใหม่ → กลับเป็นยังไม่โพสต์ — Task 1 (test `setPlan` ล้าง `planned_done_at`)
5. ผู้ช่วย/เจ้าของเปิด `/studio/calendar` → ยังได้ปฏิทิน Facebook เดิม ไม่ใช่ปฏิทินวางแผน — Task 3

---

### Task 1: ข้อมูล กติกา และ store

**Files:**
- Create: `supabase/migrations/20260930_content_plan.sql`
- Create: `src/lib/content/day-plan.ts`
- Modify: `src/lib/content/store.ts` (`ContentItem`, `COLUMNS`, `toItem`, เพิ่ม `listPlanned`, `listUnplanned`, `setPlan`, `setPlanDone`)
- Modify: `tests/content/publish-flow.test.ts` (`piece`), `tests/content/actions-page.test.ts` (`make`) — เติม `plan: null`
- Test: `tests/content/day-plan.test.ts` (ใหม่), `tests/content/store-plan.test.ts` (ใหม่)

**Interfaces:**
- Produces: `type PlanState = "planned" | "today" | "overdue" | "done"` · `planState(day: string, doneAt: string | null, today: string): PlanState` · `mayPlanOn(day: string, today: string): boolean` · `PLAN_LABEL: Record<PlanState, string>` · `planTitle(item: ContentItem): string` · `ContentItem.plan: { day: string; doneAt: string | null } | null` · `listPlanned(from: string, to: string): Promise<ContentItem[]>` · `listUnplanned(limit?: number): Promise<ContentItem[]>` · `setPlan(id: string, day: string | null): Promise<ContentItem>` · `setPlanDone(id: string, done: boolean): Promise<ContentItem>`

- [ ] **Step 1: migration**

`supabase/migrations/20260930_content_plan.sql`:

```sql
-- A planning calendar for agents with no Page (owner, 2026-09-30): a piece is put on a day and
-- the agent posts it themselves. Nothing here reaches Facebook; the publish_* columns are untouched.
alter table public.ins_content add column if not exists plan_day date;
alter table public.ins_content add column if not exists planned_done_at timestamptz;
create index if not exists ins_content_plan_day on public.ins_content (plan_day) where plan_day is not null;
```

ยังไม่รันบนฐานข้อมูลจริง — Task 5

- [ ] **Step 2: test ที่ล้ม — `tests/content/day-plan.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { mayPlanOn, PLAN_LABEL, planState, planTitle } from "@/lib/content/day-plan";

const TODAY = "2026-09-30";

describe("a planned piece's state (owner, 2026-09-30)", () => {
  it("is done once the agent says so, whatever the day", () => {
    expect(planState("2026-09-01", "2026-09-01T09:00:00Z", TODAY)).toBe("done");
    expect(planState("2026-10-05", "2026-09-30T09:00:00Z", TODAY)).toBe("done");
  });

  it("is today's, still ahead, or overdue by the day", () => {
    expect(planState(TODAY, null, TODAY)).toBe("today");
    expect(planState("2026-10-01", null, TODAY)).toBe("planned");
    expect(planState("2026-09-29", null, TODAY)).toBe("overdue");
  });

  it("says each state in Thai", () => {
    expect(PLAN_LABEL).toEqual({ planned: "วางไว้", today: "วันนี้", overdue: "ค้าง", done: "โพสต์แล้ว" });
  });
});

describe("the days a piece may be planned on", () => {
  it("today and any day after", () => {
    expect(mayPlanOn(TODAY, TODAY)).toBe(true);
    expect(mayPlanOn("2027-01-15", TODAY)).toBe(true);
  });

  it("never a day gone, a day that does not exist, or something that is not a day", () => {
    for (const day of ["2026-09-29", "2026-02-30", "2026-13-01", "30/09/2026", "", "2026-9-30"]) expect(mayPlanOn(day, TODAY)).toBe(false);
  });
});

describe("a planned piece's title", () => {
  it("is its first opening line, cut short", () => {
    const item = { output: { hooks: ["หัวเรื่องที่ยาวมาก".repeat(10)] } } as never;
    expect(planTitle(item).length).toBeLessThanOrEqual(60);
    expect(planTitle({ output: { hooks: [] } } as never)).toBe("ชิ้นงาน");
  });
});
```

- [ ] **Step 3: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/day-plan.test.ts`
Expected: FAIL — `Cannot find module '@/lib/content/plan'`

- [ ] **Step 4: `src/lib/content/day-plan.ts`**

```ts
import type { ContentItem } from "./store";

/**
 * The planning calendar of an agent with no Page (owner, 2026-09-30): a piece is put on a day,
 * the agent posts it themselves and says so. Days are Bangkok days ("YYYY-MM-DD", todayKey()).
 */

export type PlanState = "planned" | "today" | "overdue" | "done";

export const PLAN_LABEL: Record<PlanState, string> = { planned: "วางไว้", today: "วันนี้", overdue: "ค้าง", done: "โพสต์แล้ว" };

export function planState(day: string, doneAt: string | null, today: string): PlanState {
  if (doneAt) return "done";
  if (day < today) return "overdue";
  return day === today ? "today" : "planned";
}

/** a real day, today or later: a day gone is not planned for */
export function mayPlanOn(day: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day && day >= today;
}

/** what a card on the calendar says: the piece's first opening line */
export function planTitle(item: Pick<ContentItem, "output">): string {
  const first = item.output.hooks[0]?.trim();
  if (!first) return "ชิ้นงาน";
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}
```

- [ ] **Step 5: รันให้ผ่าน**

Run: `npx vitest run tests/content/day-plan.test.ts`
Expected: PASS

- [ ] **Step 6: test ที่ล้ม — `tests/content/store-plan.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The planning calendar's reads and writes, within the asker's own pieces (owner, 2026-09-30). */

const db = vi.hoisted(() => {
  const calls: unknown[][] = [];
  const answer = { value: { data: [] as unknown, error: null } };
  /** a PostgREST query that writes down every step and answers `answer.value` when awaited */
  const query = (): unknown => {
    const q: unknown = new Proxy({}, {
      get: (_t, key) => key === "then"
        ? (resolve: (v: unknown) => void) => resolve(answer.value)
        : (...args: unknown[]) => { calls.push([key, ...args]); return q; },
    });
    return q;
  };
  return { calls, answer, query };
});
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: () => db.query() }) }));
vi.mock("@/lib/auth/scope", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/scope")>()),
  currentScope: async () => ({ agents: ["a1"], unowned: false, pages: [], owner: null }),
}));

const { listPlanned, listUnplanned, setPlan, setPlanDone } = await import("@/lib/content/store");

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const row = { id: ID, agent_id: "a1", page_id: null, output: { hooks: ["หัว"] }, flags: {}, status: "draft", plan_day: "2026-10-01", planned_done_at: null };

beforeEach(() => {
  db.calls.length = 0;
  db.answer.value = { data: [row], error: null };
});
const has = (...call: unknown[]) => db.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));

describe("the planned pieces of a month", () => {
  it("are the asker's own, still in รอตรวจ or ใช้จริง, between the grid's first and last day", async () => {
    const items = await listPlanned("2026-09-28", "2026-11-01");
    expect(has("gte", "plan_day", "2026-09-28")).toBe(true);
    expect(has("lte", "plan_day", "2026-11-01")).toBe(true);
    expect(has("in", "status", ["draft", "used"])).toBe(true);
    expect(has("or", "and(page_id.is.null,or(agent_id.in.(a1)))")).toBe(true);
    expect(items[0].plan).toEqual({ day: "2026-10-01", doneAt: null });
  });

  it("leave the rail only the pieces with no day", async () => {
    await listUnplanned();
    expect(has("is", "plan_day", null)).toBe(true);
    expect(has("in", "status", ["draft", "used"])).toBe(true);
    expect(has("or", "and(page_id.is.null,or(agent_id.in.(a1)))")).toBe(true);
  });
});

describe("putting a piece on a day", () => {
  it("sets the day and forgets it was posted, so a move is planned anew", async () => {
    db.answer.value = { data: row, error: null };
    await setPlan(ID, "2026-10-02");
    expect(db.calls.find((c) => c[0] === "update")?.[1]).toEqual({ plan_day: "2026-10-02", planned_done_at: null });
  });

  it("takes it off the plan", async () => {
    db.answer.value = { data: { ...row, plan_day: null }, error: null };
    await setPlan(ID, null);
    expect(db.calls.find((c) => c[0] === "update")?.[1]).toEqual({ plan_day: null, planned_done_at: null });
  });

  it("marks it posted, and unmarks it", async () => {
    db.answer.value = { data: { ...row, planned_done_at: "2026-09-30T10:00:00Z" }, error: null };
    expect((await setPlanDone(ID, true)).plan?.doneAt).toBe("2026-09-30T10:00:00Z");
    const set = db.calls.find((c) => c[0] === "update")?.[1] as { planned_done_at: string | null };
    expect(typeof set.planned_done_at).toBe("string");
    db.calls.length = 0;
    await setPlanDone(ID, false);
    expect(db.calls.find((c) => c[0] === "update")?.[1]).toEqual({ planned_done_at: null });
  });
});
```

- [ ] **Step 7: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/store-plan.test.ts`
Expected: FAIL — `listPlanned is not a function`

- [ ] **Step 8: store — `src/lib/content/store.ts`**

ใน `interface ContentItem` ต่อจาก `pageId`:

```ts
  /** the day an agent with no Page planned it for, and when they said it was posted (owner, 2026-09-30); null when not planned */
  plan: { day: string; doneAt: string | null } | null;
```

`COLUMNS` ต่อท้าย `, plan_day, planned_done_at` · ใน `toItem` ต่อจาก `pageId`:

```ts
    plan: r.plan_day ? { day: String(r.plan_day), doneAt: (r.planned_done_at as string | null) ?? null } : null,
```

ต่อจาก `adoptPage`:

```ts
/** the planning calendar keeps to pieces still in use: a piece thrown away leaves the plan with it */
const PLANNABLE = ["draft", "used"];

/** The asker's pieces planned between two days, inclusive (owner, 2026-09-30). */
export async function listPlanned(from: string, to: string): Promise<ContentItem[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS)
    .gte("plan_day", from).lte("plan_day", to).in("status", PLANNABLE);
  if (only) q = q.or(only);
  const { data, error } = await q.order("plan_day", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/** The asker's pieces with no day yet, newest first — the planning calendar's rail. */
export async function listUnplanned(limit = 60): Promise<ContentItem[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS).is("plan_day", null).in("status", PLANNABLE);
  if (only) q = q.or(only);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toItem);
}

/** A piece put on a day, moved, or taken off (null); either way it is not posted yet. The caller checks the piece is theirs. */
export async function setPlan(id: string, day: string | null): Promise<ContentItem> {
  const { data, error } = await supabaseAdmin().from("ins_content")
    .update({ plan_day: day, planned_done_at: null }).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return toItem(data as Record<string, unknown>);
}

/** The agent says a planned piece went up (or takes that back). The caller checks the piece is theirs and planned. */
export async function setPlanDone(id: string, done: boolean): Promise<ContentItem> {
  const { data, error } = await supabaseAdmin().from("ins_content")
    .update({ planned_done_at: done ? new Date().toISOString() : null }).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return toItem(data as Record<string, unknown>);
}
```

- [ ] **Step 9: fixture**

`tests/content/publish-flow.test.ts` ใน `piece`: `..., agentId: null, pageId: PAGE, plan: null,`
`tests/content/actions-page.test.ts` ใน `make`: `..., agentId: null, pageId: PAGE, plan: null,`

- [ ] **Step 10: ตรวจ**

Run: `npx vitest run tests/content/day-plan.test.ts tests/content/store-plan.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS · tsc ไม่มี error (ถ้าฟ้อง `plan` หายใน object literal อื่นของ test ให้เติม `plan: null`)

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/20260930_content_plan.sql src/lib/content/day-plan.ts src/lib/content/store.ts tests/content/day-plan.test.ts tests/content/store-plan.test.ts tests/content/publish-flow.test.ts tests/content/actions-page.test.ts
git commit -m "feat(studio): a piece can be planned for a day and marked posted, with no Page"
```

---

### Task 2: server actions ของแผน

**Files:**
- Create: `src/app/studio/plan.ts`
- Test: `tests/content/plan-actions.test.ts` (ใหม่)

**Interfaces:**
- Consumes: `mayPlanOn`, `setPlan`, `setPlanDone`, `getContent`, `todayKey`
- Produces: `type PlanResult = { ok: true; item: ContentItem } | { ok: false; error: string }` · `planPiece(input: { id: string; day: string }): Promise<PlanResult>` · `unplanPiece(id: string): Promise<PlanResult>` · `markPlanDone(input: { id: string; done: boolean }): Promise<PlanResult>`

- [ ] **Step 1: test ที่ล้ม — `tests/content/plan-actions.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Planning is checked on the server: the asker's own piece, a day not gone (owner, 2026-09-30). */

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const store = vi.hoisted(() => ({ getContent: vi.fn(), setPlan: vi.fn(), setPlanDone: vi.fn() }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("@/lib/content/calendar", async (orig) => ({ ...(await orig<typeof import("@/lib/content/calendar")>()), todayKey: () => "2026-09-30" }));

const { markPlanDone, planPiece, unplanPiece } = await import("@/app/studio/plan");

const piece = (over: object = {}) => ({ id: ID, status: "draft", plan: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  store.getContent.mockResolvedValue(piece());
  store.setPlan.mockImplementation(async (_id: string, day: string | null) => piece({ plan: day ? { day, doneAt: null } : null }));
  store.setPlanDone.mockImplementation(async (_id: string, done: boolean) => piece({ plan: { day: "2026-10-01", doneAt: done ? "t" : null } }));
});

describe("putting a piece on a day", () => {
  it("puts the asker's own piece on today or a day ahead", async () => {
    expect(await planPiece({ id: ID, day: "2026-09-30" })).toMatchObject({ ok: true, item: { plan: { day: "2026-09-30" } } });
    expect(store.setPlan).toHaveBeenCalledWith(ID, "2026-09-30");
  });

  it("refuses a day gone or not a day, and writes nothing", async () => {
    for (const day of ["2026-09-29", "2026-02-30", "x"]) expect(await planPiece({ id: ID, day })).toMatchObject({ ok: false });
    expect(store.setPlan).not.toHaveBeenCalled();
  });

  it("refuses somebody else's piece, and one in the bin", async () => {
    store.getContent.mockResolvedValueOnce(null);
    expect(await planPiece({ id: ID, day: "2026-10-01" })).toEqual({ ok: false, error: "ไม่พบชิ้นงานนี้" });
    store.getContent.mockResolvedValueOnce(piece({ status: "trashed" }));
    expect(await planPiece({ id: ID, day: "2026-10-01" })).toEqual({ ok: false, error: "ไม่พบชิ้นงานนี้" });
    expect(store.setPlan).not.toHaveBeenCalled();
  });
});

describe("taking a piece off, and saying it was posted", () => {
  it("takes the asker's own piece off", async () => {
    expect(await unplanPiece(ID)).toMatchObject({ ok: true });
    expect(store.setPlan).toHaveBeenCalledWith(ID, null);
  });

  it("marks a planned piece posted, and unmarks it", async () => {
    store.getContent.mockResolvedValue(piece({ plan: { day: "2026-10-01", doneAt: null } }));
    expect(await markPlanDone({ id: ID, done: true })).toMatchObject({ ok: true, item: { plan: { doneAt: "t" } } });
    expect(await markPlanDone({ id: ID, done: false })).toMatchObject({ ok: true, item: { plan: { doneAt: null } } });
  });

  it("will not mark a piece that is not planned", async () => {
    expect(await markPlanDone({ id: ID, done: true })).toEqual({ ok: false, error: "ชิ้นนี้ยังไม่ได้วางแผน" });
    expect(store.setPlanDone).not.toHaveBeenCalled();
  });

  it("says so in Thai when the save fails", async () => {
    store.setPlan.mockRejectedValueOnce(new Error("db down"));
    expect(await planPiece({ id: ID, day: "2026-10-01" })).toEqual({ ok: false, error: "บันทึกแผนไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/plan-actions.test.ts`
Expected: FAIL — `Cannot find module '@/app/studio/plan'`

- [ ] **Step 3: `src/app/studio/plan.ts`**

```ts
"use server";
import { requireMember } from "@/lib/auth/viewer";
import { todayKey } from "@/lib/content/calendar";
import { mayPlanOn } from "@/lib/content/day-plan";
import { getContent, setPlan, setPlanDone, type ContentItem } from "@/lib/content/store";

/**
 * The planning calendar's actions (owner, 2026-09-30): put a piece on a day, take it off, say it
 * went up. The piece must be the asker's (getContent keeps to their scope) and not in the bin,
 * and a day gone is refused here, not only on the screen.
 */

export type PlanResult = { ok: true; item: ContentItem } | { ok: false; error: string };

const NOT_FOUND = "ไม่พบชิ้นงานนี้";
const NOT_SAVED = "บันทึกแผนไม่สำเร็จ ลองใหม่อีกครั้งนะครับ";

async function mine(id: string): Promise<ContentItem | null> {
  const item = await getContent(id).catch(() => null);
  return item && item.status !== "trashed" ? item : null;
}

async function saving(write: () => Promise<ContentItem>): Promise<PlanResult> {
  try {
    return { ok: true, item: await write() };
  } catch (e) {
    console.error("plan not saved:", e);
    return { ok: false, error: NOT_SAVED };
  }
}

export async function planPiece(input: { id: string; day: string }): Promise<PlanResult> {
  await requireMember();
  const item = await mine(String(input.id));
  if (!item) return { ok: false, error: NOT_FOUND };
  if (!mayPlanOn(String(input.day), todayKey())) return { ok: false, error: "เลือกวันนี้หรือวันถัดไป — วันที่ผ่านมาแล้ววางแผนไม่ได้" };
  return saving(() => setPlan(item.id, input.day));
}

export async function unplanPiece(id: string): Promise<PlanResult> {
  await requireMember();
  const item = await mine(String(id));
  if (!item) return { ok: false, error: NOT_FOUND };
  return saving(() => setPlan(item.id, null));
}

export async function markPlanDone(input: { id: string; done: boolean }): Promise<PlanResult> {
  await requireMember();
  const item = await mine(String(input.id));
  if (!item) return { ok: false, error: NOT_FOUND };
  if (!item.plan) return { ok: false, error: "ชิ้นนี้ยังไม่ได้วางแผน" };
  return saving(() => setPlanDone(item.id, input.done === true));
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/content/plan-actions.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/plan.ts tests/content/plan-actions.test.ts
git commit -m "feat(studio): plan actions keep to the asker's own pieces and days not gone"
```

---

### Task 3: ปฏิทินวางแผนและเมนู

**Files:**
- Modify: `src/lib/shell/menu.ts` (`studioMenu`)
- Modify: `src/app/studio/calendar/page.tsx` (แยกตามสิทธิ์)
- Create: `src/app/studio/calendar/PlanCalendar.tsx` (server)
- Create: `src/app/studio/calendar/PlanBoard.tsx` (client)
- Test: `tests/calc/shell-menu.test.ts`, `tests/content/plan-calendar-page.test.ts` (ใหม่)

**Interfaces:**
- Consumes: `listPlanned`, `listUnplanned`, `planPiece`, `unplanPiece`, `markPlanDone`, `planState`, `PLAN_LABEL`, `planTitle`, `mayPlanOn`, `monthGridDays`, `parseMonth`, `shiftMonth`, `thaiMonthYear`, `thaiDayLabel`, `todayKey`
- Produces: `PlanCalendar({ params }: { params: { y?: string; m?: string; view?: string } })` · `PlanCard = { id: string; title: string; format: string; day: string | null; doneAt: string | null }` · `PlanBoard({ cells, planned, unplanned, today, listView })`

- [ ] **Step 1: test ที่ล้ม — เมนู `tests/calc/shell-menu.test.ts`**

แทน test "keeps the front page for admins and posting staff; other agents start at the workbench" บรรทัด expectation ของ `who`:

```ts
    // the calendar is every agent's: a Page's for those who post, a plan for the rest (owner, 2026-09-30)
    expect(hrefs(who)).toEqual(["/studio/write", "/studio/calendar", "/studio/hooks", "/studio/people", "/"]);
```

- [ ] **Step 2: test ที่ล้ม — `tests/content/plan-calendar-page.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** /studio/calendar is a Page's for those who post, and a plan for everyone else (owner, 2026-09-30). */

const who = vi.hoisted(() => ({ viewer: { agentId: "a1", staff: null } as unknown }));
const fb = vi.hoisted(() => ({ publishSetup: vi.fn(async () => ({ pages: [] })) }));
const store = vi.hoisted(() => ({ listPlanned: vi.fn(async () => []), listUnplanned: vi.fn(async () => []), listPublished: vi.fn(async () => []), listWaiting: vi.fn(async () => []) }));
vi.mock("@/lib/auth/viewer", () => ({ gatePage: vi.fn(async () => who.viewer), placedBy: vi.fn(async () => ({})) }));
vi.mock("@/app/studio/publish", () => fb);
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/publish-flow", () => ({ verifyDue: vi.fn(async () => undefined) }));
vi.mock("@/lib/content/calendar", async (orig) => ({ ...(await orig<typeof import("@/lib/content/calendar")>()), todayKey: () => "2026-09-30" }));
vi.mock("@/app/studio/calendar/PlanBoard", () => ({ PlanBoard: () => null }));
vi.mock("@/app/studio/calendar/CalendarBoard", () => ({ CalendarBoard: () => null, MonthList: () => null }));

const { default: CalendarPage } = await import("@/app/studio/calendar/page");
const { PlanCalendar } = await import("@/app/studio/calendar/PlanCalendar");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = { agentId: "a1", staff: null };
});

describe("the calendar an agent with no Page gets", () => {
  it("is the plan, and asks Facebook nothing", async () => {
    const page = (await CalendarPage({ searchParams: Promise.resolve({ y: "2026", m: "10" }) })) as { type: unknown; props: { params: unknown } };
    expect(page.type).toBe(PlanCalendar);
    expect(page.props.params).toEqual({ y: "2026", m: "10" });
    expect(fb.publishSetup).not.toHaveBeenCalled();
  });

  it("reads the month's grid, first day to last, and the rail", async () => {
    await PlanCalendar({ params: { y: "2026", m: "10" } });
    // October 2026's grid runs Monday 28 September to Sunday 1 November
    expect(store.listPlanned).toHaveBeenCalledWith("2026-09-28", "2026-11-01");
    expect(store.listUnplanned).toHaveBeenCalled();
  });
});

describe("the calendar posting staff get", () => {
  it("is still the Page's", async () => {
    who.viewer = { agentId: "s1", staff: { owner: false, publish: true, connect: false, admin: false } };
    const page = (await CalendarPage({ searchParams: Promise.resolve({}) })) as { type: unknown };
    expect(page.type).not.toBe(PlanCalendar);
    expect(fb.publishSetup).toHaveBeenCalled();
    expect(store.listPlanned).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/calc/shell-menu.test.ts tests/content/plan-calendar-page.test.ts`
Expected: FAIL — เมนูไม่มี `/studio/calendar` · `Cannot find module '@/app/studio/calendar/PlanCalendar'`

- [ ] **Step 4: เมนู — `src/lib/shell/menu.ts`**

แทน comment สามบรรทัดและบรรทัด `const hidden = ...` ด้วย

```ts
  // the calendar is every agent's: a Page's for the staff who post to it (owner, 2026-09-27), a
  // plan for everyone else (2026-09-30); the front page is the admins' and the posting staff's,
  // who pick among their own Pages there (2026-09-29) — every other agent's Studio starts at the workbench
  const hidden = new Set(who && !who.admin && !who.publish ? ["/studio"] : []);
```

- [ ] **Step 5: `src/app/studio/calendar/PlanCalendar.tsx`**

```tsx
import Link from "next/link";
import { monthGridDays, parseMonth, shiftMonth, thaiMonthYear, todayKey } from "@/lib/content/calendar";
import { planTitle } from "@/lib/content/day-plan";
import { listPlanned, listUnplanned, type ContentItem } from "@/lib/content/store";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { PlanBoard, type PlanCard } from "./PlanBoard";

/**
 * The calendar of an agent with no Page (owner, 2026-09-30): the month's planned pieces and a
 * rail of the ones with no day. Nothing here reaches Facebook — the agent posts, then says so.
 */

const card = (i: ContentItem): PlanCard => ({
  id: i.id, title: planTitle(i), format: i.format, day: i.plan?.day ?? null, doneAt: i.plan?.doneAt ?? null,
});

export async function PlanCalendar({ params }: { params: { y?: string; m?: string; view?: string } }) {
  const today = todayKey();
  const [ty, tm] = today.split("-").map(Number);
  const { year, month } = parseMonth(params.y, params.m, { year: ty, month: tm });
  const listView = params.view === "list";
  const cells = monthGridDays(year, month);
  const [planned, unplanned] = await Promise.all([
    listPlanned(cells[0].day, cells[cells.length - 1].day).catch(() => []),
    listUnplanned().catch(() => []),
  ]);

  const query = (over: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams({ y: String(year), m: String(month) });
    if (listView) q.set("view", "list");
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return `/studio/calendar?${q.toString()}`;
  };
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const toggle = (on: boolean) => `inline-flex min-h-11 items-center rounded-full px-4 text-sm ${on ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}`;
  const navBtn = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ปฏิทินโพสต์</h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">วางแผนว่าจะโพสต์ชิ้นไหนวันไหน — ระบบไม่โพสต์เอง ถึงวันคัดลอกไปโพสต์แล้วกด “โพสต์แล้ว”</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={query({ y: String(ty), m: String(tm) })} className={navBtn}>วันนี้</Link>
          <Link href={query({ y: String(prev.year), m: String(prev.month) })} aria-label="เดือนก่อน" className={navBtn}><ChevronLeftIcon className="size-5" /></Link>
          <h2 className="min-w-36 text-center text-lg font-semibold sm:min-w-40">{thaiMonthYear(year, month)}</h2>
          <Link href={query({ y: String(next.year), m: String(next.month) })} aria-label="เดือนถัดไป" className={navBtn}><ChevronRightIcon className="size-5" /></Link>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] p-1">
          <Link href={query({ view: undefined })} aria-current={!listView ? "page" : undefined} className={toggle(!listView)}>เดือน</Link>
          <Link href={query({ view: "list" })} aria-current={listView ? "page" : undefined} className={toggle(listView)}>รายการ</Link>
        </div>
      </div>
      <PlanBoard cells={cells} planned={planned.map(card)} unplanned={unplanned.map(card)} today={today} listView={listView} />
    </div>
  );
}
```

- [ ] **Step 6: `src/app/studio/calendar/PlanBoard.tsx`**

```tsx
"use client";
import Link from "next/link";
import { useState } from "react";
import { thaiDayLabel, type MonthCell } from "@/lib/content/calendar";
import { mayPlanOn, PLAN_LABEL, planState, type PlanState } from "@/lib/content/day-plan";
import { markPlanDone, planPiece, unplanPiece, type PlanResult } from "../plan";
import { CheckIcon, XIcon } from "../ui/icons";

/**
 * The planning board (owner, 2026-09-30): pick a piece on the rail, then a day; or drag it there.
 * A day gone takes nothing. Each card opens its piece, moves, comes off the plan, or is marked posted.
 */

export interface PlanCard {
  id: string;
  title: string;
  format: string;
  day: string | null;
  doneAt: string | null;
}

const FORMAT: Record<string, string> = { post: "โพสต์", script: "สคริปต์", ad: "โฆษณา" };
const TONE: Record<PlanState, string> = {
  planned: "border-[var(--ct-line)]",
  today: "border-[var(--ct-accent)] bg-[var(--ct-soft)]",
  overdue: "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)]",
  done: "border-[var(--ct-line)] opacity-70",
};
const WEEKDAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export function PlanBoard({ cells, planned: initialPlanned, unplanned: initialUnplanned, today, listView }: {
  cells: MonthCell[]; planned: PlanCard[]; unplanned: PlanCard[]; today: string; listView: boolean;
}) {
  const [planned, setPlanned] = useState(initialPlanned);
  const [rail, setRail] = useState(initialUnplanned);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const byDay = new Map<string, PlanCard[]>();
  for (const c of planned) if (c.day) byDay.set(c.day, [...(byDay.get(c.day) ?? []), c]);

  async function run(call: () => Promise<PlanResult>, apply: (item: PlanCard) => void) {
    setBusy(true);
    setNote(null);
    const res = await call().catch(() => null);
    setBusy(false);
    if (!res) return setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ");
    if (!res.ok) return setNote(res.error);
    const i = res.item;
    apply({ id: i.id, title: [...planned, ...rail].find((c) => c.id === i.id)?.title ?? "ชิ้นงาน", format: i.format, day: i.plan?.day ?? null, doneAt: i.plan?.doneAt ?? null });
  }

  const place = (id: string, day: string) => {
    if (!mayPlanOn(day, today)) return setNote("วันที่ผ่านมาแล้ววางแผนไม่ได้");
    void run(() => planPiece({ id, day }), (c) => {
      setRail((r) => r.filter((x) => x.id !== c.id));
      setPlanned((p) => [...p.filter((x) => x.id !== c.id), c]);
      setPicked(null);
    });
  };
  const takeOff = (id: string) => run(() => unplanPiece(id), (c) => {
    setPlanned((p) => p.filter((x) => x.id !== c.id));
    setRail((r) => [c, ...r]);
  });
  const toggleDone = (c: PlanCard) => run(() => markPlanDone({ id: c.id, done: !c.doneAt }), (n) => setPlanned((p) => p.map((x) => (x.id === n.id ? n : x))));

  const Card = ({ c }: { c: PlanCard }) => {
    const state = planState(c.day!, c.doneAt, today);
    return (
      <div className={`space-y-1 rounded-lg border p-2 text-xs ${TONE[state]}`}>
        <Link href={`/studio/write?open=${c.id}`} className="line-clamp-2 font-medium underline-offset-2 hover:underline">{c.title}</Link>
        <div className="flex flex-wrap items-center gap-1 text-[var(--ct-mute)]">
          <span>{FORMAT[c.format] ?? c.format} · {PLAN_LABEL[state]}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" disabled={busy} onClick={() => toggleDone(c)} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50">
            <CheckIcon className="size-3.5" />{c.doneAt ? "ยกเลิกโพสต์แล้ว" : "โพสต์แล้ว"}
          </button>
          <button type="button" disabled={busy} onClick={() => setPicked(c.id)} className="min-h-9 rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50">ย้ายวัน</button>
          <button type="button" disabled={busy} aria-label="เอาออกจากแผน" onClick={() => takeOff(c.id)} className="inline-flex min-h-9 items-center rounded-md border border-[var(--ct-line)] px-2 disabled:opacity-50">
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-2">
        {note && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{note}</p>}
        {picked && <p role="status" className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]">เลือกวันที่จะวางชิ้นนี้ — <button type="button" onClick={() => setPicked(null)} className="underline">ยกเลิก</button></p>}
        {listView ? (
          <ul className="space-y-3">
            {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => (
              <li key={day} className="space-y-2">
                <h3 className="text-sm font-semibold">{thaiDayLabel(day)}</h3>
                {list.map((c) => <Card key={c.id} c={c} />)}
              </li>
            ))}
            {byDay.size === 0 && <p className="text-sm text-[var(--ct-mute)]">เดือนนี้ยังไม่ได้วางแผน</p>}
          </ul>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => <div key={w} className="py-1 text-center text-xs text-[var(--ct-mute)]">{w}</div>)}
            {cells.map((cell) => {
              const open = mayPlanOn(cell.day, today);
              return (
                <div
                  key={cell.day}
                  onDragOver={(e) => { if (open) e.preventDefault(); }}
                  onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) place(id, cell.day); }}
                  onClick={() => { if (picked && open) place(picked, cell.day); }}
                  className={`min-h-24 space-y-1 rounded-lg border p-1 ${cell.inMonth ? "border-[var(--ct-line)]" : "border-transparent opacity-60"} ${cell.day === today ? "ring-1 ring-[var(--ct-accent)]" : ""} ${picked && open ? "cursor-pointer hover:bg-[var(--ct-soft)]" : ""}`}
                >
                  <div className="text-right text-xs text-[var(--ct-mute)]">{Number(cell.day.slice(8))}</div>
                  {(byDay.get(cell.day) ?? []).map((c) => <Card key={c.id} c={c} />)}
                  {open && (
                    <Link href={`/studio/write?day=${cell.day}`} onClick={(e) => e.stopPropagation()} className="block text-center text-[10px] text-[var(--ct-mute)] underline-offset-2 hover:underline">+ เขียน</Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <aside className="space-y-2 rounded-xl border border-[var(--ct-hair)] p-3">
        <h2 className="text-sm font-semibold">ยังไม่ได้วางวัน ({rail.length})</h2>
        <p className="text-xs text-[var(--ct-mute)]">กดชิ้นแล้วกดวัน หรือลากไปวางบนวัน</p>
        {rail.length === 0 && <p className="text-xs text-[var(--ct-mute)]">ไม่มีชิ้นที่รอวาง — เขียนเพิ่มใน <Link href="/studio/write" className="underline">Organic Studio</Link></p>}
        {rail.map((c) => (
          <button
            key={c.id} type="button" draggable disabled={busy}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
            onClick={() => setPicked(picked === c.id ? null : c.id)}
            aria-pressed={picked === c.id}
            className={`block w-full rounded-lg border p-2 text-left text-xs ${picked === c.id ? "border-[var(--ct-accent)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)]"}`}
          >
            <span className="line-clamp-2 font-medium">{c.title}</span>
            <span className="text-[var(--ct-mute)]">{FORMAT[c.format] ?? c.format}</span>
          </button>
        ))}
      </aside>
    </div>
  );
}
```

- [ ] **Step 7: หน้าปฏิทินแยกตามสิทธิ์ — `src/app/studio/calendar/page.tsx`**

import เพิ่ม `import { can } from "@/lib/auth/access";` และ `import { PlanCalendar } from "./PlanCalendar";` · แทนสองบรรทัดแรกของ `CalendarPage`:

```ts
  const viewer = await gatePage("/studio/calendar", "publish");
  const params = await searchParams;
```

ด้วย

```ts
  const viewer = await gatePage("/studio/calendar");
  const params = await searchParams;
  // an agent with no Page plans rather than posts: nothing below asks Facebook (owner, 2026-09-30)
  if (!can(viewer, "publish")) return <PlanCalendar params={{ y: params.y, m: params.m, view: params.view }} />;
```

- [ ] **Step 8: รันให้ผ่าน**

Run: `npx vitest run tests/calc/shell-menu.test.ts tests/content/plan-calendar-page.test.ts && npx tsc --noEmit && npx eslint`
Expected: PASS · tsc ไม่มี error · eslint 0 error

- [ ] **Step 9: Commit**

```bash
git add src/lib/shell/menu.ts src/app/studio/calendar/page.tsx src/app/studio/calendar/PlanCalendar.tsx src/app/studio/calendar/PlanBoard.tsx tests/calc/shell-menu.test.ts tests/content/plan-calendar-page.test.ts
git commit -m "feat(studio): agents with no Page get a planning calendar"
```

---

### Task 4: ช่องวางแผนใน editor และแถบวันนี้

**Files:**
- Create: `src/app/studio/PlanPanel.tsx` (client)
- Modify: `src/app/studio/PieceEditor.tsx` (prop `planner`, แสดง `PlanPanel`)
- Modify: `src/app/studio/ContentStudio.tsx` (props `planner`, `todayPlan`, ส่ง `planner` ให้ editor, แถบวันนี้, ข้อความแถบ `forDay`)
- Modify: `src/app/studio/StudioPage.tsx` (อ่าน `planner` และ `todayPlan`)
- Test: `tests/content/studio-write-page.test.ts`

**Interfaces:**
- Consumes: `planPiece`, `unplanPiece`, `markPlanDone`, `listPlanned`, `planState`, `PLAN_LABEL`, `planTitle`, `mayPlanOn`, `todayKey`
- Produces: `ContentStudio` props `planner: boolean`, `todayPlan: { id: string; title: string }[]` · `PieceEditor` prop `planner?: boolean` · `PlanPanel({ item, suggestDay, onSaved })`

- [ ] **Step 1: test ที่ล้ม — `tests/content/studio-write-page.test.ts`**

ใน mock ของ `@/lib/content/store` เพิ่ม `listPlanned: store.listPlanned,` และใน `store` hoisted เพิ่ม `listPlanned: vi.fn(async () => [])` · เพิ่ม mock:

```ts
const viewer = vi.hoisted(() => ({ current: { agentId: "a1", staff: null } as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: vi.fn(async () => viewer.current) }));
vi.mock("@/lib/content/calendar", async (orig) => ({ ...(await orig<typeof import("@/lib/content/calendar")>()), todayKey: () => "2026-09-30" }));
```

ใน `beforeEach` เพิ่ม `viewer.current = { agentId: "a1", staff: null };` · เพิ่ม helper และ describe ท้ายไฟล์:

```ts
const propsOf = async (args: Parameters<typeof StudioPage>[0]) =>
  ((await StudioPage(args)) as { props: { planner: boolean; todayPlan: { id: string; title: string }[] } }).props;

describe("an agent who plans rather than posts (owner, 2026-09-30)", () => {
  it("is told what today's plan still holds", async () => {
    state.mine = [];
    store.listPlanned.mockResolvedValue([
      { id: "p1", output: { hooks: ["โพสต์วันนี้"] }, plan: { day: "2026-09-30", doneAt: null } },
      { id: "p2", output: { hooks: ["โพสต์ไปแล้ว"] }, plan: { day: "2026-09-30", doneAt: "t" } },
    ]);
    const props = await propsOf({});
    expect(props.planner).toBe(true);
    expect(store.listPlanned).toHaveBeenCalledWith("2026-09-30", "2026-09-30");
    expect(props.todayPlan).toEqual([{ id: "p1", title: "โพสต์วันนี้" }]);
  });

  it("is not who posting staff are: no plan read for them", async () => {
    viewer.current = { agentId: "s1", staff: { owner: false, publish: true, connect: false, admin: false } };
    const props = await propsOf({});
    expect(props.planner).toBe(false);
    expect(props.todayPlan).toEqual([]);
    expect(store.listPlanned).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/studio-write-page.test.ts`
Expected: FAIL — `planner` undefined

- [ ] **Step 3: `src/app/studio/StudioPage.tsx`**

import เพิ่ม `import { can } from "@/lib/auth/access";`, `import { getViewer } from "@/lib/auth/viewer";`, `import { planTitle } from "@/lib/content/day-plan";` และ `todayKey` (มีอยู่แล้วจาก calendar) · เพิ่ม `listPlanned` ใน import จาก store

ต่อจากบรรทัด `const pageId = project?.pageId;`:

```ts
  // an agent who may not post plans instead (owner, 2026-09-30): the editor offers a day, and
  // the workbench says what today's plan still holds
  const planner = !can(await getViewer().catch(() => null), "publish");
  const today = todayKey();
```

ใน `Promise.all` ต่อท้าย (ตัวแปรที่หก `planned`):

```ts
    planner ? listPlanned(today, today).catch(() => []) : Promise.resolve([]),
```

(บรรทัด destructure เป็น `const [initial, used, hooks, spend, people, planned] = await Promise.all([`)

ใน `<ContentStudio ... />` เพิ่ม

```tsx
      planner={planner}
      todayPlan={planned.filter((i) => !i.plan?.doneAt).map((i) => ({ id: i.id, title: planTitle(i) }))}
```

- [ ] **Step 4: `src/app/studio/PlanPanel.tsx`**

```tsx
"use client";
import { useState } from "react";
import { thaiDayLabel, todayKey } from "@/lib/content/calendar";
import { mayPlanOn, PLAN_LABEL, planState } from "@/lib/content/day-plan";
import type { ContentItem } from "@/lib/content/store";
import { markPlanDone, planPiece, unplanPiece, type PlanResult } from "./plan";

/**
 * วางแผน, in the editor of an agent who may not post (owner, 2026-09-30): the day this piece is
 * planned for, and whether it went up. The calendar's day comes first when it sent the agent here.
 */
export function PlanPanel({ item, suggestDay, onSaved }: { item: ContentItem; suggestDay?: string | null; onSaved: (item: ContentItem) => void }) {
  const today = todayKey();
  const [day, setDay] = useState(item.plan?.day ?? (suggestDay && mayPlanOn(suggestDay, today) ? suggestDay : today));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(call: () => Promise<PlanResult>) {
    setBusy(true);
    setNote(null);
    const res = await call().catch(() => null);
    setBusy(false);
    if (!res) return setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ");
    if (!res.ok) return setNote(res.error);
    onSaved(res.item);
  }

  const plan = item.plan;
  const button = "min-h-11 rounded-lg border border-[var(--ct-line)] px-3 text-sm disabled:opacity-50";
  return (
    <section aria-label="วางแผน" className="mt-4 space-y-2 rounded-xl border border-[var(--ct-line)] p-3">
      <h3 className="text-sm font-semibold">วางแผน</h3>
      {plan && (
        <p className="text-sm">
          วางไว้ <b>{thaiDayLabel(plan.day)}</b> · {PLAN_LABEL[planState(plan.day, plan.doneAt, today)]}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={day} min={today} onChange={(e) => setDay(e.target.value)} aria-label="วันที่จะโพสต์" className="min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 text-sm" />
        <button type="button" disabled={busy || !mayPlanOn(day, today) || plan?.day === day} onClick={() => run(() => planPiece({ id: item.id, day }))} className={`${button} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`}>
          {plan ? "ย้ายไปวันนี้" : "วางแผน"}
        </button>
        {plan && (
          <>
            <button type="button" disabled={busy} onClick={() => run(() => markPlanDone({ id: item.id, done: !plan.doneAt }))} className={button}>
              {plan.doneAt ? "ยกเลิกโพสต์แล้ว" : "โพสต์แล้ว"}
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => unplanPiece(item.id))} className={button}>เอาออกจากแผน</button>
          </>
        )}
      </div>
      {note && <p role="alert" className="text-sm text-[var(--ct-alert)]">{note}</p>}
    </section>
  );
}
```

- [ ] **Step 5: `src/app/studio/PieceEditor.tsx`**

import `import { PlanPanel } from "./PlanPanel";` · ใน `interface Props` เพิ่ม

```ts
  /** the agent may not post: the editor offers วางแผน instead of ลงเพจ (owner, 2026-09-30) */
  planner?: boolean;
```

เพิ่ม `planner` ใน destructure ของ `PieceEditor` · แทนบรรทัด

```tsx
      {isPost && <PublishPanel item={item} hook={hook} beforePublish={save} onPublished={onPublished} drawing={drawing} suggestDay={suggestDay} onBusy={setSending} />}
```

ด้วย

```tsx
      {planner
        ? <PlanPanel item={item} suggestDay={suggestDay} onSaved={onSaved} />
        : isPost && <PublishPanel item={item} hook={hook} beforePublish={save} onPublished={onPublished} drawing={drawing} suggestDay={suggestDay} onBusy={setSending} />}
```

- [ ] **Step 6: `src/app/studio/ContentStudio.tsx`**

ใน `interface Props` เพิ่ม

```ts
  /** the agent may not post, and plans instead (owner, 2026-09-30) */
  planner: boolean;
  /** today's planned pieces not yet marked posted, for the banner */
  todayPlan: { id: string; title: string }[];
```

เพิ่ม `planner, todayPlan` ใน destructure · ใน `<PieceEditor` เพิ่ม prop `planner={planner}` · ข้อความแถบ `forDay` เปลี่ยนเป็น

```tsx
              <p className="min-w-0 flex-1">เขียนสำหรับ <b>{thaiDayLabel(forDay)}</b> — เปิดชิ้นงานแล้วช่อง “{planner ? "วางแผน" : "ลงเพจ"}” จะมีวันนี้ให้เลือก</p>
```

ก่อนบรรทัด `{forDay && (` เพิ่มแถบวันนี้:

```tsx
          {todayPlan.length > 0 && (
            <div role="status" className="space-y-1 rounded-lg border border-[var(--ct-accent)] bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]">
              <p className="flex items-center gap-2"><CalendarIcon className="size-4 shrink-0" />วันนี้มีงานตามแผน <b>{todayPlan.length} ชิ้น</b></p>
              <ul className="space-y-0.5 pl-6">
                {todayPlan.map((p) => <li key={p.id}><Link href={`/studio/write?open=${p.id}`} className="underline underline-offset-2">{p.title}</Link></li>)}
              </ul>
            </div>
          )}
```

- [ ] **Step 7: ตรวจ**

Run: `npx vitest run tests/content/studio-write-page.test.ts && npx tsc --noEmit && npx eslint && npx vitest run`
Expected: PASS ทั้งหมด · eslint 0 error

- [ ] **Step 8: Commit**

```bash
git add src/app/studio/PlanPanel.tsx src/app/studio/PieceEditor.tsx src/app/studio/ContentStudio.tsx src/app/studio/StudioPage.tsx tests/content/studio-write-page.test.ts
git commit -m "feat(studio): the editor plans a piece for an agent with no Page, and the workbench shows today's plan"
```

---

### Task 5: ตรวจรวมและขึ้นระบบ

- [ ] **Step 1:** `npx tsc --noEmit` → `npx eslint` → `npx vitest run` → `NEXT_DIST_DIR=.next-build npx next build` — ผ่านทุกตัว
- [ ] **Step 2:** `apply_migration` project `cenysylrzbwfrtuqoeqk`, name `content_plan`, query = เนื้อหา `supabase/migrations/20260930_content_plan.sql`
- [ ] **Step 3:** ยืนยัน: `select column_name from information_schema.columns where table_name = 'ins_content' and column_name in ('plan_day','planned_done_at');` → 2 แถว
- [ ] **Step 4:** `git fetch origin` · `git switch main` · `git merge --ff-only origin/main` · `git merge --ff-only plan-calendar` · `git push origin main` (ถ้า `--ff-only` ไม่ผ่าน หยุดแล้วบอกเจ้าของ)
- [ ] **Step 5:** Vercel deployment ของ commit ล่าสุด READY บน `advisortool.app` · `/api/health` → `ok: true` · `get_runtime_errors` ไม่มี error ใหม่
