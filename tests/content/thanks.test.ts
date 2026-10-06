import { describe, expect, it } from "vitest";
import {
  occasionOf, parseThanksPiece, THANKS_OCCASIONS, THANKS_TONES, thanksFormat, thanksMessages, thanksSystem, thanksTones,
} from "@/lib/content/thanks";
import { modeChecks } from "@/lib/content/mode-checks";
import { modeName } from "@/lib/content/modes";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const trust = THANKS_OCCASIONS[0];

describe("THANKS_OCCASIONS", () => {
  it("has unique ids and a brief for each", () => {
    expect(new Set(THANKS_OCCASIONS.map((o) => o.id)).size).toBe(THANKS_OCCASIONS.length);
    for (const o of THANKS_OCCASIONS) expect(o.brief.length).toBeGreaterThan(30);
  });

  it("states no figure the writer could repeat", () => {
    for (const o of THANKS_OCCASIONS) expect(o.brief).not.toMatch(/\d/);
  });

  it("takes the owner's own words as an occasion, cut at 120, and refuses nothing", () => {
    expect(occasionOf("trust", "")).toBe(trust);
    expect(occasionOf("custom", "  ขอบคุณที่มางานเลี้ยง ")?.label).toBe("ขอบคุณที่มางานเลี้ยง");
    expect([...occasionOf("custom", "ก".repeat(300))!.label].length).toBe(120);
    expect(occasionOf("custom", "   ")).toBeNull();
    expect(occasionOf("nope", "")).toBeNull();
  });
});

describe("a thank-you's tones", () => {
  it("run in turn when none is picked, each opened its own way", () => {
    const t = thanksTones("", 3);
    expect(t.map((x) => x.label)).toEqual(THANKS_TONES.map((x) => x.label));
    expect(new Set(t.map((x) => x.say)).size).toBe(3);
  });

  it("is the picked one for every piece, opened three ways", () => {
    const t = thanksTones(THANKS_TONES[1].id, 3);
    expect(t.every((x) => x.label === THANKS_TONES[1].label)).toBe(true);
    expect(new Set(t.map((x) => x.say)).size).toBe(3);
  });
});

describe("the writer's brief", () => {
  it("thanks customers in general, naming no one and offering nothing", () => {
    const s = thanksSystem("post");
    expect(s).toContain("ห้ามแต่งเรื่องของลูกค้าคนใดคนหนึ่ง");
    expect(s).toContain("ห้ามเสนอของแถม ส่วนลด");
    expect(s).toContain("ไม่ขาย");
  });

  it("is never an ad: anything but a clip is a post", () => {
    expect(thanksFormat("ad")).toBe("post");
    expect(thanksFormat("script")).toBe("script");
    expect(thanksSystem("script", "60")).not.toContain("imagePrompt");
    expect(thanksSystem("post")).toContain("imagePrompt");
  });

  it("gives the writer the occasion and its facts", () => {
    const m = text(thanksMessages(trust, THANKS_TONES[0], "", "post", null, false, null));
    expect(m).toContain(trust.label);
    expect(m).toContain(trust.brief);
  });
});

describe("a thank-you from a reply", () => {
  const reply = JSON.stringify({ hook: "ขอบคุณ", body: "เนื้อ", closing: "ทักมาได้เสมอ", hashtags: ["ขอบคุณ"], imagePrompt: "p", poster: { theme: "navy", headline: "ขอบคุณที่ไว้วางใจ" } });

  it("keeps the occasion as its fact, adds no buyer's warning, and carries a poster", () => {
    const o = parseThanksPiece(reply, trust, "อบอุ่นจริงใจ", "post")!;
    expect(o.fact).toBe(trust.brief);
    expect(o.disclaimer).toBe("");
    expect(o.hashtags).toEqual(["#ขอบคุณ"]);
    expect(o.angle).toBe(`ขอบคุณลูกค้า · ${trust.label} · อบอุ่นจริงใจ`);
    expect(o.poster).toBeDefined();
  });

  it("has no poster or picture prompt as a clip", () => {
    const o = parseThanksPiece(reply, trust, "สั้น กระชับ", "script")!;
    expect(o.poster).toBeUndefined();
    expect(o.imagePrompt).toBe("");
  });

  it("is nothing without a hook or a body", () => {
    expect(parseThanksPiece(JSON.stringify({ hook: "หัว" }), trust, "x", "post")).toBeNull();
    expect(parseThanksPiece("not json", trust, "x", "post")).toBeNull();
  });
});

describe("where thank-yous are listed and checked", () => {
  it("is named ขอบคุณลูกค้า wherever pieces are listed", () => {
    expect(modeName("thanks")).toBe("ขอบคุณลูกค้า");
  });

  it("flags every figure, as ความรู้ does, and needs no recruit rules", () => {
    expect(modeChecks("thanks", undefined)).toEqual({ recruit: false, income: false, every: true });
  });
});
