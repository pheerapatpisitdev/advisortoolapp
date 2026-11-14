import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

const state = vi.hoisted(() => ({
  viewer: null as unknown as Viewer | null,
  sent: [] as unknown[],
  answer: { ok: true, id: "11111111-1111-4111-8111-111111111111", state: "wait" } as unknown,
  row: null as unknown,
  file: null as unknown,
  readerArgs: [] as unknown[],
}));

vi.mock("@/lib/auth/viewer", () => ({
  getViewer: async () => state.viewer,
  refuseUnless: async () => state.viewer ? null : Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 }),
}));
vi.mock("@/lib/scene-library/uploads", () => ({
  sendUpload: async (...a: unknown[]) => { state.sent.push(a); return state.answer; },
  readableUpload: async (...a: unknown[]) => { state.readerArgs.push(a); return state.row; },
  uploadFile: async () => state.file,
}));

import { OWNER, SUPER } from "../helpers/signed-in";
import { GET, POST } from "@/app/api/library-upload/route";

const ID = "11111111-1111-4111-8111-111111111111";
const AGENT: Viewer = { ...OWNER, agentId: "00000000-0000-4000-8000-0000000000a1", staff: null };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const form = (parts: [string, string | File][]) => {
  const f = new FormData();
  for (const [k, v] of parts) f.append(k, v);
  return new Request("http://x/api/library-upload", { method: "POST", body: f }) as never;
};
const png = (name = "a.png") => new File([PNG], name, { type: "image/png" });
const get = (qs: string) => new Request(`http://x/api/library-upload?${qs}`) as never;
const text = (r: Response) => r.text();

beforeEach(() => {
  state.viewer = OWNER;
  state.sent = [];
  state.readerArgs = [];
  state.answer = { ok: true, id: ID, state: "ok" };
  state.row = null;
  state.file = null;
});

/** anyone but the owner (spec 2026-11-14-library-owner-only-design.md): an agent, an admin, a member, the demo account */
const OTHERS: Viewer[] = [
  AGENT,
  { ...AGENT, staff: { owner: false, publish: true, connect: true, admin: true } },
  { ...AGENT, kind: "member" },
  { ...OWNER, kind: "demo" },
];

describe("POST", () => {
  it("passes who is calling and the files' bytes to sendUpload and relays its answer", async () => {
    const res = await POST(form([["kind", "part"], ["name", "หมอ"], ["note", "ท"], ["file", png()]]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: ID, state: "ok" });
    const [who, v] = state.sent[0] as [unknown, { kind: unknown; name: unknown; note: unknown; rights: boolean; files: { bytes: Buffer }[] }];
    expect(who).toEqual({ agentId: OWNER.agentId, owner: true, demo: false });
    expect(v).toMatchObject({ kind: "part", name: "หมอ", note: "ท", rights: false });
    expect(v.files).toHaveLength(1);
    expect([...v.files[0].bytes]).toEqual([...PNG]);
  });

  it("admits the Super Admin, who counts as the owner here (the route asks getViewer, not requireMember)", async () => {
    state.viewer = SUPER;
    const res = await POST(form([["kind", "part"], ["name", "หมอ"], ["file", png()]]));
    expect(res.status).toBe(200);
    expect((state.sent[0] as unknown[])[0]).toEqual({ agentId: SUPER.agentId, owner: true, demo: false });
  });

  it("answers anyone but the owner 403 with the closed line, before the body is read", async () => {
    for (const v of OTHERS) {
      state.viewer = v;
      const formData = vi.fn(async () => new FormData());
      const res = await POST({ headers: new Headers(), formData } as never);
      expect(res.status, v.kind).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: "ฟังก์ชันนี้ปิดใช้งานอยู่" });
      expect(formData).not.toHaveBeenCalled();
    }
    expect(state.sent).toEqual([]);
  });

  it("rights is true only for 1", async () => {
    await POST(form([["kind", "part"], ["name", "x"], ["rights", "on"], ["file", png()]]));
    expect((state.sent[0] as [unknown, { rights: boolean }])[1].rights).toBe(false);
  });

  it("relays a refusal as 400", async () => {
    state.answer = { ok: false, error: "เลือกแบบที่จะส่ง" };
    const res = await POST(form([["name", "x"]]));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "เลือกแบบที่จะส่ง" });
  });

  it("drops an empty file part", async () => {
    await POST(form([["kind", "ask"], ["name", "x"], ["file", new File([], "")]]));
    expect((state.sent[0] as [unknown, { files: unknown[] }])[1].files).toEqual([]);
  });

  it("refuses more than 3 files without calling sendUpload", async () => {
    const res = await POST(form([["kind", "ask"], ["name", "x"], ["file", png()], ["file", png()], ["file", png()], ["file", png()]]));
    expect(res.status).toBe(400);
    expect(state.sent).toEqual([]);
  });

  it("refuses a file over 5 MB without calling sendUpload", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "b.png", { type: "image/png" });
    const res = await POST(form([["kind", "part"], ["name", "x"], ["file", big]]));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่" });
    expect(state.sent).toEqual([]);
  });

  it("refuses a body that says it is over 16 MB before reading it", async () => {
    const formData = vi.fn(async () => new FormData());
    const sized = (n: number) => ({ headers: new Headers({ "content-length": String(n) }), formData }) as never;
    const res = await POST(sized(3 * 5 * 1024 * 1024 + 1024 * 1024 + 1));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่" });
    expect(formData).not.toHaveBeenCalled();
    expect(state.sent).toEqual([]);
    // exactly 16 MB is still read
    await POST(sized(3 * 5 * 1024 * 1024 + 1024 * 1024));
    expect(formData).toHaveBeenCalledTimes(1);
  });

  it("reads a body with no content-length as before", async () => {
    const formData = vi.fn(async () => { const f = new FormData(); f.append("kind", "ask"); f.append("name", "x"); return f; });
    const res = await POST({ headers: new Headers(), formData } as never);
    expect(formData).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("answers 401 when nobody is signed in", async () => {
    state.viewer = null;
    const res = await POST(form([["kind", "ask"], ["name", "x"]]));
    expect(res.status).toBe(401);
    expect(state.sent).toEqual([]);
  });

  it("answers 400 for a body that is not a form", async () => {
    const res = await POST(new Request("http://x/api/library-upload", { method: "POST", body: "nope" }) as never);
    expect(res.status).toBe(400);
  });
});

describe("GET", () => {
  const OKROW = { id: ID, agentId: "someone", kind: "part", state: "ok", paths: [`library/${ID}.png`, `library/${ID}.jpg`, `library/${ID}.png`] };

  it("answers the same 404 for a bad id or n out of range, without asking the reader", async () => {
    state.row = OKROW;
    const bodies: string[] = [];
    for (const qs of ["id=zzz", "", `id=${ID}&n=3`, `id=${ID}&n=-1`, `id=${ID}&n=x`, `id=${ID}&n=1.5`]) {
      const r = await GET(get(qs));
      expect(r.status).toBe(404);
      bodies.push(await text(r));
    }
    expect(new Set(bodies)).toEqual(new Set(["ไม่พบไฟล์นี้"]));
    expect(state.readerArgs).toEqual([]);
  });

  it("serves the last picture at the boundary n=2", async () => {
    state.row = OKROW;
    state.file = { bytes: Buffer.from(PNG), type: "image/png" };
    expect((await GET(get(`id=${ID}&n=2`))).status).toBe(200);
    expect(state.readerArgs).toHaveLength(1);
  });

  it("answers the same 404 for an unknown id", async () => {
    state.row = null;
    const r = await GET(get(`id=${ID}`));
    expect(r.status).toBe(404);
    expect(await text(r)).toBe("ไม่พบไฟล์นี้");
  });

  it("answers 404 for a row the reader may not see (readableUpload says null)", async () => {
    state.row = null;
    const r = await GET(get(`id=${ID}`));
    expect(r.status).toBe(404);
    expect(state.readerArgs[0]).toEqual([{ agentId: OWNER.agentId, owner: true }, ID]);
  });

  it("answers anyone but the owner the same 404, even for an ok row, without asking the reader", async () => {
    state.row = OKROW;
    state.file = { bytes: Buffer.from(PNG), type: "image/png" };
    for (const v of OTHERS) {
      state.viewer = v;
      const r = await GET(get(`id=${ID}`));
      expect(r.status, v.kind).toBe(404);
      expect(await text(r)).toBe("ไม่พบไฟล์นี้");
    }
    expect(state.readerArgs).toEqual([]);
  });

  it("answers 404 when the stored file is gone", async () => {
    state.row = OKROW;
    state.file = null;
    expect((await GET(get(`id=${ID}`))).status).toBe(404);
  });

  it("serves an ok row's bytes with both headers", async () => {
    state.row = OKROW;
    state.file = { bytes: Buffer.from(PNG), type: "image/png" };
    const r = await GET(get(`id=${ID}`));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([...PNG]);
  });

  it("takes the content type from the stored extension and n picks the file", async () => {
    state.row = OKROW;
    state.file = { bytes: Buffer.from(PNG), type: "image/png" };
    const r = await GET(get(`id=${ID}&n=1`));
    expect(r.headers.get("content-type")).toBe("image/jpeg");
  });

  it("answers 401 when nobody is signed in", async () => {
    state.viewer = null;
    expect((await GET(get(`id=${ID}`))).status).toBe(401);
  });
});
