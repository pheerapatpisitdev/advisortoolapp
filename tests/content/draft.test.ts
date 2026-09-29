import { describe, expect, it } from "vitest";
import { cleanDraft, DRAFT_STYLES, draftMessages, MAX_DRAFT, parseDraftPiece } from "@/lib/content/draft";
import { DISCLAIMER } from "@/lib/content/output";
import { modeName } from "@/lib/content/modes";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const DRAFT = "ลูกค้าอายุ 35 ถามว่าทุน 500,000 พอไหม ผมแนะนำให้ดูรายจ่ายต่อปีก่อน";

describe("the owner's draft", () => {
  it("is trimmed and kept to 2,000 characters, not refused", () => {
    expect(cleanDraft("  ร่าง  ")).toBe("ร่าง");
    expect([...cleanDraft("ก".repeat(MAX_DRAFT + 50))].length).toBe(MAX_DRAFT);
    expect(cleanDraft("   ")).toBe("");
    expect(cleanDraft(42)).toBe("");
  });

  it("is named เขียนเอง wherever pieces are listed", () => {
    expect(modeName("draft")).toBe("เขียนเอง");
  });
});

describe("the polisher's brief", () => {
  it("keeps the draft's meaning and adds no fact, number or promise", () => {
    const brief = text(draftMessages(DRAFT, 0, "", "post", null, false, false));
    expect(brief).toContain(DRAFT);
    expect(brief).toContain("ห้ามเพิ่มข้อเท็จจริง ตัวเลข หรือคำสัญญา");
  });

  it("polishes each version its own way: closest, punchier, a story", () => {
    expect(DRAFT_STYLES.map((s) => s.id)).toEqual(["close", "punchy", "story"]);
    expect(text(draftMessages(DRAFT, 0, "", "post", null, false, false))).toContain(DRAFT_STYLES[0].say);
    expect(text(draftMessages(DRAFT, 2, "", "post", null, false, false))).toContain(DRAFT_STYLES[2].say);
  });

  it("writes an ad to Ads Manager's lengths", () => {
    expect(text(draftMessages(DRAFT, 0, "", "ad", null, false, false))).toContain("headline");
  });
});

describe("a polished version", () => {
  const reply = JSON.stringify({ hook: "หัว", body: "เนื้อ", closing: "ทักมา", hashtags: ["x"], imagePrompt: "p", poster: { theme: "navy", headline: "บนภาพ" } });

  it("keeps the draft as its story, so the draft's own figures stay allowed after an edit", () => {
    const o = parseDraftPiece(reply, DRAFT, 1, "post")!;
    expect(o.fact).toBe(DRAFT);
    expect(o.disclaimer).toBe(DISCLAIMER);
    expect(o.angle).toContain(DRAFT_STYLES[1].label);
    expect(o.poster).toBeDefined();
  });

  it("is nothing without a hook or a body", () => {
    expect(parseDraftPiece(JSON.stringify({ hook: "หัว" }), DRAFT, 0, "post")).toBeNull();
  });
});
