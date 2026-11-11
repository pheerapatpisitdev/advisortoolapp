import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { contactBlock, counted, enter, fitSize, footLine, type Enter, type RecipeClip } from "@/lib/quote-video/recipe-blocks";
import { askFrame } from "@/lib/quote-video/recipe-ask";
import { recipeFigures } from "@/lib/quote-video/recipes";
import { quoteVideoFacts, type QuoteVideoFacts } from "@/lib/quote-video/script";

/**
 * Every one-line piece (white-space:nowrap) in the markup whose text is wider than `room` px at
 * 0.6 em a letter. Shared by the three recipes' frame tests (Review Focus 2: a 50,000,000 figure
 * and a 40-letter name must still fit the clip).
 */
export function nowrapOverflows(html: string, room = 1080): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<div style="([^"]*white-space:nowrap[^"]*)">([^<]*)</g)) {
    const size = Number(/font-size:([\d.]+)px/.exec(m[1])?.[1]);
    if (size * 0.6 * [...m[2]].length > room) out.push(m[2]);
  }
  return out;
}

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

const LP35 = quoteVideoFacts({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 })!;
const FOOT = "ตัวอย่างประกอบ · เงื่อนไขตามกรมธรรม์";
const lp35Clip = (durs: number[], facts: QuoteVideoFacts = LP35, name = "ชื่อตัวแทน"): RecipeClip => {
  let at = 0;
  return {
    facts,
    figures: recipeFigures(facts)!,
    contact: { name, phone: "081-234-5678", line: "@yourline" },
    total: durs.reduce((a, b) => a + b, 0),
    scenes: durs.map((dur) => { const s = { start: at, dur }; at += dur; return s; }),
  };
};

describe("askFrame (เปิดด้วยคำถาม)", () => {
  const c = lp35Clip([3.4, 3.6, 4.2, 2.8]);
  const at = (i: number, t: number, clipOf = c, w = 1080, h = 1920) => renderToStaticMarkup(askFrame(clipOf, i, t, clipOf.scenes[i].start + t, w, h));

  it("draws every scene at its start, middle and end with the foot line", () => {
    c.scenes.forEach((s, i) => {
      for (const t of [0, 0.3, s.dur / 2, s.dur - 0.01]) expect(at(i, t)).toContain(FOOT);
    });
  });
  it("puts the quote's own figures on the scenes that tell them", () => {
    const big = at(1, c.scenes[1].dur / 2);
    for (const s of ["2,000,000", "60"]) expect(big).toContain(s);
    const rows = at(2, c.scenes[2].dur / 2);
    for (const s of ["79", "28,700", "19", "53", "99"]) expect(rows).toContain(s);
    expect(at(0, 2)).toContain("ถามจริง");
  });
  it("counts the big figure up from nothing", () => {
    expect(at(1, 0.1)).not.toContain("2,000,000");
    expect(at(1, 0.1)).toContain(">0<");
  });
  it("swaps ground and ink on the figure and contact scenes", () => {
    expect(at(0, 2)).toContain("background:#ffd23f");
    expect(at(1, 2)).toContain("background:#111");
    expect(at(3, 2)).toContain("background:#111");
  });
  it("ends on the contact name and LINE", () => {
    const html = at(3, c.scenes[3].dur / 2);
    for (const s of ["ขอตัวเลขของคุณเอง", "ชื่อตัวแทน", "LINE @yourline", "081-234-5678"]) expect(html).toContain(s);
  });
  it("keeps a 50,000,000 figure and a 40-letter name on one line inside the clip", () => {
    const facts = { ...LP35, lead: { ...LP35.lead, baht: 50_000_000 } };
    const big = lp35Clip([3.4, 3.6, 4.2, 2.8], facts, "ก".repeat(40));
    for (let i = 0; i < 4; i++) {
      const html = at(i, big.scenes[i].dur / 2, big);
      expect(nowrapOverflows(html)).toEqual([]);
    }
    expect(at(1, 2, big)).toContain("50,000,000");
  });
});
