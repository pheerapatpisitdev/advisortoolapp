import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Contacts kept per Page. The database and the sign-in are fakes; the migration is read as text. */

interface Call { table: string; op: string; payload?: unknown; filters: [string, unknown][] }
const calls: Call[] = [];
let one: Record<string, unknown> | null = null;

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {
    upsert: (payload: unknown) => { call.op = "upsert"; call.payload = payload; return b; },
    delete: () => { call.op = "delete"; return b; },
    select: () => b,
    eq: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    maybeSingle: async () => { calls.push(call); return { data: one, error: null }; },
    then: (resolve: (v: unknown) => unknown) => { calls.push(call); return resolve({ data: null, error: null }); },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: builder }) }));
const audits = vi.hoisted(() => [] as unknown[][]);
vi.mock("@/lib/auth/viewer", () => ({ requireStaff: async () => ({}), audit: async (...a: unknown[]) => { audits.push(a); } }));
vi.mock("@/lib/auth/pages", () => ({ myPages: async () => [{ pageId: "mine" }] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { cleanContact, contactBlock, getPageContact, savePageContact } = await import("@/lib/ads/page-contact");
const { pageContact, updatePageContact } = await import("@/app/studio/ads/actions");

const none = { agentName: null, lineId: null, inboxUrl: null };
beforeEach(() => { calls.length = 0; one = null; audits.length = 0; });

describe("cleanContact", () => {
  it("trims, strips one @ and inner spaces from the Line ID", () => {
    expect(cleanContact({ agentName: "  พี่ปอ ", lineId: "  @team paui ", inboxUrl: " https://m.me/x " }))
      .toEqual({ agentName: "พี่ปอ", lineId: "teampaui", inboxUrl: "https://m.me/x" });
  });
  it("refuses an inbox that is not https", () => {
    for (const inboxUrl of ["http://x", "javascript:alert(1)", "m.me/x"]) {
      expect(cleanContact({ inboxUrl })).toEqual({ error: "ลิงก์ Inbox ต้องขึ้นต้นด้วย https://" });
    }
  });
  it("stores the scheme in lower case, so the table's ^https:// check passes", () => {
    expect(cleanContact({ inboxUrl: "HTTPS://m.me/X" })).toEqual({ ...none, inboxUrl: "https://m.me/X" });
    expect(cleanContact({ inboxUrl: "Https://m.me/x" })).toEqual({ ...none, inboxUrl: "https://m.me/x" });
    // parsed as https by URL, but not written as https://
    expect(cleanContact({ inboxUrl: "https:m.me/x" })).toEqual({ error: "ลิงก์ Inbox ต้องขึ้นต้นด้วย https://" });
  });
  it("says a link over 200 characters is too long, not that it is not https", () => {
    const inboxUrl = `https://m.me/${"a".repeat(200)}`;
    expect(cleanContact({ inboxUrl })).toEqual({ error: "ลิงก์ Inbox ยาวเกินไป (ไม่เกิน 200 ตัวอักษร)" });
    expect(cleanContact({ inboxUrl: inboxUrl.slice(0, 200) })).toEqual({ ...none, inboxUrl: inboxUrl.slice(0, 200) });
  });
  it("turns empty strings into null and cuts to the lengths", () => {
    expect(cleanContact({ agentName: " ", lineId: "@", inboxUrl: "" })).toEqual(none);
    const c = cleanContact({ agentName: "a".repeat(80), lineId: "b".repeat(80) }) as { agentName: string; lineId: string };
    expect([c.agentName.length, c.lineId.length]).toEqual([60, 40]);
  });
});

describe("contactBlock", () => {
  it("lists what is set", () => {
    expect(contactBlock({ agentName: "พี่ปอ", lineId: "paui", inboxUrl: "https://m.me/x" }))
      .toBe("👉 พี่ปอ\n📲 Line: @paui\n👉 Inbox: https://m.me/x");
    expect(contactBlock({ ...none, lineId: "paui" })).toBe("📲 Line: @paui");
  });
  it("invites a chat when nothing is set", () => {
    expect(contactBlock(none)).toBe("ทักแชทได้เลย");
    expect(contactBlock(null)).toBe("ทักแชทได้เลย");
  });
});

describe("the store", () => {
  it("reads a row into camelCase", async () => {
    one = { agent_name: "ปอ", line_id: "paui", inbox_url: null };
    expect(await getPageContact("p1")).toEqual({ agentName: "ปอ", lineId: "paui", inboxUrl: null });
    expect(calls[0].filters).toEqual([["page_id", "p1"]]);
  });
  it("deletes the row when all three are null", async () => {
    await savePageContact("p1", none);
    expect(calls).toEqual([{ table: "ins_page_contact", op: "delete", filters: [["page_id", "p1"]] }]);
  });
  it("upserts when something is set", async () => {
    await savePageContact("p1", { ...none, lineId: "paui" });
    expect(calls[0].op).toBe("upsert");
    expect(calls[0].payload).toMatchObject({ page_id: "p1", line_id: "paui", agent_name: null });
  });
});

describe("the actions", () => {
  it("refuse a Page that is not the owner's and write nothing", async () => {
    expect(await updatePageContact("other", { lineId: "x" })).toEqual({ ok: false, error: "เพจนี้ยังไม่ได้เชื่อมกับระบบ" });
    expect(await pageContact("other")).toEqual({ ok: false, error: "เพจนี้ยังไม่ได้เชื่อมกับระบบ" });
    expect(calls).toEqual([]);
  });
  it("refuse a bad inbox without writing", async () => {
    expect((await updatePageContact("mine", { inboxUrl: "http://x" })).ok).toBe(false);
    expect(calls).toEqual([]);
    expect(audits).toEqual([]);
  });
  it("save and read back for the owner's Page; an empty form clears", async () => {
    expect(await updatePageContact("mine", { lineId: "@ab c" })).toEqual({ ok: true });
    expect(calls[0].payload).toMatchObject({ line_id: "abc" });
    expect(audits).toEqual([["ads-page-contact", "mine", { agentName: null, lineId: "abc", inboxUrl: null }]]);
    calls.length = 0;
    expect(await updatePageContact("mine", {})).toEqual({ ok: true });
    expect(calls[0].op).toBe("delete");
    expect(await pageContact("mine")).toEqual({ ok: true, contact: null });
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261009_page_contact.sql", "utf8");
  it("holds the checks and is locked to service_role", () => {
    expect(sql).toContain("char_length(agent_name) <= 60");
    expect(sql).toContain("char_length(line_id) <= 40");
    expect(sql).toContain("char_length(inbox_url) <= 200");
    expect(sql).toContain("'^https://'");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("grant all on public.ins_page_contact to service_role");
  });
});
