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
import { BAND_WORDS, HEALTH2_LAYOUTS, HEALTH2_WORDS as W, provinceShort, showText, thaiDate, type Health2Show, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { HEALTH2_FIXED } from "@/lib/scene-library/health2-fixed";
import { kspec } from "@/lib/quote-video/story-knowledge-motion";
import { copayGeo, copaySplit, deductibleGeo, deductibleParts, groupGeo, groupMonth, h2Inside, hospitalsFoot, hospitalsGeo, ipdopdGeo, paclaimGeo, parentsFoot, parentsGeo, renewGeo } from "@/lib/quote-video/story-health2-motion";
import { health2InfoPlace } from "@/lib/quote-video/story-health2-info";
import { infoDrawn, infoShow, kitFor } from "@/lib/quote-video/story-info-motion";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import { storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import { figWidth } from "@/lib/quote-video/story-save-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/**
 * device round 5, Task 4: ipdopd, deductible, copay, renew98, parentshealth, groupcost, hospitals and paclaim in the info route —
 * ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน, บลูพริ้นท์ and the retired อินโฟกราฟิก — drawn with the Kit, the paper's geometry and beats.
 * Stills (single PNGs and the contact sheets) are written to tests/scratch/devices5 only with HEALTH2_STILLS=1.
 */
const STILLS = process.env.HEALTH2_STILLS === "1";
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
/** a fully clear paint draws nothing: the pen's layer of a piece holding words, whose words fade in over it (owner chose ก, 2026-11-16) */
const CLEARED = /^rgba\(0,\s*0,\s*0,\s*0\)$/;
const LOOKS = ["plot", "board", "neon", "blueprint", "info"] as const;
type Look = (typeof LOOKS)[number];
const DARK = ["neon", "blueprint"] as const;
const STILL_LOOKS = ["plot", "board", "neon", "blueprint"] as const;

const ctx = (size: VideoSize, art: Look): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const T: [string, string] = ["สองประตู", "คนละวงเงิน"];
const LONG_TITLE: [string, string] = ["ครอบครัวไม่ต้องเปียก", "ประกันคือร่มของบ้าน"];
const LONG_NOTE = "รายได้หลักของบ้าน ถ้าหายไปจะลำบาก";
const NINE = 123_456_789;
const FIVE_PROVINCES = [{ province: "กรุงเทพมหานคร", count: 135 }, { province: "ชลบุรี", count: 49 }, { province: "ระยอง", count: 38 }, { province: "สมุทรปราการ", count: 25 }, { province: "นนทบุรี", count: 22 }];

/** the spec's example for each device, a nine-digit case, and the optional parts missing */
const SHOWS: Health2Show[] = [
  /* 0 */ { layout: "ipdopd", title: T, note: "ตามตารางของแผน", room: 9_000, opd: 12_000, planName: "โกลด์" },
  /* 1 */ { layout: "ipdopd", title: T, room: 3_000, opd: "none" },
  /* 2 */ { layout: "ipdopd", title: T, room: 6_000, opd: "actual" },
  /* 3 */ { layout: "ipdopd", title: LONG_TITLE, note: LONG_NOTE, room: NINE, opd: NINE, planName: "ชื่อแผนยาวสิบสี่ตัว" },
  /* 4 */ { layout: "deductible", title: ["ส่วนรับผิดชอบแรก", "เราจ่ายก่อน"], note: "ตามเงื่อนไขของแผน", deductible: 50_000, bill: 100_000 },
  /* 5 */ { layout: "deductible", title: T, deductible: 50_000, bill: 30_000 },
  /* 6 */ { layout: "deductible", title: T, deductible: 50_000 },
  /* 7 */ { layout: "deductible", title: LONG_TITLE, note: LONG_NOTE, deductible: 100_000_000, bill: NINE },
  /* 8 */ { layout: "copay", title: ["ร่วมจ่าย", "ตามเงื่อนไข"], note: "แบ่งตามส่วน", percent: 20, bill: 100_000 },
  /* 9 */ { layout: "copay", title: T, percent: 20 },
  /* 10 */ { layout: "copay", title: LONG_TITLE, note: LONG_NOTE, percent: 20, bill: NINE },
  /* 11 */ { layout: "copay", title: T, percent: 1, bill: 100_000 },
  /* 12 */ { layout: "copay", title: T, percent: 99, bill: 100_000 },
  /* 13 */ { layout: "renew98", title: ["ต่ออายุ", "ได้ถึง"], note: "ตามเงื่อนไข", to: 98, age: 35 },
  /* 14 */ { layout: "renew98", title: T, to: 98 },
  /* 15 */ { layout: "renew98", title: LONG_TITLE, note: LONG_NOTE, to: 98, age: 1 },
  /* 16 */ { layout: "parentshealth", title: ["ประกันสุขภาพ", "ให้พ่อแม่"], note: "ตามเงื่อนไขของแผน", cap: 15_000 },
  /* 17 */ { layout: "parentshealth", title: LONG_TITLE, note: LONG_NOTE, cap: NINE },
  /* 18 */ { layout: "groupcost", title: ["ต้นทุนต่อหัว", "ประกันกลุ่ม"], note: "ตามตารางเบี้ยกลุ่ม", perYear: 2_552, band: "10-25" },
  /* 19 */ { layout: "groupcost", title: LONG_TITLE, note: LONG_NOTE, perYear: NINE },
  /* 20 */ { layout: "groupcost", title: T, perYear: 12_047, band: "51-100" },
  /* 21 */ { layout: "hospitals", title: ["โรงพยาบาลในเครือ", "ทั่วประเทศ"], note: "ดูรายชื่อเต็มที่เว็บ", total: 537, rows: FIVE_PROVINCES },
  /* 22 */ { layout: "hospitals", title: T, total: 537, rows: [{ province: "เชียงใหม่", count: 14 }] },
  /* 23 */ { layout: "hospitals", title: LONG_TITLE, note: LONG_NOTE, total: NINE, rows: [{ province: "กรุงเทพมหานคร", count: NINE }, { province: "พระนครศรีอยุธยา", count: 5 }, { province: "ประจวบคีรีขันธ์", count: 2 }, { province: "นครศรีธรรมราช", count: 6 }, { province: "เลย", count: 1 }] },
  /* 24 */ { layout: "paclaim", title: ["อุบัติเหตุ", "หนึ่งครั้ง"], note: "ตามแผนที่เลือก", medical: 150_000, weekly: 3_000, weeks: 52 },
  /* 25 */ { layout: "paclaim", title: T, medical: 80_000 },
  /* 26 */ { layout: "paclaim", title: LONG_TITLE, note: LONG_NOTE, medical: NINE, weekly: NINE, weeks: 52 },
  /* 27 */ { layout: "paclaim", title: T, medical: 100_000, weekly: 1_000 },
];
const of = <L extends Health2Show["layout"]>(layout: L) => SHOWS.filter((x): x is Health2Show<L> => x.layout === layout);
const ipds = of("ipdopd");
const deds = of("deductible");
const cops = of("copay");
const rens = of("renew98");
const pars = of("parentshealth");
const grps = of("groupcost");
const hosps = of("hospitals");
const pacs = of("paclaim");
/** the spec's example of each device and its nine-digit case: what the dark-look checks and the sheets use */
const KEY: Health2Show[] = [SHOWS[0], SHOWS[3], SHOWS[4], SHOWS[7], SHOWS[8], SHOWS[10], SHOWS[13], SHOWS[15], SHOWS[16], SHOWS[17], SHOWS[18], SHOWS[19], SHOWS[21], SHOWS[23], SHOWS[24], SHOWS[26]];
const SPEC: Health2Show[] = [SHOWS[0], SHOWS[4], SHOWS[8], SHOWS[13], SHOWS[16], SHOWS[18], SHOWS[21], SHOWS[24]];

const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const mid = (show: KnowShow) => {
  const s = kspec(show);
  const x = show.layout === "ipdopd" ? s.door1 : show.layout === "deductible" ? s.ours : show.layout === "copay" ? s.cut : show.layout === "renew98" ? s.arc : show.layout === "parentshealth" ? s.child : show.layout === "groupcost" ? s.year : show.layout === "hospitals" ? s.bar2 ?? s.bar0 : s.weekly ?? s.medical;
  return x.at + x.dur / 2;
};
const draw = (show: KnowShow, size: VideoSize = "portrait", art: Look = "plot", t = end(show)) => renderToStaticMarkup(<>{infoDrawn(show, ctx(size, art), t)}</>);
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const flat = (markup: string) => words(markup).replace(/ /g, "");
const each = (fn: (size: VideoSize, art: Look, label: string) => void) => {
  for (const size of SIZES) for (const art of LOOKS) fn(size, art, `${size} ${art}`);
};
const times = (show: KnowShow) => [0, 0.7, mid(show), 2.2, end(show), end(show) + 3];
const n = (v: number) => v.toLocaleString("en-US");
const hit = (p: { x: number; y: number; w: number; h: number }, q: { x: number; y: number; w: number; h: number }) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

describe("the eight round-5 health devices draw in the info route", () => {
  it("every layout has its drawer in every look and size: none falls through to nothing", () => {
    expect(new Set(SHOWS.map((x) => x.layout))).toEqual(new Set(HEALTH2_LAYOUTS));
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
    for (const show of SHOWS) each((size, art, label) => expect(draw(show, size, art).length, `${show.layout} ${label}`).toBeGreaterThan(1500));
    for (const show of KEY) for (const art of LOOKS) expect(draw(show, "portrait", art, 0), `${show.layout} ${art}`).toContain("opacity:0");
  });

  it("draws no return word, no promise, no daily word, and a percent only on the co-payment's own figure", () => {
    const BAD = /ผลตอบแทน|ดอกเบี้ย|กำไร|ปันผล|IRR|ปัน|เบี้ยเท่าเดิม|ต่อได้แน่นอน|รายวัน/i;
    each((size, art, label) => {
      for (const show of SHOWS) {
        const w = words(draw(show, size, art));
        expect(w, `${show.layout} ${label}`).not.toMatch(BAD);
        if (show.layout === "copay") expect(w.match(/%/g) ?? [], `${label} percent`).toHaveLength(1);
        else expect(w, `${show.layout} ${label} percent`).not.toContain("%");
      }
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
      if (show.note) {
        expect(say, `${show.layout} ${label}`).toContain(show.note.replace(/ /g, ""));
        const before = draw(show, size, art, kspec(show).note.at - 0.01);
        const i = before.indexOf("data-note");
        const j = before.indexOf(show.note.split(" ")[0].slice(0, 4), i);
        expect(i, `${show.layout} ${label}`).toBeGreaterThan(-1);
        expect(before.slice(i, j), `${show.layout} ${label}: the note hidden before its beat`).toContain("opacity:0");
      }
    });
  });

  it("deductible and copay say which plan the figure is of (final review 6), in every look", () => {
    each((size, art, label) => {
      for (const show of deds) expect(flat(draw(show, size, art)), `${label} deductible`).toContain(W.deductibleWhen.replace(/ /g, ""));
      for (const show of cops) expect(flat(draw(show, size, art)), `${label} copay`).toContain(W.copayWhen.replace(/ /g, ""));
    });
  });

  it("ipdopd: both cards with the sheet's figures and the plan's name; \"none\" keeps the second door shut and drops the OPD line and figure", () => {
    each((size, art, label) => {
      const full = words(draw(ipds[0], size, art));
      for (const x of [W.inpatient, W.outpatient, W.room, `9,000 ${W.perDay}`, W.opdLimit, `12,000 ${W.baht}`, "โกลด์"]) expect(full, `${label} ${x}`).toContain(x);
      expect(flat(draw(ipds[0], size, art)), label).toContain(W.opdIncludes.replace(/ /g, ""));
      const none = words(draw(ipds[1], size, art));
      expect(none, label).toContain(`3,000 ${W.perDay}`);
      expect(flat(draw(ipds[1], size, art)), label).toContain(W.noOpd.replace(/ /g, ""));
      expect(none, label).not.toContain(W.opdLimit);
      expect(flat(draw(ipds[1], size, art)), label).not.toContain(W.opdIncludes.replace(/ /g, ""));
      expect(words(draw(ipds[2], size, art)), label).toContain(W.actual);
      // the door opens in turn: before its beat the second door is shut (its leaf at the frame's full width)
      const s = kspec(ipds[0]);
      expect(draw(ipds[0], size, art, s.door0.at + s.door0.dur + 0.05), label).not.toBe(draw(ipds[0], size, art, s.door1.at + s.door1.dur + 0.05));
      // (the plotter's carriage moves with time: the door's own picture is what is compared)
      const door1 = (t: number) => { const m = draw(ipds[1], size, art, t); return m.slice(m.indexOf('data-part="door1"'), m.indexOf('data-part="card1"')); };
      expect(door1(s.door1.at + s.door1.dur + 0.5), `${label} none stays shut`).toBe(door1(0));
    });
  });

  it("deductible: ours is the deductible or the bill if smaller, the insurer's the rest; no bill, no part amounts", () => {
    each((size, art, label) => {
      const full = words(draw(deds[0], size, art));
      for (const x of [W.bill, `100,000 ${W.baht}`, W.weOwn, `50,000 ${W.baht}`, W.insurerPays, `${W.deductibleCard.split(" ")[0]}`, `50,000 ${W.perYear}`]) expect(full, `${label} ${x}`).toContain(x);
      const inside = words(draw(deds[1], size, art));
      expect(inside, label).toContain(`30,000 ${W.baht}`);
      expect(flat(draw(deds[1], size, art)), label).toContain(W.notYet.replace(/ /g, ""));
      expect(draw(deds[1], size, art).match(/data-part="label-theirs"/g), `${label} no insurer part`).toBeNull();
      const bare = words(draw(deds[2], size, art));
      expect(bare, label).not.toContain(W.bill);
      expect(words(draw(deds[2], size, art)).match(/\d[\d,]*/g), `${label} only the card's figure`).toEqual(["50,000"]);
      expect(bare, label).toContain(`50,000 ${W.perYear}`);
    });
    const p = deductibleParts(deds[0]);
    expect([p.ours, p.theirs]).toEqual([50_000, 50_000]);
  });

  it("copay: the percent once, ours and the insurer's computed from it; no bill, no card", () => {
    each((size, art, label) => {
      const sp = copaySplit(cops[0])!;
      const full = words(draw(cops[0], size, art));
      for (const x of [W.bill, `${W.weOwn} 20%`, `${W.bill} ${n(sp.bill)}`, `${W.weOwn} ${n(sp.ours)}`, `${W.insurerPays} ${n(sp.theirs)}`]) expect(full, `${label} ${x}`).toContain(x);
      expect([sp.ours, sp.theirs]).toEqual([20_000, 80_000]);
      const bare = words(draw(cops[1], size, art));
      expect(bare, label).toContain(`${W.weOwn} 20%`);
      expect(bare, label).not.toContain(`${W.bill} `.trimEnd() + " 1");
      expect(draw(cops[1], size, art).match(/data-part="card"/g), label).toBeNull();
    });
  });

  it("renew98: วันนี้, the renewal age, the card, today's age only when given and below the renewal age", () => {
    each((size, art, label) => {
      const full = words(draw(rens[0], size, art));
      for (const x of [W.today, "อายุ 35", `${W.renewTo.split(" ")[1]} 98`]) expect(full, `${label} ${x}`).toContain(x);
      expect(flat(draw(rens[0], size, art)), label).toContain(W.notBeyond.replace(/ /g, ""));
      expect(words(draw(rens[1], size, art)), label).not.toContain("อายุ 1");
      expect(words(draw(rens[1], size, art)), label).not.toContain("อายุ 3");
    });
  });

  it("parentshealth: the parents, the child who pays, the cap and the tax foot with the table's year; three people", () => {
    each((size, art, label) => {
      const out = draw(pars[0], size, art);
      const w = words(out);
      for (const x of [W.insured, W.childPays, `${W.upTo} 15,000 ${W.baht}`, parentsFoot()]) expect(flat(out), `${label} ${x}`).toContain(x.replace(/ /g, ""));
      expect(w, label).toContain("15,000");
      expect(out.match(/data-part="(parent0|parent1|child)"/g)?.length, label).toBe(3);
    });
  });

  it("groupcost: six people, the band as the code words it, the month as the year over twelve to the baht below", () => {
    each((size, art, label) => {
      const out = draw(grps[0], size, art);
      const w = words(out);
      expect(w, label).toContain(`${n(2_552)} ${W.baht}`);
      expect(w, label).toContain(`${n(groupMonth(2_552))} ${W.baht}`);
      expect(groupMonth(2_552)).toBe(212);
      expect(w, label).toContain(BAND_WORDS["10-25"]);
      expect(out.match(/data-part="staff\d"/g)?.length, label).toBe(6);
      expect(words(draw(grps[1], size, art)), label).not.toMatch(/10–25|26–50|51–100/);
      expect(words(draw(grps[2], size, art)), label).toContain(BAND_WORDS["51-100"]);
    });
  });

  it("hospitals: the total, each province's short name with its count, the date from the sources, the line", () => {
    each((size, art, label) => {
      const out = draw(hosps[0], size, art);
      const w = words(out);
      expect(w, label).toContain(`537 ${W.nationwide}`);
      for (const r of FIVE_PROVINCES) { expect(w, `${label} ${r.province}`).toContain(provinceShort(r.province)); expect(w, label).toContain(String(r.count)); }
      expect(flat(out), label).toContain(hospitalsFoot().replace(/ /g, ""));
      expect(hospitalsFoot()).toContain(thaiDate(HEALTH2_FIXED.hospitals.fetchedAt));
      expect(flat(out), label).toContain(W.fullList.replace(/ /g, ""));
      expect(out.match(/data-part="bar\d"/g)?.length, label).toBe(5);
    });
  });

  it("hospitals: the bars are to one scale from zero, each growing in its turn", () => {
    for (const size of SIZES) {
      const geo = hospitalsGeo(size, hosps[0], health2InfoPlace(size));
      const max = Math.max(...FIVE_PROVINCES.map((x) => x.count));
      for (const b of geo.bars) expect(Math.abs(b.w - (geo.barRoom * b.count) / max), `${size} ${b.name}`).toBeLessThanOrEqual(1);
    }
    each((size, art, label) => {
      const s = kspec(hosps[0]);
      const early = draw(hosps[0], size, art, s.bar0.at + 0.2);
      expect(early.match(/data-part="bar\d"/g)?.length, label).toBe(1);
      expect(draw(hosps[0], size, art, s.bar2.at + 0.3).match(/data-part="bar\d"/g)?.length, label).toBe(3);
    });
  });

  it("paclaim: the treatment card; with a weekly sum also the weekly card and its weeks, never a daily word", () => {
    each((size, art, label) => {
      const full = draw(pacs[0], size, art);
      for (const x of [`${n(150_000)} ${W.baht}`, `${n(3_000)} ${W.baht}`, `${W.atMost} 52 ${W.weeks}`]) expect(words(full), `${label} ${x}`).toContain(x);
      expect(flat(full), label).toContain(W.perAccident.replace(/ /g, ""));
      expect(flat(full), label).toContain(W.offWork.replace(/ /g, ""));
      const bare = draw(pacs[1], size, art);
      expect(bare.match(/data-part="card-weekly"/g), label).toBeNull();
      expect(bare.match(/data-part="card-weeks"/g), label).toBeNull();
      expect(draw(pacs[3], size, art).match(/data-part="card-weeks"/g), `${label} weekly without weeks`).toBeNull();
    });
  });
});

describe("in the info route's own room every part fits, and the people, names and figures keep their floors", () => {
  const room = (size: VideoSize) => health2InfoPlace(size).room;
  const text = (size: VideoSize) => health2InfoPlace(size).text;
  const fitsFig = (blocks: { size: number; lines: string[] }[], inner: number, label: string) => { for (const b of blocks) for (const l of b.lines) expect(figWidth(l, b.size), `${label} ${l}`).toBeLessThanOrEqual(inner + 1); };

  it("ipdopd: doors, cards, plan, line and note inside the room and apart; the doors stay large", () => {
    for (const size of SIZES) for (const show of ipds) {
      const p = health2InfoPlace(size);
      const geo = ipdopdGeo(size, show, p);
      const label = `${size} ${show.room}/${show.opd}`;
      if (geo.plan) expect(h2Inside(geo.plan, p.room), `${label} plan`).toBe(true);
      for (const dr of geo.doors) {
        expect(h2Inside(dr.door, p.room), `${label} door`).toBe(true);
        expect(h2Inside(dr.card, p.room), `${label} card`).toBe(true);
        expect(hit(dr.door, dr.card), `${label} door on card`).toBe(false);
        expect(dr.card.content, label).toBeLessThanOrEqual(dr.card.h + 1);
        fitsFig(dr.card.blocks, dr.card.inner, label);
        expect(dr.door.h, label).toBeGreaterThanOrEqual(Math.round(p.text * 3.2));
      }
      if (geo.line) { expect(h2Inside(geo.line, p.room), label).toBe(true); expect(Math.max(...geo.doors.map((x) => x.cell.y + x.cell.h)), label).toBeLessThanOrEqual(geo.line.y); }
      if (geo.note) expect(h2Inside(geo.note, p.room), label).toBe(true);
      expect(geo.doors[0].card.blocks[2].size, `${label} amount`).toBeGreaterThanOrEqual(Math.round(p.text * 0.55));
    }
  });

  it("deductible: bar, labels, card inside the room and in order; labels apart under their own part", () => {
    for (const size of SIZES) for (const show of deds) {
      const p = health2InfoPlace(size);
      const geo = deductibleGeo(size, show, p);
      const label = `${size} ${show.deductible}/${show.bill}`;
      for (const r of [geo.bar, geo.card, ...(geo.bill ? [geo.bill] : []), ...(geo.notYet ? [geo.notYet] : []), ...(geo.note ? [geo.note] : [])]) expect(h2Inside(r, p.room), label).toBe(true);
      for (const l of geo.labels) {
        expect(h2Inside({ x: l.x, y: l.y, w: l.w, h: l.h }, p.room), `${label} label`).toBe(true);
        if (l.amount) { expect(figWidth(l.amount, l.amtSize), label).toBeLessThanOrEqual(l.w); expect(l.amtSize, label).toBeGreaterThanOrEqual(Math.round(p.text * 0.5)); }
      }
      if (geo.labels.length === 2) expect(geo.labels[0].x + geo.labels[0].w, label).toBeLessThan(geo.labels[1].x);
      expect(geo.bar.y + geo.bar.h, label).toBeLessThanOrEqual(geo.labels[0].y);
      expect(geo.labels[0].y + geo.labels[0].h, label).toBeLessThanOrEqual(geo.card.y);
      fitsFig(geo.card.blocks, geo.card.inner, label);
    }
  });

  it("copay: sheet, labels and card inside the room and never over each other", () => {
    for (const size of SIZES) for (const show of cops) {
      const p = health2InfoPlace(size);
      const geo = copayGeo(size, show, p);
      const label = `${size} ${show.percent}/${show.bill}`;
      expect(h2Inside(geo.sheet, p.room), `${label} sheet`).toBe(true);
      const lo = geo.labels.ours;
      const lr = { x: lo.x, y: lo.y, w: lo.w, h: lo.h };
      expect(h2Inside(lr, p.room), `${label} ours`).toBe(true);
      expect(lo.x, label).toBeGreaterThanOrEqual(geo.sheet.x + geo.sheet.w);
      if (geo.labels.theirs) { expect(h2Inside(geo.labels.theirs, p.room), label).toBe(true); expect(lo.y + lo.h, label).toBeLessThan(geo.labels.theirs.y); }
      if (geo.card) {
        expect(h2Inside(geo.card, p.room), `${label} card`).toBe(true);
        expect(hit(geo.card, { x: geo.sheet.x, y: geo.tab.y, w: geo.sheet.w, h: geo.sheet.h + geo.tab.h + 8 }), `${label} card on sheet`).toBe(false);
        expect(hit(geo.card, lr), `${label} card on label`).toBe(false);
        if (geo.labels.theirs) expect(hit(geo.card, geo.labels.theirs), label).toBe(false);
        fitsFig(geo.card.blocks, geo.card.inner, label);
      }
      if (geo.note) expect(geo.sheet.y + geo.sheet.h, label).toBeLessThanOrEqual(geo.note.y);
      expect(geo.sheet.h, label).toBeGreaterThanOrEqual(200);
    }
  });

  it("renew98: marks, arc and card inside the room, in order", () => {
    for (const size of SIZES) for (const show of rens) {
      const p = health2InfoPlace(size);
      const geo = renewGeo(size, show, p);
      const label = `${size} ${show.age}`;
      expect(h2Inside(geo.card, p.room), label).toBe(true);
      for (const k of [geo.today, geo.to]) { expect(h2Inside({ x: k.x, y: k.y, w: k.w, h: geo.labelsH }, p.room), label).toBe(true); fitsFig(k.blocks, k.w, label); }
      expect(geo.today.x + geo.today.w, label).toBeLessThan(geo.to.x);
      expect(geo.arc.y - geo.arc.peak, label).toBeGreaterThanOrEqual(p.room.y);
      expect(geo.today.y + geo.labelsH, label).toBeLessThanOrEqual(geo.card.y);
      expect(geo.f, label).toBeGreaterThan(0.55);
    }
  });

  it("parentshealth: three people, big enough, clear of the card, captions and foot", () => {
    for (const size of SIZES) for (const show of pars) {
      const p = health2InfoPlace(size);
      const geo = parentsGeo(size, show, p);
      const label = `${size} ${show.cap}`;
      for (const q of geo.people) { expect(h2Inside(q, p.room), label).toBe(true); expect(hit(q, geo.card), label).toBe(false); expect(hit(q, geo.foot), label).toBe(false); }
      for (const c of [geo.caps.parents, geo.caps.child]) { expect(h2Inside(c, p.room), label).toBe(true); for (const q of geo.people) expect(hit(c, q), label).toBe(false); }
      for (const r of [geo.card, geo.foot, geo.arrow]) expect(h2Inside(r, p.room), label).toBe(true);
      expect(hit(geo.card, geo.foot), label).toBe(false);
      fitsFig(geo.card.blocks, geo.card.inner, label);
      if (geo.note) { expect(h2Inside(geo.note, p.room), label).toBe(true); expect(hit(geo.note, geo.card), label).toBe(false); }
      expect(geo.fw, `${label} person`).toBeGreaterThanOrEqual(Math.round(p.text * 3.2));
    }
  });

  it("groupcost: six people, big enough, apart, over the cards; the band between", () => {
    for (const size of SIZES) for (const show of grps) {
      const p = health2InfoPlace(size);
      const geo = groupGeo(size, show, p);
      const label = `${size} ${show.perYear}/${show.band}`;
      expect(geo.people).toHaveLength(6);
      expect(geo.fw, `${label} people`).toBeGreaterThanOrEqual(Math.round(p.text * 2.8));
      for (const [i, q] of geo.people.entries()) {
        expect(h2Inside(q, p.room), label).toBe(true);
        if (i) expect(geo.people[i - 1].x + geo.people[i - 1].w, label).toBeLessThanOrEqual(q.x);
        expect(hit(q, geo.year) || hit(q, geo.monthCard), label).toBe(false);
      }
      for (const c of [geo.year, geo.monthCard]) { expect(h2Inside(c, p.room), label).toBe(true); fitsFig(c.blocks, c.inner, label); expect(c.blocks[1].size, label).toBeGreaterThanOrEqual(Math.round(p.text * 0.55)); }
      expect(hit(geo.year, geo.monthCard), label).toBe(false);
      if (geo.band) { expect(h2Inside(geo.band, p.room), label).toBe(true); expect(hit(geo.band, geo.year), label).toBe(false); }
    }
  });

  it("hospitals: five rows, the longest names and nine digits inside the room; names and counts keep their size", () => {
    for (const size of SIZES) for (const show of hosps) {
      const p = health2InfoPlace(size);
      const geo = hospitalsGeo(size, show, p);
      const label = `${size} ${show.rows.length} rows`;
      expect(h2Inside(geo.head, p.room), label).toBe(true);
      for (const [i, bar] of geo.bars.entries()) {
        expect(h2Inside(bar.nameBox, p.room), label).toBe(true);
        expect(handWidth(bar.name, geo.nameSize), label).toBeLessThanOrEqual(bar.nameBox.w + 1);
        expect(bar.x, label).toBeGreaterThanOrEqual(bar.nameBox.x + bar.nameBox.w + 8);
        expect(bar.x + bar.w + 10 + figWidth(bar.countText, geo.countSize), label).toBeLessThanOrEqual(p.room.x + p.room.w);
        if (i) expect(bar.y, label).toBeGreaterThanOrEqual(geo.bars[i - 1].y + geo.bars[i - 1].rowH);
      }
      expect(h2Inside(geo.foot, p.room) && h2Inside(geo.line, p.room), label).toBe(true);
      if (geo.line.x > p.room.x) expect(geo.foot.x + geo.foot.w, label).toBeLessThanOrEqual(geo.line.x);
      else expect(geo.line.y, label).toBeGreaterThanOrEqual(geo.foot.y + geo.foot.h);
      if (geo.note) expect(h2Inside(geo.note, p.room), label).toBe(true);
      expect(geo.nameSize, `${label} names`).toBeGreaterThanOrEqual(Math.round(p.text * 0.8));
      expect(geo.countSize, `${label} counts`).toBeGreaterThanOrEqual(Math.round(p.text * 0.8));
    }
  });

  it("paclaim: the cards inside the room and apart; the figures stay readable", () => {
    for (const size of SIZES) for (const show of pacs) {
      const p = health2InfoPlace(size);
      const geo = paclaimGeo(size, show, p);
      const label = `${size} ${show.medical}/${show.weekly}`;
      const cards = [geo.medical, geo.weekly, geo.weeks].filter((x): x is NonNullable<typeof x> => !!x);
      for (const [i, c] of cards.entries()) {
        expect(h2Inside(c, p.room), `${label} card ${i}`).toBe(true);
        fitsFig(c.blocks, c.inner, label);
        for (const [j, d] of cards.entries()) if (j > i) expect(hit(c, d), `${label} ${i} on ${j}`).toBe(false);
      }
      expect(geo.medical.blocks[1].size, label).toBeGreaterThanOrEqual(Math.round(p.text * 0.55));
      if (geo.note) for (const c of cards) expect(hit(geo.note, c), label).toBe(false);
    }
  });

  it("the info route's room is the one the paper's geometry is asked for (portrait is tall, landscape is wide)", () => {
    expect(room("portrait").h).toBeGreaterThan(room("portrait").w);
    expect(room("landscape").w / room("landscape").h).toBeGreaterThan(2);
    expect(text("portrait")).toBeGreaterThan(text("square"));
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
        for (const m of draw(show, size, art, t).matchAll(COLOR)) expect(CLEARED.test(m[1]) || own.has(m[1].replace(/\s/g, "")), `${art} ${show.layout} ${size} ${m[1]}`).toBe(true);
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
  it("every look and size at the end, and mid-beat in portrait, for the spec examples (every other case at the end in one look): draws", async () => {
    for (const show of SPEC) for (const size of SIZES) for (const art of LOOKS) {
      for (const t of size === "portrait" ? [mid(show), end(show)] : [end(show)]) {
        const bytes = await png(frame(show, size, art, t), size);
        expect(bytes.length, `${show.layout} ${size} ${art} ${t}`).toBeGreaterThan(1000);
      }
    }
    for (const show of SHOWS.filter((x) => !SPEC.includes(x))) for (const size of SIZES) {
      const bytes = await png(frame(show, size, "neon", end(show)), size);
      expect(bytes.length, `${show.layout} ${size} neon`).toBeGreaterThan(1000);
    }
  }, 900_000);

  it.skipIf(!STILLS)("writes the stills and contact sheets to tests/scratch/devices5/sheets (HEALTH2_STILLS=1)", async () => {
    const dir = path.join(process.cwd(), "tests/scratch/devices5/sheets");
    mkdirSync(dir, { recursive: true });
    const cell = 560;
    // one sheet per device: a row per size, a column per look, the end frame
    for (const show of SPEC) {
      const tiles: { input: Buffer; left: number; top: number }[] = [];
      let top = 0;
      for (const size of SIZES) {
        let left = 0;
        for (const art of STILL_LOOKS) {
          const bytes = await png(frame(show, size, art, end(show)), size);
          writeFileSync(path.join(dir, `h2info-${show.layout}-${size}-${art}-end.png`), bytes);
          const resized = await sharp(bytes).resize({ height: cell }).png().toBuffer();
          tiles.push({ input: resized, left, top });
          left += (await sharp(resized).metadata()).width! + 8;
        }
        top += cell + 8;
      }
      const width = Math.max(...tiles.map((x) => x.left)) + 900;
      await sharp({ create: { width, height: top, channels: 3, background: "#808080" } }).composite(tiles).png().toFile(path.join(dir, `sheet-${show.layout}.png`));
    }
    // the mid-beat sheet: the eight devices in portrait, the four looks
    const tiles: { input: Buffer; left: number; top: number }[] = [];
    for (const [i, show] of SPEC.entries()) {
      let left = 0;
      for (const art of STILL_LOOKS) {
        const resized = await sharp(await png(frame(show, "portrait", art, mid(show)), "portrait")).resize({ height: 640 }).png().toBuffer();
        tiles.push({ input: resized, left, top: i * 648 });
        left += (await sharp(resized).metadata()).width! + 8;
      }
    }
    await sharp({ create: { width: 4 * 366, height: 8 * 648, channels: 3, background: "#808080" } }).composite(tiles).png().toFile(path.join(dir, "sheet-mid-beat.png"));
    // the nine-digit cases, every size, neon and plot: the longest figures
    for (const show of [SHOWS[3], SHOWS[7], SHOWS[10], SHOWS[17], SHOWS[19], SHOWS[23], SHOWS[26]]) for (const size of SIZES) for (const art of ["neon", "plot"] as const) {
      writeFileSync(path.join(dir, `h2info-nine-${show.layout}-${size}-${art}.png`), await png(frame(show, size, art, end(show)), size));
    }
  }, 900_000);
});

/* ── Review Focus 3: on the dark looks every word and figure can be read where it is drawn, element by element ───── */

/** the hex colour probe `i` is drawn in: thirty-six apart-looking colours (twelve hues, three lightnesses) */
const PROBES: number[][] = (() => {
  const out: number[][] = [];
  for (const l of [0.7, 0.5, 0.3]) for (let h = 0; h < 12; h++) {
    const a = 1 * Math.min(l, 1 - l);
    const f = (k: number) => { const q = (k + h * 30 / 30) % 12; return l - a * Math.max(-1, Math.min(q - 3, 9 - q, 1)); };
    out.push([f(0), f(8), f(4)].map((v) => Math.round(v * 255)));
  }
  return out;
})();
const hex = (p: number[]) => `#${p.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** which text elements `expand` finds, in tree order: `seen` collects their words and inks; in a blank pass every one is hidden, in a probe pass each is its own colour */
interface Pass { n: number; mode: "count" | "blank" | "probe"; seen: string[]; ink: (string | undefined)[] }
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
  // words painted clear are the pen's layer of a piece whose words fade in over it: not seen, so not audited
  if (mine && !(typeof style?.color === "string" && CLEARED.test(style.color))) {
    const i = pass.n++;
    if (pass.mode === "count") { pass.seen[i] = mine; pass.ink[i] = typeof style?.color === "string" ? style.color : undefined; }
    else if (pass.mode === "probe") style = { ...style, color: hex(PROBES[i % PROBES.length]), textShadow: "none" };
    else {
      // hidden: satori draws a "transparent" ink as black, so the ink is not made clear. An element with a plate of its own (any colour format) keeps its plate
      // and hides only its words, in a clear box of their own; any other is hidden by its opacity
      style = { ...style, textShadow: "none" };
      if (style.background === undefined && style.backgroundColor === undefined) return cloneElement(el, { style: { ...style, opacity: 0 } }, expand(kids, pass));
      return cloneElement(el, { style }, createElement("div", { style: { display: "flex", opacity: 0 } }, expand(kids, pass)));
    }
  }
  return cloneElement(el, { style }, expand(kids, pass));
}
const lum = (p: number[]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * Each text element (a title line, a card line, a figure, a label, a caption, the foot line, a note line…) is found in the
 * frame's tree. The frame is drawn twice: once with every text element hidden (what is under them, plates included) and once
 * with each text element in a colour of its own (its glyphs' own solid pixels, found by that colour). An element must have
 * glyph pixels at all (unless `lenient`: a mid-beat frame, where a piece not yet in has none), and its real ink (the colour
 * it is given) must stand 3:1 or better off what is under those pixels, for nine in ten of them.
 */
async function audit(body: ReactNode, size: VideoSize, wrap: (b: ReactNode) => ReactElement, label: string, lenient = false) {
  const failures: string[] = [];
  const count: Pass = { n: 0, mode: "count", seen: [], ink: [] };
  expand(body, count);
  const { w, h } = FRAME[size];
  expect(count.n, `${label}: probes`).toBeLessThanOrEqual(PROBES.length);
  const raw = async (mode: "blank" | "probe") => {
    const { data, info } = await sharp(await png(wrap(expand(body, { n: 0, mode, seen: [], ink: [] })), size)).raw().toBuffer({ resolveWithObject: true });
    return { data, ch: info.channels };
  };
  const [blank, probe] = [await raw("blank"), await raw("probe")];
  const mask: number[] = new Array(count.n).fill(0);
  const read: number[] = new Array(count.n).fill(0);
  const inks = count.ink.map((c) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? rgb(c) : null));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * probe.ch;
    const j = (y * w + x) * blank.ch;
    if (Math.abs(probe.data[i] - blank.data[j]) + Math.abs(probe.data[i + 1] - blank.data[j + 1]) + Math.abs(probe.data[i + 2] - blank.data[j + 2]) < 60) continue;
    // which element's own colour this solid glyph pixel is (an edge pixel, a blend, is nobody's)
    let who = -1;
    for (let k = 0; k < count.n; k++) {
      const c = PROBES[k % PROBES.length];
      if (Math.abs(probe.data[i] - c[0]) + Math.abs(probe.data[i + 1] - c[1]) + Math.abs(probe.data[i + 2] - c[2]) < 24) { who = k; break; }
    }
    if (who < 0) continue;
    mask[who]++;
    const ink = inks[who];
    if (ink && contrast(ink, [blank.data[j], blank.data[j + 1], blank.data[j + 2]]) >= 3) read[who]++;
  }
  let seen = 0;
  for (let k = 0; k < count.n; k++) {
    const at = `${label} "${count.seen[k]}"`;
    if (!inks[k]) failures.push(`${at}: ink ${count.ink[k]} is not one of the look's hex inks`);
    else if (mask[k] < 20) { if (!lenient) failures.push(`${at}: no glyph pixels (${mask[k]})`); }
    else { seen++; if (read[k] / mask[k] < 0.9) failures.push(`${at}: ${read[k]}/${mask[k]} pixels read 3:1`); }
  }
  return { failures, count: count.n, seen };
}

describe("Review Focus 3: นีออน and บลูพริ้นท์ keep every word and figure readable, element by element", () => {
  for (const art of DARK) {
    it(`every text element stands 3:1 off what is under it, with real glyph pixels, in ${art}: the eight spec examples and a 9-digit case of each, every size`, async () => {
      const failures: string[] = [];
      let checked = 0;
      for (const show of KEY) for (const size of SIZES) {
        const t = end(show);
        const r = await audit(infoDrawn(show, ctx(size, art), t), size, (b) => frame(show, size, art, t, b), `${art} ${show.layout} ${SHOWS.indexOf(show)} ${size}`);
        expect(r.count, `${show.layout} ${size}: text elements`).toBeGreaterThan(3);
        checked += r.count;
        failures.push(...r.failures);
      }
      expect(checked, "elements checked").toBeGreaterThan(200);
      expect(failures).toEqual([]);
    }, 1_800_000);

    it(`mid-beat, the words and figures already in stand 3:1 off what is under them, in ${art}: the eight spec examples, portrait`, async () => {
      const failures: string[] = [];
      let seen = 0;
      for (const show of SPEC) {
        const t = mid(show);
        const r = await audit(infoDrawn(show, ctx("portrait", art), t), "portrait", (b) => frame(show, "portrait", art, t, b), `${art} ${show.layout} mid`, true);
        seen += r.seen;
        failures.push(...r.failures);
      }
      expect(seen, "elements in at mid-beat").toBeGreaterThan(30);
      expect(failures).toEqual([]);
    }, 1_800_000);
  }

  it("the audit judges plate-bearing text against its plate, in any colour format: ink equal to an rgba plate fails, a hex plate fails, a readable ink passes", async () => {
    const wrap = (b: ReactNode) => <div style={{ display: "flex", width: FRAME.portrait.w, height: FRAME.portrait.h, background: "#ffffff", fontFamily: "Plex" }}>{b}</div>;
    const mk = (color: string, background: string) => (
      <div style={{ display: "flex", position: "absolute", left: 100, top: 100 }}>
        <div style={{ display: "flex", fontSize: 120, color, background }}>ผู้ป่วยใน 9,000</div>
      </div>
    );
    // the plate is drawn on white; the ink equals the plate: unreadable, though the page under the plate is white
    expect((await audit(mk("#2850a0", "rgba(40,80,160,1)"), "portrait", wrap, "rgba plate")).failures.length, "rgba plate, same ink").toBeGreaterThan(0);
    expect((await audit(mk("#2850a0", "#2850a0"), "portrait", wrap, "hex plate")).failures.length, "hex plate, same ink").toBeGreaterThan(0);
    expect((await audit(mk("#ffffff", "rgba(40,80,160,1)"), "portrait", wrap, "readable")).failures, "white on the plate").toEqual([]);
  });
});

/* ── a figure is never shown in part ─────────────────────────────────────────────────────────────────────────────── */

describe("a figure is whole or not there at every frame, in every look and size", () => {
  /** every text element holding a digit, with whether any ancestor clips (a write-in sweep or an inset) */
  function figureClips(node: ReactNode, clipped: boolean, out: { text: string; clipped: boolean }[]): void {
    if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
    if (Array.isArray(node)) { for (const x of node) figureClips(x, clipped, out); return; }
    if (!isValidElement(node)) return;
    const el = node as ReactElement<{ children?: ReactNode; style?: React.CSSProperties }>;
    if (typeof el.type === "function") return figureClips((el.type as (p: unknown) => ReactNode)(el.props), clipped, out);
    const kids = el.props.children;
    const style = el.props.style ?? {};
    const here = clipped || (style.clipPath !== undefined && style.clipPath !== "none") || style.overflow === "hidden";
    const list = Array.isArray(kids) ? kids.flat(Infinity) : [kids];
    const mine = list.filter((k) => typeof k === "string" || typeof k === "number").join("").trim();
    if (mine && /[0-9๐-๙]/.test(mine)) out.push({ text: mine, clipped: here });
    figureClips(kids, here, out);
  }

  it("no text with a digit in it is ever drawn under a clip: not while it comes in, not at any beat", () => {
    let seen = 0;
    for (const show of SHOWS) for (const size of SIZES) for (const art of LOOKS) {
      const e = end(show);
      for (let i = 0; i <= 24; i++) {
        const out: { text: string; clipped: boolean }[] = [];
        figureClips(infoDrawn(show, ctx(size, art), (e * i) / 24), false, out);
        seen += out.length;
        for (const f of out) expect(f.clipped, `${show.layout} ${size} ${art} ${i}/24 "${f.text}"`).toBe(false);
      }
    }
    expect(seen).toBeGreaterThan(1000);
  });

  it("at every sampled frame each figure is drawn whole in the markup: the full text, never cut digits", () => {
    for (const show of SPEC) for (const size of SIZES) for (const art of LOOKS) {
      const full = words(draw(show, size, art));
      const figs = full.match(/\d[\d,]*\d|\d/g) ?? [];
      for (let i = 1; i <= 12; i++) {
        const out = words(draw(show, size, art, (end(show) * i) / 12));
        for (const f of out.match(/\d[\d,]*\d|\d/g) ?? []) expect(figs, `${show.layout} ${size} ${art} ${i}/12 "${f}"`).toContain(f);
      }
    }
  });
});
