import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cloneElement, createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { SAVE_LAYOUTS, SAVE_WORDS, showText, type KnowShow, type SaveShow } from "@/lib/quote-video/story-knowledge";
import { kspec } from "@/lib/quote-video/story-knowledge-motion";
import { infoDrawn, infoShow, kitFor } from "@/lib/quote-video/story-info-motion";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import { storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import { savePlace } from "@/lib/quote-video/story-save-info";
import { figWidth, jarGeo, paidGeo, pensionGeo, priceGeo } from "@/lib/quote-video/story-save-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/**
 * device round 4, Task 4: savejar, paidgot, pricerise and pensionsteps in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด,
 * นีออน, บลูพริ้นท์ and the retired อินโฟกราฟิก — drawn with the Kit, the paper's geometry and beats. Stills (single PNGs and
 * the contact sheets) are written to tests/scratch/devices4 only with SAVE_STILLS=1.
 */
const STILLS = process.env.SAVE_STILLS === "1";
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const LOOKS = ["plot", "board", "neon", "blueprint", "info"] as const;
type Look = (typeof LOOKS)[number];
const DARK = ["neon", "blueprint"] as const;
const STILL_LOOKS = ["plot", "board", "neon", "blueprint"] as const;

const ctx = (size: VideoSize, art: Look): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const T: [string, string] = ["ส่งทุกปี", "ก้อนโตขึ้นเรื่อยๆ"];
const LONG_TITLE: [string, string] = ["ครอบครัวไม่ต้องเปียก", "ประกันคือร่มของบ้าน"];
const LONG_NOTE = "รายได้หลักของบ้าน ถ้าหายไปจะลำบาก";
const SOLID_NOTE = "เงินก้อนมาถึงมือตอนที่ต้องการที่สุด";
const SPEC_ROWS = [{ from: 60, to: 75, annual: 118_110 }, { from: 76, to: 80, annual: 157_480 }, { from: 81, to: 85, annual: 196_851 }, { from: 86, to: 95, annual: 236_221 }];
const FIVE = [{ from: 60, to: 64, annual: 100_000 }, { from: 65, to: 69, annual: 130_000 }, { from: 70, to: 79, annual: 160_000 }, { from: 80, to: 89, annual: 190_000 }, { from: 90, to: 95, annual: 220_000 }];
const NINE = [{ from: 60, to: 64, annual: 100_000_000 }, { from: 65, to: 69, annual: 110_000_000 }, { from: 70, to: 79, annual: 120_000_000 }, { from: 80, to: 89, annual: 123_456_788 }, { from: 90, to: 99, annual: 123_456_789 }];

/** the spec's example, a nine-digit case, and the optional numbers missing, for each device */
const SHOWS: SaveShow[] = [
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
/** one of each at the spec's example, the nine-digit cases: what the dark-look checks and the sheets use */
const KEY: SaveShow[] = [SHOWS[0], SHOWS[4], SHOWS[6], SHOWS[9], SHOWS[11], SHOWS[13], SHOWS[15], SHOWS[17]];

const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const mid = (show: KnowShow) => {
  const s = kspec(show);
  const x = show.layout === "savejar" ? s.fill1 : show.layout === "pricerise" ? s.fade : show.layout === "pensionsteps" ? s[`step${Math.floor(show.rows.length / 2)}`] : s.got;
  return x.at + x.dur / 2;
};
const draw = (show: KnowShow, size: VideoSize = "portrait", art: Look = "plot", t = end(show)) => renderToStaticMarkup(<>{infoDrawn(show, ctx(size, art), t)}</>);
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const flat = (markup: string) => words(markup).replace(/ /g, "");
const each = (fn: (size: VideoSize, art: Look, label: string) => void) => {
  for (const size of SIZES) for (const art of LOOKS) fn(size, art, `${size} ${art}`);
};
const times = (show: KnowShow) => [0, 0.7, mid(show), 2.2, end(show), end(show) + 3];

describe("the four saving devices draw in the info route", () => {
  it("every layout has its drawer in every look and size: none falls through to nothing", () => {
    expect(new Set(SHOWS.map((x) => x.layout))).toEqual(new Set(SAVE_LAYOUTS));
    for (const show of SHOWS) each((size, art, label) => expect(infoShow(show, ctx(size, art), end(show)), `${show.layout} ${label}`).not.toBeNull());
  });

  it("in every look and size, from the start through the middle of the beat to the end, with no NaN, no Infinity and no shared id", () => {
    for (const show of SHOWS) each((size, art, label) => {
      for (const t of times(show)) {
        let out = "";
        expect(() => { out = draw(show, size, art, t); }, `${show.layout} ${label} ${t}`).not.toThrow();
        expect(out, `${show.layout} ${label} ${t}`).not.toContain("NaN");
        expect(out, `${show.layout} ${label} ${t}`).not.toContain("Infinity");
        expect(out).not.toMatch(/ id="/);
      }
    });
  });

  it("each draws its picture, not only its title; before its moment the picture is hidden", () => {
    for (const show of SHOWS) each((size, art, label) => expect(draw(show, size, art).length, `${show.layout} ${label}`).toBeGreaterThan(1800));
    for (const show of KEY) for (const art of LOOKS) expect(draw(show, "portrait", art, 0), `${show.layout} ${art}`).toContain("opacity:0");
  });

  it("draws no percent and no return word; no digit at all when no number was given", () => {
    const BAD = /%|ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล|IRR|ปัน/i;
    each((size, art, label) => {
      for (const show of SHOWS) expect(words(draw(show, size, art)), `${show.layout} ${label}`).not.toMatch(BAD);
      expect(words(draw(jars[3], size, art)), `${label} bare jar`).not.toMatch(/[\d๐-๙]/);
      for (const show of prices) expect(words(draw(show, size, art)), `${label} pricerise: no figure`).not.toMatch(/[\d๐-๙]/);
    });
  });

  it("every word it draws is one the hand font is given (showText)", () => {
    for (const show of SHOWS) {
      const given = new Set(showText(show));
      for (const art of ["plot", "neon"] as const) {
        const seen = [...words(draw(show, "portrait", art))].filter((c) => c.trim());
        for (const c of seen) expect(given.has(c), `${show.layout} ${art}: ${c}`).toBe(true);
      }
    }
  });
});

describe("they tell the paper's story with its words and figures", () => {
  it("the title whole, the note at its beat (not before), in every look and size", () => {
    for (const show of SHOWS) each((size, art, label) => {
      const say = flat(draw(show, size, art));
      for (const x of show.title) expect(say, `${show.layout} ${label} ${x}`).toContain(x.replace(/ /g, ""));
      const note = show.note ?? (show.layout === "pricerise" ? "ราคาของสูงขึ้นทุกปี" : show.layout === "pensionsteps" ? "ค่าครองชีพก็สูงขึ้น วางแผนเผื่อไว้" : undefined);
      if (note) {
        expect(say, `${show.layout} ${label}`).toContain(note.replace(/ /g, ""));
        const before = draw(show, size, art, kspec(show).note.at - 0.01);
        const i = before.indexOf("data-note");
        const j = before.indexOf(note.split(" ")[0].slice(0, 4), i);
        expect(i, `${show.layout} ${label}`).toBeGreaterThan(-1);
        expect(before.slice(i, j), `${show.layout} ${label}: the note hidden before its beat`).toContain("opacity:0");
      }
    });
  });

  it("savejar: its four marks and its card as the paper's", () => {
    each((size, art, label) => {
      const full = words(draw(jars[0], size, art));
      for (const x of ["ปีที่ 5", "ปีที่ 10", "ปีที่ 15", "ปีที่ 20", "ส่งรวม 20 ปี", "2,724,411 บาท"]) expect(full, `${label} ${x}`).toContain(x);
      const noPaid = words(draw(jars[1], size, art));
      expect(noPaid, label).toContain("ส่งรวม 20 ปี");
      expect(noPaid, label).not.toContain("บาท");
      const noYears = words(draw(jars[2], size, art));
      expect(noYears, label).toContain("2,724,411 บาท");
      expect(noYears, label).not.toContain("ปีที่");
      const bare = words(draw(jars[3], size, art));
      expect(bare, label).toContain(SAVE_WORDS.each);
      expect(bare, label).not.toContain("ปีที่");
    });
  });

  it("paidgot: both baht, ages only when both of a bar's are given, the fixed line under", () => {
    each((size, art, label) => {
      const full = words(draw(gots[0], size, art));
      for (const x of ["2,724,411 บาท", "6,023,625 บาท", "อายุ 40–59", "อายุ 60–95", SAVE_WORDS.sent, SAVE_WORDS.got, SAVE_WORDS.foot]) expect(full, `${label} ${x}`).toContain(x);
      const none = words(draw(gots[1], size, art));
      expect(none, label).not.toContain("อายุ");
      expect(none, label).toContain(SAVE_WORDS.foot);
      const half = words(draw(gots[2], size, art));
      expect(half, label).not.toContain("อายุ 40");
      expect(half, label).toContain("อายุ 60–95");
    });
  });

  it("pricerise: two baskets and a banknote each, two goods fade out of the second, no figure", () => {
    for (const art of LOOKS) {
      const out = draw(prices[0], "portrait", art);
      expect(out.match(/data-part="banknote"/g)?.length, art).toBe(2);
      expect(out.match(/data-good="a"/g)?.length, art).toBe(5);
      expect(out.match(/data-good="b"/g)?.length ?? 0, art).toBe(3);
      const s = kspec(prices[0]);
      expect(draw(prices[0], "portrait", art, s.fade.at + 0.01).match(/data-good="b"/g)?.length, art).toBe(5);
      expect(flat(out), art).toContain(SAVE_WORDS.fewer.replace(/ /g, ""));
    }
  });

  it("pensionsteps: one step for each row, each with its baht a year and its ages; the cost-of-living line carries no figure", () => {
    each((size, art, label) => {
      const out = draw(pensions[0], size, art);
      expect(out.match(/data-part="step"/g)?.length, label).toBe(4);
      for (const x of ["118,110", "157,480", "196,851", "236,221", "60–75", "76–80", "81–85", "86–95", SAVE_WORDS.living]) expect(words(out), `${label} ${x}`).toContain(x);
      expect(words(out), label).toContain(SAVE_WORDS.perYear);
      expect(out.match(/data-part="step"/g)?.length, label).toBe(4);
      // the line's label is a word, no figure
      const label2 = /data-part="living-label"[^>]*>([^<]*)</.exec(out)?.[1];
      expect(label2, label).toBe(SAVE_WORDS.living);
      // steps rise one by one
      const early = draw(pensions[0], size, art, kspec(pensions[0]).step0.at + 0.2);
      expect(early.split('data-part="step"')[4], label).toContain("opacity:0");
      expect(early.split('data-part="step"')[1], label).toContain("opacity:1");
    });
  });

  it("pensionsteps: each step as tall as its baht from zero, each figure centred over its own step at one fixed gap", () => {
    for (const size of SIZES) for (const show of [pensions[0], pensions[2], pensions[3], pensions[4]]) {
      const geo = pensionGeo(size, show, savePlace(size));
      const top = Math.max(...geo.bars.map((b) => b.row.annual));
      const full = geo.bars.find((b) => b.row.annual === top)!;
      for (const b of geo.bars) {
        expect(Math.abs(b.h - Math.max(6, (full.h * b.row.annual) / top)), `${size} ${show.rows.length} ${b.row.annual}`).toBeLessThanOrEqual(2);
        if (!b.leader) {
          expect(Math.abs(b.fig.x + b.fig.w / 2 - (b.x + b.w / 2)), `${size} centred`).toBeLessThanOrEqual(8);
          expect(b.y - (b.fig.y + b.fig.h), `${size} gap`).toBe(geo.bars[0].y - (geo.bars[0].fig.y + geo.bars[0].fig.h));
        }
      }
    }
  });
});

describe("Review Focus 2: the longest words and figures fit at every size, in the info route's room", () => {
  const inside = (b: { x: number; y: number; w: number; h: number }, r: { x: number; y: number; w: number; h: number }, at: string) => {
    expect(b.x, at).toBeGreaterThanOrEqual(r.x - 1);
    expect(b.y, at).toBeGreaterThanOrEqual(r.y - 1);
    expect(b.x + b.w, at).toBeLessThanOrEqual(r.x + r.w + 1);
    expect(b.y + b.h, at).toBeLessThanOrEqual(r.y + r.h + 1);
  };
  it("savejar: jar, marks and card inside the room; the longest figure fits its card", () => {
    for (const size of SIZES) for (const show of jars) {
      const p = savePlace(size);
      const geo = jarGeo(size, show, p);
      const at = `${size} ${jars.indexOf(show)}`;
      inside(geo.jar, p.room, at);
      inside(geo.card, p.room, at);
      for (const l of geo.card.lines) expect(figWidth(l.text, l.size), `${at} ${l.text}`).toBeLessThanOrEqual(geo.card.inner);
      if (geo.labels) inside({ x: geo.labels.x, y: geo.labels.ys[0], w: geo.labels.w, h: 1 }, p.room, `${at} labels`);
    }
  });
  it("paidgot: each figure inside its column, the bars to one scale", () => {
    for (const size of SIZES) for (const show of gots) {
      const p = savePlace(size);
      const geo = paidGeo(size, show, p);
      const at = `${size} ${gots.indexOf(show)}`;
      for (const b of geo.bars) expect(figWidth(b.fig, geo.figSize), `${at} ${b.fig}`).toBeLessThanOrEqual(b.col.w);
      inside({ x: geo.bars[0].col.x, y: geo.top, w: geo.bars[1].col.x + geo.bars[1].col.w - geo.bars[0].col.x, h: geo.bottom - geo.top }, p.room, at);
      const more = Math.max(show.paid, show.got);
      for (const [b, v] of [[geo.bars[0], show.paid], [geo.bars[1], show.got]] as const) expect(Math.abs(b.h - Math.max(8, (geo.maxBarH * v) / more)), `${at} ${v}`).toBeLessThanOrEqual(1);
    }
  });
  it("pricerise: baskets, the red line and the note inside the room", () => {
    for (const size of SIZES) for (const show of prices) {
      const p = savePlace(size);
      const geo = priceGeo(size, show, p);
      for (const col of geo.cols) inside(col, p.room, `${size} col`);
      inside({ x: geo.line.x, y: geo.line.y, w: geo.line.w, h: geo.line.h }, p.room, `${size} line`);
      if (geo.note) inside(geo.note, p.room, `${size} note`);
      for (const l of geo.line.lines) expect(handWidth(l, geo.line.size), `${size} ${l}`).toBeLessThanOrEqual(geo.line.w);
    }
  });
  it("pensionsteps: nine-digit figures inside the room and clear of each other and of the steps", () => {
    for (const size of SIZES) for (const show of pensions) {
      const p = savePlace(size);
      const geo = pensionGeo(size, show, p);
      const at = `${size} ${pensions.indexOf(show)}`;
      for (const b of geo.bars) {
        inside(b.fig, p.room, `${at} ${b.fig.text}`);
        expect(figWidth(b.fig.text, geo.figSize), `${at} ${b.fig.text}`).toBeLessThanOrEqual(b.fig.w + 1);
      }
      for (let i = 1; i < geo.bars.length; i++) {
        const [a, b] = [geo.bars[i - 1].fig, geo.bars[i].fig];
        expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${at} ${i}`).toBe(true);
      }
    }
  });
});

describe("drawn with the Kit", () => {
  const weights = (html: string) => [...html.matchAll(/font-weight:(\d+)/g)].map((m) => Number(m[1]));

  it("นีออน writes in Sriracha and never above 400; the other looks keep their bold", () => {
    for (const show of SHOWS) for (const size of SIZES) {
      const html = draw(show, size, "neon");
      expect(html, `${show.layout} ${size}`).toContain("font-family:Sriracha");
      for (const w of weights(html)) expect(w, `${show.layout} ${size}`).toBeLessThanOrEqual(400);
    }
    for (const art of ["plot", "board", "blueprint", "info"] as const) expect(KEY.flatMap((x) => weights(draw(x, "portrait", art))), art).toContain(600);
  });

  it("every colour drawn is one of the look's own", () => {
    const COLOR = /(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\))/g;
    for (const art of LOOKS) {
      const kit = kitFor({ art });
      const own = new Set([...Object.values(kit).filter((v): v is string => typeof v === "string"), S.plotRail, S.plotRailEdge, S.plotHead, S.plotPaper, S.plotPen].map((x) => x.replace(/\s/g, "")));
      for (const show of KEY) for (const size of SIZES) for (const t of [mid(show), end(show)]) {
        for (const m of draw(show, size, art, t).matchAll(COLOR)) expect(own.has(m[1].replace(/\s/g, "")), `${art} ${show.layout} ${size} ${m[1]}`).toBe(true);
      }
    }
  });

  it("glows only in นีออน, and the plotter's machine is over plot only", () => {
    for (const show of KEY) {
      expect(draw(show, "portrait", "neon"), show.layout).toMatch(/text-shadow:0 0|box-shadow:0 0|stroke-opacity/);
      for (const art of ["plot", "board", "blueprint", "info"] as const) {
        const html = draw(show, "portrait", art);
        expect(html, `${art} ${show.layout}`).not.toContain("text-shadow");
        expect(html, `${art} ${show.layout}`).not.toContain("box-shadow");
      }
      expect(draw(show, "portrait", "plot", 1), show.layout).toContain(S.plotRail);
      for (const art of ["board", "neon", "blueprint", "info"] as const) expect(draw(show, "portrait", art, 1), `${art} ${show.layout}`).not.toContain(S.plotRail);
    }
  });
});

/* ── through satori, as the stills and the clip frames draw them ─────────────────────────────────────────────────── */

const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
const FONTS: DrawFont[] = [
  { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
  { name: "Plex", data: face("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
  { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
  { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
  { name: "Sriracha", data: face("Sriracha-400.ttf"), weight: 400, style: "normal" },
];
/** a frame as the clip shows it: the look's background, the scene over it */
const frame = (show: KnowShow, size: VideoSize, art: Look, t: number, body: ReactNode = infoDrawn(show, ctx(size, art), t)) => (
  <div style={{ display: "flex", position: "relative", width: FRAME[size].w, height: FRAME[size].h, fontFamily: "Plex" }}>
    <div style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>{storyBackground(size, ctx(size, art).input)}</div>
    <div style={{ position: "absolute", left: 0, top: 0, width: FRAME[size].w, height: FRAME[size].h, display: "flex" }}>{body}</div>
  </div>
);
const png = (el: ReactElement, size: VideoSize) => drawPngHere(el, { width: FRAME[size].w, height: FRAME[size].h }, FONTS);

describe("through satori, as the stills and the clip frames draw them", () => {
  it("every look and size, mid-beat and at the end, for the key cases (all cases at the end in one look): draws", async () => {
    for (const show of KEY) for (const size of SIZES) for (const art of LOOKS) for (const t of [mid(show), end(show)]) {
      const bytes = await png(frame(show, size, art, t), size);
      expect(bytes.length, `${show.layout} ${size} ${art} ${t}`).toBeGreaterThan(1000);
    }
    for (const show of SHOWS) for (const size of SIZES) {
      const bytes = await png(frame(show, size, "neon", end(show)), size);
      expect(bytes.length, `${show.layout} ${size} neon`).toBeGreaterThan(1000);
    }
  }, 900_000);

  it.skipIf(!STILLS)("writes the stills and contact sheets to tests/scratch/devices4 (SAVE_STILLS=1)", async () => {
    const dir = path.join(process.cwd(), "tests/scratch/devices4");
    mkdirSync(dir, { recursive: true });
    const names = ["savejar", "paidgot", "pricerise", "pensionsteps"];
    const picks: SaveShow[] = [SHOWS[0], SHOWS[6], SHOWS[11], SHOWS[13]];
    const cell = 560;
    // one sheet per device: a row per size, a column per look, the end frame
    for (const [i, show] of picks.entries()) {
      const tiles: { input: Buffer; left: number; top: number }[] = [];
      let top = 0;
      for (const size of SIZES) {
        const h = cell;
        let left = 0;
        for (const art of STILL_LOOKS) {
          const bytes = await png(frame(show, size, art, end(show)), size);
          writeFileSync(path.join(dir, `saveinfo-${names[i]}-${size}-${art}-end.png`), bytes);
          const resized = await sharp(bytes).resize({ height: h }).png().toBuffer();
          const wide = (await sharp(resized).metadata()).width!;
          tiles.push({ input: resized, left, top });
          left += wide + 8;
        }
        top += h + 8;
      }
      const width = Math.max(...tiles.map((x) => x.left)) + 900;
      await sharp({ create: { width, height: top, channels: 3, background: "#808080" } }).composite(tiles).png().toFile(path.join(dir, `sheet-${names[i]}.png`));
    }
    // the mid-beat sheet: the four devices in portrait, the four looks
    const tiles: { input: Buffer; left: number; top: number }[] = [];
    for (const [i, show] of picks.entries()) {
      let left = 0;
      for (const art of STILL_LOOKS) {
        const bytes = await png(frame(show, "portrait", art, mid(show)), "portrait");
        const resized = await sharp(bytes).resize({ height: 800 }).png().toBuffer();
        tiles.push({ input: resized, left, top: i * 808 });
        left += (await sharp(resized).metadata()).width! + 8;
      }
    }
    await sharp({ create: { width: 4 * 458, height: 4 * 808, channels: 3, background: "#808080" } }).composite(tiles).png().toFile(path.join(dir, "sheet-mid-beat.png"));
    // the nine-digit cases, portrait and landscape, neon: the longest figures
    for (const show of [SHOWS[4], SHOWS[9], SHOWS[17]]) for (const size of SIZES) for (const art of ["neon", "plot"] as const) {
      writeFileSync(path.join(dir, `saveinfo-nine-${show.layout}-${size}-${art}.png`), await png(frame(show, size, art, end(show)), size));
    }
  }, 900_000);
});

/* ── Review Focus 3: on the dark looks every word and figure can be read where it is drawn, element by element ───── */

/** which text element `expand` hides: its index in tree order (-1 hides none); `seen` collects every text element's words */
interface Pass { n: number; hide: number; probe: boolean; seen: string[]; ink: (string | undefined)[] }
/** the frame's tree with its components run; the one text element numbered `hide` has its ink drawn transparent and its glow off */
function expand(node: ReactNode, pass: Pass): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((x) => expand(x, pass));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode; style?: React.CSSProperties }>;
  if (typeof el.type === "function") return expand((el.type as (p: unknown) => ReactNode)(el.props), pass);
  const kids = el.props.children;
  if ((el.type as unknown) === Fragment) return createElement(Fragment, null, expand(kids, pass));
  const list = Array.isArray(kids) ? kids.flat(Infinity) : [kids];
  const mine = list.filter((k) => typeof k === "string" || typeof k === "number").join("").trim();
  let style = el.props.style;
  if (mine) {
    const i = pass.n++;
    pass.seen[i] = mine;
    pass.ink[i] = typeof style?.color === "string" ? style.color : undefined;
    // the hidden element's ink goes transparent (the blank frame: what is under it); in a probe frame it is a flat marker colour, which gives its glyphs' own pixels
    if (i === pass.hide) style = { ...style, color: pass.probe ? "#ff00ff" : "transparent", textShadow: "none" };
  }
  return cloneElement(el, { style }, expand(kids, pass));
}
const lum = (p: number[]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
async function pixels(bytes: Buffer) {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  return (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe("Review Focus 3: นีออน and บลูพริ้นท์ keep every word and figure readable, element by element", () => {
  /**
   * Each text element (a title line, a mark, a figure, an age, the ค่าครองชีพ label, the fixed foot line, a note line…)
   * is drawn twice on its own: with its ink transparent (what is under it) and in a flat marker colour (its glyphs'
   * own pixels: where the two frames differ). It must have glyph pixels at all, and its real ink (the colour it is
   * given) must stand 3:1 or better off what is under those pixels, for nine in ten of them (the edges' antialiasing
   * and a grid line crossing a glyph are not counted). Text drawn in the colour of its ground has the pixels and
   * fails the contrast; text that is never drawn has none and fails the pixels.
   */
  const CASES: SaveShow[] = [SHOWS[0], SHOWS[6], SHOWS[11], SHOWS[17]];
  for (const art of DARK) {
    it(`every text element stands 3:1 off what is under it, with real glyph pixels, in ${art}: four devices at the spec example, a 9-digit case, every size`, async () => {
      const failures: string[] = [];
      let checked = 0;
      for (const show of CASES) for (const size of SIZES) {
        const t = end(show);
        const body = infoDrawn(show, ctx(size, art), t);
        const count: Pass = { n: 0, hide: -1, probe: false, seen: [], ink: [] };
        expand(body, count);
        const { w, h } = FRAME[size];
        expect(count.n, `${show.layout} ${size}: text elements`).toBeGreaterThan(3);
        for (let i = 0; i < count.n; i++) {
          const blank = await pixels(await png(frame(show, size, art, t, expand(body, { n: 0, hide: i, probe: false, seen: [], ink: [] })), size));
          const probe = await pixels(await png(frame(show, size, art, t, expand(body, { n: 0, hide: i, probe: true, seen: [], ink: [] })), size));
          const label = `${art} ${show.layout} ${SHOWS.indexOf(show)} ${size} "${count.seen[i]}"`;
          const color = count.ink[i];
          checked++;
          if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) { failures.push(`${label}: ink ${color} is not one of the look's hex inks`); continue; }
          const ink = rgb(color);
          let mask = 0;
          let read = 0;
          for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
            const [p, q] = [probe(x, y), blank(x, y)];
            if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 60) continue;
            mask++;
            if (contrast(ink, q) >= 3) read++;
          }
          if (mask < 20) { failures.push(`${label}: no glyph pixels (${mask})`); continue; }
          if (read / mask < 0.9) failures.push(`${label}: ${read}/${mask} pixels read 3:1`);
        }
      }
      expect(checked, "elements checked").toBeGreaterThan(100);
      expect(failures).toEqual([]);
    }, 1_800_000);
  }
});
