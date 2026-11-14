import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS as C } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { knowText, LIFE_WORDS as LW, moneysplitRemainder, n, taxbackLadder, taxbackRefund, type KnowShow, type LifeShow } from "@/lib/quote-video/story-knowledge";
import { kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { handWidth, moneysplitGeo, threegenGeo } from "@/lib/quote-video/story-life-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";
import { TAX_CAPS, TAX_FOOT, TAX_RATES, TAX_YEAR } from "@/lib/scene-library/tax-th";

/** device round 2, Task 3: taxback, taxcap, moneysplit and threegen drawn in paper, warm and line */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const ARTS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];

const ctx = (size: VideoSize, art: Partial<StoryVideoInput> = { art: "paper" }): StoryContext => ({
  input: { product: "STORY", topic: "mythclaim", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const LONG_PARTS = [
  { label: "ค่าเทอมลูกจนจบมหาวิทยาลัย", amount: 1_200_000 },
  { label: "หนี้บ้านและหนี้รถ ที่ยังค้างอยู่กับธนาคาร", amount: 1_200_000 },
  { label: "ค่าใช้จ่ายของครอบครัว ระหว่างตั้งตัวใหม่", amount: 600_000 },
];
const LONG_ROWS = ["รุ่นปู่ย่าตายาย ผู้เริ่มสร้างฐานะ", "รุ่นพ่อแม่ ผู้ดูแลและส่งต่อ", "รุ่นลูกหลาน ผู้รับมรดกต่อไป"];

const TB = ["ภาษีที่ได้คืน", "ตามฐานภาษี"] as [string, string];
const SHOWS: KnowShow[] = [
  /* 0 */ { layout: "taxback", title: TB, premium: 50_000, bracket: 15 },
  /* 1 */ { layout: "taxback", title: TB, premium: 150_000, bracket: 30 },
  /* 2 */ { layout: "taxback", title: TB, premium: 50_000 },
  /* 3 */ { layout: "taxback", title: TB, bracket: 20 },
  /* 4 */ { layout: "taxback", title: TB },
  /* 5 */ { layout: "taxcap", title: ["เพดานลดหย่อน", "ปีนี้ใช้ได้เท่าไหร่"] },
  /* 6 */ { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ค่าเทอมลูก", amount: 1_200_000 }, { label: "หนี้บ้าน", amount: 1_200_000 }, { label: "ใช้จ่าย", amount: 600_000 }] },
  /* 7 */ { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ค่าเทอมลูก", amount: 1_000_000 }, { label: "หนี้บ้าน", amount: 1_200_000 }] },
  /* 8 */ { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ค่าเทอมลูก" }, { label: "หนี้บ้าน" }] },
  /* 9 */ { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], parts: [{ label: "ค่าเทอมลูก" }, { label: "หนี้บ้าน" }, { label: "ใช้จ่าย" }] },
  /* 10 */ { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: LONG_PARTS },
  /* 11 */ { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["ปู่ ย่า", "พ่อ แม่", "ลูก หลาน"], note: "มรดกที่ส่งต่อได้ ไม่ต้องขายบ้าน" },
  /* 12 */ { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["ปู่ ย่า", "พ่อ แม่", "ลูก หลาน"] },
  /* 13 */ { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: LONG_ROWS, note: "มรดกที่ส่งต่อได้ ไม่ต้องขายบ้าน ส่งต่อผ่านผู้รับประโยชน์ที่ระบุไว้" },
];

/** the moment every piece of a show is in: the end of its last movement */
const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** the words with the title taken out and every space gone (the drawing sets a long line as several) */
const flat = (show: KnowShow, markup: string) => words(markup).replace(("title" in show ? show.title : []).join(" "), "").replace(/ /g, "");
const each = (fn: (size: VideoSize, art: Partial<StoryVideoInput>, label: string) => void) => {
  for (const size of SIZES) for (const art of ARTS) fn(size, art, `${size} ${art.art}`);
};

describe("the four devices draw", () => {
  it("in every look and size, at the start, the middle and the end of the animation, with no NaN and no shared id", () => {
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) for (const t of [0, 1.5, end(show)]) {
      let out = "";
      expect(() => { out = html(show, t, size, art); }, `${show.layout} ${size} ${art.art} ${t}`).not.toThrow();
      expect(out, `${show.layout} ${size} ${art.art} ${t}`).not.toContain("NaN");
      expect(out).not.toMatch(/ id="/);
      expect(words(out)).not.toMatch(/(^|\s)-\d/);
    }
  });

  it("draws through satori (as the stills and the clip frames do) in every look and size at the end", async () => {
    const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
    const FONTS: DrawFont[] = [
      { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
    ];
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) {
      const { w, h } = FRAME[size];
      const el = <div style={{ display: "flex", position: "relative", width: w, height: h }}>{showBody(show, ctx(size, art), end(show))}</div>;
      await expect(drawPngHere(el, { width: w, height: h }, FONTS), `${show.layout} ${size} ${art.art}`).resolves.toBeInstanceOf(Buffer);
    }
  }, 180_000);

  it("each draws more than its title (it is not the empty fall-through)", () => {
    for (const show of SHOWS) for (const size of SIZES) expect(html(show, end(show), size).length, `${show.layout} ${size}`).toBeGreaterThan(1500);
  });

  it("every movement is over within 6 s", () => {
    for (const show of SHOWS) expect(end(show), show.layout).toBeLessThanOrEqual(6);
  });
});

describe("taxback", () => {
  const rungs = (markup: string) => (markup.match(new RegExp(`background:${C.coin}`, "g")) ?? []).length;

  it("the ladder of the table's rates, each with the helper's refund on the capped premium", () => {
    for (const show of [SHOWS[0], SHOWS[1], SHOWS[2]] as LifeShow<"taxback">[]) each((size, art, label) => {
      const out = words(html(show, end(show), size, art));
      for (const rung of taxbackLadder(show)) {
        expect(out, `${label} ${rung.rate}`).toContain(`${rung.rate}%`);
        expect(out, `${label} ${rung.rate}`).toContain(n(rung.refund!));
      }
      expect(out, label).toContain(TAX_FOOT);
    });
    // 50,000 at 15% is 7,500; 150,000 is capped at 100,000, so 35% gives 35,000, not 52,500
    expect(words(html(SHOWS[0]))).toContain("7,500");
    expect(words(html(SHOWS[1]))).toContain("35,000");
    expect(words(html(SHOWS[1]))).not.toContain("52,500");
  });

  it("the agent's bracket: its rung highlighted and the line ฐานภาษี X% → ได้คืน Y, the helper's refund", () => {
    for (const show of [SHOWS[0], SHOWS[1]] as LifeShow<"taxback">[]) each((size, art, label) => {
      const markup = html(show, end(show), size, art);
      expect(rungs(markup), label).toBe(1);
      expect(words(markup), label).toContain(`${LW.bracket} ${show.bracket}% → ${LW.back} ${n(taxbackRefund(show)!)} บาท`);
    });
  });

  it("no bracket: no rung highlighted and no line; a bracket without a premium: its rung highlighted, no refund", () => {
    each((size, art, label) => {
      for (const show of [SHOWS[2], SHOWS[4]]) {
        const markup = html(show, end(show), size, art);
        expect(rungs(markup), label).toBe(0);
        expect(words(markup), label).not.toContain("→");
      }
      const markup = html(SHOWS[3], end(SHOWS[3]), size, art);
      expect(rungs(markup), label).toBe(1);
      expect(words(markup), label).toContain(`${LW.bracket} 20%`);
      expect(words(markup), label).not.toContain("→");
    });
  });

  it("no premium: the rates only, no amounts", () => {
    for (const show of [SHOWS[3], SHOWS[4]]) each((size, art, label) => {
      const out = flat(show, html(show, end(show), size, art)).replace(TAX_FOOT.replace(/ /g, ""), "");
      // every figure left is a rate
      const figures = out.match(/[\d,]+/g) ?? [];
      for (const f of figures) expect(TAX_RATES.map(String), `${label} ${f}`).toContain(f);
      for (const r of TAX_RATES) expect(out, label).toContain(`${r}%`);
    });
  });

  it("the deductible cap only when the premium is over it", () => {
    each((size, art, label) => {
      expect(words(html(SHOWS[1], end(SHOWS[1]), size, art)), label).toContain(`${LW.deductible} 100,000 บาท`);
      expect(words(html(SHOWS[0], end(SHOWS[0]), size, art)), label).not.toContain(LW.deductible);
    });
  });

  it("a refund on the show is never read", () => {
    const forged = { ...SHOWS[0], refund: 99_999 } as unknown as KnowShow;
    expect(words(html(forged))).not.toContain("99,999");
  });
});

describe("taxcap", () => {
  it("the table's rows exactly, the year and the foot", () => {
    const show = SHOWS[5];
    each((size, art, label) => {
      const out = flat(show, html(show, end(show), size, art));
      for (const row of TAX_CAPS) {
        expect(out, `${label} ${row.label}`).toContain(row.label.replace(/ /g, ""));
        expect(out, `${label} ${row.cap}`).toContain(n(row.cap));
        if (row.note) expect(out, `${label} ${row.note}`).toContain(row.note.replace(/ /g, ""));
      }
      expect(out, label).toContain(TAX_YEAR.replace(/ /g, ""));
      expect(out, label).toContain(TAX_FOOT.replace(/ /g, ""));
      // one row a cap, no more
      const caps = (html(show, end(show), size, art).match(/data-cap="/g) ?? []).length;
      expect(caps, label).toBe(TAX_CAPS.length);
    });
  });
});

describe("moneysplit", () => {
  it("the total, each part with its amount, and what is left only when the helper gives it", () => {
    const three = SHOWS[6] as LifeShow<"moneysplit">;
    const two = SHOWS[7] as LifeShow<"moneysplit">;
    expect(moneysplitRemainder(three)).toBeUndefined();
    expect(moneysplitRemainder(two)).toBe(800_000);
    each((size, art, label) => {
      const a = words(html(three, end(three), size, art));
      for (const w of [LW.total, "3,000,000", "ค่าเทอมลูก", "หนี้บ้าน", "ใช้จ่าย", "1,200,000", "600,000"]) expect(a, `${label} ${w}`).toContain(w);
      expect(a, label).not.toContain(LW.left);
      const b = words(html(two, end(two), size, art));
      expect(b, label).toContain("1,000,000");
      expect(b, label).toContain(`${LW.left} 800,000 บาท`);
    });
  });

  it("no amounts: the total and the labels, no other figure; no total: words only", () => {
    each((size, art, label) => {
      const a = flat(SHOWS[8], html(SHOWS[8], end(SHOWS[8]), size, art));
      expect(a, label).toContain("3,000,000");
      expect(a.replace("3,000,000", ""), label).not.toMatch(/\d/);
      expect(a, label).not.toContain(LW.left);
      const b = flat(SHOWS[9], html(SHOWS[9], end(SHOWS[9]), size, art));
      for (const w of [LW.total, "ค่าเทอมลูก", "หนี้บ้าน", "ใช้จ่าย"]) expect(b, `${label} ${w}`).toContain(w);
      expect(b, label).not.toMatch(/\d/);
    });
  });

  it("long Thai labels fit their boxes at every size, readable", () => {
    const show = SHOWS[10] as LifeShow<"moneysplit">;
    const FLOOR: Record<VideoSize, number> = { portrait: 34, square: 24, landscape: 26 };
    for (const size of SIZES) {
      const geo = moneysplitGeo(size, show);
      expect(geo.labelSize, size).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const lines of geo.labels) {
        for (const l of lines) expect(handWidth(l, geo.labelSize), `${size} ${l}`).toBeLessThanOrEqual(geo.labelRoom);
        expect(lines.length * geo.labelSize * 1.3, size).toBeLessThanOrEqual(geo.labelBand);
      }
      for (const art of ARTS) {
        const out = flat(show, html(show, end(show), size, art));
        for (const p of LONG_PARTS) expect(out, `${size} ${art.art}`).toContain(p.label.replace(/ /g, ""));
      }
    }
  });
});

describe("threegen", () => {
  it("three generations, the money passed on, and the note", () => {
    each((size, art, label) => {
      const out = words(html(SHOWS[11], end(SHOWS[11]), size, art));
      for (const w of ["ปู่ ย่า", "พ่อ แม่", "ลูก หลาน", LW.pass, "มรดกที่ส่งต่อได้ ไม่ต้องขายบ้าน"]) expect(out, `${label} ${w}`).toContain(w);
      expect(out.replace("ส่งต่อ สามรุ่น", ""), label).not.toMatch(/\d/);
    });
  });

  it("no note: none drawn", () => {
    const out = words(html(SHOWS[12]));
    expect(out).toContain("ลูก หลาน");
    expect(out).not.toContain("มรดก");
  });

  it("long rows and a long note fit at every size, readable", () => {
    const show = SHOWS[13] as LifeShow<"threegen">;
    const FLOOR: Record<VideoSize, number> = { portrait: 30, square: 22, landscape: 24 };
    for (const size of SIZES) {
      const geo = threegenGeo(size, show);
      expect(geo.rowSize, size).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const lines of geo.rows) {
        for (const l of lines) expect(handWidth(l, geo.rowSize), `${size} ${l}`).toBeLessThanOrEqual(geo.rowRoom);
        expect(lines.length * geo.rowSize * 1.3, size).toBeLessThanOrEqual(geo.rowBand);
      }
      expect(geo.noteSize, size).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const l of geo.note) expect(handWidth(l, geo.noteSize), `${size} ${l}`).toBeLessThanOrEqual(geo.noteRoom);
      for (const art of ARTS) {
        const out = flat(show, html(show, end(show), size, art));
        for (const r of LONG_ROWS) expect(out, `${size} ${art.art}`).toContain(r.replace(/ /g, ""));
        expect(out, `${size} ${art.art}`).toContain(show.note!.replace(/ /g, ""));
      }
    }
  });
});

it("the words these four draw are in the hand font's text", () => {
  const text = knowText({ scenes: SHOWS.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "", contactVoice: "" });
  for (const w of [LW.bracket, LW.back, LW.deductible, LW.total, LW.left, LW.pass, TAX_YEAR, TAX_FOOT, ...TAX_CAPS.map((r) => r.label)]) expect(text).toContain(w);
  expect(text).toContain("→");
});
