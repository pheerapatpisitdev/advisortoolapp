import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { HEALTH2_WORDS as W, showText, type Health2Show, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { geoOf, kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import {
  arcPoint, copayAt, copayGeo, copaySplit, deductibleAt, deductibleGeo, deductibleParts, h2Inside, ipdopdAt, ipdopdGeo, renewAge, renewAt, renewGeo, blkH,
} from "@/lib/quote-video/story-health2-motion";
import { figWidth } from "@/lib/quote-video/story-save-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/** device round 5, Task 2: ipdopd, deductible, copay and renew98 drawn in paper, warm and line. PNG stills are written only with HEALTH2_STILLS=1 */
const STILLS = process.env.HEALTH2_STILLS === "1";
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const ARTS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];

const ctx = (size: VideoSize, art: Partial<StoryVideoInput> = { art: "paper" }): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const T: [string, string] = ["สองประตู", "คนละวงเงิน"];
const LONG_TITLE: [string, string] = ["ครอบครัวไม่ต้องเปียก", "ประกันคือร่มของบ้าน"];
const LONG_NOTE = "รายได้หลักของบ้าน ถ้าหายไปจะลำบาก";
const NINE = 123_456_789;

type S<L extends Health2Show["layout"]> = Health2Show<L>;
const SHOWS: KnowShow[] = [
  /* 0 */ { layout: "ipdopd", title: T, note: "ตามตารางของแผน", room: 9_000, opd: 12_000, planName: "โกลด์" },
  /* 1 */ { layout: "ipdopd", title: T, room: 3_000, opd: "none" },
  /* 2 */ { layout: "ipdopd", title: T, room: 6_000, opd: "actual" },
  /* 3 */ { layout: "ipdopd", title: LONG_TITLE, note: LONG_NOTE, room: NINE, opd: NINE, planName: "ชื่อแผนยาวสิบสี่ตัว" },
  /* 4 */ { layout: "ipdopd", title: T, room: 9_000, opd: "none", planName: "สมาร์ท", note: LONG_NOTE },
  /* 5 */ { layout: "deductible", title: ["ส่วนรับผิดชอบแรก", "เราจ่ายก่อน"], note: "ตามเงื่อนไขของแผน", deductible: 50_000, bill: 100_000 },
  /* 6 */ { layout: "deductible", title: T, deductible: 50_000, bill: 30_000 },
  /* 7 */ { layout: "deductible", title: T, deductible: 50_000 },
  /* 8 */ { layout: "deductible", title: LONG_TITLE, note: LONG_NOTE, deductible: 100_000_000, bill: NINE },
  /* 9 */ { layout: "deductible", title: T, deductible: 30_000, bill: NINE },
  /* 10 */ { layout: "deductible", title: T, deductible: 50_000, bill: 50_000 },
  /* 11 */ { layout: "copay", title: ["ร่วมจ่าย", "ตามเงื่อนไข"], note: "แบ่งตามส่วน", percent: 20, bill: 100_000 },
  /* 12 */ { layout: "copay", title: T, percent: 20 },
  /* 13 */ { layout: "copay", title: LONG_TITLE, note: LONG_NOTE, percent: 20, bill: NINE },
  /* 14 */ { layout: "copay", title: T, percent: 1, bill: 100_000 },
  /* 15 */ { layout: "copay", title: T, percent: 99, bill: 100_000 },
  /* 16 */ { layout: "copay", title: T, percent: 100, bill: 100_000 },
  /* 17 */ { layout: "renew98", title: ["ต่ออายุ", "ได้ถึง"], note: "ตามเงื่อนไข", to: 98, age: 35 },
  /* 18 */ { layout: "renew98", title: T, to: 98 },
  /* 19 */ { layout: "renew98", title: LONG_TITLE, note: LONG_NOTE, to: 98, age: 1 },
  /* 20 */ { layout: "renew98", title: T, to: 98, age: 98 },
];
const of = <L extends Health2Show["layout"]>(layout: L) => SHOWS.filter((x): x is S<L> => x.layout === layout);
const ipds = of("ipdopd");
const deds = of("deductible");
const cops = of("copay");
const rens = of("renew98");

const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** the words without any space, to compare phrases the drawer sets on lines of its own */
const squash = (markup: string) => words(markup).replace(/\s+/g, "");
const each = (fn: (size: VideoSize, art: Partial<StoryVideoInput>, label: string) => void) => {
  for (const size of SIZES) for (const art of ARTS) fn(size, art, `${size} ${art.art}`);
};
/** the middle of the beat that makes the figure */
const mid = (show: KnowShow) => {
  const s = kspec(show);
  const x = show.layout === "ipdopd" ? s.door1 : show.layout === "deductible" ? s.ours : show.layout === "copay" ? s.cut : s.arc;
  return x.at + x.dur / 2;
};
const rect = (r: { x: number; y: number; w: number; h: number }) => r;
const hit = (p: { x: number; y: number; w: number; h: number }, q: { x: number; y: number; w: number; h: number }) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

describe("the four round-5 health devices draw", () => {
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
  it("draws through satori (as the stills do) in every look and size, mid-beat and at the end, and writes the stills to tests/scratch/devices5 only with HEALTH2_STILLS=1", async () => {
    const fonts = FONTS();
    const dir = path.join(process.cwd(), "tests/scratch/devices5");
    if (STILLS) mkdirSync(dir, { recursive: true });
    for (const [i, show] of SHOWS.entries()) for (const size of SIZES) for (const art of ARTS) for (const [when, t] of [["mid", mid(show)], ["end", end(show)]] as const) {
      const { w, h } = FRAME[size];
      const el = <div style={{ display: "flex", position: "relative", width: w, height: h, background: "#ece8df" }}>{showBody(show, ctx(size, art), t)}</div>;
      const png = await drawPngHere(el, { width: w, height: h }, fonts);
      expect(png, `${show.layout} ${size} ${art.art} ${t}`).toBeInstanceOf(Buffer);
      if (STILLS) writeFileSync(path.join(dir, `h2-${String(i).padStart(2, "0")}-${show.layout}-${size}-${art.art}${art.art === "minimal" ? "-warm" : ""}-${when}.png`), png);
    }
  }, 900_000);

  it("draws no return word, and a percent only on the co-payment's own figure", () => {
    const BAD = /ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล|IRR|ปัน|เบี้ยเท่าเดิม|ต่อได้แน่นอน|รายวัน/i;
    each((size, art, label) => {
      for (const show of SHOWS) {
        const w = words(html(show, end(show), size, art));
        expect(w, `${show.layout} ${label}`).not.toMatch(BAD);
        if (show.layout === "copay") expect(w.match(/%/g) ?? [], `${label} percent`).toHaveLength(1);
        else expect(w, `${show.layout} ${label} percent`).not.toContain("%");
      }
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

describe("ipdopd", () => {
  it("draws the two cards the spec words, the plan's name when given, and the line", () => {
    const g = squash(html(ipds[0]));
    for (const x of ["ผู้ป่วยใน", "ผู้ป่วยนอก", "ค่าห้อง9,000บาท/วัน", "วงเงินรวม/ปี12,000บาท", "โกลด์", W.opdIncludes.replace(/ /g, "")]) expect(g, x).toContain(x);
    expect(squash(html(ipds[1]))).not.toContain("โกลด์");
  });

  it("opd \"none\" says the plan has no OPD and draws no OPD figure or includes-line; \"actual\" says as paid", () => {
    const none = squash(html(ipds[1]));
    expect(none).toContain(W.noOpd);
    expect(none).not.toContain(W.opdLimit);
    expect(none).not.toContain(W.opdIncludes.replace(/ /g, ""));
    expect(none).toContain("3,000บาท/วัน");
    const actual = squash(html(ipds[2]));
    expect(actual).toContain(W.actual);
    expect(actual).not.toContain(W.opdLimit);
    expect(actual).toContain(W.opdIncludes.replace(/ /g, ""));
    expect(squash(html(ipds[4]))).not.toContain(W.opdLimit);
  });

  it("the two doors open in turn, the second only after the first; a plan without OPD keeps its second door shut", () => {
    const s = kspec(ipds[0]);
    expect(s.door1.at).toBeGreaterThan(s.door0.at + s.door0.dur - 1e-9);
    expect(s.card0.at).toBeGreaterThanOrEqual(s.door0.at);
    expect(ipdopdAt(s, ipds[0], 0).open).toEqual([0, 0]);
    const a = ipdopdAt(s, ipds[0], s.door0.at + s.door0.dur + 0.01);
    expect(a.open[0]).toBeCloseTo(1, 5);
    expect(a.open[1]).toBe(0);
    expect(ipdopdAt(s, ipds[0], end(ipds[0])).open).toEqual([1, 1]);
    expect(ipdopdAt(kspec(ipds[1]), ipds[1], end(ipds[1])).open).toEqual([1, 0]);
  });

  it("every part sits inside its room at every size, nine digits and the longest plan name included; the figures keep a readable size", () => {
    for (const size of SIZES) for (const show of ipds) {
      const g = geoOf(size);
      const geo = ipdopdGeo(size, show);
      const label = `${size} ${show.room}/${show.opd}`;
      if (geo.plan) { expect(h2Inside(geo.plan, g.dev), `${label} plan`).toBe(true); expect(handWidth(geo.plan.text, geo.plan.size) + geo.plan.pad * 2, label).toBeLessThanOrEqual(geo.plan.w); }
      const [d0, d1] = geo.doors;
      expect(hit(d0.cell, d1.cell), `${label} cells`).toBe(false);
      for (const dr of geo.doors) {
        expect(h2Inside(dr.door, g.dev), `${label} door`).toBe(true);
        expect(h2Inside(dr.card, g.dev), `${label} card`).toBe(true);
        expect(hit(dr.door, dr.card), `${label} door on card`).toBe(false);
        expect(dr.card.content, `${label} card content`).toBeLessThanOrEqual(dr.card.h + 1);
        for (const b of dr.card.blocks) for (const l of b.lines) expect(figWidth(l, b.size), `${label} ${l}`).toBeLessThanOrEqual(dr.card.inner + 1);
        expect(dr.door.h, label).toBeGreaterThanOrEqual(Math.round(g.text * 3.2));
      }
      if (geo.line) { expect(h2Inside(geo.line, g.dev), label).toBe(true); for (const l of geo.line.lines) expect(handWidth(l, geo.line.size), label).toBeLessThanOrEqual(geo.line.w); }
      if (geo.note) expect(h2Inside(geo.note, g.dev), label).toBe(true);
      // the stack of plan, doors, line, note never overlaps
      const bottomDoors = Math.max(d0.cell.y + d0.cell.h, d1.cell.y + d1.cell.h);
      if (geo.line) expect(bottomDoors, label).toBeLessThanOrEqual(geo.line.y);
      if (geo.line && geo.note) expect(geo.line.y + geo.line.h, label).toBeLessThanOrEqual(geo.note.y);
      if (geo.plan) expect(geo.plan.y + geo.plan.h, label).toBeLessThanOrEqual(Math.min(d0.cell.y, d1.cell.y));
      // the amounts stay readable
      const amount = d0.card.blocks[2];
      expect(amount.size, `${label} amount`).toBeGreaterThanOrEqual(Math.round(g.text * 0.55));
    }
  });
});

describe("deductible", () => {
  it("splits the bill at the deductible: ours is the smaller, the insurer's the rest, never negative", () => {
    expect(deductibleParts(deds[0])).toMatchObject({ ours: 50_000, theirs: 50_000, below: false });
    expect(deductibleParts(deds[1])).toMatchObject({ ours: 30_000, theirs: 0, below: true });
    expect(deductibleParts(deds[5])).toMatchObject({ ours: 50_000, theirs: 0, below: true });
    expect(deductibleParts(deds[4])).toMatchObject({ ours: 30_000, theirs: 123_426_789, below: false });
    expect(deductibleParts(deds[3])).toMatchObject({ ours: 100_000_000, theirs: 23_456_789 });
    expect(deductibleParts(deds[2])).toMatchObject({ ours: undefined, theirs: undefined, below: false });
    for (const bill of [1, 10, 49_999, 50_000, 50_001, 1_000_000_000]) {
      const p = deductibleParts({ layout: "deductible", title: T, deductible: 50_000, bill });
      expect(p.ours! + p.theirs!).toBe(bill);
      expect(p.theirs!).toBeGreaterThanOrEqual(0);
    }
  });

  it("draws amounts only when a bill is given: with the bill both parts and the card; without it only the card's figure", () => {
    const withBill = squash(html(deds[0]));
    for (const x of ["เราจ่าย", "ประกันจ่าย", "50,000บาท", "บิล100,000บาท", "ส่วนรับผิดชอบแรกของแผน", "50,000บาทต่อปี"]) expect(withBill, x).toContain(x);
    expect(withBill).not.toContain(W.notYet);
    const none = squash(html(deds[2]));
    expect(none).toContain("50,000บาทต่อปี");
    expect(none.match(/\d[\d,]*/g)).toEqual(["50,000"]);
    expect(none).toContain("เราจ่าย");
    expect(none).toContain("ประกันจ่าย");
    expect(none).not.toContain("บิล");
  });

  it("a bill inside the deductible is all ours, says it has not reached the insurer's part, and draws no insurer amount", () => {
    for (const show of [deds[1], deds[5]]) {
      const w = squash(html(show));
      expect(w).toContain(W.notYet);
      expect(w).toContain(`${show.bill!.toLocaleString("en-US")}บาท`);
      expect(w.replace(W.notYet, "")).not.toContain("ประกันจ่าย");
      expect(deductibleGeo("portrait", show).greenW).toBe(0);
      expect(deductibleGeo("portrait", show).goldW).toBe(deductibleGeo("portrait", show).bar.w);
    }
  });

  it("the split is to scale: our part is deductible / bill of the bar (a few pixels at least), at every size", () => {
    for (const size of SIZES) for (const show of [deds[0], deds[3], deds[5], deds[1]]) {
      const geo = deductibleGeo(size, show);
      const p = deductibleParts(show);
      expect(geo.goldW + geo.greenW, `${size}`).toBe(geo.bar.w);
      if (show.bill! > show.deductible) expect(Math.abs(geo.goldW - Math.round(geo.bar.w * p.frac)), `${size} ${show.bill}`).toBeLessThanOrEqual(1);
    }
    expect(deductibleGeo("portrait", deds[5]).greenW).toBe(0); // bill = deductible: all ours
    const huge = deductibleGeo("portrait", { layout: "deductible", title: T, deductible: 30_000, bill: NINE });
    expect(huge.goldW).toBeGreaterThanOrEqual(14);
    expect(huge.goldW).toBeLessThan(20);
    // twice the bill, our part half as wide
    const a = deductibleGeo("portrait", { layout: "deductible", title: T, deductible: 50_000, bill: 100_000 });
    const b = deductibleGeo("portrait", { layout: "deductible", title: T, deductible: 50_000, bill: 200_000 });
    expect(a.goldW / b.goldW).toBeCloseTo(2, 1);
  });

  it("grows the bill, then ours, then the insurer's, each after the one before", () => {
    const s = kspec(deds[0]);
    expect(s.ours.at).toBeGreaterThanOrEqual(s.bill.at + s.bill.dur - 0.3);
    expect(s.theirs.at).toBeGreaterThanOrEqual(s.ours.at + s.ours.dur - 1e-9);
    expect(deductibleAt(s, 0)).toEqual({ bill: 0, ours: 0, theirs: 0 });
    const done = deductibleAt(s, end(deds[0]));
    expect(done.bill).toBeCloseTo(1, 5); expect(done.ours).toBeCloseTo(1, 5); expect(done.theirs).toBeCloseTo(1, 5);
    // mid-beat: the gold part partly drawn, the green none
    const m = deductibleAt(s, s.ours.at + s.ours.dur / 2);
    expect(m.ours).toBeGreaterThan(0); expect(m.ours).toBeLessThan(1); expect(m.theirs).toBe(0);
  });

  it("every part sits inside its room at every size; the labels sit apart, under their own part, and fit; nine digits stay readable", () => {
    for (const size of SIZES) for (const show of deds) {
      const g = geoOf(size);
      const geo = deductibleGeo(size, show);
      const label = `${size} ${show.deductible}/${show.bill}`;
      expect(h2Inside(geo.bar, g.dev), `${label} bar`).toBe(true);
      expect(h2Inside(geo.card, g.dev), `${label} card`).toBe(true);
      if (geo.bill) expect(h2Inside(geo.bill, g.dev), `${label} bill`).toBe(true);
      if (geo.notYet) expect(h2Inside(geo.notYet, g.dev), `${label} notYet`).toBe(true);
      if (geo.note) expect(h2Inside(geo.note, g.dev), `${label} note`).toBe(true);
      for (const l of geo.labels) {
        expect(h2Inside({ x: l.x, y: l.y, w: l.w, h: l.h }, g.dev), `${label} label`).toBe(true);
        expect(handWidth(l.name, l.nameSize), `${label} ${l.name}`).toBeLessThanOrEqual(l.w);
        if (l.amount) expect(figWidth(l.amount, l.amtSize), `${label} ${l.amount}`).toBeLessThanOrEqual(l.w);
        // its tick starts under its own part and reaches into its label
        expect(l.tickX, label).toBeGreaterThanOrEqual(l.x); expect(l.tickX, label).toBeLessThanOrEqual(l.x + l.w);
      }
      if (geo.labels.length === 2) {
        const [o, t] = geo.labels;
        expect(o.x + o.w, `${label} labels apart`).toBeLessThan(t.x);
        expect(o.tickX, label).toBeLessThanOrEqual(geo.bar.x + geo.goldW + 1);
        expect(t.tickX, label).toBeGreaterThanOrEqual(geo.bar.x + geo.goldW - 1);
      }
      // top to bottom: bill, bar, labels, line, card, note
      const y = [geo.bill?.y ?? geo.bar.y, geo.bar.y + geo.bar.h, geo.labels[0].y + geo.labels[0].h, geo.notYet ? geo.notYet.y + geo.notYet.h : 0, geo.card.y];
      expect(y[1], label).toBeLessThanOrEqual(geo.labels[0].y);
      expect(y[2], label).toBeLessThanOrEqual(geo.card.y);
      if (geo.notYet) { expect(y[2], label).toBeLessThanOrEqual(geo.notYet.y); expect(geo.notYet.y + geo.notYet.h, label).toBeLessThanOrEqual(geo.card.y); }
      if (geo.note) expect(geo.card.y + geo.card.h, label).toBeLessThanOrEqual(geo.note.y);
      for (const b of geo.card.blocks) for (const x of b.lines) expect(figWidth(x, b.size), `${label} ${x}`).toBeLessThanOrEqual(geo.card.inner + 1);
      for (const l of geo.labels) if (l.amount) expect(l.amtSize, `${label} amount`).toBeGreaterThanOrEqual(Math.round(g.text * 0.5));
      expect(blkH(geo.card.blocks[1]), label).toBeGreaterThan(0);
    }
  });
});

describe("copay", () => {
  it("splits the bill at the percent: ours is the floor, the insurer's the rest, always adding to the bill; none without a bill", () => {
    expect(copaySplit(cops[0])).toEqual({ bill: 100_000, ours: 20_000, theirs: 80_000 });
    expect(copaySplit(cops[1])).toBeNull();
    for (const [percent, bill, ours] of [[20, 123_456_789, 24_691_357], [20, 7, 1], [1, 99, 0], [99, 101, 99], [100, 50, 50]] as const) {
      const sp = copaySplit({ layout: "copay", title: T, percent, bill })!;
      expect(sp.ours).toBe(ours);
      expect(sp.ours + sp.theirs).toBe(bill);
    }
  });

  it("draws the percent once on เราจ่าย, the insurer's line, and with a bill the card with both parts", () => {
    const w = squash(html(cops[0]));
    for (const x of ["เราจ่าย20%", W.restPays, "บิล100,000", "เราจ่าย20,000", "ประกันจ่าย80,000"]) expect(w, x).toContain(x);
    expect(words(html(cops[0])).match(/%/g)).toHaveLength(1);
    const bare = squash(html(cops[1]));
    expect(bare).toContain("เราจ่าย20%");
    expect(bare).toContain(W.restPays);
    expect(bare).not.toContain("ประกันจ่าย80,000");
    expect(bare.match(/\d[\d,]*/g)).toEqual(["20"]);
    // 123,456,789 → floor(20%) 24,691,357 and the rest 98,765,432
    const nine = squash(html(cops[2]));
    for (const x of ["บิล123,456,789", "เราจ่าย24,691,357", "ประกันจ่าย98,765,432"]) expect(nine, x).toContain(x);
    // 100%: the insurer pays nothing, no insurer label for it
    expect(squash(html(cops[5]))).not.toContain(W.restPays);
    expect(squash(html(cops[5]))).toContain("ประกันจ่าย0");
  });

  it("the sheet is cut at the percent, to scale: our part is percent of the sheet's height, at every size", () => {
    for (const size of SIZES) for (const show of cops) {
      const geo = copayGeo(size, show);
      const inner = geo.sheet.h - 8;
      expect(geo.ours.h + geo.theirs.h, `${size} ${show.percent}`).toBe(inner);
      expect(Math.abs(geo.ours.h - (inner * show.percent) / 100), `${size} ${show.percent}`).toBeLessThanOrEqual(show.percent === 1 ? 10 : 1);
      expect(geo.cutY, size).toBe(geo.ours.y + geo.ours.h);
    }
    const a = copayGeo("portrait", { layout: "copay", title: T, percent: 20 });
    const b = copayGeo("portrait", { layout: "copay", title: T, percent: 40 });
    expect(b.ours.h / a.ours.h).toBeCloseTo(2, 1);
  });

  it("the sheet, the cut, our part, the insurer's part and the card come in that order", () => {
    const s = kspec(cops[0]);
    expect(s.cut.at).toBeGreaterThanOrEqual(s.sheet.at + s.sheet.dur - 0.1);
    expect(s.ours.at).toBeGreaterThanOrEqual(s.cut.at + s.cut.dur - 0.1);
    expect(s.theirs.at).toBeGreaterThan(s.ours.at);
    expect(s.card.at).toBeGreaterThan(s.theirs.at);
    expect(copayAt(s, 0)).toEqual({ sheet: 0, cut: 0, ours: 0, theirs: 0 });
    const m = copayAt(s, s.cut.at + s.cut.dur / 2);
    expect(m.cut).toBeGreaterThan(0); expect(m.cut).toBeLessThan(1); expect(m.ours).toBe(0);
    expect(html(cops[0], s.cut.at + s.cut.dur / 2)).toContain('data-part="cut"');
    expect(html(cops[0], s.sheet.at + 0.01)).not.toContain('data-part="cut"');
  });

  it("every part sits inside its room at every size; the labels sit beside their part and never over each other or the card", () => {
    for (const size of SIZES) for (const show of cops) {
      const g = geoOf(size);
      const geo = copayGeo(size, show);
      const label = `${size} ${show.percent}/${show.bill}`;
      expect(h2Inside(geo.sheet, g.dev), `${label} sheet`).toBe(true);
      expect(h2Inside(geo.tab, g.dev), `${label} tab`).toBe(true);
      const lo = geo.labels.ours;
      const lr = { x: lo.x, y: lo.y, w: lo.w, h: lo.h };
      expect(h2Inside(lr, g.dev), `${label} ours`).toBe(true);
      expect(lo.y, label).toBeGreaterThanOrEqual(geo.sheet.y);
      expect(lo.y + lo.h, label).toBeLessThanOrEqual(geo.sheet.y + geo.sheet.h);
      expect(lo.x, label).toBeGreaterThanOrEqual(geo.sheet.x + geo.sheet.w);
      expect(figWidth(lo.blk.lines[0], lo.blk.size), label).toBeLessThanOrEqual(lo.w + 1);
      if (geo.labels.theirs) {
        const th = geo.labels.theirs;
        expect(h2Inside({ x: th.x, y: th.y, w: th.w, h: th.h }, g.dev), `${label} theirs`).toBe(true);
        expect(lo.y + lo.h, `${label} labels apart`).toBeLessThan(th.y);
        expect(th.y + th.h, label).toBeLessThanOrEqual(geo.sheet.y + geo.sheet.h);
        for (const l of th.blk.lines) expect(handWidth(l, th.blk.size), `${label} ${l}`).toBeLessThanOrEqual(th.w);
      }
      if (geo.card) {
        expect(h2Inside(geo.card, g.dev), `${label} card`).toBe(true);
        expect(hit(rect(geo.card), { x: geo.sheet.x, y: geo.tab.y, w: geo.sheet.w, h: geo.sheet.h + geo.tab.h + 8 }), `${label} card on sheet`).toBe(false);
        expect(hit(geo.card, lr), `${label} card on label`).toBe(false);
        if (geo.labels.theirs) expect(hit(geo.card, geo.labels.theirs), `${label} card on label`).toBe(false);
        for (const b of geo.card.blocks) for (const x of b.lines) expect(figWidth(x, b.size), `${label} ${x}`).toBeLessThanOrEqual(geo.card.inner + 1);
      }
      if (geo.note) { expect(h2Inside(geo.note, g.dev), label).toBe(true); expect(geo.sheet.y + geo.sheet.h, label).toBeLessThanOrEqual(geo.note.y); }
      expect(geo.sheet.h, label).toBeGreaterThanOrEqual(200);
    }
  });
});

describe("renew98", () => {
  it("draws วันนี้, ต่อได้ถึง อายุ 98, the two lines of the card, and today's age only when given and below 98", () => {
    const w = squash(html(rens[0]));
    for (const x of ["วันนี้", "อายุ35", "ต่อได้ถึง", "อายุ98", W.notBeyond, W.byAge]) expect(w, x).toContain(x);
    const bare = squash(html(rens[1]));
    expect(bare).toContain("วันนี้");
    expect(bare).toContain("อายุ98");
    expect(bare.match(/อายุ\d+/g)).toEqual(["อายุ98"]);
    // today at or past the renewal age is dropped
    expect(renewAge(rens[3])).toBeUndefined();
    expect(squash(html(rens[3])).match(/อายุ\d+/g)).toEqual(["อายุ98"]);
    expect(renewAge(rens[0])).toBe(35);
  });

  it("never promises the same premium or a sure renewal", () => {
    for (const show of rens) expect(squash(html(show))).not.toMatch(/เท่าเดิม|แน่นอน|รับรอง|การันตี/);
  });

  it("draws the line, today, the dashed arc, the renewal age and the card in that order", () => {
    const s = kspec(rens[0]);
    expect(s.today.at).toBeGreaterThan(s.line.at);
    expect(s.arc.at).toBeGreaterThanOrEqual(s.today.at);
    expect(s.to.at).toBeGreaterThanOrEqual(s.arc.at + s.arc.dur - 0.3);
    expect(s.card.at).toBeGreaterThan(s.to.at);
    expect(renewAt(s, 0)).toEqual({ line: 0, arc: 0, today: 0, to: 0 });
    const m = renewAt(s, s.arc.at + s.arc.dur / 2);
    expect(m.arc).toBeGreaterThan(0); expect(m.arc).toBeLessThan(1); expect(m.to).toBe(0);
    const done = renewAt(s, end(rens[0]));
    expect(done.arc).toBeCloseTo(1, 5); expect(done.line).toBeCloseTo(1, 5);
    // the arc is part drawn mid-beat and whole at the end (its path grows)
    const len = (out: string) => (out.match(/<path d="M([^"]+)"/)?.[1].split(" L").length ?? 0);
    expect(len(html(rens[0], s.arc.at + s.arc.dur / 2))).toBe(41);
    const p0 = arcPoint({ x1: 0, x2: 100, y: 50, peak: 20 }, 0);
    const p1 = arcPoint({ x1: 0, x2: 100, y: 50, peak: 20 }, 1);
    const pm = arcPoint({ x1: 0, x2: 100, y: 50, peak: 20 }, 0.5);
    expect([p0.x, p0.y, p1.x, p1.y]).toEqual([0, 50, 100, 50]);
    expect(pm.x).toBeCloseTo(50, 5); expect(pm.y).toBeCloseTo(30, 5);
  });

  it("every part sits inside its room at every size: the marks and their words apart, the arc above the line, the card under", () => {
    for (const size of SIZES) for (const show of rens) {
      const g = geoOf(size);
      const geo = renewGeo(size, show);
      const label = `${size} ${show.age}`;
      expect(h2Inside(geo.card, g.dev), `${label} card`).toBe(true);
      for (const k of [geo.today, geo.to]) {
        expect(h2Inside({ x: k.x, y: k.y, w: k.w, h: geo.labelsH }, g.dev), `${label} label`).toBe(true);
        for (const b of k.blocks) for (const x of b.lines) expect(figWidth(x, b.size), `${label} ${x}`).toBeLessThanOrEqual(k.w);
      }
      expect(geo.today.x + geo.today.w, `${label} labels apart`).toBeLessThan(geo.to.x);
      expect(geo.x1, label).toBeGreaterThan(g.dev.x);
      expect(geo.x2, label).toBeLessThan(g.dev.x + g.dev.w);
      expect(geo.arc.y - geo.arc.peak, `${label} arc inside`).toBeGreaterThanOrEqual(g.dev.y);
      expect(geo.lineY + geo.dot, label).toBeLessThanOrEqual(geo.today.y);
      expect(geo.today.y + geo.labelsH, label).toBeLessThanOrEqual(geo.card.y);
      if (geo.note) { expect(h2Inside(geo.note, g.dev), label).toBe(true); expect(geo.card.y + geo.card.h, label).toBeLessThanOrEqual(geo.note.y); }
      for (const b of geo.card.blocks) for (const x of b.lines) expect(handWidth(x, b.size), `${label} ${x}`).toBeLessThanOrEqual(geo.card.inner + 1);
      expect(geo.f, label).toBeGreaterThan(0.55);
    }
  });
});
