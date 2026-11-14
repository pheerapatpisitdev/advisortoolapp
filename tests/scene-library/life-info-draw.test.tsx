import { readFileSync } from "node:fs";
import path from "node:path";
import { cloneElement, createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { incomestopLost, LIFE_LAYOUTS, LIFE_WORDS as LW, lifeneedTotals, moneysplitRemainder, n, taxbackLadder, taxbackRefund, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { kspec } from "@/lib/quote-video/story-knowledge-motion";
import { iconOf, infoDrawn, infoShow, kitFor } from "@/lib/quote-video/story-info-motion";
import { benInfoGeo, genInfoGeo, splitInfoGeo } from "@/lib/quote-video/story-life-info";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import { storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";
import { LIFE_CAP, TAX_CAPS, TAX_FOOT, TAX_YEAR } from "@/lib/scene-library/tax-th";

/**
 * device round 2, Task 4: the eight life, CI, tax and legacy devices in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด,
 * นีออน, บลูพริ้นท์ and the retired อินโฟกราฟิก — drawn with the Kit, showing what the paper shows and by its rules.
 */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const LOOKS = ["plot", "board", "neon", "blueprint", "info"] as const;
type Look = (typeof LOOKS)[number];
const DARK = ["neon", "blueprint"] as const;

const ctx = (size: VideoSize, art: Look): StoryContext => ({
  input: { product: "STORY", topic: "mythclaim", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const LONG_NAMES = ["นางสาวพรรณราย ศรีสุวรรณวงศ์", "เด็กชายธนกฤต เจริญรุ่งเรืองกิจ", "เด็กหญิงกัญญาณัฐ ทรัพย์มหาศาล", "นางบุญเรือน ใจดีมีสุขสวัสดิ์"];
const LONG_PARTS = [
  { label: "ค่าเทอมลูกจนจบมหาวิทยาลัย", amount: 1_200_000 },
  { label: "หนี้บ้านและหนี้รถ ที่ยังค้างอยู่กับธนาคาร", amount: 1_200_000 },
  { label: "ค่าใช้จ่ายของครอบครัว ระหว่างตั้งตัวใหม่", amount: 600_000 },
];
const LONG_ROWS = ["รุ่นปู่ย่าตายาย ผู้เริ่มสร้างฐานะ", "รุ่นพ่อแม่ ผู้ดูแลและส่งต่อ", "รุ่นลูกหลาน ผู้รับมรดกต่อไป"];
const TB = ["ภาษีที่ได้คืน", "ตามฐานภาษี"] as [string, string];
const LN = ["ทุนชีวิต", "ควรมีเท่าไหร่"] as [string, string];

const X = {
  need: { layout: "lifeneed", title: LN, debts: 1_800_000, expenses: 240_000, years: 10, education: 800_000, have: 1_000_000 },
  needEnough: { layout: "lifeneed", title: LN, debts: 1_800_000, expenses: 240_000, years: 10, education: 800_000, have: 6_000_000 },
  needPartial: { layout: "lifeneed", title: LN, debts: 1_800_000, have: 500_000 },
  needWords: { layout: "lifeneed", title: LN },
  ben: { layout: "beneficiary", title: ["ผู้รับประโยชน์", "ใครได้รับเงิน"], rows: [{ name: "ภรรยา", share: 60 }, { name: "ลูกคนโต", share: 20 }, { name: "ลูกคนเล็ก", share: 20 }] },
  benNoShare: { layout: "beneficiary", title: ["ผู้รับประโยชน์", ""], rows: [{ name: "ภรรยา" }, { name: "ลูก" }] },
  benLong: { layout: "beneficiary", title: ["ผู้รับประโยชน์", "ใครได้รับเงิน"], rows: LONG_NAMES.map((name) => ({ name, share: 25 })) },
  ci: { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"], sum: 1_000_000, note: "ใช้รักษาหรือทดแทนรายได้" },
  ciWords: { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"] },
  stop: { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 30_000, months: 6 },
  stopMonthly: { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 30_000 },
  stopMonths: { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], months: 6 },
  stopWords: { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"] },
  tax: { layout: "taxback", title: TB, premium: 50_000, bracket: 15 },
  taxOver: { layout: "taxback", title: TB, premium: 150_000, bracket: 30 },
  taxNoBracket: { layout: "taxback", title: TB, premium: 50_000 },
  taxRate: { layout: "taxback", title: TB, bracket: 20 },
  taxWords: { layout: "taxback", title: TB },
  cap: { layout: "taxcap", title: ["เพดานลดหย่อน", "ปีนี้ใช้ได้เท่าไหร่"] },
  split: { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ค่าเทอมลูก", amount: 1_200_000 }, { label: "หนี้บ้าน", amount: 1_200_000 }, { label: "ใช้จ่าย", amount: 600_000 }] },
  splitLeft: { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ค่าเทอมลูก", amount: 1_000_000 }, { label: "หนี้บ้าน", amount: 1_200_000 }] },
  splitTotal: { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ค่าเทอมลูก" }, { label: "หนี้บ้าน" }] },
  splitWords: { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], parts: [{ label: "ค่าเทอมลูก" }, { label: "หนี้บ้าน" }, { label: "ใช้จ่าย" }] },
  splitLong: { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: LONG_PARTS },
  gen: { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["ปู่ ย่า", "พ่อ แม่", "ลูก หลาน"], note: "มรดกที่ส่งต่อได้ ไม่ต้องขายบ้าน" },
  genNoNote: { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["ปู่ ย่า", "พ่อ แม่", "ลูก หลาน"] },
  genLong: { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: LONG_ROWS, note: "มรดกที่ส่งต่อได้ ไม่ต้องขายบ้าน ส่งต่อผ่านผู้รับประโยชน์ที่ระบุไว้" },
} satisfies Record<string, KnowShow>;
const ALL: KnowShow[] = Object.values(X);
/** one of each device, with its figures */
const MAIN: KnowShow[] = [X.need, X.ben, X.ci, X.stop, X.tax, X.cap, X.split, X.gen];

/** the moment every piece of a show is in: the end of its last movement */
const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const draw = (show: KnowShow, size: VideoSize = "portrait", art: Look = "plot", t = end(show)) => renderToStaticMarkup(<>{infoDrawn(show, ctx(size, art), t)}</>);
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/\s+/g, " ");
/** the words with the title taken out and every space gone (the drawing sets a long line as several) */
const flat = (show: KnowShow, markup: string) => {
  const title = "title" in show ? show.title : ["", ""];
  return words(markup).replace(/ /g, "").replace(title[0].replace(/ /g, ""), "").replace(title[1].replace(/ /g, ""), "");
};
const sq = (x: string) => x.replace(/ /g, "");
const each = (fn: (size: VideoSize, art: Look, label: string) => void) => {
  for (const size of SIZES) for (const art of LOOKS) fn(size, art, `${size} ${art}`);
};

describe("the eight devices draw in the info route", () => {
  it("every layout has its drawer: none falls through to nothing", () => {
    expect(new Set(ALL.map((x) => x.layout))).toEqual(new Set(LIFE_LAYOUTS));
    for (const show of ALL) each((size, art, label) => expect(infoShow(show, ctx(size, art), end(show)), `${show.layout} ${label}`).not.toBeNull());
  });

  it("in every look and size, at the start, the middle and the end, with no NaN, no shared id and no negative figure", () => {
    for (const show of ALL) each((size, art, label) => {
      for (const t of [0, 1.5, end(show)]) {
        let out = "";
        expect(() => { out = draw(show, size, art, t); }, `${show.layout} ${label} ${t}`).not.toThrow();
        expect(out, `${show.layout} ${label} ${t}`).not.toContain("NaN");
        expect(out).not.toMatch(/ id="/);
        expect(words(out)).not.toMatch(/(^|\s)-\d/);
      }
    });
  });

  it("each draws more than its title", () => {
    for (const show of ALL) each((size, art, label) => expect(draw(show, size, art).length, `${show.layout} ${label}`).toBeGreaterThan(1500));
  });

  it("writes each piece with the pen: before its moment the device's pieces are hidden", () => {
    for (const show of MAIN) expect(draw(show, "portrait", "plot", 0), show.layout).toContain("opacity:0");
  });

  it("a device's words-only card shows the device's own icon, not the episode's", () => {
    for (const show of ALL) expect(iconOf("groupins", "knowThree", show), show.layout).not.toBe("warn");
  });
});

const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
const FONTS: DrawFont[] = [
  { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
  { name: "Plex", data: face("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
  { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
  { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
  { name: "Sriracha", data: face("Sriracha-400.ttf"), weight: 400, style: "normal" },
  { name: "Symbols", data: face("NotoSansSymbols2-400.ttf"), weight: 400, style: "normal" },
];
/** a frame as the clip shows it: the look's background, the device over it */
const frame = (show: KnowShow, size: VideoSize, art: Look, body: ReactNode = infoDrawn(show, ctx(size, art), end(show))) => (
  <div style={{ display: "flex", position: "relative", width: FRAME[size].w, height: FRAME[size].h, fontFamily: "Plex" }}>
    <div style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>{storyBackground(size, ctx(size, art).input)}</div>
    <div style={{ position: "absolute", left: 0, top: 0, width: FRAME[size].w, height: FRAME[size].h, display: "flex" }}>{body}</div>
  </div>
);
const png = (el: ReactElement, size: VideoSize) => drawPngHere(el, { width: FRAME[size].w, height: FRAME[size].h }, FONTS);

describe("through satori, as the stills and the clip frames draw them", () => {
  it("every show in every look and size at the end of its animation", async () => {
    for (const show of ALL) for (const size of SIZES) for (const art of LOOKS) {
      const bytes = await png(frame(show, size, art), size);
      expect(bytes.length, `${show.layout} ${size} ${art}`).toBeGreaterThan(1000);
    }
  }, 600_000);
});

describe("they say what the paper says (the same helpers, the same rules)", () => {
  it("lifeneed: the blocks, the need, what is had and what is short; enough when covered", () => {
    const tot = lifeneedTotals(X.need);
    each((size, art, label) => {
      const say = flat(X.need, draw(X.need, size, art));
      for (const b of tot.blocks) expect(say, `${label} ${b.key}`).toContain(sq(`${n(b.amount)} บาท`));
      for (const w of [LW.debts, `${LW.living}10${LW.years}`, LW.education, LW.need, sq(`${n(tot.need!)} บาท`), LW.have, sq(`${n(tot.have!)} บาท`), LW.gap, sq(`${n(tot.gap!)} บาท`)]) expect(say, `${label} ${w}`).toContain(w);
      const enough = flat(X.needEnough, draw(X.needEnough, size, art));
      expect(enough, label).toContain(LW.enough);
      expect(enough, label).not.toContain(LW.gap);
    });
  });

  it("lifeneed partial: รวมที่กรอกไว้, what is had, and no gap or enough against a partial sum", () => {
    each((size, art, label) => {
      const say = flat(X.needPartial, draw(X.needPartial, size, art));
      for (const w of [LW.partial, LW.have, "1,800,000", "500,000"]) expect(say, `${label} ${w}`).toContain(w);
      for (const w of [LW.need, LW.gap, LW.enough, "1,300,000"]) expect(say, `${label} ${w}`).not.toContain(w);
    });
  });

  it("lifeneed words-only: the blocks named, the line, no figure; a forged need or gap is never read", () => {
    each((size, art, label) => {
      const say = flat(X.needWords, draw(X.needWords, size, art));
      for (const w of [LW.debts, LW.living, LW.education, LW.needWords]) expect(say, `${label} ${w}`).toContain(w);
      expect(say, label).not.toMatch(/\d/);
    });
    const forged = { ...X.need, need: 99_000_000, gap: 77_000_000 } as KnowShow;
    const say = words(draw(forged));
    expect(say).not.toContain("99,000,000");
    expect(say).not.toContain("77,000,000");
  });

  it("beneficiary: the policy, each name and share, the line; no share without all shares", () => {
    each((size, art, label) => {
      const say = flat(X.ben, draw(X.ben, size, art));
      for (const w of [LW.policy, "ภรรยา", "ลูกคนโต", "ลูกคนเล็ก", "60%", "20%", LW.name]) expect(say, `${label} ${w}`).toContain(w);
      const none = flat(X.benNoShare, draw(X.benNoShare, size, art));
      expect(none, label).not.toContain("%");
      for (const nm of LONG_NAMES) expect(flat(X.benLong, draw(X.benLong, size, art)), `${label} ${nm}`).toContain(sq(nm));
    });
  });

  it("cilump: the certificate, the lump and its sum, the line and the note; the lump alone without a sum", () => {
    each((size, art, label) => {
      const say = flat(X.ci, draw(X.ci, size, art));
      for (const w of [LW.certificate, LW.lump, "1,000,000บาท", LW.diagnosed, sq(X.ci.note)]) expect(say, `${label} ${w}`).toContain(w);
      const bare = flat(X.ciWords, draw(X.ciWords, size, art));
      expect(bare, label).toContain(LW.lump);
      expect(bare, label).not.toMatch(/\d/);
    });
  });

  it("incomestop: the month's income × the months = what is lost; a month's income alone is no loss", () => {
    each((size, art, label) => {
      const say = flat(X.stop, draw(X.stop, size, art));
      for (const w of [`${LW.income}30,000${LW.perMonth}`, `${LW.stop}6${LW.months}`, LW.lost, sq(`30,000 × 6 ${LW.months}`), sq(`= ${n(incomestopLost(X.stop)!)} บาท`)]) expect(say, `${label} ${w}`).toContain(w);
      const month = flat(X.stopMonthly, draw(X.stopMonthly, size, art));
      expect(month, label).toContain(`${LW.income}${LW.perMonth}`);
      expect(month, label).toContain("30,000บาท");
      expect(month, label).not.toContain(LW.lost);
      expect(month, label).not.toContain("=");
      const months = flat(X.stopMonths, draw(X.stopMonths, size, art));
      expect(months, label).not.toContain("×");
      expect(months, label).toContain(`${LW.stop}6${LW.months}`);
      const none = flat(X.stopWords, draw(X.stopWords, size, art));
      expect(none, label).toContain(LW.lost);
      expect(none, label).not.toMatch(/\d/);
    });
  });

  it("taxback: each rung's figure is the ladder's, the agent's rung lit, its line and refund, the premium in the subtitle, the foot", () => {
    const refund = taxbackRefund(X.tax)!;
    each((size, art, label) => {
      const out = draw(X.tax, size, art);
      const say = words(out).replace(/ /g, "");
      for (const r of taxbackLadder(X.tax)) expect(say, `${label} ${r.rate}`).toContain(`${r.rate}%`);
      for (const r of taxbackLadder(X.tax)) expect(say, `${label} ${r.refund}`).toContain(n(r.refund!));
      expect(out.match(/data-pick/g)?.length, label).toBe(1);
      for (const w of [sq(`${LW.bracket} 15% → ${LW.back}`), sq(`${n(refund)} บาท`), sq(`${LW.premium} 50,000 บาท`), sq(TAX_FOOT)]) expect(say, `${label} ${w}`).toContain(w);
      expect(say, label).not.toContain(sq(TB[1]));
      expect(say, label).not.toContain(sq(LW.deductible));
      // over the cap: the typed premium in the subtitle, the cap line, and the ladder counts the cap (35% → 35,000)
      const over = words(draw(X.taxOver, size, art)).replace(/ /g, "");
      for (const w of [sq(`${LW.premium} 150,000 บาท`), sq(`${LW.deductible} ${n(LIFE_CAP)} บาท`), "35,000"]) expect(over, `${label} ${w}`).toContain(w);
      expect(over, label).not.toContain("52,500");
      // no bracket: nothing lit, no line
      const nob = draw(X.taxNoBracket, size, art);
      expect(nob, label).not.toContain("data-pick");
      expect(words(nob), label).not.toContain("→");
      // a rate alone: lit, its rate, no refund
      const rate = draw(X.taxRate, size, art);
      expect(rate.match(/data-pick/g)?.length, label).toBe(1);
      expect(words(rate).replace(/ /g, ""), label).toContain(sq(`${LW.bracket} 20%`));
      expect(words(rate), label).not.toContain("→");
      // nothing typed: the rates alone, the show's own subtitle
      const bare = words(draw(X.taxWords, size, art)).replace(/ /g, "");
      expect(bare.replace(/\d+%/g, "").replace(sq(TAX_FOOT), ""), label).not.toMatch(/\d/);
      expect(bare, label).toContain(sq(TB[1]));
      expect(bare, label).not.toContain(LW.premium);
    });
    const forged = { ...X.tax, refund: 99_999 } as KnowShow;
    expect(words(draw(forged))).not.toContain("99,999");
  });

  it("taxcap: the year, exactly the table's rows and caps, the foot", () => {
    each((size, art, label) => {
      const out = draw(X.cap, size, art);
      const say = flat(X.cap, out);
      expect(say, label).toContain(sq(TAX_YEAR));
      for (const row of TAX_CAPS) {
        expect(say, `${label} ${row.label}`).toContain(sq(row.label));
        expect(say, `${label} ${row.cap}`).toContain(n(row.cap));
        if (row.note) expect(say, `${label} ${row.note}`).toContain(sq(row.note));
      }
      expect(out.match(/data-cap=/g)?.length, label).toBe(TAX_CAPS.length);
      expect(say, label).toContain(sq(TAX_FOOT));
    });
  });

  it("moneysplit: the lump, each part and amount, what is left only when there is some; amounts only when all are given", () => {
    each((size, art, label) => {
      const say = flat(X.split, draw(X.split, size, art));
      for (const w of [LW.total, "3,000,000บาท", "ค่าเทอมลูก", "หนี้บ้าน", "ใช้จ่าย", "1,200,000บาท", "600,000บาท"]) expect(say, `${label} ${w}`).toContain(w);
      expect(say, label).not.toContain(LW.left);
      const left = flat(X.splitLeft, draw(X.splitLeft, size, art));
      expect(left, label).toContain(sq(`${LW.left} ${n(moneysplitRemainder(X.splitLeft)!)} บาท`));
      const total = flat(X.splitTotal, draw(X.splitTotal, size, art));
      expect(total.replace("3,000,000", ""), label).not.toMatch(/\d/);
      const none = flat(X.splitWords, draw(X.splitWords, size, art));
      expect(none, label).toContain(LW.total);
      expect(none, label).not.toMatch(/\d/);
      for (const p of LONG_PARTS) expect(flat(X.splitLong, draw(X.splitLong, size, art)), `${label} ${p.label}`).toContain(sq(p.label));
    });
  });

  it("threegen: the three generations' words, ส่งต่อ and the note; no figure", () => {
    each((size, art, label) => {
      const say = flat(X.gen, draw(X.gen, size, art));
      for (const w of [...X.gen.rows.map(sq), LW.pass, sq(X.gen.note)]) expect(say, `${label} ${w}`).toContain(w);
      expect(say, label).not.toMatch(/\d/);
      const bare = flat(X.genNoNote, draw(X.genNoNote, size, art));
      expect(bare, label).not.toContain(sq(X.gen.note));
      for (const r of LONG_ROWS) expect(flat(X.genLong, draw(X.genLong, size, art)), `${label} ${r}`).toContain(sq(r));
    });
  });
});

describe("Review Focus 3: long names, labels and rows fit at every size", () => {
  const FLOOR: Record<VideoSize, number> = { portrait: 30, square: 20, landscape: 24 };
  it("beneficiary's four long names", () => {
    for (const size of SIZES) {
      const geo = benInfoGeo(size, X.benLong.rows);
      expect(geo.nameSize, size).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const lines of geo.names) {
        for (const l of lines) expect(handWidth(l, geo.nameSize), `${size} ${l}`).toBeLessThanOrEqual(geo.nameRoom);
        expect(lines.length * geo.nameSize * 1.3, size).toBeLessThanOrEqual(geo.nameBand);
      }
    }
  });

  it("moneysplit's three long labels", () => {
    for (const size of SIZES) {
      const geo = splitInfoGeo(size, X.splitLong);
      expect(geo.labelSize, size).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const lines of geo.labels) {
        for (const l of lines) expect(handWidth(l, geo.labelSize), `${size} ${l}`).toBeLessThanOrEqual(geo.labelRoom);
        expect(lines.length * geo.labelSize * 1.3, size).toBeLessThanOrEqual(geo.labelBand);
      }
    }
  });

  it("threegen's long rows and note", () => {
    for (const size of SIZES) {
      const geo = genInfoGeo(size, X.genLong);
      expect(geo.rowSize, size).toBeGreaterThanOrEqual(FLOOR[size] - 4);
      for (const lines of geo.rows) {
        for (const l of lines) expect(handWidth(l, geo.rowSize), `${size} ${l}`).toBeLessThanOrEqual(geo.rowRoom);
        expect(lines.length * geo.rowSize * 1.3, size).toBeLessThanOrEqual(geo.rowBand);
      }
      for (const l of geo.note) expect(handWidth(l, geo.noteSize), `${size} ${l}`).toBeLessThanOrEqual(geo.noteRoom);
    }
  });
});

describe("drawn with the Kit", () => {
  const weights = (html: string) => [...html.matchAll(/font-weight:(\d+)/g)].map((m) => Number(m[1]));

  it("นีออน writes in Sriracha and never above 400; the other looks keep their bold", () => {
    for (const show of ALL) for (const size of SIZES) {
      const html = draw(show, size, "neon");
      expect(html, `${show.layout} ${size}`).toContain("font-family:Sriracha");
      for (const w of weights(html)) expect(w, `${show.layout} ${size}`).toBeLessThanOrEqual(400);
    }
    for (const art of ["plot", "board", "blueprint", "info"] as const) expect(MAIN.flatMap((x) => weights(draw(x, "portrait", art))), art).toContain(600);
  });

  it("every colour drawn is one of the look's own (no colour of its own)", () => {
    const COLOR = /(#[0-9a-fA-F]{6}\b|rgba?\([^)]*\))/g;
    for (const art of LOOKS) {
      const kit = kitFor({ art });
      const own = new Set([...Object.values(kit).filter((v): v is string => typeof v === "string"), S.plotRail, S.plotRailEdge, S.plotHead, S.plotPaper, S.plotPen].map((x) => x.replace(/\s/g, "")));
      for (const show of ALL) for (const size of SIZES) {
        for (const m of draw(show, size, art).matchAll(COLOR)) expect(own.has(m[1].replace(/\s/g, "")), `${art} ${show.layout} ${size} ${m[1]}`).toBe(true);
      }
    }
  });

  it("glows only in นีออน, as a shadow in the line's own colour", () => {
    for (const show of MAIN) {
      expect(draw(show, "portrait", "neon"), show.layout).toContain("text-shadow:0 0");
      for (const art of ["plot", "board", "blueprint", "info"] as const) {
        const html = draw(show, "portrait", art);
        expect(html, `${art} ${show.layout}`).not.toContain("text-shadow");
        expect(html, `${art} ${show.layout}`).not.toContain("box-shadow");
      }
    }
  });

  it("บลูพริ้นท์ sets a dimension line under its figures, and no other look does", () => {
    for (const show of [X.need, X.ci, X.stop, X.tax, X.split]) {
      expect(draw(show, "portrait", "blueprint"), show.layout).toContain("data-dim");
      for (const art of ["plot", "board", "neon", "info"] as const) expect(draw(show, "portrait", art), `${art} ${show.layout}`).not.toContain("data-dim");
    }
  });

  it("puts the plotter's machine over plot only", () => {
    for (const show of MAIN) {
      expect(draw(show, "portrait", "plot", 1), show.layout).toContain(S.plotRail);
      for (const art of ["board", "neon", "blueprint", "info"] as const) expect(draw(show, "portrait", art, 1), `${art} ${show.layout}`).not.toContain(S.plotRail);
    }
  });
});

/* ── Review Focus 4: on the dark looks, every device's words can be read where they are drawn ───────────────────── */

/**
 * The frame's tree with its components run, so each word's own box can be found: `hide` draws the same frame with every
 * word's ink transparent and its glow off, so what differs between the two is the words' own pixels, at their place.
 */
function expand(node: ReactNode, hide: boolean): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((x) => expand(x, hide));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode; style?: React.CSSProperties }>;
  if (typeof el.type === "function") return expand((el.type as (p: unknown) => ReactNode)(el.props), hide);
  const kids = el.props.children;
  if ((el.type as unknown) === Fragment) return createElement(Fragment, null, expand(kids, hide));
  const list = Array.isArray(kids) ? kids.flat(Infinity) : [kids];
  const text = list.some((k) => typeof k === "string" || typeof k === "number");
  const style = hide && text ? { ...el.props.style, color: "transparent", textShadow: "none" } : el.props.style;
  return cloneElement(el, { style }, expand(kids, hide));
}
const lum = (p: number[]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
async function pixels(bytes: Buffer) {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  return (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
}

describe("Review Focus 4: นีออน and บลูพริ้นท์ keep each device's words readable", () => {
  /**
   * A word's own pixels are where the frame differs from the same frame with its words' ink transparent; of those, the
   * glyphs' cores are in one of the look's inks (นีออน's glow around them is softer by design and not counted). Every
   * core must stand 3:1 off what is under it there: the card, the tile, the ground.
   */
  const hexes = (art: Look) => {
    const K = kitFor({ art });
    return [K.white, K.soft, K.gold, K.sub, K.sky, K.red, K.green, K.ground, K.dim, K.mute].filter((x) => x.startsWith("#")).map(rgb);
  };
  it("every word's ink stands 3:1 off what is under it, for every device in every size", async () => {
    for (const art of DARK) for (const show of [...MAIN, X.needWords, X.stopMonthly, X.taxWords, X.splitWords]) for (const size of SIZES) {
      const inks = hexes(art);
      const body = infoDrawn(show, ctx(size, art), end(show));
      const shown = await pixels(await png(frame(show, size, art, expand(body, false)), size));
      const blank = await pixels(await png(frame(show, size, art, expand(body, true)), size));
      const { w, h } = FRAME[size];
      let drawn = 0;
      let core = 0;
      let read = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const [p, q] = [shown(x, y), blank(x, y)];
        if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 24) continue;
        drawn++;
        if (!inks.some((c) => c.every((v, i) => Math.abs(v - p[i]) <= 10))) continue;
        core++;
        if (contrast(p, q) >= 3) read++;
      }
      const label = `${art} ${show.layout} ${size} (${read}/${core} of ${drawn})`;
      expect(core, label).toBeGreaterThan(300);
      expect(read / core, label).toBeGreaterThan(0.97);
    }
  }, 900_000);
});
