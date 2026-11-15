import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { SAVE_WORDS, showText, type KnowShow, type SaveShow } from "@/lib/quote-video/story-knowledge";
import { geoOf, kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { figWidth, jarAt, jarGeo, jarMarks, paidGeo } from "@/lib/quote-video/story-save-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/** device round 4, Task 2: savejar and paidgot drawn in paper, warm and line */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const ARTS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];

const ctx = (size: VideoSize, art: Partial<StoryVideoInput> = { art: "paper" }): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const T: [string, string] = ["ส่งทุกปี", "ก้อนโตขึ้นเรื่อยๆ"];
const LONG_TITLE: [string, string] = ["ครอบครัวไม่ต้องเปียก", "ประกันคือร่มของบ้าน"];
const LONG_NOTE = "รายได้หลักของบ้าน ถ้าหายไปจะลำบาก";
const SOLID_NOTE = "เงินก้อนมาถึงมือตอนที่ต้องการที่สุด";

const SHOWS: KnowShow[] = [
  /* 0 */ { layout: "savejar", title: T, note: "ส่งเท่าเดิมทุกปี", years: 20, paid: 2_724_411 },
  /* 1 */ { layout: "savejar", title: T, years: 20 },
  /* 2 */ { layout: "savejar", title: T, paid: 2_724_411 },
  /* 3 */ { layout: "savejar", title: T },
  /* 4 */ { layout: "savejar", title: LONG_TITLE, note: LONG_NOTE, years: 60, paid: 123_456_789 },
  /* 5 */ { layout: "savejar", title: T, note: SOLID_NOTE, years: 3, paid: 123_456_789 },
  /* 6 */ { layout: "paidgot", title: ["ส่งเท่าไร", "ได้คืนเท่าไร"], note: "ดูตามตาราง", paid: 2_724_411, got: 6_023_625, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95 },
  /* 7 */ { layout: "paidgot", title: T, paid: 2_724_411, got: 6_023_625 },
  /* 8 */ { layout: "paidgot", title: T, paid: 2_724_411, got: 6_023_625, payFrom: 40, getFrom: 60, getTo: 95 },
  /* 9 */ { layout: "paidgot", title: LONG_TITLE, note: LONG_NOTE, paid: 123_456_789, got: 987_654_321, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95 },
  /* 10 */ { layout: "paidgot", title: T, note: SOLID_NOTE, paid: 1_000_000_000, got: 1_000, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95 },
];
const jars = SHOWS.filter((x): x is SaveShow<"savejar"> => x.layout === "savejar");
const gots = SHOWS.filter((x): x is SaveShow<"paidgot"> => x.layout === "paidgot");

const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const each = (fn: (size: VideoSize, art: Partial<StoryVideoInput>, label: string) => void) => {
  for (const size of SIZES) for (const art of ARTS) fn(size, art, `${size} ${art.art}`);
};
/** the middle of the beat that makes the figure: a jar's second fill, paidgot's second bar */
const mid = (show: KnowShow) => { const s = kspec(show); const x = show.layout === "savejar" ? s.fill1 : s.got; return x.at + x.dur / 2; };

describe("savejar and paidgot draw", () => {
  it("in every look and size, from the start through the middle of the beat to the end, with no NaN and no shared id", () => {
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) for (const t of [0, 0.7, mid(show), 2.2, end(show), end(show) + 3]) {
      let out = "";
      const label = `${show.layout} ${size} ${art.art} ${t}`;
      expect(() => { out = html(show, t, size, art); }, label).not.toThrow();
      expect(out, label).not.toContain("NaN");
      expect(out, label).not.toContain("Infinity");
      expect(out).not.toMatch(/ id="/);
    }
  });

  const FONTS = (): DrawFont[] => {
    const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
    return [
      { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
    ];
  };
  it("draws through satori (as the stills do) in every look and size, mid-beat and at the end, and writes the stills to tests/scratch/devices4", async () => {
    const fonts = FONTS();
    const dir = path.join(process.cwd(), "tests/scratch/devices4");
    mkdirSync(dir, { recursive: true });
    for (const [i, show] of SHOWS.entries()) for (const size of SIZES) for (const art of ARTS) for (const [when, t] of [["mid", mid(show)], ["end", end(show)]] as const) {
      const { w, h } = FRAME[size];
      const el = <div style={{ display: "flex", position: "relative", width: w, height: h, background: "#ece8df" }}>{showBody(show, ctx(size, art), t)}</div>;
      const png = await drawPngHere(el, { width: w, height: h }, fonts);
      expect(png, `${show.layout} ${size} ${art.art} ${t}`).toBeInstanceOf(Buffer);
      writeFileSync(path.join(dir, `save${String(i).padStart(2, "0")}-${show.layout}-${size}-${art.art}${art.art === "minimal" ? "-warm" : ""}-${when}.png`), png);
    }
  }, 600_000);

  it("draws no percent and no return word, and no figure but what it was given", () => {
    const BAD = /%|ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล|IRR|ปัน/i;
    each((size, art, label) => {
      for (const show of SHOWS) expect(words(html(show, end(show), size, art)), `${show.layout} ${label}`).not.toMatch(BAD);
      // no number given: no digit anywhere
      for (const show of [jars[3]]) expect(words(html(show, end(show), size, art)), `${label} bare jar`).not.toMatch(/[\d๐-๙]/);
    });
  });

  it("every word it draws is one the hand font is given (knowText)", () => {
    for (const show of SHOWS) {
      const given = new Set(showText(show));
      const seen = [...words(html(show, end(show), "portrait"))].filter((c) => c.trim());
      for (const c of seen) expect(given.has(c), `${show.layout}: ${c}`).toBe(true);
    }
  });
});

describe("savejar", () => {
  it("fills in four steps, each marked ปีที่ N with N = round(years × k / 4)", () => {
    expect(jarMarks(jars[0].years).map((m) => m.text)).toEqual(["ปีที่ 5", "ปีที่ 10", "ปีที่ 15", "ปีที่ 20"]);
    expect(jarMarks(60).map((m) => m.text)).toEqual(["ปีที่ 15", "ปีที่ 30", "ปีที่ 45", "ปีที่ 60"]);
    expect(jarMarks(30).map((m) => m.text)).toEqual(["ปีที่ 8", "ปีที่ 15", "ปีที่ 23", "ปีที่ 30"]);
    // marks without numbers when years is absent
    expect(jarMarks(undefined).map((m) => m.text)).toEqual(["", "", "", ""]);
    // a plan so short the steps repeat: never "ปีที่ 0", never the same year twice
    for (let y = 1; y < 4; y++) {
      const t = jarMarks(y).map((m) => m.text).filter(Boolean);
      expect(t.some((x) => x === "ปีที่ 0"), `${y}`).toBe(false);
      expect(new Set(t).size, `${y}`).toBe(t.length);
    }
  });

  it("draws the marks it is given and the card the spec describes", () => {
    const full = words(html(jars[0]));
    for (const x of ["ปีที่ 5", "ปีที่ 10", "ปีที่ 15", "ปีที่ 20", "ส่งรวม 20 ปี", "2,724,411 บาท"]) expect(full, x).toContain(x);
    const yearsOnly = words(html(jars[1]));
    expect(yearsOnly).toContain("ส่งรวม 20 ปี");
    expect(yearsOnly).not.toContain("บาท");
    expect(yearsOnly).not.toContain(SAVE_WORDS.each);
    const neither = words(html(jars[3]));
    expect(neither).toContain("ส่งทีละปี");
    expect(neither).not.toContain("ปีที่");
    expect(neither).not.toContain("ส่งรวม");
    expect(words(html(jars[2]))).toContain("2,724,411 บาท");
  });

  it("the jar fills evenly in four steps and is full at the end; never past the top", () => {
    const s = kspec(jars[0]);
    expect(jarAt(s, 0).level).toBe(0);
    let last = 0;
    for (let t = 0; t <= end(jars[0]) + 1; t += 0.05) {
      const l = jarAt(s, t).level;
      expect(l, `t=${t}`).toBeGreaterThanOrEqual(last - 1e-9);
      expect(l).toBeLessThanOrEqual(1);
      last = l;
    }
    expect(jarAt(s, end(jars[0])).level).toBeCloseTo(1, 5);
    expect(jarAt(s, s.fill1.at + s.fill1.dur).level).toBeCloseTo(0.5, 5);
    expect(jarAt(s, s.fill1.at + s.fill1.dur).marks).toEqual([true, true, false, false]);
  });

  it("every part sits inside its room at every size, the marks apart from one another, the figure inside its card", () => {
    for (const size of SIZES) for (const show of jars) {
      const g = geoOf(size);
      const geo = jarGeo(size, show);
      const label = `${size} ${show.years} ${show.paid}`;
      const inside = (r: { x: number; y: number; w: number; h: number }, what: string) => {
        expect(r.x, `${label} ${what}`).toBeGreaterThanOrEqual(g.dev.x);
        expect(r.y, `${label} ${what}`).toBeGreaterThanOrEqual(g.dev.y);
        expect(r.x + r.w, `${label} ${what}`).toBeLessThanOrEqual(g.dev.x + g.dev.w);
        expect(r.y + r.h, `${label} ${what}`).toBeLessThanOrEqual(g.dev.y + g.dev.h);
      };
      inside(geo.jar, "jar");
      inside(geo.card, "card");
      if (geo.note) inside(geo.note, "note");
      if (geo.labels) {
        inside({ x: geo.labels.x, y: Math.min(...geo.labels.ys) - geo.labels.size, w: geo.labels.w, h: Math.max(...geo.labels.ys) - Math.min(...geo.labels.ys) + geo.labels.size * 2 }, "labels");
        for (let i = 1; i < 4; i++) expect(Math.abs(geo.labels.ys[i] - geo.labels.ys[i - 1]), `${label} marks apart`).toBeGreaterThanOrEqual(Math.ceil(geo.labels.size * 1.3));
      }
      // jar, labels and card never overlap
      const jarRight = geo.jar.x + geo.jar.w + (geo.labels ? geo.labels.w + 8 : 0);
      if (size === "portrait") expect(geo.jar.y + geo.jar.h, label).toBeLessThanOrEqual(geo.card.y);
      else expect(jarRight, label).toBeLessThanOrEqual(geo.card.x);
      // every line of the card fits inside the card's padding
      for (const l of geo.card.lines) expect(figWidth(l.text, l.size), `${label} ${l.text}`).toBeLessThanOrEqual(geo.card.inner);
    }
  });

  it("nine-digit figures keep a readable size at all three sizes", () => {
    for (const size of SIZES) {
      const geo = jarGeo(size, jars[4]);
      const fig = geo.card.lines.find((l) => l.text.includes("123,456,789"))!;
      expect(fig, size).toBeTruthy();
      expect(fig.size, size).toBeGreaterThanOrEqual(Math.round(geoOf(size).text * 1.0));
    }
  });
});

describe("paidgot", () => {
  it("draws both amounts, the two labels, the ages only where both ends of a bar are given, and the fixed line", () => {
    const full = words(html(gots[0]));
    for (const x of ["2,724,411 บาท", "6,023,625 บาท", SAVE_WORDS.sent, SAVE_WORDS.got, "อายุ 40–59", "อายุ 60–95", SAVE_WORDS.foot]) expect(full, x).toContain(x);
    const none = words(html(gots[1]));
    expect(none).not.toContain(SAVE_WORDS.age);
    expect(none).toContain(SAVE_WORDS.foot);
    // payFrom without payTo: no age under the paid bar; the got bar has both
    const half = words(html(gots[2]));
    expect(half).not.toContain("อายุ 40");
    expect(half).toContain("อายุ 60–95");
  });

  it("the two bars are to one scale and grow in turn, the larger first-rate to its full height", () => {
    for (const size of SIZES) for (const show of gots) {
      const geo = paidGeo(size, show);
      const label = `${size} ${show.paid}/${show.got}`;
      expect(geo.maxBarH, label).toBeGreaterThanOrEqual(110);
      const [p, q] = geo.bars;
      const more = Math.max(show.paid, show.got);
      expect(Math.max(p.h, q.h), label).toBe(geo.maxBarH);
      // heights are in the ratio of the amounts (a floor of a few pixels keeps a tiny one visible)
      const ratio = show.paid / show.got;
      if (Math.min(show.paid, show.got) / more > 0.03) expect(p.h / q.h, label).toBeCloseTo(ratio, 1);
      expect(p.h, label).toBeGreaterThanOrEqual(8);
      expect(q.h, label).toBeGreaterThanOrEqual(8);
    }
    const s = kspec(gots[0]);
    expect(s.got.at).toBeGreaterThanOrEqual(s.paid.at + s.paid.dur - 1e-9);
  });

  it("every part sits inside its room at every size; the amounts and labels fit their columns, nine digits included", () => {
    for (const size of SIZES) for (const show of gots) {
      const g = geoOf(size);
      const geo = paidGeo(size, show);
      const label = `${size} ${show.paid}/${show.got}`;
      for (const b of geo.bars) {
        expect(b.x, label).toBeGreaterThanOrEqual(g.dev.x);
        expect(b.x + b.w, label).toBeLessThanOrEqual(g.dev.x + g.dev.w);
        expect(b.col.x, label).toBeGreaterThanOrEqual(g.dev.x);
        expect(b.col.x + b.col.w, label).toBeLessThanOrEqual(g.dev.x + g.dev.w);
        expect(figWidth(b.fig, geo.figSize), `${label} ${b.fig}`).toBeLessThanOrEqual(b.col.w);
        expect(handWidth(b.label, geo.labelSize), `${label} ${b.label}`).toBeLessThanOrEqual(b.col.w);
        if (b.age) expect(handWidth(b.age, geo.ageSize), `${label} ${b.age}`).toBeLessThanOrEqual(b.col.w);
      }
      expect(geo.figSize, label).toBeGreaterThanOrEqual(Math.round(g.text * 0.9));
      expect(handWidth(SAVE_WORDS.foot, geo.footSize), label).toBeLessThanOrEqual(g.dev.w);
      // everything stacks inside the room, top to bottom
      expect(geo.top, label).toBeGreaterThanOrEqual(g.dev.y);
      expect(geo.bottom, label).toBeLessThanOrEqual(g.dev.y + g.dev.h);
      if (geo.note) expect(geo.note.y + geo.note.h, label).toBeLessThanOrEqual(g.dev.y + g.dev.h);
    }
  });
});
