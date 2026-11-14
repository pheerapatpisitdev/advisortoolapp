import { describe, expect, it, vi } from "vitest";
import {
  afterSent, checkForm, claimRow, rowReducer, sentView, submitUpload, uploadHref, uploadsFor, withHidden, withoutUpload, withSent, withShown,
  type FormState, type RowState, type UploadSet,
} from "@/lib/scene-library/upload-flow";
import { shrinkForUpload } from "@/lib/scene-library/shrink";
import { KIND_TELLS, SIDE_MAX, stateWord, type UploadView } from "@/lib/scene-library/upload-rules";

const view = (o: Partial<UploadView>): UploadView => ({ id: "11111111-1111-4111-8111-111111111111", kind: "part", name: "ตะกร้า", note: "", files: 1, state: "wait", reason: null, mine: true, ...o });
const set = (o: Partial<UploadSet> = {}): UploadSet => ({ mine: [], shared: [], waiting: [], ...o });
const form = (o: Partial<FormState> = {}): FormState => ({ kind: "part", name: "ตะกร้า", note: "", rights: true, files: [{ size: 1000, type: "image/png" }], ...o });
const who = { owner: false, sent: 0 };
const owner = { owner: true, sent: 0 };

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
  it("wants one file for a part or style", () => {
    expect(checkForm(form({ files: [] }), who)).toBe("เลือกไฟล์ภาพก่อนส่ง");
    expect(checkForm(form({ kind: "style", files: [] }), who)).toBe("เลือกไฟล์ภาพก่อนส่ง");
  });
  it("refuses an ask (คำขอชิ้นใหม่) as the server does, from anyone", () => {
    expect(checkForm(form({ kind: "ask", files: [] }), who)).toBe("เลือกแบบที่จะส่ง");
    expect(checkForm(form({ kind: "ask", files: [] }), owner)).toBe("เลือกแบบที่จะส่ง");
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
  it("rights must be ticked by a member, never by the owner", () => {
    expect(checkForm(form({ rights: false }), who)).toBe("ติ๊กยืนยันสิทธิ์ในไฟล์ก่อนส่ง");
    expect(checkForm(form({ rights: false }), owner)).toBeNull();
    expect(checkForm(form({ kind: "style", rights: false, files: [{ size: 1, type: "image/jpeg" }] }), owner)).toBeNull();
  });
  it("one file, never two", () => {
    const f = { size: 1, type: "image/jpeg" };
    expect(checkForm(form({ files: [f, f] }), owner)).toBe("เลือกไฟล์ภาพก่อนส่ง");
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
  it("the owner's form, with no rights box, sends no rights", async () => {
    const send = vi.fn(async () => ({ ok: true as const, id: "x", state: "ok" as const }));
    expect((await submitUpload({ send, shrink: fakeShrink }, { kind: "part", name: "ก", note: "", rights: false, files: [png] }, owner)).ok).toBe(true);
    const fd = (send.mock.calls[0] as unknown as [FormData])[0];
    expect(fd.get("rights")).toBeNull();
    expect(fd.get("kind")).toBe("part");
  });
  it("an ask never reaches send", async () => {
    const send = vi.fn();
    const r = await submitUpload({ send, shrink: fakeShrink }, { kind: "ask", name: "ขอ", note: "", rights: false, files: [] }, owner);
    expect(r).toEqual({ ok: false, error: "เลือกแบบที่จะส่ง" });
    expect(send).not.toHaveBeenCalled();
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
  it("the owner's part or style joins shared too", () => {
    const p = sentView({ kind: "part", name: "ก", note: "", files: 1 }, { id: "a", state: "ok" });
    expect(withSent(set(), p, true)).toEqual(set({ mine: [p], shared: [p] }));
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
  it("shows all under ทั้งหมด and ไฟล์ของฉัน", () => {
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

describe("afterSent: where the page goes and what ของฉัน holds", () => {
  const row = sentView({ kind: "part", name: "ตะกร้า", note: "", files: 1 }, { id: "n", state: "wait" });
  it("a member lands on ของฉัน with the new row, saying รออนุมัติ", async () => {
    const { stateWord } = await import("@/lib/scene-library/upload-rules");
    const r = afterSent(set({ mine: [view({ id: "old" })] }), row, false);
    expect(r.tab).toBe("mine");
    expect(r.ups.mine.map((v) => v.id)).toEqual(["n", "old"]);
    expect(stateWord(r.ups.mine[0].kind, r.ups.mine[0].state)).toBe("รออนุมัติ");
  });
  it("the owner stays where they are, and an own part is shared at once", () => {
    const ok = sentView({ kind: "part", name: "ก", note: "", files: 1 }, { id: "o", state: "ok" });
    const r = afterSent(set(), ok, true);
    expect(r.tab).toBeNull();
    expect(r.ups.shared.map((v) => v.id)).toEqual(["o"]);
  });
});

describe("withHidden and withShown: ไฟล์ของฉัน after ถอนออกจากคลัง and นำกลับเข้าคลัง", () => {
  const own = view({ id: "o", state: "ok", mine: true });
  const other = view({ id: "x", state: "ok", mine: true, name: "อื่น" });
  const shown = (u: UploadSet) => uploadsFor(u.shared, { q: "", type: "any", product: "any", state: "ready" }).map((v) => v.id);
  it("hidden: the file leaves shared (so เลือกดู) and stays in mine as ถอนออกแล้ว, no reason", () => {
    const u = withHidden(set({ mine: [own, other], shared: [own, other] }), "o");
    expect(shown(u)).toEqual(["x"]);
    expect(u.mine).toEqual([{ ...own, state: "gone", reason: null }, other]);
    expect(stateWord(u.mine[0].kind, u.mine[0].state)).toBe("ถอนออกแล้ว");
  });
  it("shown: the file is back in shared and ok in mine", () => {
    const gone = { ...own, state: "gone" as const };
    const u = withShown(set({ mine: [gone, other], shared: [other] }), "o");
    expect(u.mine).toEqual([{ ...own, state: "ok", reason: null }, other]);
    expect(shown(u).sort()).toEqual(["o", "x"]);
  });
  it("shown twice adds it once; an id not in mine changes nothing", () => {
    const gone = { ...own, state: "gone" as const };
    const once = withShown(set({ mine: [gone] }), "o");
    expect(withShown(once, "o").shared).toHaveLength(1);
    const start = set({ mine: [other], shared: [other] });
    expect(withShown(start, "zz")).toEqual(start);
    expect(withHidden(start, "zz")).toEqual(start);
  });
});

describe("rowReducer done: one row finishing leaves the others alone", () => {
  it("closes only the row it names", () => {
    expect(rowReducer({ removing: "a", refusing: null, reason: null }, { type: "done", id: "a" })).toEqual({ removing: null, refusing: null, reason: null });
    const open = { removing: null, refusing: "b", reason: "อาจติดลิขสิทธิ์" };
    expect(rowReducer(open, { type: "done", id: "a" })).toBe(open);
    expect(rowReducer(open, { type: "done", id: "b" })).toEqual({ removing: null, refusing: null, reason: null });
  });
});

describe("claimRow: a second fast press on the same row does nothing", () => {
  it("takes an id once, until it is let go; other rows are free", () => {
    const flying = new Set<string>();
    expect(claimRow(flying, "a")).toBe(true);
    // the second press comes before any render: the same set already holds it
    expect(claimRow(flying, "a")).toBe(false);
    expect(claimRow(flying, "b")).toBe(true);
    flying.delete("a");
    expect(claimRow(flying, "a")).toBe(true);
  });
});
