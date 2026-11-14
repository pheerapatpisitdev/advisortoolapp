import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ins_library_uploads and the content-media bucket in memory: eq / in filters, order, a head count,
 * insert, update … select, delete … select, maybeSingle; storage upload / remove / download.
 */
type Row = {
  id: string; agent_id: string; kind: string; name: string; note: string; paths: string[]; state: string;
  reason: string | null; decided_by: string | null; decided_at: string | null; created_at: string;
};
type Step = { method: string; args: unknown[] };
const mem = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  files: new Map<string, { bytes: Buffer; type: string }>(),
  uploads: [] as string[],
  removed: [] as string[],
  queries: [] as { method: string; args: unknown[] }[][],
  insertError: null as null | { message: string },
  failAll: null as null | { message: string },
  deleteError: null as null | { message: string },
  clock: 0,
}));

/** who the account lookups say an id is: a row, nobody (null), or a failed read (throws); and whether the outside systems are set up */
const people = vi.hoisted(() => ({
  agent: null as unknown, member: null as unknown, superAdmin: null as unknown, bluewealth: null as unknown, kingclub: null as unknown,
  bwSet: true, kcSet: true, asked: [] as string[],
}));
const HANG = vi.hoisted(() => Symbol("never answers"));
const look = (name: string, v: unknown) => {
  people.asked.push(name);
  if (v === HANG) return new Promise(() => {});
  if (v instanceof Error) throw v;
  return v;
};
vi.mock("@/lib/auth/viewer", () => ({
  agentById: async () => look("agent", people.agent),
  memberById: async () => look("member", people.member),
  superAdminById: async () => look("super", people.superAdmin),
}));
vi.mock("@/lib/auth/bluewealth", () => ({
  bluewealthConfigured: () => people.bwSet,
  bluewealthAgentById: async () => look("bluewealth", people.bluewealth),
}));
vi.mock("@/lib/auth/kingclub", () => ({
  kingclubConfigured: () => people.kcSet,
  kingclubAgentById: async () => look("kingclub", people.kingclub),
}));

function answer(steps: Step[]): { data: unknown; error: unknown; count?: number } {
  if (mem.failAll) return { data: null, error: mem.failAll };
  const rows = mem.rows as Row[];
  const get = (r: Row, k: string) => (r as unknown as Record<string, unknown>)[k];
  const hit = (r: Row) => steps.every((s) => {
    if (s.method === "eq") return String(get(r, s.args[0] as string)) === String(s.args[1]);
    if (s.method === "in") return (s.args[1] as unknown[]).includes(get(r, s.args[0] as string));
    return true;
  });
  const insert = steps.find((s) => s.method === "insert");
  if (insert) {
    if (mem.insertError) return { data: null, error: mem.insertError };
    const row = insert.args[0] as Record<string, unknown>;
    mem.rows.push({ reason: null, decided_by: null, decided_at: null, note: "", paths: [], ...row, created_at: new Date(Date.UTC(2026, 10, 14, 0, 0, mem.clock++)).toISOString() });
    return { data: null, error: null };
  }
  const update = steps.find((s) => s.method === "update");
  if (update) {
    const gone = rows.filter(hit);
    for (const r of gone) Object.assign(r, update.args[0]);
    return { data: gone.map((r) => ({ ...r })), error: null };
  }
  if (steps.some((s) => s.method === "delete")) {
    if (mem.deleteError) return { data: null, error: mem.deleteError };
    const gone = rows.filter(hit);
    mem.rows = rows.filter((r) => !hit(r));
    return { data: gone.map((r) => ({ ...r })), error: null };
  }
  let out = rows.filter(hit);
  const order = steps.find((s) => s.method === "order");
  if (order) {
    const asc = (order.args[1] as { ascending: boolean }).ascending;
    out = [...out].sort((a, b) => (String(get(a, order.args[0] as string)) < String(get(b, order.args[0] as string)) ? -1 : 1) * (asc ? 1 : -1));
  }
  const sel = steps.find((s) => s.method === "select");
  if ((sel?.args[1] as { head?: boolean } | undefined)?.head) return { data: null, error: null, count: out.length };
  if (steps.some((s) => s.method === "maybeSingle")) return { data: out[0] ? { ...out[0] } : null, error: null };
  return { data: out.map((r) => ({ ...r })), error: null };
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "ins_library_uploads") throw new Error(`unexpected table ${table}`);
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
    storage: {
      from: (bucket: string) => {
        if (bucket !== "content-media") throw new Error(`unexpected bucket ${bucket}`);
        return {
          upload: async (path: string, bytes: Buffer, opts: { contentType: string }) => {
            mem.uploads.push(path);
            mem.files.set(path, { bytes, type: opts.contentType });
            return { error: null };
          },
          remove: async (paths: string[]) => { mem.removed.push(...paths); for (const p of paths) mem.files.delete(p); return { error: null }; },
          download: async (path: string) => {
            const f = mem.files.get(path);
            return f ? { data: new Blob([new Uint8Array(f.bytes)], { type: f.type }), error: null } : { data: null, error: { message: "not found" } };
          },
        };
      },
    },
  }),
}));

import {
  decideUpload, deleteUpload, myUploads, okUploads, readableUpload, sendUpload, sharedUploads, uploadFile, waitingUploads, withdrawUpload,
} from "@/lib/scene-library/uploads";
import { FILE_MAX, PER_PERSON, REASONS } from "@/lib/scene-library/upload-rules";
import { DEMO_ID } from "@/lib/auth/demo";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OWNER = "00000000-0000-4000-8000-0000000000ff";
const member = { agentId: A, owner: false, demo: false };
const owner = { agentId: OWNER, owner: true, demo: false };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const png = { bytes: PNG };
const jpg = { bytes: JPG };
const good = { kind: "part", name: "ตะกร้าผลไม้", note: "", rights: true, files: [png] };

const seed = (over: Partial<Row>) => {
  mem.rows.push({ id: crypto.randomUUID(), agent_id: A, kind: "part", name: "x", note: "", paths: ["library/a.png"], state: "wait", reason: null, decided_by: null, decided_at: null, created_at: new Date(Date.UTC(2026, 10, 14, 0, 0, mem.clock++)).toISOString(), ...over });
  return mem.rows[mem.rows.length - 1] as Row;
};

beforeEach(() => {
  mem.rows = []; mem.files.clear(); mem.uploads.length = 0; mem.removed.length = 0; mem.queries.length = 0;
  mem.insertError = null; mem.failAll = null; mem.deleteError = null; mem.clock = 0;
  // by default the sender is a UnitClub agent, still there
  Object.assign(people, { agent: { id: A }, member: null, superAdmin: null, bluewealth: null, kingclub: null, bwSet: true, kcSet: true, asked: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe("sendUpload: refusals", () => {
  const refused = async (who: typeof member, v: Parameters<typeof sendUpload>[1], error: string) => {
    expect(await sendUpload(who, v)).toEqual({ ok: false, error });
    expect(mem.uploads).toEqual([]);
    expect(mem.rows).toEqual([]);
  };
  it("the demo account cannot", () => refused({ ...member, agentId: DEMO_ID, demo: true }, good, "บัญชีทดลองอัปโหลดไม่ได้"));
  it("a bad kind", () => refused(member, { ...good, kind: "video" }, "เลือกแบบที่จะส่ง"));
  it("an empty or long name", async () => {
    await refused(member, { ...good, name: "   " }, "ตั้งชื่อ ไม่เกิน 60 ตัวอักษร");
    await refused(member, { ...good, name: "ก".repeat(61) }, "ตั้งชื่อ ไม่เกิน 60 ตัวอักษร");
  });
  it("a long note", () => refused(member, { ...good, note: "ก".repeat(301) }, "หมายเหตุยาวเกิน 300 ตัวอักษร"));
  it("a part with no file or two", async () => {
    await refused(member, { ...good, files: [] }, "เลือกไฟล์ภาพก่อนส่ง");
    await refused(member, { ...good, files: [png, png] }, "เลือกไฟล์ภาพก่อนส่ง");
  });
  it("a part that is a JPEG", () => refused(member, { ...good, files: [jpg] }, "ชิ้นส่วนภาพรับเฉพาะไฟล์ PNG"));
  it("an SVG is refused before anything is stored", async () => {
    const svg = { bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") };
    await refused(member, { ...good, files: [svg] }, "ชิ้นส่วนภาพรับเฉพาะไฟล์ PNG");
    await refused(member, { ...good, kind: "style", files: [svg] }, "รับเฉพาะรูป JPG หรือ PNG");
    await refused(member, { kind: "ask", name: "อยากได้", note: "", rights: false, files: [svg] }, "รับเฉพาะรูป JPG หรือ PNG");
  });
  it("a file over 5 MB", async () => {
    const big = { bytes: Buffer.concat([PNG, Buffer.alloc(FILE_MAX)]) };
    await refused(member, { ...good, files: [big] }, "ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่");
  });
  it("a part or style without the rights box", async () => {
    await refused(member, { ...good, rights: false }, "ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง");
    await refused(member, { ...good, kind: "style", files: [jpg], rights: false }, "ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง");
  });
  it("an ask with four screenshots", () => refused(member, { kind: "ask", name: "อยากได้", note: "", rights: false, files: [png, png, png, png] }, "แนบภาพหน้าจอได้ไม่เกิน 3 ภาพ"));
});

describe("sendUpload: storing", () => {
  it("a member's part waits, its file under library/ as a png", async () => {
    const r = await sendUpload(member, { ...good, name: "  ตะกร้า  ", note: "โน้ต" });
    expect(r).toMatchObject({ ok: true, state: "wait" });
    expect(mem.uploads).toHaveLength(1);
    expect(mem.uploads[0]).toMatch(/^library\/[0-9a-f-]{36}\.png$/);
    expect(mem.files.get(mem.uploads[0])?.type).toBe("image/png");
    expect(mem.rows).toHaveLength(1);
    expect(mem.rows[0]).toMatchObject({ agent_id: A, kind: "part", name: "ตะกร้า", note: "โน้ต", state: "wait", paths: mem.uploads });
    expect(r.ok && r.id).toBe(mem.rows[0].id);
  });
  it("a style may be JPEG or PNG; jpeg is kept as .jpg", async () => {
    await sendUpload(member, { ...good, kind: "style", files: [jpg] });
    await sendUpload(member, { ...good, kind: "style", files: [png] });
    expect(mem.uploads[0]).toMatch(/\.jpg$/);
    expect(mem.files.get(mem.uploads[0])?.type).toBe("image/jpeg");
    expect(mem.uploads[1]).toMatch(/\.png$/);
  });
  it("the owner's part and style are ok at once; an ask waits for both", async () => {
    expect(await sendUpload(owner, good)).toMatchObject({ ok: true, state: "ok" });
    expect(await sendUpload(owner, { ...good, kind: "style", files: [jpg] })).toMatchObject({ ok: true, state: "ok" });
    const ask = { kind: "ask", name: "อยากได้", note: "", rights: false, files: [] };
    expect(await sendUpload(owner, ask)).toMatchObject({ ok: true, state: "wait" });
    expect(await sendUpload(member, ask)).toMatchObject({ ok: true, state: "wait" });
    expect(mem.rows.at(-1)).toMatchObject({ kind: "ask", paths: [] });
  });
  it("an ask takes up to three screenshots, no rights box", async () => {
    const r = await sendUpload(member, { kind: "ask", name: "อยากได้", note: "ลิงก์ https://x.test", rights: false, files: [png, jpg, png] });
    expect(r.ok).toBe(true);
    expect(mem.uploads).toHaveLength(3);
  });
  it("refuses the 21st row of a member, not the owner's", async () => {
    for (let i = 0; i < PER_PERSON; i++) seed({});
    expect(await sendUpload(member, good)).toEqual({ ok: false, error: "ส่งครบ 20 ไฟล์แล้ว ลบไฟล์เก่าก่อนส่งใหม่" });
    expect(mem.uploads).toEqual([]);
    const cap = mem.queries.at(-1)!;
    expect(cap.find((s) => s.method === "select")?.args[1]).toMatchObject({ head: true });
    // other people's rows do not count
    for (let i = 0; i < PER_PERSON; i++) seed({ agent_id: OWNER });
    expect(await sendUpload(owner, good)).toMatchObject({ ok: true });
  });
  it("a row that fails to insert takes the files back", async () => {
    mem.insertError = { message: "boom" };
    expect(await sendUpload(member, { kind: "ask", name: "x", note: "", rights: false, files: [png, jpg] })).toEqual({ ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" });
    expect(mem.uploads).toHaveLength(2);
    expect([...mem.removed].sort()).toEqual([...mem.uploads].sort());
    expect(mem.files.size).toBe(0);
  });
});

describe("decideUpload", () => {
  it("ok and no on a part or style; sets who and when", async () => {
    const a = seed({}); const b = seed({ kind: "style" });
    expect(await decideUpload(OWNER, a.id, "ok")).toEqual({ ok: true });
    expect(a).toMatchObject({ state: "ok", decided_by: OWNER });
    expect(typeof a.decided_at).toBe("string");
    expect(await decideUpload(OWNER, b.id, "no", REASONS[1])).toEqual({ ok: true });
    expect(b).toMatchObject({ state: "no", reason: REASONS[1] });
  });
  it("queue and closed only on an ask", async () => {
    const part = seed({}); const ask = seed({ kind: "ask", paths: [] }); const ask2 = seed({ kind: "ask", paths: [] });
    expect((await decideUpload(OWNER, part.id, "queue")).ok).toBe(false);
    expect((await decideUpload(OWNER, ask.id, "ok")).ok).toBe(false);
    expect((await decideUpload(OWNER, ask.id, "no", REASONS[0])).ok).toBe(false);
    expect(part.state).toBe("wait");
    expect(ask.state).toBe("wait");
    expect(await decideUpload(OWNER, ask.id, "queue")).toEqual({ ok: true });
    expect(await decideUpload(OWNER, ask2.id, "closed")).toEqual({ ok: true });
    expect([ask.state, ask2.state]).toEqual(["queue", "closed"]);
  });
  it("no needs a reason from the four", async () => {
    const a = seed({});
    expect(await decideUpload(OWNER, a.id, "no")).toEqual({ ok: false, error: "เลือกเหตุผลก่อน" });
    expect(await decideUpload(OWNER, a.id, "no", "เพราะอยากให้ไม่ผ่าน")).toEqual({ ok: false, error: "เลือกเหตุผลก่อน" });
    expect(a.state).toBe("wait");
  });
  it("a row no longer waiting is left alone", async () => {
    const a = seed({ state: "ok", decided_by: B });
    expect(await decideUpload(OWNER, a.id, "no", REASONS[0])).toEqual({ ok: false, error: "ไฟล์นี้ตรวจไปแล้ว" });
    expect(a).toMatchObject({ state: "ok", decided_by: B, reason: null });
    const upd = mem.queries.at(-1)!;
    expect(upd.some((s) => s.method === "eq" && s.args[0] === "state" && s.args[1] === "wait")).toBe(true);
  });
  it("an unknown id", async () => {
    expect(await decideUpload(OWNER, crypto.randomUUID(), "ok")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    expect(await decideUpload(OWNER, "nope", "ok")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
  });
});

describe("deleteUpload", () => {
  it("removes the sender's own row, then its files", async () => {
    mem.files.set("library/a.png", { bytes: PNG, type: "image/png" });
    const a = seed({});
    expect(await deleteUpload(A, a.id)).toEqual({ ok: true });
    expect(mem.rows).toEqual([]);
    expect(mem.removed).toEqual(["library/a.png"]);
    expect(mem.files.size).toBe(0);
  });
  it("not another member's", async () => {
    const a = seed({});
    expect(await deleteUpload(B, a.id)).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    expect(mem.rows).toHaveLength(1);
    expect(mem.removed).toEqual([]);
    expect(await deleteUpload(A, "nope")).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
  });
  it("an ask without files removes no files", async () => {
    const a = seed({ kind: "ask", paths: [] });
    expect(await deleteUpload(A, a.id)).toEqual({ ok: true });
    expect(mem.removed).toEqual([]);
  });
});

describe("withdrawUpload", () => {
  const nobody = () => Object.assign(people, { agent: null, member: null, superAdmin: null, bluewealth: null, kingclub: null });
  it("an ok part goes to gone with the reason, who and when; its files stay for the sender", async () => {
    mem.files.set("library/a.png", { bytes: PNG, type: "image/png" });
    const a = seed({ state: "ok", decided_by: B });
    expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: false });
    expect(a).toMatchObject({ state: "gone", reason: REASONS[0], decided_by: OWNER });
    expect(typeof a.decided_at).toBe("string");
    expect(mem.rows).toHaveLength(1);
    expect(mem.removed).toEqual([]);
    expect(mem.files.size).toBe(1);
  });
  it("an ok style too", async () => {
    const s = seed({ state: "ok", kind: "style", paths: ["library/s.jpg"] });
    expect(await withdrawUpload(OWNER, s.id, REASONS[3])).toEqual({ ok: true, removed: false });
    expect(s.state).toBe("gone");
  });
  it("needs a reason from the four", async () => {
    const a = seed({ state: "ok" });
    for (const r of [undefined, "", "เพราะอยากถอน", 3]) {
      expect(await withdrawUpload(OWNER, a.id, r as never)).toEqual({ ok: false, error: "เลือกเหตุผลก่อน" });
    }
    expect(a).toMatchObject({ state: "ok", reason: null });
  });
  it("only an ok row: waiting, refused, an ask or one withdrawn already is left alone", async () => {
    for (const over of [{ state: "wait" }, { state: "no", reason: REASONS[1] }, { state: "queue", kind: "ask", paths: [] }, { state: "gone", reason: REASONS[2] }]) {
      const r = seed(over);
      const before = { ...r };
      expect(await withdrawUpload(OWNER, r.id, REASONS[0])).toEqual({ ok: false, error: "ไฟล์นี้ตรวจไปแล้ว" });
      expect(r).toEqual(before);
    }
    expect(mem.removed).toEqual([]);
  });
  it("the change is made only where the row is still ok (a race leaves it alone)", async () => {
    const a = seed({ state: "ok" });
    await withdrawUpload(OWNER, a.id, REASONS[0]);
    const upd = mem.queries.find((q) => q.some((s) => s.method === "update"))!;
    expect(upd.some((s) => s.method === "eq" && s.args[0] === "state" && s.args[1] === "ok")).toBe(true);
    expect(upd.some((s) => s.method === "eq" && s.args[0] === "id" && s.args[1] === a.id)).toBe(true);
  });
  it("a missing or non-uuid id: ไม่พบไฟล์นี้, and a non-uuid never asks the table", async () => {
    expect(await withdrawUpload(OWNER, crypto.randomUUID(), REASONS[0])).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    mem.queries.length = 0;
    expect(await withdrawUpload(OWNER, "../x", REASONS[0])).toEqual({ ok: false, error: "ไม่พบไฟล์นี้" });
    expect(mem.queries).toHaveLength(0);
  });
  it("a database failure says it failed and changes nothing", async () => {
    const a = seed({ state: "ok" });
    mem.failAll = { message: "down" };
    expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" });
    expect(a.state).toBe("ok");
  });

  it("a sender whose account is gone (looked up, found nowhere): row and files deleted", async () => {
    mem.files.set("library/a.png", { bytes: PNG, type: "image/png" });
    nobody();
    const a = seed({ state: "ok" });
    expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: true });
    expect(mem.rows).toEqual([]);
    expect(mem.removed).toEqual(["library/a.png"]);
    expect(mem.files.size).toBe(0);
    expect([...people.asked].sort()).toEqual(["agent", "bluewealth", "kingclub", "member", "super"]);
    // the delete takes only the row it just withdrew
    const del = mem.queries.find((q) => q.some((s) => s.method === "delete"))!;
    expect(del.some((s) => s.method === "eq" && s.args[0] === "state" && s.args[1] === "gone")).toBe(true);
  });
  it("a sender still found anywhere keeps the row", async () => {
    for (const k of ["agent", "member", "superAdmin", "bluewealth", "kingclub"] as const) {
      nobody();
      people[k] = { id: A };
      const a = seed({ state: "ok" });
      expect(await withdrawUpload(OWNER, a.id, REASONS[0]), k).toEqual({ ok: true, removed: false });
      expect(a.state).toBe("gone");
      expect(mem.rows).toContain(a);
    }
    expect(mem.removed).toEqual([]);
  });
  it("a lookup that fails keeps the row (gone), never deletes", async () => {
    for (const k of ["agent", "member", "superAdmin", "bluewealth", "kingclub"] as const) {
      nobody();
      people[k] = new Error("read failed");
      const a = seed({ state: "ok" });
      expect(await withdrawUpload(OWNER, a.id, REASONS[0]), k).toEqual({ ok: true, removed: false });
      expect(a.state).toBe("gone");
      expect(mem.rows).toContain(a);
    }
    expect(mem.removed).toEqual([]);
  });
  it("Bluewealth or KingClub not set up cannot say nobody: the row is kept", async () => {
    for (const off of [{ bwSet: false }, { kcSet: false }]) {
      nobody();
      Object.assign(people, { bwSet: true, kcSet: true }, off);
      const a = seed({ state: "ok" });
      expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: false });
      expect(mem.rows).toContain(a);
    }
    expect(mem.removed).toEqual([]);
  });
  it("a sender found here (UnitClub, member, Super Admin) never makes Bluewealth or KingClub be asked", async () => {
    for (const [k, asked] of [["agent", ["agent"]], ["member", ["agent", "member"]], ["superAdmin", ["agent", "member", "super"]]] as const) {
      nobody();
      people.asked = [];
      people[k] = { id: A };
      const a = seed({ state: "ok" });
      expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: false });
      expect(people.asked, k).toEqual(asked);
    }
  });
  it("a local read that fails stops there, the outside systems not asked", async () => {
    nobody();
    people.member = new Error("members unreadable");
    const a = seed({ state: "ok" });
    expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: false });
    expect(people.asked).toEqual(["agent", "member"]);
    expect(mem.rows).toContain(a);
  });
  it("Bluewealth or KingClub not answering within 5 s cannot say nobody: the row is kept", async () => {
    vi.useFakeTimers();
    try {
      for (const k of ["bluewealth", "kingclub"] as const) {
        nobody();
        people[k] = HANG;
        const a = seed({ state: "ok" });
        const done = withdrawUpload(OWNER, a.id, REASONS[0]);
        await vi.advanceTimersByTimeAsync(5000);
        expect(await done, k).toEqual({ ok: true, removed: false });
        expect(mem.rows).toContain(a);
      }
      expect(mem.removed).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("the demo account is never taken for gone, and is not looked up", async () => {
    nobody();
    const a = seed({ state: "ok", agent_id: DEMO_ID });
    expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: false });
    expect(mem.rows).toContain(a);
    expect(people.asked).toEqual([]);
  });
  it("a delete that fails after the withdraw leaves the row gone, and still says ok", async () => {
    nobody();
    mem.deleteError = { message: "boom" };
    const a = seed({ state: "ok" });
    expect(await withdrawUpload(OWNER, a.id, REASONS[0])).toEqual({ ok: true, removed: false });
    expect(a.state).toBe("gone");
    expect(mem.removed).toEqual([]);
  });
  it("a gone row is the sender's and the owner's only, and not among the shared or ok ones", async () => {
    const a = seed({ state: "ok" });
    await withdrawUpload(OWNER, a.id, REASONS[0]);
    expect(await readableUpload({ agentId: B, owner: false }, a.id)).toBeNull();
    expect((await readableUpload({ agentId: A, owner: false }, a.id))?.state).toBe("gone");
    expect((await readableUpload(owner, a.id))?.id).toBe(a.id);
    expect(await sharedUploads()).toEqual([]);
    expect(await okUploads([a.id], "part")).toEqual([]);
  });
});

describe("readableUpload", () => {
  it("an ok row is anyone's", async () => {
    const a = seed({ state: "ok" });
    expect((await readableUpload({ agentId: B, owner: false }, a.id))?.id).toBe(a.id);
  });
  it("a waiting or refused row is the sender's and the owner's only", async () => {
    for (const state of ["wait", "no"]) {
      const a = seed({ state });
      expect((await readableUpload({ agentId: A, owner: false }, a.id))?.id).toBe(a.id);
      expect((await readableUpload({ agentId: OWNER, owner: true }, a.id))?.id).toBe(a.id);
      expect(await readableUpload({ agentId: B, owner: false }, a.id)).toBeNull();
    }
  });
  it("unknown or non-uuid is null, without asking the table", async () => {
    expect(await readableUpload(owner, crypto.randomUUID())).toBeNull();
    mem.queries.length = 0;
    expect(await readableUpload(owner, "../x")).toBeNull();
    expect(mem.queries).toHaveLength(0);
  });
  it("hands back the row in the store's own shape", async () => {
    const a = seed({ state: "ok", name: "ชื่อ", note: "n" });
    expect(await readableUpload(member, a.id)).toEqual({ id: a.id, agentId: A, kind: "part", name: "ชื่อ", note: "n", paths: ["library/a.png"], state: "ok", reason: null, createdAt: a.created_at });
  });
});

describe("lists", () => {
  it("myUploads: the person's own, newest first", async () => {
    const x = seed({}); const y = seed({}); seed({ agent_id: B });
    expect((await myUploads(A)).map((r) => r.id)).toEqual([y.id, x.id]);
  });
  it("sharedUploads: ok parts and styles only, newest first", async () => {
    const x = seed({ state: "ok" }); const y = seed({ state: "ok", kind: "style" });
    seed({ state: "ok", kind: "ask", paths: [] }); seed({ state: "wait" }); seed({ state: "no" });
    expect((await sharedUploads()).map((r) => r.id)).toEqual([y.id, x.id]);
  });
  it("waitingUploads: waiting rows, oldest first", async () => {
    const x = seed({}); const y = seed({ kind: "ask", paths: [] }); seed({ state: "ok" });
    expect((await waitingUploads()).map((r) => r.id)).toEqual([x.id, y.id]);
  });
  it("okUploads: ok rows of the asked kind among the ids", async () => {
    const p = seed({ state: "ok" }); const s = seed({ state: "ok", kind: "style" }); const w = seed({}); const other = seed({ state: "ok" });
    expect((await okUploads([p.id, s.id, w.id], "part")).map((r) => r.id)).toEqual([p.id]);
    expect((await okUploads([p.id, s.id, w.id], "style")).map((r) => r.id)).toEqual([s.id]);
    expect(await okUploads([], "part")).toEqual([]);
    expect(other.id).not.toBe(p.id);
  });
  it("a database failure throws", async () => {
    mem.failAll = { message: "x" };
    await expect(myUploads(A)).rejects.toThrow();
    await expect(sharedUploads()).rejects.toThrow();
  });
});

describe("uploadFile", () => {
  it("reads a library file with its type", async () => {
    mem.files.set("library/0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f.png", { bytes: PNG, type: "image/png" });
    const f = await uploadFile("library/0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f.png");
    expect(f?.type).toBe("image/png");
    expect(f?.bytes.equals(PNG)).toBe(true);
  });
  it("null for a missing file or a path outside library/", async () => {
    expect(await uploadFile("library/0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f.jpg")).toBeNull();
    mem.files.set("logos/a.png", { bytes: PNG, type: "image/png" });
    expect(await uploadFile("logos/a.png")).toBeNull();
    expect(await uploadFile("library/../logos/a.png")).toBeNull();
  });
});

describe("migration", () => {
  const sql = readFileSync("supabase/migrations/20261215_library_uploads.sql", "utf8");
  const fn = (s: string) => {
    const at = s.indexOf("create or replace function public.ins_member_delete");
    expect(at).toBeGreaterThanOrEqual(0);
    return s.slice(at, s.indexOf("$$;", s.indexOf("$$", s.indexOf("$$", at) + 2)) + 3);
  };
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("--"));

  it("makes the table, service-role only", () => {
    expect(sql).toMatch(/create table if not exists public\.ins_library_uploads/);
    expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/);
    expect(sql).toMatch(/agent_id uuid not null/);
    expect(sql).toMatch(/check \(kind in \('part', ?'style', ?'ask'\)\)/);
    expect(sql).toMatch(/paths text\[\] not null default '\{\}'/);
    expect(sql).toMatch(/state text not null default 'wait' check \(state in \('wait', ?'ok', ?'no', ?'queue', ?'closed'\)\)/);
    expect(sql).toMatch(/on public\.ins_library_uploads \(agent_id\)/);
    expect(sql).toMatch(/on public\.ins_library_uploads \(state\)/);
    expect(sql).toMatch(/alter table public\.ins_library_uploads enable row level security/);
    expect(sql).toMatch(/revoke all on public\.ins_library_uploads from public, anon, authenticated/);
    expect(sql).toMatch(/grant all on public\.ins_library_uploads to service_role/);
    expect(sql).toMatch(/comment on table public\.ins_library_uploads/);
    expect(sql).not.toMatch(/create policy/);
  });
  it("member delete takes the unapproved uploads and returns their paths, the live function otherwise unchanged", () => {
    const mine = fn(sql);
    // the latest body before this one (20261213 added มีอะไรใหม่'s reads): previous live body + only the additions
    const before = readdirSync("supabase/migrations").filter((f) => f < "20261215_library_uploads.sql" && /function public\.ins_member_delete/.test(readFileSync(`supabase/migrations/${f}`, "utf8"))).sort();
    expect(before.at(-1)).toBe("20261213_whats_new.sql");
    const live = fn(readFileSync("supabase/migrations/20261213_whats_new.sql", "utf8"));
    expect(mine).toMatch(/delete from ins_library_uploads where agent_id = p_member and state <> 'ok';/);
    expect(mine).toMatch(/'library', v_library/);
    // the collection happens before the delete, and the delete before the member row goes
    expect(mine.indexOf("jsonb_agg(p)")).toBeLessThan(mine.indexOf("delete from ins_library_uploads"));
    expect(mine.indexOf("delete from ins_library_uploads")).toBeLessThan(mine.indexOf("delete from ins_members"));
    const added = /ins_library_uploads|v_library|jsonb_agg\(p\)|unnest\(u\.paths\)|'logos', v_logos/;
    expect(lines(mine).filter((l) => !added.test(l))).toEqual(lines(live).filter((l) => !/'logos', v_logos/.test(l)));
    expect(sql).toMatch(/revoke all on function public\.ins_member_delete\(uuid\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.ins_member_delete\(uuid\) to service_role/);
  });
  it("leaves the demo wipe alone", () => {
    expect(sql).not.toMatch(/ins_demo_wipe/);
  });
});

describe("migration 20261216: the state check gains gone", () => {
  const sql = readFileSync("supabase/migrations/20261216_library_withdraw.sql", "utf8");
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  it("drops the inline check by its real name and adds it back with six states", () => {
    expect(code).toMatch(/alter table public\.ins_library_uploads drop constraint if exists ins_library_uploads_state_check;/);
    expect(code).toMatch(/alter table public\.ins_library_uploads add constraint ins_library_uploads_state_check check \(state in \('wait', 'ok', 'no', 'queue', 'closed', 'gone'\)\);/);
  });
  it("does nothing else", () => {
    const statements = code.split(";").map((x) => x.trim()).filter(Boolean);
    expect(statements).toHaveLength(2);
  });
});
