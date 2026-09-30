# ชิ้นงานเป็นโปรเจคของแต่ละเพจ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ชิ้นงานใน Organic Studio เป็นของเพจตั้งแต่สร้าง; หน้าเขียนงาน ปฏิทิน และหน้ารวมแสดงเฉพาะโปรเจคของเพจนั้น และ server ไม่ยอมให้แตะชิ้นของเพจที่ไม่ได้ดูแล

**Architecture:** คอลัมน์ใหม่ `ins_content.page_id` (โปรเจค) แยกจาก `fb_page_id` (เพจที่ส่งไปจริง) · `currentScope()` รู้เพจที่ผู้ขอดูแล และ store กรองเองทุกการอ่าน · `projectPage()` ใน `src/lib/auth/pages.ts` ตัดสินว่าคำขอทำงานในโปรเจคไหน ใช้ทั้งตอนสร้าง ตอนเปิดรายการ และในหน้าเขียนงาน

**Tech Stack:** Next.js 15 (App Router, server actions), TypeScript, Supabase (service role, PostgREST), vitest

**Spec:** `docs/superpowers/specs/2026-09-30-page-projects-design.md`

## Global Constraints

- `page_id` = โปรเจคของชิ้น · `fb_page_id` = เพจที่ส่งไปจริง — ห้ามเปลี่ยนความหมายของ `fb_page_id`
- ชิ้นหาทีม 2 ชิ้นที่ไม่มีเพจ → LuckyPlanner โชคดีที่มีแพลน `105982528649026`
- ไม่ย้าย/ไม่ทำสำเนาข้ามเพจ: ชิ้นของเพจไหนลงได้เฉพาะเพจนั้น
- ไม่เปลี่ยน: คลังสูตรประโยคเปิด · งบ/โควตา AI · คลังบุคคล · ชิ้นที่ลง/ตั้งเวลาแล้ว · ตัวแทนที่ไม่มีเพจ (กองเดียวของตัวเอง)
- อ่านรายชื่อเพจไม่ได้ = ปิด (ไม่เห็นชิ้นของเพจไหน / ไม่สร้างรอบ) ไม่ใช่เปิด
- Supabase project: `cenysylrzbwfrtuqoeqk` · migration: `supabase/migrations/20260930_content_page.sql`
- ข้อความถึงผู้ใช้เป็นภาษาไทย; comment ในโค้ดเป็นภาษาอังกฤษแบบที่ไฟล์นั้นใช้ พร้อมวันที่ของเจ้าของเมื่อเป็นการตัดสินใจ
- คำสั่งตรวจ: `npx vitest run <file>` · `npx tsc --noEmit` · `npx eslint` · `NEXT_DIST_DIR=.next-build npx next build`

## Review Focus

1. เปิด `/studio/write?open=<id>` จากปฏิทินของเพจ B ขณะที่ไม่ได้ระบุ `page` → ต้องเปิดในโปรเจคของเพจ B ไม่ใช่เพจแรก — Task 5 (test `studio-write-page`)
2. ทีมงานถูกเอาเพจออกระหว่างเปิดหน้าเขียนงานค้างไว้ → กดแท็บ/โหลดเพิ่ม/สร้างรอบ ครั้งถัดไปต้องไม่ได้ชิ้นของเพจนั้น — Task 2 และ 3 (test `projectPage` ปฏิเสธ → ไม่นับโควตา, `contentWorkbench` ว่าง)
3. อ่านรายชื่อเพจไม่ได้ชั่วคราว → ไม่เห็นชิ้นของเพจไหน และสร้างรอบไม่ได้โดยไม่เสียโควตา — Task 1 และ 2
4. ตัวแทนที่ไม่มีเพจ → ทุกอย่างเหมือนเดิม: รอบบันทึก `page_id` ว่าง, รายการไม่ถูกกรองด้วยเพจ — Task 2 และ 3
5. ชิ้นเก่าที่ยังไม่มีเพจถูกลงเพจ X → กลายเป็นของ X; ชิ้นของ X ส่งไปเพจ Y → ถูกปฏิเสธก่อนถึง Facebook — Task 4

---

### Task 1: ข้อมูลและขอบเขตที่รู้เพจ

**Files:**
- Create: `supabase/migrations/20260930_content_page.sql`
- Modify: `src/lib/auth/scope.ts`
- Modify: `src/lib/content/store.ts` (imports, `ContentItem`, `COLUMNS`, `toItem`, `getContent`, `ownersFilter`)
- Modify: `tests/content/publish-flow.test.ts` (fixture `piece`), `tests/content/actions-page.test.ts` (fixture `make`)
- Test: `tests/auth/scope.test.ts`, `tests/auth/scope-pages.test.ts` (ใหม่)

**Interfaces:**
- Produces: `Scope.pages: string[] | null` · `maySeePiece(scope: Scope, piece: { agentId: string | null; pageId: string | null }): boolean` · `pieceFilter(scope: Scope): string | null` · `ContentItem.pageId: string | null`

- [ ] **Step 1: เขียน migration**

`supabase/migrations/20260930_content_page.sql`:

```sql
-- A piece is its Page's from the moment it is written (owner, 2026-09-30): the workbench, the
-- calendar's rail and the front page show one Page's project at a time. page_id is that
-- project; fb_page_id stays where it was actually sent.
alter table public.ins_content add column if not exists page_id text;
-- a piece already on a Page, or held for one, is that Page's
update public.ins_content set page_id = fb_page_id where page_id is null and fb_page_id is not null;
-- the staff's pieces on no Page yet (two หาทีม pieces): LuckyPlanner โชคดีที่มีแพลน's, the owner's call
update public.ins_content set page_id = '105982528649026'
  where page_id is null and agent_id in (select agent_id from public.ins_staff);
create index if not exists ins_content_page_status on public.ins_content (page_id, status, created_at desc);
```

ยังไม่รันบนฐานข้อมูลจริง — Task 6

- [ ] **Step 2: เขียน test ที่ล้ม — `tests/auth/scope.test.ts`**

เปลี่ยน fixture ทั้งสี่ให้มี `pages` และเพิ่ม import กับ describe ใหม่ท้ายไฟล์:

```ts
import { agentFilter, maySee, maySeePiece, pieceFilter, type Scope } from "@/lib/auth/scope";

const member: Scope = { agents: ["a1"], unowned: false, pages: [], owner: { agentId: "a1", tenantId: "t1" } };
const staff: Scope = { agents: ["s1", "s2"], unowned: true, pages: ["p1", "p2"], owner: { agentId: "s1", tenantId: "t1" } };
const all: Scope = { agents: null, unowned: true, pages: null, owner: null };
const none: Scope = { agents: [], unowned: false, pages: [], owner: null };
```

```ts
describe("a piece and its Page (owner, 2026-09-30)", () => {
  it("is seen by whoever looks after its Page, whoever wrote it", () => {
    expect(maySeePiece(staff, { agentId: "s2", pageId: "p1" })).toBe(true);
    expect(maySeePiece(staff, { agentId: "a9", pageId: "p2" })).toBe(true);
    expect(maySeePiece({ ...staff, pages: ["p1"] }, { agentId: "s1", pageId: "p2" })).toBe(false);
  });

  it("on no Page, is seen as before", () => {
    expect(maySeePiece(staff, { agentId: "s2", pageId: null })).toBe(true);
    expect(maySeePiece(member, { agentId: "a1", pageId: null })).toBe(true);
    expect(maySeePiece(member, { agentId: "a2", pageId: null })).toBe(false);
  });

  it("is seen by work with no request, and never by nobody", () => {
    expect(maySeePiece(all, { agentId: null, pageId: "p9" })).toBe(true);
    expect(maySeePiece(none, { agentId: "a1", pageId: "p1" })).toBe(false);
  });

  it("writes the same rule as one filter", () => {
    expect(pieceFilter(staff)).toBe("page_id.in.(p1,p2),and(page_id.is.null,or(agent_id.in.(s1,s2),agent_id.is.null))");
    expect(pieceFilter(member)).toBe("and(page_id.is.null,or(agent_id.in.(a1)))");
    expect(pieceFilter(all)).toBeNull();
    expect(pieceFilter(none)).toBe("and(page_id.is.null,or(agent_id.eq.00000000-0000-0000-0000-000000000000))");
  });
});
```

- [ ] **Step 3: เขียน test ที่ล้ม — `tests/auth/scope-pages.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** currentScope knows the Pages a caller looks after (owner, 2026-09-30), and shows none it cannot read. */

const viewer = vi.hoisted(() => ({ getViewer: vi.fn(), staffAgentIds: vi.fn(async () => ["s1", "s2"]) }));
const pages = vi.hoisted(() => ({ myPageIds: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("@/lib/auth/pages", () => pages);
// every call answered afresh, as every request is
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));

const { currentScope } = await import("@/lib/auth/scope");

const staffer = { agentId: "s1", tenantId: "t1", staff: { owner: false, publish: true, connect: false, admin: false } };

beforeEach(() => vi.clearAllMocks());

describe("the scope of a request", () => {
  it("carries the Pages the caller looks after", async () => {
    viewer.getViewer.mockResolvedValue(staffer);
    pages.myPageIds.mockResolvedValue(new Set(["p1"]));
    expect(await currentScope()).toMatchObject({ agents: ["s1", "s2"], pages: ["p1"] });
  });

  it("shows no Page's pieces when the Pages cannot be read", async () => {
    viewer.getViewer.mockResolvedValue(staffer);
    pages.myPageIds.mockRejectedValue(new Error("db down"));
    expect((await currentScope()).pages).toEqual([]);
  });

  it("is every Page's for work with no request, and none for nobody", async () => {
    viewer.getViewer.mockRejectedValue(new Error("cookies() outside a request"));
    expect((await currentScope()).pages).toBeNull();
    viewer.getViewer.mockResolvedValue(null);
    expect((await currentScope()).pages).toEqual([]);
  });
});
```

- [ ] **Step 4: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/auth/scope.test.ts tests/auth/scope-pages.test.ts`
Expected: FAIL — `maySeePiece is not a function` / `pages` undefined

- [ ] **Step 5: แก้ `src/lib/auth/scope.ts`**

เพิ่ม import, field, ค่าคงที่ และสองฟังก์ชัน:

```ts
import { myPageIds } from "./pages";
```

ใน `interface Scope` หลัง `unowned`:

```ts
  /** the Pages whose pieces are visible (src/lib/auth/pages.ts, owner 2026-09-30); null = every Page's */
  pages: string[] | null;
```

```ts
const ALL: Scope = { agents: null, unowned: true, pages: null, owner: null };
const NONE: Scope = { agents: [], unowned: false, pages: [], owner: null };
```

ใน `currentScope` แทนสองบรรทัด return สุดท้าย:

```ts
  // a Page's pieces are for whoever looks after it; a list that cannot be read shows none
  const pages = [...(await myPageIds().catch(() => new Set<string>()))];
  if (viewer.staff) return { agents: await staffAgentIds(), unowned: true, pages, owner };
  return { agents: [viewer.agentId], unowned: false, pages, owner };
```

ท้ายไฟล์:

```ts
/**
 * A piece of the workbench (owner, 2026-09-30): while it has a Page it is that Page's project,
 * seen by whoever looks after the Page and by nobody else, whoever wrote it. A piece on no Page
 * is seen as every row is (maySee).
 */
export function maySeePiece(scope: Scope, piece: { agentId: string | null; pageId: string | null }): boolean {
  if (!piece.pageId) return maySee(scope, piece.agentId);
  return scope.pages === null || scope.pages.includes(piece.pageId);
}

/** maySeePiece as a PostgREST `or` filter on page_id and agent_id; null when everything is visible. */
export function pieceFilter(scope: Scope): string | null {
  const agents = agentFilter(scope);
  if (scope.pages === null && agents === null) return null;
  const onPage = scope.pages === null ? "page_id.not.is.null" : scope.pages.length ? `page_id.in.(${scope.pages.join(",")})` : null;
  const offPage = agents ? `and(page_id.is.null,or(${agents}))` : "page_id.is.null";
  return onPage ? `${onPage},${offPage}` : offPage;
}
```

- [ ] **Step 6: รัน test สองไฟล์ให้ผ่าน**

Run: `npx vitest run tests/auth/scope.test.ts tests/auth/scope-pages.test.ts`
Expected: PASS

- [ ] **Step 7: แก้ `src/lib/content/store.ts`**

import บรรทัดแรก:

```ts
import { currentScope, maySeePiece, pieceFilter } from "@/lib/auth/scope";
```

ใน `interface ContentItem` หลัง `agentId`:

```ts
  /** the Page whose project it is (owner, 2026-09-30): written there, posted only there; null for an agent with no Pages */
  pageId: string | null;
```

`COLUMNS` ต่อท้าย `, page_id` · ใน `toItem` หลัง `agentId`:

```ts
    pageId: (r.page_id as string | null) ?? null,
```

`getContent` บรรทัด return:

```ts
  return item && maySeePiece(scope, item) ? item : null;
```

`ownersFilter`:

```ts
async function ownersFilter(): Promise<string | null> {
  return pieceFilter(await currentScope());
}
```

แก้ comment เหนือ `getContent` เป็น `A piece by its id — or null when it is not the asker's to see (src/lib/auth/scope.ts: its Page's, or its writer's).`

- [ ] **Step 8: เติม `pageId` ใน fixture ของ test**

`tests/content/publish-flow.test.ts` ใน `piece`: `hookTemplateId: null, publish, agentId: null, pageId: PAGE,`
`tests/content/actions-page.test.ts` ใน `make`: `status: "used", hookTemplateId: null, publish, agentId: null, pageId: PAGE,`

- [ ] **Step 9: ตรวจ**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc ไม่มี error · test ผ่านทั้งหมด

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260930_content_page.sql src/lib/auth/scope.ts src/lib/content/store.ts tests/auth/scope.test.ts tests/auth/scope-pages.test.ts tests/content/publish-flow.test.ts tests/content/actions-page.test.ts
git commit -m "feat(studio): a piece is its Page's, and only those who look after the Page see it"
```

---

### Task 2: สร้างชิ้นงานลงโปรเจคของเพจ

**Files:**
- Modify: `src/lib/auth/pages.ts` (เพิ่ม `NOT_YOUR_PAGE`, `projectPage`)
- Modify: `src/lib/content/store.ts` (`saveContent`)
- Modify: `src/app/studio/actions.ts` (`saveAll`, `generateContent`, `generateRecruit`, `generateKnowledge`, `generateDraft`)
- Modify: `src/lib/content/recruit-run.ts`, `src/lib/content/one-call-run.ts`, `src/lib/content/knowledge-run.ts`, `src/lib/content/draft-run.ts`, `src/lib/content/claim-run.ts`
- Modify: `src/app/api/content-claim/route.ts` (PUT)
- Modify: `tests/content/one-call-run.test.ts` (`base`), `tests/content/mode-checks.test.ts` (สองบรรทัดที่เรียก runner)
- Test: `tests/auth/pages.test.ts`, `tests/content/round-page.test.ts` (ใหม่), `tests/content/claim-route.test.ts`, `tests/content/one-call-run.test.ts`

**Interfaces:**
- Consumes: `myPages()` (มีอยู่แล้ว)
- Produces: `NOT_YOUR_PAGE: string` · `projectPage(asked?: string | null): Promise<{ ok: true; pageId: string | null } | { ok: false; error: string }>` · `saveContent(row: {...; pageId: string | null })` · `writeRecruit(input, pageId: string | null)` · `writeKnowledge(input, pageId: string | null)` · `writeDraft(input, pageId: string | null)` · `writeClaim(input, pageId: string | null)` · `OneCallRound.pageId: string | null` (แทน `page`)

- [ ] **Step 1: test ที่ล้ม — `tests/auth/pages.test.ts`**

เปลี่ยน import และต่อ describe ท้ายไฟล์:

```ts
const { myPages, myPageIds, seesEveryPage, projectPage, NOT_YOUR_PAGE } = await import("@/lib/auth/pages");
```

```ts
describe("the project a request works in (owner, 2026-09-30)", () => {
  it("the Page asked for when the caller looks after it, else the first", async () => {
    viewer.getViewer.mockResolvedValue(staff({ owner: true }));
    expect(await projectPage("p2")).toEqual({ ok: true, pageId: "p2" });
    expect(await projectPage("")).toEqual({ ok: true, pageId: "p1" });
    expect(await projectPage(undefined)).toEqual({ ok: true, pageId: "p1" });
  });

  it("refuses a Page the caller does not look after", async () => {
    viewer.getViewer.mockResolvedValue(staff({ publish: true }));
    tied.rows = [{ page_id: "p1" }];
    expect(await projectPage("p2")).toEqual({ ok: false, error: NOT_YOUR_PAGE });
  });

  it("is no Page for an agent with none, whatever is asked", async () => {
    viewer.getViewer.mockResolvedValue({ agentId: "a1", staff: null });
    expect(await projectPage("p1")).toEqual({ ok: true, pageId: null });
  });

  it("refuses rather than guesses when the Pages cannot be read", async () => {
    viewer.getViewer.mockResolvedValue(staff({ owner: true }));
    conn.pageConnections.mockRejectedValue(new Error("db down"));
    expect(await projectPage("p1")).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: test ที่ล้ม — `tests/content/round-page.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A round is written into the project of a Page the caller looks after, or not at all (owner, 2026-09-30). */

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => null), allowanceOf: vi.fn() }));
const project = vi.hoisted(() => ({ projectPage: vi.fn() }));
const done = { ok: true, items: [], costThb: 0, missing: 0 };
const runs = vi.hoisted(() => ({ writeRecruit: vi.fn(), writeKnowledge: vi.fn(), writeDraft: vi.fn() }));
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.4"]]) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), projectPage: project.projectPage }));
vi.mock("@/lib/content/recruit-run", () => ({ writeRecruit: runs.writeRecruit }));
vi.mock("@/lib/content/knowledge-run", () => ({ writeKnowledge: runs.writeKnowledge }));
vi.mock("@/lib/content/draft-run", () => ({ writeDraft: runs.writeDraft }));

const { generateContent, generateDraft, generateKnowledge, generateRecruit } = await import("@/app/studio/actions");
const { NOT_YOUR_PAGE } = await import("@/lib/auth/pages");
const { CONTENT_PRODUCTS } = await import("@/lib/content/products");

beforeEach(() => {
  vi.clearAllMocks();
  for (const run of Object.values(runs)) run.mockResolvedValue(done);
});

describe("a round and its Page", () => {
  it("is refused before a round is counted when the Page is not the caller's", async () => {
    project.projectPage.mockResolvedValue({ ok: false, error: NOT_YOUR_PAGE });
    const results = [
      await generateContent({ href: CONTENT_PRODUCTS[0].href, format: "post", angle: "", count: 1, hookTemplateId: null, page: "p9" }),
      await generateRecruit({ topic: "t", count: 1, page: "p9" } as never),
      await generateKnowledge({ kind: "article", subject: "waiting", count: 1, page: "p9" } as never),
      await generateDraft({ draft: "ร่างของฉัน", count: 1, page: "p9" } as never),
    ];
    for (const r of results) expect(r).toEqual({ ok: false, error: NOT_YOUR_PAGE });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(project.projectPage).toHaveBeenCalledWith("p9");
  });

  it("hands the runner the Page it resolved, not the one the screen sent", async () => {
    project.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
    await generateRecruit({ topic: "t", count: 1, page: "" } as never);
    await generateKnowledge({ kind: "article", subject: "waiting", count: 1 } as never);
    await generateDraft({ draft: "ร่างของฉัน", count: 1 } as never);
    expect(runs.writeRecruit).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeKnowledge).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(runs.writeDraft).toHaveBeenCalledWith(expect.anything(), "p1");
  });
});
```

- [ ] **Step 3: test ที่ล้ม — `tests/content/claim-route.test.ts`**

เพิ่ม mock ก่อน `await import(...)`:

```ts
const pages = vi.hoisted(() => ({ projectPage: vi.fn() }));
vi.mock("@/lib/auth/pages", () => pages);
```

ใน `beforeEach` เพิ่ม `pages.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });` · ใน test แรกเพิ่ม
`expect(run.writeClaim).toHaveBeenCalledWith(expect.anything(), "p1");` และเพิ่ม test:

```ts
  it("writes nothing, and counts no round, for a Page the caller does not look after", async () => {
    pages.projectPage.mockResolvedValue({ ok: false, error: "เพจนี้ไม่ได้อยู่ในเพจที่คุณดูแล" });
    const res = await PUT(writeRequest() as never);
    expect(res.status).toBe(403);
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(run.writeClaim).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: test ที่ล้ม — `tests/content/one-call-run.test.ts`**

`base` เพิ่ม `pageId: "p1",` และเพิ่ม test ใน describe เดิม:

```ts
  it("writes each piece into the round's Page", async () => {
    await oneCallRound({ ...base, count: 1, yardstick: "", parse: () => piece("ดี") });
    expect(store.saveContent.mock.calls[0][0]).toMatchObject({ pageId: "p1" });
  });
```

- [ ] **Step 5: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/auth/pages.test.ts tests/content/round-page.test.ts tests/content/claim-route.test.ts tests/content/one-call-run.test.ts`
Expected: FAIL — `projectPage is not a function`, `takeRound` ถูกเรียก, `pageId` ไม่อยู่ในแถว

- [ ] **Step 6: เพิ่ม `projectPage` ใน `src/lib/auth/pages.ts`**

ท้ายไฟล์:

```ts
/** said when a request names a Page the caller does not look after */
export const NOT_YOUR_PAGE = "เพจนี้ไม่ได้อยู่ในเพจที่คุณดูแล — เปิดงานของเพจจากหน้ารวม Studio";

/**
 * The Page whose project a request works in (owner, 2026-09-30): the one asked for when the
 * caller looks after it, the first of theirs when none is named, none for a caller with no
 * Pages. A Page named that is not theirs is refused, and so is a list that cannot be read — a
 * round would otherwise land in another Page's project, or in none.
 */
export async function projectPage(asked?: string | null): Promise<{ ok: true; pageId: string | null } | { ok: false; error: string }> {
  let pages: PageConnection[];
  try {
    pages = await myPages();
  } catch (e) {
    console.error("project Page not read:", e);
    return { ok: false, error: "อ่านรายชื่อเพจไม่ได้ ลองใหม่อีกครั้งนะครับ" };
  }
  if (pages.length === 0) return { ok: true, pageId: null };
  if (!asked) return { ok: true, pageId: pages[0].pageId };
  return pages.some((p) => p.pageId === asked) ? { ok: true, pageId: asked } : { ok: false, error: NOT_YOUR_PAGE };
}
```

- [ ] **Step 7: `saveContent` บันทึกเพจ — `src/lib/content/store.ts`**

ใน type ของ `row` เพิ่ม `pageId: string | null;` (ต่อจาก `hookTemplateId: string | null;`) และใน `insert({...})` เพิ่ม `page_id: row.pageId,` ต่อจาก `hook_template_id: row.hookTemplateId,`

- [ ] **Step 8: runner รับเพจที่ตัดสินแล้ว**

`src/lib/content/one-call-run.ts` ใน `interface OneCallRound` แทน `page?: string;` ด้วย

```ts
  /** the Page whose project the pieces go into, as projectPage settled it; null for an agent with no Pages */
  pageId: string | null;
```

ใน `oneCallRound`: `roundLogo(typeof r.page === "string" ? r.page : null, ...)` → `roundLogo(r.pageId, ...)` · ใน `saveContent({` เพิ่ม `pageId: r.pageId,`

`src/lib/content/draft-run.ts`: `export async function writeDraft(input: DraftWriteInput, pageId: string | null)` และใน `oneCallRound({...})` แทน `page: input.page` ด้วย `pageId`
`src/lib/content/knowledge-run.ts`: เหมือนกัน — `writeKnowledge(input: KnowledgeWriteInput, pageId: string | null)` และ `pageId` แทน `page: input.page`

`src/lib/content/recruit-run.ts`: `export async function writeRecruit(input: RecruitWriteInput, pageId: string | null)` ·
`roundLogo(typeof input.page === "string" ? input.page : null, ...)` → `roundLogo(pageId, ...)` · ใน `saveContent({` เพิ่ม `pageId,`

`src/lib/content/claim-run.ts`: `export async function writeClaim(input: ClaimWriteInput, pageId: string | null)` ·
`roundLogo(typeof input.page === "string" ? input.page : null, ...)` → `roundLogo(pageId, ...)` · ใน `saveContent({` เพิ่ม `pageId,`

ใน input type ทั้งสี่ (`RecruitWriteInput`, `ClaimWriteInput`, `DraftWriteInput`, `KnowledgeWriteInput`) คง `page?: string` ไว้ แต่เปลี่ยน comment เป็น
`/** the Page the screen asks for; the action settles it (projectPage) and hands the runner the answer */`

- [ ] **Step 9: action ตัดสินเพจก่อนหักโควตา — `src/app/studio/actions.ts`**

import: `import { projectPage } from "@/lib/auth/pages";`

`saveAll`:

```ts
async function saveAll(rows: Omit<Parameters<typeof saveContent>[0], "pageId">[], pageId: string | null): Promise<{ items: ContentItem[]; failed: boolean }> {
  const items: ContentItem[] = [];
  for (const row of rows) {
    try {
      items.push(await saveContent({ ...row, pageId }));
```

(ส่วนที่เหลือของ `saveAll` เหมือนเดิม) · ทั้งสามจุดที่เรียก `saveAll(...)` ใน `generateContent` เติมอาร์กิวเมนต์ที่สอง `project.pageId`

ใน `generateContent` แทนบล็อก `const logo = ...` ด้วย:

```ts
  // the Page whose project the round goes into (owner, 2026-09-30), settled before anything is counted
  const project = await projectPage(input.page);
  if (!project.ok) return project;
  // a script has no poster to carry a logo
  const logo = input.format === "script" ? null
    : await roundLogo(project.pageId, isLogoSpot(input.logoSpot) ? input.logoSpot : null);
```

`generateRecruit`, `generateKnowledge`, `generateDraft`: ใส่ก่อนบรรทัด `const over = await takeRound(...)` ของแต่ละตัว

```ts
  const project = await projectPage(input.page);
  if (!project.ok) return project;
```

และบรรทัดสุดท้ายเป็น `return writeRecruit(input, project.pageId);` / `return writeKnowledge(input, project.pageId);` / `return writeDraft(input, project.pageId);`

แก้ comment ของ `page` ใน `GenerateInput` เป็น `/** the Page whose project the round is for (projectPage settles it); its logo goes on the posters */`

- [ ] **Step 10: route รีวิวเคลม — `src/app/api/content-claim/route.ts`**

import: `import { projectPage } from "@/lib/auth/pages";` · ใน `PUT` ก่อน `const over = await takeRound(await requireMember(), "ai-claim");` (บรรทัดที่สอง ไม่ใช่ของ POST):

```ts
  // the Page whose project the round goes into, settled before a round is counted (owner, 2026-09-30)
  const project = await projectPage(String(form.get("page") ?? ""));
  if (!project.ok) return bad(project.error, 403);
```

และใน `writeClaim({...})` ลบ `page: String(form.get("page") ?? ""),` ออกจากบรรทัด logoSpot แล้วส่ง `project.pageId` เป็นอาร์กิวเมนต์ที่สอง:
`return Response.json(await writeClaim({ ... }, project.pageId));`

- [ ] **Step 11: test เดิมที่เรียก runner**

`tests/content/mode-checks.test.ts`: `writeKnowledge({ kind: "article", subject: "waiting", count: 1 }, null)` และ `writeDraft({ draft: "ชวนมาร่วมทีม รายได้ 50,000 บาทต่อเดือน", count: 1 }, null)`

- [ ] **Step 12: รันให้ผ่าน**

Run: `npx vitest run tests/auth/pages.test.ts tests/content/round-page.test.ts tests/content/claim-route.test.ts tests/content/one-call-run.test.ts tests/content/mode-checks.test.ts && npx tsc --noEmit`
Expected: PASS · tsc ไม่มี error

- [ ] **Step 13: Commit**

```bash
git add src/lib/auth/pages.ts src/lib/content/store.ts src/app/studio/actions.ts src/lib/content/recruit-run.ts src/lib/content/one-call-run.ts src/lib/content/knowledge-run.ts src/lib/content/draft-run.ts src/lib/content/claim-run.ts src/app/api/content-claim/route.ts tests/auth/pages.test.ts tests/content/round-page.test.ts tests/content/claim-route.test.ts tests/content/one-call-run.test.ts tests/content/mode-checks.test.ts
git commit -m "feat(studio): a round is written into the project of a Page the caller looks after"
```

---

### Task 3: รายการ จำนวน และแถบรอลง ตามโปรเจค

**Files:**
- Modify: `src/lib/content/store.ts` (`listContent`, `countByStatus`, `listWaiting`, เพิ่ม `countDraftsByPage`)
- Modify: `src/app/studio/actions.ts` (`contentWorkbench`)
- Modify: `src/lib/content/studio-home.ts` (`HomeInput`, `write`)
- Modify: `src/app/studio/page.tsx`, `src/app/studio/calendar/page.tsx`
- Test: `tests/content/store-page.test.ts` (ใหม่), `tests/content/round-page.test.ts`, `tests/content/studio-home.test.ts`, `tests/content/studio-front-page.test.ts`

**Interfaces:**
- Consumes: `pieceFilter` (Task 1), `projectPage` (Task 2)
- Produces: `listContent(filter: { status?; planHref?; pageId?: string }, limit?, offset?)` · `countByStatus(planHref?: string, pageId?: string)` · `listWaiting(pageId?: string, limit = 50)` · `countDraftsByPage(): Promise<Map<string, number>>` · `contentWorkbench(filter: { status; planHref?; offset?; page?: string })` · `HomeInput.draftsByPage: Map<string, number> | null`

- [ ] **Step 1: test ที่ล้ม — `tests/content/store-page.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The workbench's lists, its counts and the calendar's rail keep to one Page's project (owner, 2026-09-30). */

const db = vi.hoisted(() => {
  const calls: unknown[][] = [];
  const answer = { value: { data: [] as unknown[], error: null, count: 0 } };
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
  currentScope: async () => ({ agents: ["s1"], unowned: true, pages: ["p1", "p2"], owner: null }),
}));

const { countByStatus, countDraftsByPage, listContent, listWaiting } = await import("@/lib/content/store");

beforeEach(() => {
  db.calls.length = 0;
  db.answer.value = { data: [], error: null, count: 0 };
});
const pageEq = () => db.calls.filter((c) => c[0] === "eq" && c[1] === "page_id").map((c) => c[2]);

describe("one Page's project", () => {
  it("is what the workbench lists and counts", async () => {
    await listContent({ status: "draft", pageId: "p1" });
    expect(pageEq()).toEqual(["p1"]);
    db.calls.length = 0;
    await countByStatus(undefined, "p1");
    expect(pageEq()).toEqual(["p1", "p1", "p1"]);
  });

  it("is what the calendar's rail offers", async () => {
    await listWaiting("p2");
    expect(pageEq()).toEqual(["p2"]);
  });

  it("is not narrowed for a caller with no Pages", async () => {
    await listContent({ status: "draft" });
    await listWaiting();
    expect(pageEq()).toEqual([]);
  });

  it("keeps every list to the Pages the caller looks after", async () => {
    await listContent({ status: "draft", pageId: "p1" });
    expect(db.calls).toContainEqual(["or", "page_id.in.(p1,p2),and(page_id.is.null,or(agent_id.in.(s1),agent_id.is.null))"]);
  });

  it("counts each Page's drafts for the cards on /studio", async () => {
    db.answer.value = { data: [{ page_id: "p1" }, { page_id: "p1" }, { page_id: "p2" }], error: null, count: 0 };
    expect(await countDraftsByPage()).toEqual(new Map([["p1", 2], ["p2", 1]]));
  });
});
```

- [ ] **Step 2: test ที่ล้ม — workbench ใน `tests/content/round-page.test.ts`**

เพิ่ม mock ของ store ก่อน `await import(...)`:

```ts
const store = vi.hoisted(() => ({ listContent: vi.fn(async () => []), countByStatus: vi.fn(async () => ({ draft: 0, used: 0, trashed: 0 })) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
```

import `contentWorkbench` เพิ่มจาก `@/app/studio/actions` และเพิ่ม describe:

```ts
describe("the workbench's lists", () => {
  it("are the Page's the request resolved to", async () => {
    project.projectPage.mockResolvedValue({ ok: true, pageId: "p1" });
    await contentWorkbench({ status: "draft", page: "p1" });
    expect(store.listContent).toHaveBeenCalledWith({ status: "draft", planHref: undefined, pageId: "p1" }, 40, 0);
    expect(store.countByStatus).toHaveBeenCalledWith(undefined, "p1");
  });

  it("are empty for a Page taken from the caller while the page was open", async () => {
    project.projectPage.mockResolvedValue({ ok: false, error: NOT_YOUR_PAGE });
    expect(await contentWorkbench({ status: "draft", page: "p9" })).toMatchObject({ items: [], failed: true });
    expect(store.listContent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: test ที่ล้ม — การ์ดบน `/studio`**

`tests/content/studio-home.test.ts`: ใน `base` เพิ่ม `draftsByPage: new Map([["p1", 5]]),` และเพิ่ม test ใน describe เดิม:

```ts
  it("counts each Page's own drafts on its card (owner, 2026-09-30)", () => {
    const cards = homeCards({ ...base, draftsByPage: new Map([["p1", 2]]) });
    expect(tile(cards, 0, "write")?.status).toBe("ร่าง 2 ชิ้น");
    expect(tile(cards, 1, "write")?.status).toBe("ยังไม่มีร่าง");
    expect(tile(homeCards({ ...base, draftsByPage: null }), 0, "write")?.status).toBe("เปิดดู");
  });
```

`tests/content/studio-front-page.test.ts`: ใน mock ของ `@/lib/content/store` เพิ่ม `countDraftsByPage: vi.fn(async () => new Map([["pX", 4]])),` และเพิ่ม test:

```ts
  it("say how many drafts the card's own Page has", async () => {
    const [card] = await cards();
    expect(card.tiles.find((t) => t.key === "write")?.status).toBe("ร่าง 4 ชิ้น");
  });
```

- [ ] **Step 4: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/store-page.test.ts tests/content/round-page.test.ts tests/content/studio-home.test.ts tests/content/studio-front-page.test.ts`
Expected: FAIL — `countDraftsByPage is not a function`, ไม่มี `eq page_id`, สถานะช่องร่างไม่ตรง

- [ ] **Step 5: store — `src/lib/content/store.ts`**

`listContent`:

```ts
/** `offset`: the pieces already shown, for โหลดเพิ่ม — newest first, so the next page is older. `pageId`: one Page's project */
export async function listContent(filter: { status?: ContentStatus; planHref?: string; pageId?: string } = {}, limit = 40, offset = 0): Promise<ContentItem[]> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.planHref) q = q.eq("plan_href", filter.planHref);
  if (filter.pageId) q = q.eq("page_id", filter.pageId);
```

(ที่เหลือเหมือนเดิม) · `countByStatus(planHref?: string, pageId?: string)` และในลูปหลัง `if (planHref) ...` เพิ่ม `if (pageId) q = q.eq("page_id", pageId);`

`listWaiting`:

```ts
export async function listWaiting(pageId?: string, limit = 50): Promise<ContentItem[]> {
  // the staff's pieces: the rail is what the staff may put on their Page — its own project's (2026-09-30)
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select(COLUMNS)
    .eq("format", "post").in("status", ["draft", "used"])
    .or(`publish_state.is.null,publish_state.eq.cancelled,publish_state.eq.failed,${staleClaim()}`);
  if (pageId) q = q.eq("page_id", pageId);
  if (only) q = q.or(only);
```

ต่อจาก `countByStatus`:

```ts
/** How many drafts each Page's project holds, for the cards on /studio (owner, 2026-09-30). */
export async function countDraftsByPage(): Promise<Map<string, number>> {
  const only = await ownersFilter();
  let q = supabaseAdmin().from("ins_content").select("page_id").eq("status", "draft").not("page_id", "is", null);
  if (only) q = q.or(only);
  const { data, error } = await q.or(offPage());
  if (error) throw new Error(error.message);
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { page_id: string }[]) out.set(r.page_id, (out.get(r.page_id) ?? 0) + 1);
  return out;
}
```

- [ ] **Step 6: `contentWorkbench` — `src/app/studio/actions.ts`**

```ts
/** `page`: the Page whose project is open; the server settles it (projectPage), so another Page's cannot be asked for */
export async function contentWorkbench(filter: { status: ContentStatus; planHref?: string; offset?: number; page?: string }): Promise<Workbench> {
  await requireMember();
  try {
    const project = await projectPage(filter.page);
    // a Page taken from the caller while the page was open: nothing of it is listed
    if (!project.ok) return { items: [], counts: { draft: 0, used: 0, trashed: 0 }, failed: true };
    const pageId = project.pageId ?? undefined;
    const offset = Math.max(0, Math.floor(Number(filter.offset) || 0));
    const [items, counts] = await Promise.all([
      listContent({ status: filter.status, planHref: filter.planHref, pageId }, WORKBENCH_PAGE, offset),
      countByStatus(filter.planHref, pageId),
    ]);
    return { items, counts };
```

(`catch` เหมือนเดิม)

- [ ] **Step 7: การ์ด — `src/lib/content/studio-home.ts`**

ใน `HomeInput` ต่อจาก `drafts`:

```ts
  /** each Page's own drafts (its project, owner 2026-09-30); null when not read */
  draftsByPage: Map<string, number> | null;
```

`write`:

```ts
  const write = (pageId?: string): HomeTile => ({
    key: "write", href: pageId ? `/studio/write?page=${encodeURIComponent(pageId)}` : "/studio/write", label: "Organic Studio",
    status: count(pageId ? input.draftsByPage && (input.draftsByPage.get(pageId) ?? 0) : input.drafts, (n) => `ร่าง ${n} ชิ้น`, "ยังไม่มีร่าง"),
  });
```

แก้ comment หัวไฟล์ประโยค "The drafts are the agent's and the opening lines the room's, so those tiles say the same on every card." เป็น
"The drafts are the Page's own (its project, 2026-09-30) and the opening lines the room's, so only that tile says the same on every card."

- [ ] **Step 8: หน้ารวม — `src/app/studio/page.tsx`**

import: `import { countByStatus, countDraftsByPage, listHookTemplates, listPublished } from "@/lib/content/store";`
บรรทัด destructure เป็น `const [counts, hooks, everyone, setup, placed, mine, connected, draftsByPage] = await Promise.all([`
และเพิ่มท้าย `Promise.all`:

```ts
    // each Page's own drafts, for its card (its project, 2026-09-30)
    who.publish ? countDraftsByPage().catch(() => null) : null,
```

และใน `homeCards({...})` ต่อจาก `drafts: counts?.draft ?? null,` เพิ่ม `draftsByPage,`

- [ ] **Step 9: ปฏิทิน — `src/app/studio/calendar/page.tsx`**

แทน

```ts
  const [setup, placed, waiting] = await Promise.all([
    publishSetup(),
    listPublished(from, to).catch(() => []),
    listWaiting().catch(() => []),
  ]);
  // one Page, never all of them together and no switch between them (owner, 2026-09-28): the
  // one its card on /studio asked for, else the first
  const pageFilter = setup.pages.find((p) => p.pageId === params.page)?.pageId ?? setup.pages[0]?.pageId ?? "";
```

ด้วย

```ts
  const [setup, placed] = await Promise.all([
    publishSetup(),
    listPublished(from, to).catch(() => []),
  ]);
  // one Page, never all of them together and no switch between them (owner, 2026-09-28): the
  // one its card on /studio asked for, else the first
  const pageFilter = setup.pages.find((p) => p.pageId === params.page)?.pageId ?? setup.pages[0]?.pageId ?? "";
  // the rail is this Page's project (2026-09-30): what waits for another Page is not offered here
  const waiting = await listWaiting(pageFilter || undefined).catch(() => []);
```

- [ ] **Step 10: รันให้ผ่าน**

Run: `npx vitest run tests/content/store-page.test.ts tests/content/round-page.test.ts tests/content/studio-home.test.ts tests/content/studio-front-page.test.ts && npx tsc --noEmit`
Expected: PASS · tsc ไม่มี error (ถ้า `StudioPage.tsx` ฟ้องเรื่อง `listContent` ยังผ่านได้ — แก้ใน Task 5)

- [ ] **Step 11: Commit**

```bash
git add src/lib/content/store.ts src/app/studio/actions.ts src/lib/content/studio-home.ts src/app/studio/page.tsx src/app/studio/calendar/page.tsx tests/content/store-page.test.ts tests/content/round-page.test.ts tests/content/studio-home.test.ts tests/content/studio-front-page.test.ts
git commit -m "feat(studio): the workbench, the calendar's rail and the front page keep to one Page's project"
```

---

### Task 4: ลงได้เฉพาะเพจของชิ้น

**Files:**
- Modify: `src/lib/content/store.ts` (เพิ่ม `adoptPage`)
- Modify: `src/lib/content/publish-flow.ts` (`clear`, `send`, import)
- Test: `tests/content/publish-flow.test.ts`

**Interfaces:**
- Consumes: `ContentItem.pageId` (Task 1)
- Produces: `adoptPage(id: string, pageId: string): Promise<void>`

- [ ] **Step 1: test ที่ล้ม — `tests/content/publish-flow.test.ts`**

ใน `store` hoisted เพิ่ม `adoptPage: vi.fn(async () => undefined),` และเพิ่ม describe ท้ายไฟล์:

```ts
describe("a piece of one Page's project (owner, 2026-09-30)", () => {
  const TALK = "205";
  beforeEach(() => {
    conn.pageConnections.mockResolvedValue([
      { pageId: PAGE, pageName: "LuckyPlanner", scopes: ["pages_manage_posts"] },
      { pageId: TALK, pageName: "ประกัน Talk", scopes: ["pages_manage_posts"] },
    ]);
  });

  it("is refused on another Page, before Facebook hears of it", async () => {
    row = { ...piece(), pageId: PAGE };
    const r = await publish({ id: "p1", pageId: TALK, at: null });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("LuckyPlanner") });
    expect(fb.postPhoto).not.toHaveBeenCalled();
  });

  it("goes up on its own Page, and is not tied again", async () => {
    row = { ...piece(), pageId: PAGE };
    expect((await publish({ id: "p1", pageId: PAGE, at: null })).ok).toBe(true);
    expect(store.adoptPage).not.toHaveBeenCalled();
  });

  it("on no Page yet, becomes the Page's it goes to", async () => {
    row = { ...piece(), pageId: null };
    expect((await publish({ id: "p1", pageId: TALK, at: null })).ok).toBe(true);
    expect(store.adoptPage).toHaveBeenCalledWith("p1", TALK);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/publish-flow.test.ts`
Expected: FAIL — ชิ้นของ LuckyPlanner ลง ประกัน Talk ได้ · `adoptPage` ไม่ถูกเรียก

- [ ] **Step 3: `adoptPage` — `src/lib/content/store.ts`** (ต่อจาก `recordPublishIf`)

```ts
/** A piece on no Page yet takes the one it is posted to (owner, 2026-09-30): from then on it is that Page's. */
export async function adoptPage(id: string, pageId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_content").update({ page_id: pageId }).eq("id", id).is("page_id", null);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: `clear` และ `send` — `src/lib/content/publish-flow.ts`**

import จาก `./store` เพิ่ม `adoptPage` · ใน `clear` แทน

```ts
  // a Page the caller looks after (src/lib/auth/pages.ts): a post, a schedule and a move alike
  const page = (await myPages().catch(() => [])).find((pg) => pg.pageId === input.pageId);
```

ด้วย

```ts
  const mine = await myPages().catch(() => []);
  // a piece is its Page's (its project, owner 2026-09-30): posted there or nowhere
  if (item.pageId && item.pageId !== input.pageId) {
    const own = mine.find((pg) => pg.pageId === item.pageId)?.pageName;
    return { ok: false, error: own ? `ชิ้นนี้เป็นของเพจ ${own} — ลงได้เฉพาะเพจของตัวเอง` : "ชิ้นนี้เป็นของเพจอื่น — ลงได้เฉพาะเพจของตัวเอง" };
  }
  // a Page the caller looks after (src/lib/auth/pages.ts): a post, a schedule and a move alike
  const page = mine.find((pg) => pg.pageId === input.pageId);
```

ใน `send` ต่อจากบรรทัด `if (!claimAt && !(await claimPublish(...))) return ...;`:

```ts
  // a piece on no Page yet becomes the Page's it goes to; the post goes up either way
  if (!item.pageId) await adoptPage(item.id, page.pageId).catch((e) => console.error("piece not tied to its Page:", e));
```

- [ ] **Step 5: รันให้ผ่าน**

Run: `npx vitest run tests/content/publish-flow.test.ts tests/content/actions-page.test.ts tests/content/publish.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/store.ts src/lib/content/publish-flow.ts tests/content/publish-flow.test.ts
git commit -m "feat(studio): a piece goes up only on its own Page; one on no Page takes the Page it goes to"
```

---

### Task 5: หน้าจอ — หน้าเขียนงานเป็นโปรเจคของเพจ

**Files:**
- Modify: `src/app/studio/StudioPage.tsx`
- Modify: `src/app/studio/ContentStudio.tsx`
- Modify: `src/app/studio/recruit/RecruitTools.tsx`, `src/app/studio/knowledge/KnowledgeTools.tsx`, `src/app/studio/draft/DraftTools.tsx`, `src/app/studio/claim/ClaimTools.tsx`
- Modify: `src/app/studio/PublishPanel.tsx`
- Test: `tests/content/studio-write-page.test.ts` (ใหม่)

**Interfaces:**
- Consumes: `myPages()`, `contentWorkbench({ ...; page })`, `listContent({ ...; pageId })`, `ContentItem.pageId`
- Produces: `ContentStudio` prop `project: { pageId: string; pageName: string } | null` (แทน `page` และ `logoPage`)

client component ไม่มี test ในโปรเจคนี้ — `StudioPage` (server) มี test; ส่วน client ตรวจด้วย tsc, build และ Task 6

- [ ] **Step 0a: test ที่ล้ม — `tests/content/studio-write-page.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** /studio/write opens one Page's project (owner, 2026-09-30): the opened piece's, the card's, or the first. */

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const state = vi.hoisted(() => ({
  mine: [{ pageId: "pA", pageName: "A" }, { pageId: "pB", pageName: "B" }] as { pageId: string; pageName: string }[],
  opened: null as null | { id: string; pageId: string | null },
}));
const actions = vi.hoisted(() => ({
  contentWorkbench: vi.fn(async () => ({ items: [], counts: { draft: 0, used: 0, trashed: 0 } })),
  contentSpend: vi.fn(async () => ({ spent: 0, cap: 30, rounds: null })),
}));
vi.mock("@/lib/auth/pages", () => ({ myPages: vi.fn(async () => state.mine) }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => state.mine) }));
vi.mock("@/lib/content/store", () => ({
  getContent: vi.fn(async () => state.opened), listContent: vi.fn(async () => []), listHookTemplates: vi.fn(async () => []),
}));
vi.mock("@/lib/content/people-store", () => ({ listPeople: vi.fn(async () => []) }));
vi.mock("@/app/studio/actions", () => actions);
vi.mock("@/app/studio/ContentStudio", () => ({ ContentStudio: () => null }));

const { StudioPage } = await import("@/app/studio/StudioPage");
const projectOf = async (args: Parameters<typeof StudioPage>[0]) =>
  ((await StudioPage(args)) as { props: { project: unknown } }).props.project;

beforeEach(() => {
  vi.clearAllMocks();
  state.mine = [{ pageId: "pA", pageName: "A" }, { pageId: "pB", pageName: "B" }];
  state.opened = null;
});

describe("the project /studio/write opens", () => {
  it("is the Page of a piece opened from the calendar, whatever Page comes first", async () => {
    state.opened = { id: ID, pageId: "pB" };
    expect(await projectOf({ open: ID })).toEqual({ pageId: "pB", pageName: "B" });
    expect(actions.contentWorkbench).toHaveBeenCalledWith({ status: "draft", page: "pB" });
  });

  it("is the Page its card asked for, else the first", async () => {
    expect(await projectOf({ page: "pB" })).toEqual({ pageId: "pB", pageName: "B" });
    expect(await projectOf({ page: "not-mine" })).toEqual({ pageId: "pA", pageName: "A" });
    expect(await projectOf({})).toEqual({ pageId: "pA", pageName: "A" });
  });

  it("is none for an agent with no Pages", async () => {
    state.mine = [];
    expect(await projectOf({})).toBeNull();
    expect(actions.contentWorkbench).toHaveBeenCalledWith({ status: "draft", page: undefined });
  });
});
```

- [ ] **Step 0b: รันให้เห็นว่าล้ม**

Run: `npx vitest run tests/content/studio-write-page.test.ts`
Expected: FAIL — `project` undefined (ยังส่ง `page`/`logoPage`)

- [ ] **Step 1: `src/app/studio/StudioPage.tsx`**

ลบ import `can` และ `getViewer` · แทนตัวฟังก์ชันด้วย:

```ts
export async function StudioPage({ hook, open, day, page }: { hook?: string; open?: string; day?: string; page?: string }) {
  // the calendar's แก้ไข: the piece opens in the editor on arrival — in its own Page's project
  const opened = open && /^[0-9a-f-]{36}$/.test(open) ? await getContent(open).catch(() => null) : null;
  // the project (owner, 2026-09-30): one of the caller's Pages — the opened piece's, else the one
  // its card asked for, else the first — or none for an agent with no Pages, as projectPage settles it
  const [mine, connected] = await Promise.all([myPages().catch(() => []), pageConnections().catch(() => [])]);
  const project = mine.find((p) => p.pageId === (opened?.pageId ?? page)) ?? mine[0] ?? null;
  const pageId = project?.pageId;
  const [initial, used, hooks, spend, people] = await Promise.all([
    contentWorkbench({ status: "draft", page: pageId }),
    listContent({ status: "used", pageId }, 20).catch(() => []),
    listHookTemplates().catch(() => []),
    contentSpend(),
    listPeople().catch(() => []),
  ]);
  return (
    <ContentStudio
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
      lengths={LENGTHS}
      hooks={hooks}
      initialHook={hooks.some((h) => h.id === hook) ? hook! : null}
      initial={initial}
      initialUsed={used}
      spend={spend}
      initialOpen={opened}
      forDay={day && /^\d{4}-\d{2}-\d{2}$/.test(day) && fillable(day, todayKey()) ? day : null}
      // nobody of a Page the caller does not look after (final review, 2026-09-29)
      people={peopleFor(visibleTo(people, new Set(connected.map((p) => p.pageId)), new Set(mine.map((p) => p.pageId))), mine, pageId ?? "")}
      project={project ? { pageId: project.pageId, pageName: project.pageName } : null}
    />
  );
}
```

แก้ comment `/** \`page\`: ... */` เหนือฟังก์ชันเป็น `/** \`page\`: the Page whose project opens (from its card on /studio); the first when not given */`

- [ ] **Step 2: `src/app/studio/ContentStudio.tsx`**

ใน `interface Props` แทน `page?` และ `logoPage?` (พร้อม comment ของมัน) ด้วย

```ts
  /** the Page whose project this is (its card on /studio, else the first, 2026-09-30); null for an agent with no Pages */
  project: { pageId: string; pageName: string } | null;
```

ลบ `const PAGE_KEY = "content-page";` และ effect ที่เขียน `localStorage.setItem(PAGE_KEY, page)` (บรรทัด ~348–352)
ใน signature ของ `ContentStudio` แทน `page = "", logoPage` ด้วย `project`

```ts
  const logo = { page: project?.pageId, spot: logoSpot, onSpot: setLogoSpot };
```

ใน `generate()` แทน `...(format !== "script" && logoSpot ? { logoSpot, page: logoPage } : {}),` ด้วย

```ts
      ...(format !== "script" && logoSpot ? { logoSpot } : {}), page: project?.pageId,
```

`reload`: `contentWorkbench({ status: nextTab, planHref: nextPlan || undefined, page: project?.pageId })`
`loadMore`: `contentWorkbench({ status: tab, planHref: plan || undefined, offset: items.length, page: project?.pageId })`

หัวหน้า:

```tsx
        <h1 className="text-xl font-semibold">Organic Studio{project && <span className="font-normal text-[var(--ct-mute)]"> · {project.pageName}</span>}</h1>
```

"ตั้งเวลาหลายชิ้น" — ใน `loadPages` แทนสามบรรทัดท้าย (`let kept`, `try { kept = ... }`, `setPickPage(...)`) ด้วย

```ts
    // what is scheduled from here goes on this project's Page (2026-09-30), when it may be posted to
    setPickPage(project && usable.some((p) => p.pageId === project.pageId) ? project.pageId : "");
```

ใน `scheduleMany` ลบบรรทัด `try { localStorage.setItem("content-page", pickPage); } catch { /* not kept */ }` และเปลี่ยน
`const pageName = pages?.find((p) => p.pageId === pickPage)?.pageName ?? "เพจ";` เป็น `const pageName = project?.pageName ?? "เพจ";`

ใน JSX แทนเงื่อนไข `) : pages.length === 0 ? (` และข้อความใต้มัน ด้วย

```tsx
              ) : !pickPage ? (
                <p className="text-sm text-[var(--ct-alert)]">เพจ {project?.pageName ?? "นี้"} ยังไม่ได้อนุญาตให้ระบบโพสต์ — เชื่อมเพจที่หน้าตั้งค่าเพจก่อน</p>
```

และแทน `<select value={pickPage} ...>...</select>` ด้วย

```tsx
                  <span className="text-sm">ลง <b>{project?.pageName}</b></span>
```

- [ ] **Step 3: ฟอร์มส่งเพจของโปรเจคทุกครั้ง**

`RecruitTools.tsx`, `KnowledgeTools.tsx`, `DraftTools.tsx` แทน

```ts
      ...(format !== "script" && logo.spot ? { logoSpot: logo.spot, page: logo.page } : {}) };
```

ด้วย

```ts
      ...(format !== "script" && logo.spot ? { logoSpot: logo.spot } : {}), page: logo.page };
```

`ClaimTools.tsx` แทน

```ts
      if (round.format !== "script" && logo.spot) {
        form.set("logoSpot", logo.spot);
        if (logo.page) form.set("page", logo.page);
      }
```

ด้วย

```ts
      if (round.format !== "script" && logo.spot) form.set("logoSpot", logo.spot);
      // the project's Page: the round is written into it (2026-09-30)
      if (logo.page) form.set("page", logo.page);
```

- [ ] **Step 4: `src/app/studio/PublishPanel.tsx`**

ต่อจาก `const pageName = (id: ...) => ...;` เพิ่ม

```ts
  // a piece of a Page's project goes on that Page and no other (2026-09-30); one on no Page picks
  const target = item.pageId ?? pageId;
```

เปลี่ยน `pageId` เป็น `target` ในห้าจุด: `ask(\`โพสต์ลงเพจ ${pageName(pageId)} ...\`)`, `localStorage.setItem(PAGE_KEY, pageId)`,
`scheduleNextOpen({ id: item.id, pageId, ... })` → `pageId: target`, `publishPiece({ id: item.id, pageId, ... })` → `pageId: target`,
และ `disabled={... || !pageId || drawing}` → `!target`

แทน `<select value={pageId} ... aria-label="เพจที่จะโพสต์" ...>...</select>` ด้วย

```tsx
          {item.pageId ? (
            <p className={`${field} flex items-center`}>ลง {pageName(item.pageId)}</p>
          ) : (
            <select value={pageId} onChange={(e) => setPageId(e.target.value)} aria-label="เพจที่จะโพสต์" className={field}>
              {setup.pages.map((p) => (
                <option key={p.pageId} value={p.pageId} disabled={!p.canPost}>{p.pageName}{p.canPost ? "" : " (ยังไม่ได้อนุญาตให้โพสต์)"}</option>
              ))}
            </select>
          )}
```

- [ ] **Step 5: ตรวจ**

Run: `npx vitest run tests/content/studio-write-page.test.ts && npx tsc --noEmit && npx eslint && npx vitest run`
Expected: test ใหม่ผ่าน · tsc ไม่มี error · eslint 0 error (warning เดิม 8 ตัว) · test ผ่านทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add tests/content/studio-write-page.test.ts src/app/studio/StudioPage.tsx src/app/studio/ContentStudio.tsx src/app/studio/recruit/RecruitTools.tsx src/app/studio/knowledge/KnowledgeTools.tsx src/app/studio/draft/DraftTools.tsx src/app/studio/claim/ClaimTools.tsx src/app/studio/PublishPanel.tsx
git commit -m "feat(studio): the workbench is one Page's project — named at the top, posting only to it"
```

---

### Task 6: ตรวจรวมและขึ้นระบบ

**Files:** ไม่มีไฟล์ใหม่ — ฐานข้อมูลจริง, `main`, Vercel

- [ ] **Step 1: ตรวจรวมทีละคำสั่ง**

Run: `npx tsc --noEmit` → `npx eslint` → `npx vitest run` → `NEXT_DIST_DIR=.next-build npx next build`
Expected: ผ่านทุกตัว (eslint 0 error)

- [ ] **Step 2: รัน migration บน Supabase จริง**

`apply_migration` project `cenysylrzbwfrtuqoeqk`, name `content_page`, query = เนื้อหาของ `supabase/migrations/20260930_content_page.sql`

- [ ] **Step 3: ยืนยันข้อมูล**

```sql
select c.page_id, c.status, (s.agent_id is not null) as by_staff, count(*)
from public.ins_content c left join public.ins_staff s on s.agent_id = c.agent_id
group by 1, 2, 3 order by 1, 2, 3;
```

Expected: ไม่มีแถว `by_staff = true` ที่ `page_id` ว่าง · ชิ้น `used` ของ 105982528649026 เพิ่มขึ้น 2 · ของตัวแทน 133350 ยังว่าง

- [ ] **Step 4: ขึ้น `main`**

```bash
git fetch origin
git switch main
git merge --ff-only origin/main
git merge --ff-only page-projects
git push origin main
```

ถ้า `--ff-only` ไม่ผ่าน (มีคนดัน main ระหว่างนี้) ให้หยุดและบอกเจ้าของ

- [ ] **Step 5: ตรวจบนเว็บจริง**

Vercel: deployment ของ commit ล่าสุดเป็น READY และ alias `advisortool.app` · `https://advisortool.app/api/health` → `ok: true` ·
`get_runtime_errors` ไม่มี error ใหม่ในชั่วโมงนั้น · แจ้งเจ้าของให้ลองเปิดการ์ด LuckyPlanner ที่ `/studio` แล้วเห็น 2 ชิ้นหาทีมในแท็บใช้จริง และการ์ดเพจอื่นไม่มี
