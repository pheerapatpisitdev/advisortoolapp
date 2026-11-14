import { describe, expect, it, vi } from "vitest";
import {
  checkForm, rowReducer, sentView, submitUpload, uploadHref, uploadsFor, withoutUpload, withSent, withVerdict,
  type FormState, type RowState, type UploadSet,
} from "@/lib/scene-library/upload-flow";
import { shrinkForUpload } from "@/lib/scene-library/shrink";
import { KIND_TELLS, SIDE_MAX, type UploadView } from "@/lib/scene-library/upload-rules";

const view = (o: Partial<UploadView>): UploadView => ({ id: "11111111-1111-4111-8111-111111111111", kind: "part", name: "ตะกร้า", note: "", files: 1, state: "wait", reason: null, mine: true, ...o });
const set = (o: Partial<UploadSet> = {}): UploadSet => ({ mine: [], shared: [], waiting: [], ...o });
const form = (o: Partial<FormState> = {}): FormState => ({ kind: "part", name: "ตะกร้า", note: "", rights: true, files: [{ size: 1000, type: "image/png" }], ...o });
const who = { owner: false, sent: 0 };

describe("the kinds' lines are the approved mockup's", () => {
  it("says them verbatim", () => {
    expect(KIND_TELLS).toEqual({
      part: "ตัวละคร ไอคอน ฉากหลัง ใช้เป็นภาพของฉากแทนภาพ AI",
      style: "ภาพที่ชอบโทนสีหรือลายเส้น ใช้เป็นแนวให้ AI วาดภาพ",
      ask: "อยากได้อุปกรณ์หรือรูปแบบที่ยังไม่มี ส่งเป็นข้อความ ลิงก์ หรือภาพหน้าจอ",
    });
  });
});

describe("checkForm: the server's checks, before sending", () => {
  it("passes a good form", () => expect(checkForm(form(), who)).toBeNull());
  it("wants a file for a part or style, none needed for an ask", () => {
    expect(checkForm(form({ files: [] }), who)).toBe("เลือกไฟล์ภาพก่อนส่ง");
    expect(checkForm(form({ kind: "style", files: [] }), who)).toBe("เลือกไฟล์ภาพก่อนส่ง");
    expect(checkForm(form({ kind: "ask", files: [] }), who)).toBeNull();
  });
  it("names must be 1 to 60 long", () => {
    expect(checkForm(form({ name: "   " }), who)).toBe("ตั้งชื่อ ไม่เกิน 60 ตัวอักษร");
    expect(checkForm(form({ name: "ก".repeat(61) }), who)).toBe("ตั้งชื่อ ไม่เกิน 60 ตัวอักษร");
    expect(checkForm(form({ name: "ก".repeat(60) }), who)).toBeNull();
  });
  it("note at most 300", () => {
    expect(checkForm(form({ note: "ก".repeat(301) }), who)).toBe("หมายเหตุยาวเกิน 300 ตัวอักษร");
    expect(checkForm(form({ note: "ก".repeat(300) }), who)).toBeNull();
  });
  it("rights must be ticked for a part or style, not for an ask", () => {
    expect(checkForm(form({ rights: false }), who)).toBe("ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง");
    expect(checkForm(form({ kind: "ask", rights: false, files: [] }), who)).toBeNull();
  });
  it("at most 3 screenshots on an ask, one file otherwise", () => {
    const f = { size: 1, type: "image/jpeg" };
    expect(checkForm(form({ kind: "ask", files: [f, f, f] }), who)).toBeNull();
    expect(checkForm(form({ kind: "ask", files: [f, f, f, f] }), who)).toBe("แนบภาพหน้าจอได้ไม่เกิน 3 ภาพ");
    expect(checkForm(form({ files: [f, f] }), who)).toBe("เลือกไฟล์ภาพก่อนส่ง");
  });
  it("only pictures, and the cap of 20 for a member (not the owner)", () => {
    expect(checkForm(form({ files: [{ size: 1, type: "application/pdf" }] }), who)).toBe("รับเฉพาะรูป JPG หรือ PNG");
    expect(checkForm(form(), { owner: false, sent: 20 })).toBe("ส่งครบ 20 ไฟล์แล้ว ลบไฟล์เก่าก่อนส่งใหม่");
    expect(checkForm(form(), { owner: true, sent: 20 })).toBeNull();
  });
});

describe("submitUpload", () => {
  const png = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
  const fakeShrink = async (f: File) => f as Blob;
  it("a refused form never reaches send or the shrinker", async () => {
    const send = vi.fn(); const shrink = vi.fn();
    const r = await submitUpload({ send, shrink }, { kind: "part", name: "", note: "", rights: true, files: [png] }, who);
    expect(r).toEqual({ ok: false, error: "ตั้งชื่อ ไม่เกิน 60 ตัวอักษร" });
    expect(send).not.toHaveBeenCalled();
    expect(shrink).not.toHaveBeenCalled();
  });
  it("sends the fields the route reads, files after shrinking", async () => {
    const send = vi.fn(async () => ({ ok: true as const, id: "x", state: "wait" as const }));
    const r = await submitUpload({ send, shrink: fakeShrink }, { kind: "style", name: " แบบ ", note: "ก", rights: true, files: [png] }, who);
    expect(r.ok).toBe(true);
    const fd = (send.mock.calls[0] as unknown as [FormData])[0];
    expect(fd.get("kind")).toBe("style");
    expect(fd.get("name")).toBe("แบบ");
    expect(fd.get("note")).toBe("ก");
    expect(fd.get("rights")).toBe("1");
    expect(fd.getAll("file")).toHaveLength(1);
  });
  it("an ask without a rights box sends no rights", async () => {
    const send = vi.fn(async () => ({ ok: true as const, id: "x", state: "wait" as const }));
    await submitUpload({ send, shrink: fakeShrink }, { kind: "ask", name: "ขอ", note: "", rights: false, files: [] }, who);
    const fd = (send.mock.calls[0] as unknown as [FormData])[0];
    expect(fd.get("rights")).toBeNull();
  });
  it("a file still over 5 MB after shrinking is refused before sending", async () => {
    const send = vi.fn();
    const big = async () => new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    const r = await submitUpload({ send, shrink: big }, { kind: "part", name: "ก", note: "", rights: true, files: [png] }, who);
    expect(r).toEqual({ ok: false, error: "ไฟล์ใหญ่เกิน 5 MB ย่อภาพแล้วส่งใหม่" });
    expect(send).not.toHaveBeenCalled();
  });
  it("a send that throws says it failed, it does not throw", async () => {
    const r = await submitUpload({ send: async () => { throw new Error("offline"); }, shrink: fakeShrink }, { kind: "part", name: "ก", note: "", rights: true, files: [png] }, who);
    expect(r).toEqual({ ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" });
  });
});

describe("the lists after what happens", () => {
  it("a member's sent row joins mine only", () => {
    const v = sentView({ kind: "part", name: "ก", note: "", files: 1 }, { id: "a", state: "wait" });
    expect(v).toMatchObject({ id: "a", state: "wait", mine: true, reason: null });
    const u = withSent(set(), v, false);
    expect(u.mine).toEqual([v]);
    expect(u.shared).toEqual([]);
  });
  it("the owner's part or style joins shared too; an ask does not", () => {
    const p = sentView({ kind: "part", name: "ก", note: "", files: 1 }, { id: "a", state: "ok" });
    expect(withSent(set(), p, true).shared).toEqual([p]);
    const a = sentView({ kind: "ask", name: "ก", note: "", files: 0 }, { id: "b", state: "wait" });
    expect(withSent(set(), a, true).shared).toEqual([]);
  });
  it("ok moves a waiting row into shared; no and the ask verdicts drop it", () => {
    const w = view({ id: "w", mine: false, by: "ลูกค้า" });
    const ok = withVerdict(set({ waiting: [w] }), "w", "ok");
    expect(ok.waiting).toEqual([]);
    expect(ok.shared).toMatchObject([{ id: "w", state: "ok" }]);
    const no = withVerdict(set({ waiting: [w] }), "w", "no", "อาจติดลิขสิทธิ์");
    expect(no.waiting).toEqual([]);
    expect(no.shared).toEqual([]);
    const ask = view({ id: "k", kind: "ask", mine: false });
    expect(withVerdict(set({ waiting: [ask] }), "k", "queue").shared).toEqual([]);
  });
  it("the owner's own row in mine follows the verdict", () => {
    const m = view({ id: "w", kind: "ask" });
    const u = withVerdict(set({ mine: [m], waiting: [m] }), "w", "closed");
    expect(u.mine[0].state).toBe("closed");
    const n = withVerdict(set({ mine: [view({ id: "w" })], waiting: [view({ id: "w" })] }), "w", "no", "ไม่เกี่ยวกับงานประกัน");
    expect(n.mine[0]).toMatchObject({ state: "no", reason: "ไม่เกี่ยวกับงานประกัน" });
  });
  it("a removed row leaves every list", () => {
    const v = view({ id: "z" });
    const u = withoutUpload(set({ mine: [v], shared: [v], waiting: [v] }), "z");
    expect(u).toEqual(set());
  });
});

describe("rowReducer: delete asks once, ไม่ผ่าน asks for a reason", () => {
  const idle: RowState = { removing: null, refusing: null, reason: null };
  it("the first press of ลบ only asks", () => {
    expect(rowReducer(idle, { type: "ask-remove", id: "a" })).toEqual({ ...idle, removing: "a" });
  });
  it("ยกเลิก goes back; asking about another row moves the question", () => {
    expect(rowReducer({ ...idle, removing: "a" }, { type: "cancel" })).toEqual(idle);
    expect(rowReducer({ ...idle, removing: "a" }, { type: "ask-remove", id: "b" }).removing).toBe("b");
  });
  it("ไม่ผ่าน opens the reasons; one reason is picked; opening another row resets it", () => {
    const open = rowReducer(idle, { type: "ask-no", id: "a" });
    expect(open).toEqual({ removing: null, refusing: "a", reason: null });
    expect(rowReducer(open, { type: "pick", reason: "อาจติดลิขสิทธิ์" }).reason).toBe("อาจติดลิขสิทธิ์");
    expect(rowReducer({ ...open, reason: "x" }, { type: "ask-no", id: "b" })).toEqual({ removing: null, refusing: "b", reason: null });
  });
});

describe("uploadsFor: which upload cards the filter lets through", () => {
  const part = view({ id: "p", name: "ตะกร้าผลไม้", note: "ไอคอน", state: "ok", mine: false });
  const sty = view({ id: "s", kind: "style", name: "สีพาสเทล", state: "ok", mine: false });
  const base = { q: "", type: "any" as const, product: "any" as const, state: "ready" as const };
  it("shows all under ทั้งหมด and ไฟล์จากสมาชิก", () => {
    expect(uploadsFor([part, sty], base)).toHaveLength(2);
    expect(uploadsFor([part, sty], { ...base, type: "upload" })).toHaveLength(2);
    expect(uploadsFor([part, sty], { ...base, state: "all" })).toHaveLength(2);
  });
  it("hides under another type, เร็วๆ นี้ or a product chip", () => {
    expect(uploadsFor([part], { ...base, type: "device" })).toEqual([]);
    expect(uploadsFor([part], { ...base, state: "soon" })).toEqual([]);
    expect(uploadsFor([part], { ...base, product: "health" })).toEqual([]);
  });
  it("is found by name or note", () => {
    expect(uploadsFor([part, sty], { ...base, q: "ตะกร้า" })).toEqual([part]);
    expect(uploadsFor([part, sty], { ...base, q: "ไอคอน" })).toEqual([part]);
    expect(uploadsFor([part, sty], { ...base, q: "ไม่มี" })).toEqual([]);
  });
});

describe("uploadHref", () => {
  it("opens คลิปตามโจทย์ with the file chosen, by kind", () => {
    expect(uploadHref(view({ id: "abc", kind: "part" }))).toBe("/studio/prompt-story?asset=abc");
    expect(uploadHref(view({ id: "abc", kind: "style" }))).toBe("/studio/prompt-story?ref=abc");
  });
});

describe("shrinkForUpload", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });
  it("returns the file itself where there is no canvas", async () => {
    expect(await shrinkForUpload(file, "part")).toBe(file);
  });

  it("draws at most SIDE_MAX on the long side, PNG for a part, JPEG 0.9 for the rest", async () => {
    const drawn: number[][] = []; const types: unknown[][] = [];
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ drawImage: (_b: unknown, ...a: number[]) => drawn.push(a), fillRect: () => {}, set fillStyle(_v: string) {} }),
      toBlob: (cb: (b: Blob) => void, ...a: unknown[]) => { types.push(a); cb(new Blob(["x"], { type: String(a[0]) })); },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("createImageBitmap", async () => ({ width: 3200, height: 1600, close: () => {} }));
    try {
      const out = await shrinkForUpload(file, "part");
      expect(canvas.width).toBe(SIDE_MAX);
      expect(canvas.height).toBe(SIDE_MAX / 2);
      expect(drawn[0]).toEqual([0, 0, SIDE_MAX, SIDE_MAX / 2]);
      expect(types[0]).toEqual(["image/png"]);
      expect(out).not.toBe(file);
      await shrinkForUpload(file, "style");
      expect(types[1]).toEqual(["image/jpeg", 0.9]);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not enlarge a small picture, and gives the file back when the canvas cannot be used", async () => {
    const canvas = { width: 0, height: 0, getContext: () => null, toBlob: () => {} };
    vi.stubGlobal("document", { createElement: () => canvas });
    vi.stubGlobal("createImageBitmap", async () => ({ width: 100, height: 50, close: () => {} }));
    try {
      expect(await shrinkForUpload(file, "style")).toBe(file);
    } finally { vi.unstubAllGlobals(); }
  });
});
