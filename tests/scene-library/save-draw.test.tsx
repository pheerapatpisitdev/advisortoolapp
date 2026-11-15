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
import { figWidth, jarAt, jarGeo, jarMarks, paidGeo, pensionAt, pensionGeo, priceAt, priceGeo, PRICE } from "@/lib/quote-video/story-save-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/** device round 4, Tasks 2 and 3: savejar, paidgot, pricerise and pensionsteps drawn in paper, warm and line. PNG stills are written only with SAVE_STILLS=1 */
const STILLS = process.env.SAVE_STILLS === "1";
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

const SPEC_ROWS = [{ from: 60, to: 75, annual: 118_110 }, { from: 76, to: 80, annual: 157_480 }, { from: 81, to: 85, annual: 196_851 }, { from: 86, to: 95, annual: 236_221 }];
const FIVE = [{ from: 60, to: 64, annual: 100_000 }, { from: 65, to: 69, annual: 130_000 }, { from: 70, to: 79, annual: 160_000 }, { from: 80, to: 89, annual: 190_000 }, { from: 90, to: 95, annual: 220_000 }];
const NINE = [{ from: 60, to: 64, annual: 100_000_000 }, { from: 65, to: 69, annual: 110_000_000 }, { from: 70, to: 79, annual: 120_000_000 }, { from: 80, to: 89, annual: 123_456_788 }, { from: 90, to: 99, annual: 123_456_789 }];

const SHOWS: KnowShow[] = [
  /* 0 */ { layout: "savejar", title: T, note: "ส่งเท่าเดิมทุกปี", years: 20, paid: 2_724_411 },
  /* 1 */ { layout: "savejar", title: T, years: 20 },
  /* 2 */ { layout: "savejar", title: T, paid: 2_724_411 },
  /* 3 */ { layout: "savejar", title: T },
  /* 4 */ { layout: "savejar", title: LONG_TITLE, note: LONG_NOTE, years: 60, paid: 123_456_789 },
  /* 5 */ { layout: "savejar", title: T, note: SOLID_NOTE, years: 3, paid: 123_456_789 },
  /* 6 */ { layout: "paidgot", title: ["ส่งเท่าไร", "ได้คืนเท่าไร"], note: "ดูตามตาราง", paid: 2_724_411, got: 6_023_625, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95, fromPlan: true },
  /* 7 */ { layout: "paidgot", title: T, paid: 2_724_411, got: 6_023_625, fromPlan: true },
  /* 8 */ { layout: "paidgot", title: T, paid: 2_724_411, got: 6_023_625, payFrom: 40, getFrom: 60, getTo: 95 },
  /* 9 */ { layout: "paidgot", title: LONG_TITLE, note: LONG_NOTE, paid: 123_456_789, got: 987_654_321, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95, fromPlan: true },
  /* 10 */ { layout: "paidgot", title: T, note: SOLID_NOTE, paid: 1_000_000_000, got: 1_000, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95, fromPlan: true },
  /* 11 */ { layout: "pricerise", title: ["เงินเท่าเดิม", "ซื้อได้น้อยลง"] },
  /* 12 */ { layout: "pricerise", title: LONG_TITLE, note: LONG_NOTE },
  /* 13 */ { layout: "pensionsteps", title: ["บำนาญขั้นบันได", "เกษียณสบายใจ"], rows: SPEC_ROWS },
  /* 14 */ { layout: "pensionsteps", title: T, note: SOLID_NOTE, rows: [{ from: 60, to: 95, annual: 118_110 }] },
  /* 15 */ { layout: "pensionsteps", title: LONG_TITLE, note: LONG_NOTE, rows: FIVE },
  /* 16 */ { layout: "pensionsteps", title: T, rows: NINE.slice(0, 4) },
  /* 17 */ { layout: "pensionsteps", title: LONG_TITLE, note: LONG_NOTE, rows: NINE },
];
const jars = SHOWS.filter((x): x is SaveShow<"savejar"> => x.layout === "savejar");
const gots = SHOWS.filter((x): x is SaveShow<"paidgot"> => x.layout === "paidgot");
const prices = SHOWS.filter((x): x is SaveShow<"pricerise"> => x.layout === "pricerise");
const pensions = SHOWS.filter((x): x is SaveShow<"pensionsteps"> => x.layout === "pensionsteps");

const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const each = (fn: (size: VideoSize, art: Partial<StoryVideoInput>, label: string) => void) => {
  for (const size of SIZES) for (const art of ARTS) fn(size, art, `${size} ${art.art}`);
};
/** the middle of the beat that makes the figure: a jar's second fill, paidgot's second bar */
const mid = (show: KnowShow) => {
  const s = kspec(show);
  const x = show.layout === "savejar" ? s.fill1 : show.layout === "pricerise" ? s.fade : show.layout === "pensionsteps" ? s[`step${Math.floor(show.rows.length / 2)}`] : s.got;
  return x.at + x.dur / 2;
};

describe("the four saving devices draw", () => {
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
  it("draws through satori (as the stills do) in every look and size, mid-beat and at the end, and writes the stills to tests/scratch/devices4 only with SAVE_STILLS=1", async () => {
    const fonts = FONTS();
    const dir = path.join(process.cwd(), "tests/scratch/devices4");
    if (STILLS) mkdirSync(dir, { recursive: true });
    for (const [i, show] of SHOWS.entries()) for (const size of SIZES) for (const art of ARTS) for (const [when, t] of [["mid", mid(show)], ["end", end(show)]] as const) {
      const { w, h } = FRAME[size];
      const el = <div style={{ display: "flex", position: "relative", width: w, height: h, background: "#ece8df" }}>{showBody(show, ctx(size, art), t)}</div>;
      const png = await drawPngHere(el, { width: w, height: h }, fonts);
      expect(png, `${show.layout} ${size} ${art.art} ${t}`).toBeInstanceOf(Buffer);
      if (STILLS) writeFileSync(path.join(dir, `save${String(i).padStart(2, "0")}-${show.layout}-${size}-${art.art}${art.art === "minimal" ? "-warm" : ""}-${when}.png`), png);
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
    expect(half).not.toContain(SAVE_WORDS.foot); // not the plan engine's: no foot line
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

describe("pricerise", () => {
  it("draws no figure at all, and the words of the spec: two baskets, the line, the note (its default when left out)", () => {
    each((size, art, label) => {
      for (const show of prices) {
        const w = words(html(show, end(show), size, art));
        expect(w, `${label} digit`).not.toMatch(/[\d๐-๙]/);
        expect(w, label).toContain(SAVE_WORDS.today);
        expect(w, label).toContain(SAVE_WORDS.later);
        expect(w, label).toContain(SAVE_WORDS.fewer.split(" ")[0]);
        expect(w, label).toContain(SAVE_WORDS.fewer.split(" ")[1]);
      }
    });
    expect(words(html(prices[0]))).toContain("ราคาของสูงขึ้นทุกปี");
    expect(words(html(prices[1]))).toContain(LONG_NOTE);
    expect(words(html(prices[1]))).not.toContain("ราคาของสูงขึ้นทุกปี");
  });

  it("the second basket starts with five goods and two fade away, leaving three; today's keeps five; the same banknote in both", () => {
    const show = prices[0];
    const s = kspec(show);
    expect(priceAt(s, 0)).toEqual({ today: 0, later: 0, extra: 1 });
    const before = priceAt(s, s.fade.at - 0.01);
    expect(before.extra).toBe(1);
    let last = 1;
    for (let t = s.fade.at; t <= s.fade.at + s.fade.dur + 0.5; t += 0.05) {
      const e = priceAt(s, t).extra;
      expect(e, `t=${t}`).toBeLessThanOrEqual(last + 1e-9);
      last = e;
    }
    expect(priceAt(s, end(show)).extra).toBe(0);
    const out = html(show);
    expect((out.match(/data-good="a"/g) ?? []).length).toBe(5);
    expect((out.match(/data-good="b"/g) ?? []).length).toBe(3);
    expect((out.match(/data-part="banknote"/g) ?? []).length).toBe(2);
    // before the fade the second basket still holds five
    expect((html(show, s.fade.at - 0.01).match(/data-good="b"/g) ?? []).length).toBe(5);
    expect(s.later.at).toBeGreaterThan(s.today.at);
    expect(s.fade.at).toBeGreaterThanOrEqual(s.later.at + s.later.dur - 0.7);
    expect(s.line.at).toBeGreaterThanOrEqual(s.fade.at + s.fade.dur - 1e-9);
  });

  it("every part sits inside its room at every size, the baskets side by side and apart, the red line under both", () => {
    for (const size of SIZES) for (const show of prices) {
      const g = geoOf(size);
      const geo = priceGeo(size, show);
      const label = `${size} ${show.note ?? "default"}`;
      const inside = (r: { x: number; y: number; w: number; h: number }, what: string) => {
        expect(r.x, `${label} ${what}`).toBeGreaterThanOrEqual(g.dev.x);
        expect(r.y, `${label} ${what}`).toBeGreaterThanOrEqual(g.dev.y);
        expect(r.x + r.w, `${label} ${what}`).toBeLessThanOrEqual(g.dev.x + g.dev.w);
        expect(r.y + r.h, `${label} ${what}`).toBeLessThanOrEqual(g.dev.y + g.dev.h);
      };
      const [a, b] = geo.cols;
      inside(a, "today"); inside(b, "later"); inside(geo.line, "line");
      if (geo.note) inside(geo.note, "note");
      expect(a.x + a.w, label).toBeLessThanOrEqual(b.x);
      expect(a.y + a.h, label).toBeLessThanOrEqual(geo.line.y);
      if (geo.note) expect(geo.line.y + geo.line.h, label).toBeLessThanOrEqual(geo.note.y);
      expect(a.sheet.h, label).toBeGreaterThanOrEqual(PRICE.h * 0.5);
      expect(handWidth(SAVE_WORDS.today, a.labelSize), label).toBeLessThanOrEqual(a.w);
      expect(handWidth(SAVE_WORDS.later, b.labelSize), label).toBeLessThanOrEqual(b.w);
      for (const l of geo.line.lines) expect(handWidth(l, geo.line.size), `${label} ${l}`).toBeLessThanOrEqual(geo.line.w);
    }
  });
});

describe("paidgot's foot line", () => {
  it("takes no room when the plan engine's mark is not set (a คลิปตามโจทย์), and the bars grow into it", () => {
    const withFoot = paidGeo("portrait", gots[0]);
    const without = paidGeo("portrait", { ...gots[0], fromPlan: undefined });
    expect(without.bars[0].h).toBeGreaterThan(withFoot.bars[0].h);
    expect(html({ ...gots[0], fromPlan: undefined })).not.toContain(SAVE_WORDS.foot);
    expect(words(html(gots[0]))).toContain(SAVE_WORDS.foot);
  });
});

describe("pensionsteps", () => {
  it("the fallback plan (no size fits) draws every step to scale, not a flat 20 px", () => {
    // five steps in a room too narrow for any column: plan() refuses every size, the fallback stands
    const room = { x: 0, y: 0, w: 280, h: 500 };
    const rows = [{ from: 60, to: 64, annual: 100_000 }, { from: 65, to: 69, annual: 200_000 }, { from: 70, to: 79, annual: 400_000 }, { from: 80, to: 89, annual: 150_000 }, { from: 90, to: 95, annual: 50_000 }];
    const geo = pensionGeo("portrait", { layout: "pensionsteps", title: T, rows }, { room, text: 40 });
    const hs = geo.bars.map((b) => b.h);
    // proportional to the baht, the tallest the one of 400,000
    expect(new Set(hs).size).toBe(5);
    const k = hs[2] / 400_000;
    hs.forEach((h, i) => expect(Math.abs(h - Math.max(6, rows[i].annual * k)), `step ${i}`).toBeLessThanOrEqual(1));
    expect(geo.figSize).toBe(10);
  });

  it("draws every figure with its commas, each age range, the caption, the cost-of-living label (no figure) and the note", () => {
    for (const show of pensions) {
      const w = words(html(show));
      for (const r of show.rows) { expect(w, `${r.annual}`).toContain(r.annual.toLocaleString("en-US")); expect(w).toContain(`${r.from}–${r.to}`); }
      expect(w).toContain(SAVE_WORDS.perYear);
      expect(w).toContain(SAVE_WORDS.living);
      expect(w).toContain(show.note ?? "ค่าครองชีพก็สูงขึ้น วางแผนเผื่อไว้");
    }
    // the label itself carries no figure
    expect(/[\d๐-๙]/.test(SAVE_WORDS.living)).toBe(false);
    const geo = pensionGeo("portrait", pensions[0]);
    expect(geo.label.text).toBe(SAVE_WORDS.living);
    // spec example, in order
    const spec = words(html(pensions[0]));
    for (const x of ["118,110", "157,480", "196,851", "236,221", "60–75", "76–80", "81–85", "86–95"]) expect(spec, x).toContain(x);
  });

  it("the steps rise one by one, evenly, to the last; the line is drawn over them after the last begins", () => {
    for (const show of pensions) {
      const s = kspec(show);
      const n = show.rows.length;
      const geo = pensionGeo("portrait", show);
      expect(geo.bars.length).toBe(n);
      for (let i = 1; i < n; i++) {
        expect(s[`step${i}`].at, `${n} ${i}`).toBeGreaterThan(s[`step${i - 1}`].at);
        expect(geo.bars[i].h, `${n} ${i}`).toBeGreaterThanOrEqual(geo.bars[i - 1].h);
      }
      expect(s.living.at).toBeGreaterThan(s[`step${n - 1}`].at);
      expect(pensionAt(s, n, 0).steps.every((p) => p === 0)).toBe(true);
      const done = pensionAt(s, n, end(show));
      expect(done.steps.every((p) => Math.abs(p - 1) < 1e-9)).toBe(true);
      expect(done.living).toBeCloseTo(1, 5);
      if (n > 1) {
        const midT = s.step1.at + s.step1.dur / 2;
        const m = pensionAt(s, n, midT);
        expect(m.steps[0]).toBeCloseTo(1, 5);
        expect(m.steps[1]).toBeGreaterThan(0);
        expect(m.steps[1]).toBeLessThan(1);
        expect(m.steps[n - 1]).toBe(0);
      }
    }
  });

  it("each step is as tall as its baht, from zero: heights in the ratio of the annuals (within 2%)", () => {
    for (const size of SIZES) for (const show of [pensions[0], pensions[3], pensions[4], pensions[2]]) {
      const geo = pensionGeo(size, show);
      const max = Math.max(...show.rows.map((r) => r.annual));
      const tall = Math.max(...geo.bars.map((b) => b.h));
      geo.bars.forEach((b, i) => {
        expect(b.h / tall, `${size} ${show.rows.length} ${i}`).toBeGreaterThan((show.rows[i].annual / max) * 0.98);
        expect(b.h / tall, `${size} ${show.rows.length} ${i}`).toBeLessThan((show.rows[i].annual / max) * 1.02);
        expect(b.y + b.h, `${size} ${i}`).toBe(geo.base);
      });
    }
    // the spec example: 236,221 is about twice 118,110, drawn about twice as tall
    const g = pensionGeo("portrait", pensions[0]);
    expect(g.bars[3].h / g.bars[0].h).toBeGreaterThan(1.96);
    expect(g.bars[3].h / g.bars[0].h).toBeLessThan(2.04);
  });

  it("each figure is centred over its own step, a fixed gap above its top, in the spec example at all three sizes (and in every show that is not staggered)", () => {
    for (const size of SIZES) for (const show of pensions) {
      const geo = pensionGeo(size, show);
      const raised = geo.bars.filter((b) => b.leader);
      if (show === pensions[0] || show === pensions[1] || show === pensions[3]) expect(raised.length, `${size} ${show.rows.length}`).toBe(0);
      geo.bars.forEach((b, i) => {
        expect(Math.abs(b.fig.x + b.fig.w / 2 - (b.x + b.w / 2)), `${size} ${show.rows.length} fig${i} centre`).toBeLessThanOrEqual(2);
        if (!b.leader) expect(b.y - (b.fig.y + b.fig.h), `${size} ${show.rows.length} fig${i} gap`).toBe(geo.bars[0].y - (geo.bars[0].fig.y + geo.bars[0].fig.h));
        else { expect(b.leader.y).toBe(b.fig.y + b.fig.h); expect(b.leader.y + b.leader.h).toBe(b.y); }
      });
      // staggering strictly alternates: only the 2nd, 4th... are raised
      geo.bars.forEach((b, i) => expect(Boolean(b.leader) && i % 2 === 0, `${size} ${i}`).toBe(false));
    }
  });

  it("every figure fits its place at every size, nine digits and five steps included; none is covered by a bar, a neighbour or the dashed line", () => {
    for (const size of SIZES) for (const show of pensions) {
      const g = geoOf(size);
      const geo = pensionGeo(size, show);
      const label = `${size} ${show.rows.length} ${show.rows[0].annual}`;
      const room = (r: { x: number; y: number; w: number; h: number }, what: string) => {
        expect(r.x, `${label} ${what}`).toBeGreaterThanOrEqual(g.dev.x);
        expect(r.y, `${label} ${what}`).toBeGreaterThanOrEqual(g.dev.y);
        expect(r.x + r.w, `${label} ${what}`).toBeLessThanOrEqual(g.dev.x + g.dev.w);
        expect(r.y + r.h, `${label} ${what}`).toBeLessThanOrEqual(g.dev.y + g.dev.h);
      };
      const lineY = (x: number) => geo.line.y1 + ((geo.line.y2 - geo.line.y1) * (x - geo.line.x1)) / (geo.line.x2 - geo.line.x1);
      const hit = (p: { x: number; y: number; w: number; h: number }, q: { x: number; y: number; w: number; h: number }) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
      geo.bars.forEach((b, i) => {
        room({ x: b.x, y: b.y, w: b.w, h: b.h }, `bar${i}`);
        room(b.fig, `fig${i}`);
        room(b.age, `age${i}`);
        expect(figWidth(b.fig.text, geo.figSize), `${label} ${b.fig.text}`).toBeLessThanOrEqual(b.fig.w);
        expect(figWidth(b.age.text, geo.ageSize), `${label} ${b.age.text}`).toBeLessThanOrEqual(b.age.w);
        // no bar and no other figure under it
        geo.bars.forEach((o, j) => {
          expect(hit(b.fig, { x: o.x, y: o.y, w: o.w, h: o.h }), `${label} fig${i} on bar${j}`).toBe(false);
          if (j !== i) expect(hit(b.fig, o.fig), `${label} fig${i} on fig${j}`).toBe(false);
        });
        // the dashed line runs clear above the figure along its whole width (screen y grows downward)
        expect(lineY(b.fig.x), `${label} line over fig${i}`).toBeLessThanOrEqual(b.fig.y - 4);
        expect(lineY(b.fig.x + b.fig.w), `${label} line over fig${i} right`).toBeLessThanOrEqual(b.fig.y - 4);
        expect(lineY(b.x), `${label} line over step${i}`).toBeLessThanOrEqual(b.y - 4);
      });
      expect(geo.line.y2, label).toBeLessThan(geo.line.y1);
      expect(geo.line.x2, label).toBeGreaterThan(geo.line.x1);
      room({ x: geo.line.x1, y: geo.line.y2, w: geo.line.x2 - geo.line.x1, h: geo.line.y1 - geo.line.y2 }, "line");
      room(geo.label, "label");
      expect(geo.label.y + geo.label.h, `${label} label above the line`).toBeLessThanOrEqual(geo.line.y2);
      expect(handWidth(SAVE_WORDS.living, geo.label.size), label).toBeLessThanOrEqual(geo.label.w);
      room(geo.caption, "caption");
      expect(handWidth(SAVE_WORDS.perYear, geo.caption.size), label).toBeLessThanOrEqual(geo.caption.w);
      if (geo.note) { room(geo.note, "note"); expect(geo.caption.y + geo.caption.h, label).toBeLessThanOrEqual(geo.note.y); }
      expect(geo.figSize, label).toBeGreaterThanOrEqual(Math.round(g.text * 0.45));
    }
  });
});
