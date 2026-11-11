import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { contactBlock, counted, enter, fitSize, footLine, type Enter, type RecipeClip } from "@/lib/quote-video/recipe-blocks";
import type { QuoteVideoFacts } from "@/lib/quote-video/script";

const KINDS: Enter[] = ["up", "slam", "wipe", "left", "right", "pop", "fade", "grow"];

const clip = (name = "ชื่อตัวแทน", footNote?: string): RecipeClip => ({
  facts: { footNote } as unknown as QuoteVideoFacts,
  figures: { yearly: "28,700", splitAge: 60, early: "2,000,000", late: "1,000,000" },
  contact: { name, phone: "081-234-5678", line: "@yourline" },
  total: 30,
  scenes: [{ start: 0, dur: 30 }],
});

describe("enter", () => {
  it("hides a piece before its cue", () => {
    expect(enter("up", -0.1, 1).opacity).toBe(0);
    expect(enter("wipe", -0.1, 1).clipPath).toBe("inset(0px 100.00% 0px 0px)");
    expect(enter("grow", -0.1, 1).transform).toBe("scaleY(0.0000)");
  });
  it("settles every kind to its resting place", () => {
    for (const k of KINDS) {
      const st = enter(k, 2, 1);
      expect(st.opacity === undefined || st.opacity === 1).toBe(true);
      expect(st.transform === undefined || st.transform === "none").toBe(true);
    }
  });
  it("is mid-motion between cue and settle, and grow outlasts the rest", () => {
    expect(enter("up", 0.2, 1).transform).not.toBe("none");
    expect(enter("grow", 0.6, 1).transform).not.toBe("none");
    expect(enter("up", 0.6, 1).transform).toBe("none");
  });
  it("scales its travel with the unit", () => {
    expect(enter("left", 0, 2).transform).toBe("translateX(-648.00px)");
  });
});

describe("counted", () => {
  it("starts at 0, ends on the figure, never goes back", () => {
    expect(counted(2000000, 0)).toBe("0");
    expect(counted(2000000, 5)).toBe("2,000,000");
    let last = -1;
    for (let i = 0; i <= 24; i++) {
      const n = Number(counted(2000000, i * 0.05).replace(/,/g, ""));
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });
});

describe("fitSize", () => {
  it("caps and fits one line", () => {
    expect(fitSize("2,000,000", 900, 400)).toBeLessThanOrEqual(400);
    expect(fitSize("50,000,000", 900, 400) * 0.6 * 10).toBeLessThanOrEqual(900);
  });
});

describe("contactBlock", () => {
  it("keeps a 40-letter name on one line inside the room", () => {
    const name = "ก".repeat(40);
    const html = renderToStaticMarkup(contactBlock(clip(name), "ขอตัวเลขของคุณเอง", 5, 1080, 1, { family: "Kanit", weight: 800, color: "#111", accent: "#e63946" }));
    expect(html).toContain(name);
    expect(html).toContain("081-234-5678");
    expect(html).toContain("LINE @yourline");
    const size = Number(new RegExp(`font-size:(\\d+)px[^>]*>${name}<`).exec(html)?.[1]);
    expect(size * 0.6 * 40).toBeLessThanOrEqual(1080 - 128);
  });
});

describe("footLine", () => {
  it("prints the example line and the card's footnote when there is one", () => {
    expect(renderToStaticMarkup(footLine(clip(), 1080, 1920, "#000"))).toContain("ตัวอย่างประกอบ · เงื่อนไขตามกรมธรรม์");
    expect(renderToStaticMarkup(footLine(clip("x", "หมายเหตุ ๑"), 1080, 1920, "#000"))).toContain("หมายเหตุ ๑");
  });
});
