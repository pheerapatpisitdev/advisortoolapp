import { beforeEach, describe, expect, it, vi } from "vitest";

/** สูตรอ่าน-ดูจนจบ's ticks are kept with the piece, only its format's own, over the piece as read. */

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const store = vi.hoisted(() => ({ getContent: vi.fn(), saveOutputIf: vi.fn() }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);

const { saveFinishTicks } = await import("@/app/studio/ticks");

const output = { hooks: ["หัว"], body: "เนื้อ", closing: "", hashtags: [], imagePrompt: "", disclaimer: "", formula: "finish", rev: "r1" };
const piece = (over: object = {}) => ({ id: ID, format: "post", status: "draft", output, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  store.getContent.mockResolvedValue(piece());
  store.saveOutputIf.mockImplementation(async (_id: string, out: object) => piece({ output: out }));
});

describe("saving the agent's ticks", () => {
  it("keeps only the format's own, once each, over the piece as it was read", async () => {
    const res = await saveFinishTicks(ID, ["no-fear", "muted", "junk", "no-fear"]);
    expect(res).toMatchObject({ ok: true, item: { output: { finishTicks: ["no-fear"] } } });
    expect(store.saveOutputIf).toHaveBeenCalledWith(ID, expect.objectContaining({ finishTicks: ["no-fear"], formula: "finish" }), undefined, "r1");
  });

  it("reads the piece again when it moved under the save", async () => {
    store.saveOutputIf.mockResolvedValueOnce(null);
    expect(await saveFinishTicks(ID, ["no-fear"])).toMatchObject({ ok: true });
    expect(store.getContent).toHaveBeenCalledTimes(2);
  });

  it("says so in Thai when the piece is not the asker's, or keeps moving, or the save fails", async () => {
    store.getContent.mockResolvedValueOnce(null);
    expect(await saveFinishTicks(ID, [])).toEqual({ ok: false, error: "ไม่พบชิ้นงานนี้" });
    store.saveOutputIf.mockResolvedValue(null);
    expect(await saveFinishTicks(ID, [])).toMatchObject({ ok: false });
    store.saveOutputIf.mockRejectedValue(new Error("db down"));
    expect(await saveFinishTicks(ID, [])).toEqual({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
  });
});
