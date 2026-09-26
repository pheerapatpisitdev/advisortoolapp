import { describe, expect, it } from "vitest";
import { applyFix, type FixableText } from "@/lib/content/apply-fix";

const draft = (over: Partial<FixableText> = {}): FixableText => ({
  hooks: ["หัวเรื่องแรก", "หัวที่สอง"],
  body: "เนื้อหา",
  closing: "ทักแชทได้เลย",
  tags: "#ประกัน",
  poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "พาดหัว" }, { kind: "sub", text: "รอง" }] },
  ...over,
});

describe("accepting a suggested fix", () => {
  it("fixes a typo that is only on the poster", () => {
    const r = applyFix(draft({ poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "คุ้มครองโรคร้ายแรง" }] } }), { find: "ร้ายแรง", replace: "ร้ายแรง 44 โรค" });
    expect(r.changed).toBe(true);
    expect(r.draft.poster.blocks[0].text).toBe("คุ้มครองโรคร้ายแรง 44 โรค");
  });

  it("fixes it in the hashtags too", () => {
    const r = applyFix(draft({ tags: "#ประกันชีวต #ออมเงิน" }), { find: "ชีวต", replace: "ชีวิต" });
    expect(r.draft.tags).toBe("#ประกันชีวิต #ออมเงิน");
  });

  it("fixes every place the words occur, not the first only", () => {
    const r = applyFix(draft({ hooks: ["เบี้ยประกนถูก", "ประกนดี"], body: "ประกนนี้ ประกนนั้น" }), { find: "ประกน", replace: "ประกัน" });
    expect(r.draft.hooks).toEqual(["เบี้ยประกันถูก", "ประกันดี"]);
    expect(r.draft.body).toBe("ประกันนี้ ประกันนั้น");
  });

  it("says nothing changed when the words are gone already, and leaves the draft as it was", () => {
    const d = draft();
    const r = applyFix(d, { find: "ไม่มีคำนี้", replace: "x" });
    expect(r.changed).toBe(false);
    expect(r.draft).toBe(d);
  });

  it("does nothing with an empty find", () => {
    expect(applyFix(draft(), { find: "", replace: "x" }).changed).toBe(false);
  });
});
