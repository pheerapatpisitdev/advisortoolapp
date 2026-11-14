import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ins_library_marks in memory: the primary key (agent_id, item, kind) answers a second insert with
 * Postgres's duplicate-key code, as the real table would; eq filters, delete … select and range are honoured.
 */
type Row = { agent_id: string; item: string; kind: string };
type Step = { method: string; args: unknown[] };
const mem = vi.hoisted(() => ({
  rows: [] as { agent_id: string; item: string; kind: string }[],
  queries: [] as { method: string; args: unknown[] }[][],
  /** answers the next insert with this error instead of writing (a second press landing first) */
  insertError: null as null | { message: string; code: string },
  /** answers every query on the table with this error */
  failAll: null as null | { message: string },
}));

function answer(steps: Step[]): { data: unknown; error: unknown } {
  if (mem.failAll) return { data: null, error: mem.failAll };
  const eqs = steps.filter((s) => s.method === "eq");
  const neqs = steps.filter((s) => s.method === "neq");
  const hit = (r: Row) => eqs.every((s) => String(r[s.args[0] as keyof Row]) === String(s.args[1]))
    && neqs.every((s) => String(r[s.args[0] as keyof Row]) !== String(s.args[1]));
  const insert = steps.find((s) => s.method === "insert");
  if (insert) {
    if (mem.insertError) { const e = mem.insertError; mem.insertError = null; return { data: null, error: e }; }
    const row = insert.args[0] as Row;
    if (mem.rows.some((r) => r.agent_id === row.agent_id && r.item === row.item && r.kind === row.kind)) {
      return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
    }
    mem.rows.push({ agent_id: row.agent_id, item: row.item, kind: row.kind });
    return { data: null, error: null };
  }
  if (steps.some((s) => s.method === "delete")) {
    const gone = mem.rows.filter(hit);
    mem.rows = mem.rows.filter((r) => !hit(r));
    return { data: steps.some((s) => s.method === "select") ? gone : null, error: null };
  }
  let out = mem.rows.filter(hit);
  const range = steps.find((s) => s.method === "range");
  if (range) out = out.slice(range.args[0] as number, (range.args[1] as number) + 1);
  else out = out.slice(0, 1000); // PostgREST's own cap
  return { data: out.map((r) => ({ ...r })), error: null };
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "ins_library_marks") throw new Error(`unexpected table ${table}`);
      const steps: Step[] = [];
      mem.queries.push(steps);
      const chain: object = new Proxy({}, {
        get(_t, method) {
          if (method === "then") return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(answer(steps)).then(ok, bad);
          return (...args: unknown[]) => { steps.push({ method: String(method), args }); return chain; };
        },
      });
      return chain;
    },
  }),
}));
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);

import { LIBRARY } from "@/lib/scene-library/catalog";
import { marksOf, toggleMark, wantCounts } from "@/lib/scene-library/marks";
import { toggleLibraryMark } from "@/app/studio/library/actions";
import { OWNER } from "../helpers/signed-in";
import { DEMO_ID } from "@/lib/auth/demo";
import { MARK_FAILED } from "@/lib/scene-library/mark-state";

const READY = LIBRARY.find((i) => i.ready)!.id;
const UNBUILT = LIBRARY.filter((i) => !i.ready).map((i) => i.id);
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

beforeEach(() => { mem.rows = []; mem.queries.length = 0; mem.insertError = null; mem.failAll = null; });

describe("toggleMark", () => {
  it("saves, then a second press takes it off", async () => {
    expect(await toggleMark(A, READY, "save")).toEqual({ ok: true, on: true });
    expect(await marksOf(A)).toEqual({ saved: [READY], wanted: [] });
    expect(await toggleMark(A, READY, "save")).toEqual({ ok: true, on: false });
    expect(await marksOf(A)).toEqual({ saved: [], wanted: [] });
  });
  it("saves an unbuilt item too, and wants it apart from the save", async () => {
    expect(await toggleMark(A, UNBUILT[0], "save")).toEqual({ ok: true, on: true });
    expect(await toggleMark(A, UNBUILT[0], "want")).toEqual({ ok: true, on: true });
    expect(await marksOf(A)).toEqual({ saved: [UNBUILT[0]], wanted: [UNBUILT[0]] });
    expect(await toggleMark(A, UNBUILT[0], "want")).toEqual({ ok: true, on: false });
    expect(await marksOf(A)).toEqual({ saved: [UNBUILT[0]], wanted: [] });
  });
  it("refuses a want on a piece that is ready, writing nothing", async () => {
    expect(await toggleMark(A, READY, "want")).toEqual({ ok: false, error: "ชิ้นนี้ใช้ได้แล้ว ไม่ต้องกดอยากได้" });
    expect(mem.rows).toEqual([]);
  });
  it("refuses an item not in the catalogue, and a kind that is neither save nor want", async () => {
    expect(await toggleMark(A, "no-such-piece", "save")).toEqual({ ok: false, error: "ไม่พบรายการนี้ในคลัง" });
    expect(await toggleMark(A, UNBUILT[0], "x" as never)).toEqual({ ok: false, error: "ไม่พบรายการนี้ในคลัง" });
    expect(mem.rows).toEqual([]);
    expect(mem.queries).toHaveLength(0);
  });
  it("a duplicate key on insert (a second press landed first) means it is on, never an error", async () => {
    mem.insertError = { message: "duplicate key value violates unique constraint \"ins_library_marks_pkey\"", code: "23505" };
    expect(await toggleMark(A, READY, "save")).toEqual({ ok: true, on: true });
  });
  it("two presses at once both answer on, and one row is kept", async () => {
    const [x, y] = await Promise.all([toggleMark(A, READY, "save"), toggleMark(A, READY, "save")]);
    expect(x).toEqual({ ok: true, on: true });
    expect(y).toEqual({ ok: true, on: true });
    expect(mem.rows).toHaveLength(1);
  });
  it("a database failure is a Thai line, not the raw error", async () => {
    mem.failAll = { message: "connection reset" };
    const r = await toggleMark(A, READY, "save");
    expect(r.ok).toBe(false);
    expect(!r.ok && /[ก-๙]/.test(r.error) && !/connection/.test(r.error)).toBe(true);
    // the board's own line for a failed call: one string for both
    expect(r).toEqual({ ok: false, error: MARK_FAILED });
  });
  it("keeps each viewer's marks apart", async () => {
    await toggleMark(A, READY, "save");
    expect(await marksOf(B)).toEqual({ saved: [], wanted: [] });
  });
});

describe("wantCounts", () => {
  it("counts want rows per item, across viewers, and never saves", async () => {
    await toggleMark(A, UNBUILT[0], "want");
    await toggleMark(B, UNBUILT[0], "want");
    await toggleMark(B, UNBUILT[1], "want");
    await toggleMark(A, UNBUILT[1], "save");
    await toggleMark(A, READY, "save");
    expect(await wantCounts()).toEqual({ [UNBUILT[0]]: 2, [UNBUILT[1]]: 1 });
    const read = mem.queries.at(-1)!;
    expect(read.find((s) => s.method === "select")?.args[0]).toBe("item");
    expect(read.some((s) => s.method === "eq" && s.args[0] === "kind" && s.args[1] === "want")).toBe(true);
  });
  it("reads past PostgREST's 1,000-row cap", async () => {
    for (let i = 0; i < 1500; i++) mem.rows.push({ agent_id: `agent-${i}`, item: UNBUILT[i % 2], kind: "want" });
    expect(await wantCounts()).toEqual({ [UNBUILT[0]]: 750, [UNBUILT[1]]: 750 });
  });
  it("leaves out the shared demo account's votes, reading past the cap all the same", async () => {
    await toggleMark(A, UNBUILT[0], "want");
    await toggleMark(DEMO_ID, UNBUILT[0], "want");
    await toggleMark(DEMO_ID, UNBUILT[1], "want");
    expect(await wantCounts()).toEqual({ [UNBUILT[0]]: 1 });
    expect(mem.queries.at(-1)!.some((s) => s.method === "neq" && s.args[0] === "agent_id" && s.args[1] === DEMO_ID)).toBe(true);
    mem.rows = [];
    for (let i = 0; i < 1500; i++) mem.rows.push({ agent_id: i % 3 ? `agent-${i}` : DEMO_ID, item: UNBUILT[0], kind: "want" });
    expect(await wantCounts()).toEqual({ [UNBUILT[0]]: 1000 });
  });
  it("is empty with no votes", async () => {
    expect(await wantCounts()).toEqual({});
  });
});

describe("toggleLibraryMark", () => {
  it("marks for the signed-in viewer", async () => {
    expect(await toggleLibraryMark(READY, "save")).toEqual({ ok: true, on: true });
    expect(mem.rows).toEqual([{ agent_id: OWNER.agentId, item: READY, kind: "save" }]);
  });
  it("refuses what toggleMark refuses", async () => {
    expect(await toggleLibraryMark(READY, "want")).toEqual({ ok: false, error: "ชิ้นนี้ใช้ได้แล้ว ไม่ต้องกดอยากได้" });
    expect(await toggleLibraryMark(UNBUILT[0], "x")).toEqual({ ok: false, error: "ไม่พบรายการนี้ในคลัง" });
    expect((await toggleLibraryMark(42 as never, "save")).ok).toBe(false);
  });
});

describe("migration", () => {
  const sql = readFileSync("supabase/migrations/20261210_library_marks.sql", "utf8");
  const fn = (s: string, name: string) => {
    const at = s.indexOf(`create or replace function public.${name}`);
    expect(at, name).toBeGreaterThanOrEqual(0);
    return s.slice(at, s.indexOf("$$;", s.indexOf("$$", s.indexOf("$$", at) + 2)) + 3);
  };
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("--"));

  it("makes the table, service-role only", () => {
    expect(sql).toMatch(/create table if not exists public\.ins_library_marks/);
    expect(sql).toMatch(/agent_id uuid not null/);
    expect(sql).toMatch(/check \(kind in \('save', ?'want'\)\)/);
    expect(sql).toMatch(/primary key \(agent_id, item, kind\)/);
    expect(sql).toMatch(/alter table public\.ins_library_marks enable row level security/);
    expect(sql).toMatch(/revoke all on public\.ins_library_marks from public, anon, authenticated/);
    expect(sql).toMatch(/grant all on public\.ins_library_marks to service_role/);
    expect(sql).not.toMatch(/create policy/);
  });
  it("member delete takes the marks too, the live function otherwise unchanged", () => {
    const mine = fn(sql, "ins_member_delete");
    const live = fn(readFileSync("supabase/migrations/20261113_prompt_drafts.sql", "utf8"), "ins_member_delete");
    expect(mine).toMatch(/delete from ins_library_marks where agent_id = p_member;/);
    expect(lines(mine).filter((l) => !/ins_library_marks/.test(l))).toEqual(lines(live));
    expect(mine.indexOf("ins_library_marks")).toBeLessThan(mine.indexOf("delete from ins_members"));
    expect(sql).toMatch(/revoke all on function public\.ins_member_delete\(uuid\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.ins_member_delete\(uuid\) to service_role/);
  });
  it("the demo wipe takes the marks too, the live function otherwise unchanged", () => {
    const mine = fn(sql, "ins_demo_wipe");
    const live = fn(readFileSync("supabase/migrations/20261209_demo_account.sql", "utf8"), "ins_demo_wipe");
    expect(mine).toMatch(/delete from public\.ins_library_marks where agent_id = demo;/);
    expect(lines(mine).filter((l) => !/ins_library_marks/.test(l))).toEqual(lines(live));
    expect(mine.indexOf("ins_library_marks")).toBeLessThan(mine.indexOf("update public.ins_demo set wiped_at"));
    expect(sql).toMatch(/revoke all on function public\.ins_demo_wipe\(\) from public, anon, authenticated/);
    // the nightly job already exists (20261209): scheduling it again would add a second one
    expect(sql).not.toMatch(/cron\.schedule/);
  });
  it("a later migration that redefines either function keeps the marks' delete", () => {
    // 20261211_whats_new.sql redefines both to add มีอะไรใหม่'s reads (tests/updates/migration.test.ts)
    const later = readdirSync("supabase/migrations").filter((f) => f > "20261210_library_marks.sql");
    for (const f of later) {
      const text = readFileSync(`supabase/migrations/${f}`, "utf8");
      if (/function public\.ins_member_delete/.test(text)) expect(fn(text, "ins_member_delete"), f).toMatch(/delete from ins_library_marks where agent_id = p_member;/);
      if (/function public\.ins_demo_wipe/.test(text)) expect(fn(text, "ins_demo_wipe"), f).toMatch(/delete from public\.ins_library_marks where agent_id = demo;/);
    }
  });
});

