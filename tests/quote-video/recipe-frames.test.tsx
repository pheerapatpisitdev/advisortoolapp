import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { contactBlock, counted, enter, fitSize, footLine, type Enter, type RecipeClip } from "@/lib/quote-video/recipe-blocks";
import { askFrame } from "@/lib/quote-video/recipe-ask";
import { lifeFrame } from "@/lib/quote-video/recipe-life";
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

describe("contactBlock entrance and weight settings", () => {
  const face = { family: "Trirong", weight: 700, color: "#fff", accent: "#f2b84b" };
  it("keeps ask's slam at 0.25 s and last lines at 0.7 s by default", () => {
    // 0.3 s in: the name has started (slam, opacity partly up), the phone has not (opacity 0)
    const html = renderToStaticMarkup(contactBlock(clip(), "x", 0.3, 1080, 1, face));
    expect(html).toMatch(/>ชื่อตัวแทน</);
    expect(/rotate\(/.test(/<div[^>]*>ชื่อตัวแทน</.exec(html)![0])).toBe(true);
    expect(/<div[^>]*opacity:0[;"][^>]*>โทร/.test(html)).toBe(true);
  });
  it("takes its own entrance for the name and the rest", () => {
    const html = renderToStaticMarkup(contactBlock(clip(), "x", 0.3, 1080, 1, { ...face, enter: { kind: "up", name: 0.2, rest: 0.5 } }));
    expect(/rotate\(/.test(/<div[^>]*>ชื่อตัวแทน</.exec(html)![0])).toBe(false);
    expect(/<div[^>]*opacity:0[;"][^>]*>โทร/.test(html)).toBe(true);
    const later = renderToStaticMarkup(contactBlock(clip(), "x", 0.6, 1080, 1, { ...face, enter: { kind: "up", name: 0.2, rest: 0.5 } }));
    expect(/<div[^>]*opacity:0[;"][^>]*>โทร/.test(later)).toBe(false);
  });
  it("weights the non-bold lines from face.light (default 400)", () => {
    const weightOf = (html: string, text: string) => new RegExp(`font-weight:(\\d+)[^>]*>${text}<`).exec(html)?.[1];
    const plain = renderToStaticMarkup(contactBlock(clip(), "ลีด", 5, 1080, 1, face));
    expect(weightOf(plain, "ลีด")).toBe("400");
    const lighter = renderToStaticMarkup(contactBlock(clip(), "ลีด", 5, 1080, 1, { ...face, light: 500 }));
    expect(weightOf(lighter, "ลีด")).toBe("500");
    expect(weightOf(lighter, "ชื่อตัวแทน")).toBe("700");
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

describe("lifeFrame (เส้นชีวิต)", () => {
  const c = lp35Clip([3.2, 3.2, 3.4, 3.4, 2.8]);
  const at = (i: number, t: number, clipOf = c, w = 1080, h = 1920) => renderToStaticMarkup(lifeFrame(clipOf, i, t, clipOf.scenes[i].start + t, w, h));
  const railAt = (T: number, i = 0) => Number(/height:([\d.]+)%/.exec(renderToStaticMarkup(lifeFrame(c, i, 1, T, 1080, 1920)))?.[1]);

  it("draws every scene at its start, middle and end with the foot line", () => {
    c.scenes.forEach((s, i) => {
      for (const t of [0, 0.3, s.dur / 2, s.dur - 0.01]) expect(at(i, t)).toContain(FOOT);
    });
  });
  it("puts the quote's own figures on each scene", () => {
    expect(at(0, 2)).toContain(">35<");
    expect(at(0, 2)).toContain("28,700 บาท");
    expect(at(1, 2)).toContain("อีก 19 ปี · อายุ");
    expect(at(1, 2)).toContain(">53<");
    expect(at(2, 2)).toContain(">60<");
    expect(at(2, 2)).toContain("2,000,000");
    expect(at(3, 2)).toContain("จาก 60 ยาวถึงอายุ");
    expect(at(3, 2)).toContain(">99<");
    expect(at(3, 2)).toContain("1,000,000");
  });
  it("stands on the green ground in Trirong weights it has", () => {
    const html = at(0, 2);
    expect(html).toContain("background:#0f3d3a");
    for (let i = 0; i < 5; i++) for (const m of at(i, 2).matchAll(/font-weight:(\d+)/g)) expect([400, 600, 700]).toContain(Number(m[1]));
  });
  it("ends on the contact name and LINE", () => {
    const html = at(4, c.scenes[4].dur / 2);
    for (const s of ["วางเส้นชีวิตของคุณ", "ชื่อตัวแทน", "LINE @yourline", "081-234-5678"]) expect(html).toContain(s);
  });
  it("fills the rail from the clip's time and never jumps at a scene join", () => {
    expect(railAt(0)).toBeCloseTo(8, 1);
    expect(railAt(c.scenes[4].start + 2)).toBeCloseTo(100, 1);
    for (let i = 1; i < 5; i++) {
      const j = c.scenes[i].start;
      expect(Math.abs(railAt(j + 0.01, i) - railAt(j - 0.01, i - 1))).toBeLessThan(1);
    }
    expect(railAt(c.scenes[1].start + 0.6, 1)).toBeGreaterThan(8);
    expect(railAt(c.scenes[1].start + 0.6, 1)).toBeLessThan(34);
  });
  it("keeps a 50,000,000 figure and a 40-letter name on one line inside the clip", () => {
    const facts = { ...LP35, lead: { ...LP35.lead, baht: 50_000_000 } };
    const big = lp35Clip([3.2, 3.2, 3.4, 3.4, 2.8], { ...facts }, "ก".repeat(40));
    big.figures = { ...big.figures, early: "50,000,000", late: "25,000,000", yearly: "5,000,000" };
    // the real column: the clip less the rail's 20 % and the 9 % right padding
    for (let i = 0; i < 5; i++) expect(nowrapOverflows(at(i, big.scenes[i].dur / 2, big), 1080 - 0.29 * 1080)).toEqual([]);
    expect(at(2, 2, big)).toContain("50,000,000");
  });
});
