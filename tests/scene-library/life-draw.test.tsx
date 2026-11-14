import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { incomestopLost, knowText, LIFE_WORDS as LW, lifeneedTotals, n, type KnowShow, type LifeShow } from "@/lib/quote-video/story-knowledge";
import { kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { beneficiaryGeo, handLines } from "@/lib/quote-video/story-life-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/** device round 2, Task 2: lifeneed, beneficiary, cilump and incomestop drawn in paper, warm and line */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const ARTS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];

const ctx = (size: VideoSize, art: Partial<StoryVideoInput> = { art: "paper" }): StoryContext => ({
  input: { product: "STORY", topic: "mythclaim", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const LONG_NAMES = ["นางสาวพรรณราย ศรีสุวรรณวงศ์", "เด็กชายธนกฤต เจริญรุ่งเรืองกิจ", "เด็กหญิงกัญญาณัฐ ทรัพย์มหาศาล", "นางบุญเรือน ใจดีมีสุขสวัสดิ์"];

const SHOWS: KnowShow[] = [
  { layout: "lifeneed", title: ["ทุนชีวิต", "ควรมีเท่าไหร่"], debts: 1_800_000, expenses: 240_000, years: 10, education: 800_000, have: 1_000_000 },
  { layout: "lifeneed", title: ["ทุนชีวิต", "ควรมีเท่าไหร่"], debts: 1_800_000, expenses: 240_000, years: 10, education: 800_000, have: 6_000_000 },
  { layout: "lifeneed", title: ["ทุนชีวิต", "ควรมีเท่าไหร่"], debts: 1_800_000, have: 500_000 },
  { layout: "lifeneed", title: ["ทุนชีวิต", "ควรมีเท่าไหร่"] },
  { layout: "beneficiary", title: ["ผู้รับประโยชน์", "ใครได้รับเงิน"], rows: [{ name: "ภรรยา", share: 60 }, { name: "ลูกคนโต", share: 20 }, { name: "ลูกคนเล็ก", share: 20 }] },
  { layout: "beneficiary", title: ["ผู้รับประโยชน์", ""], rows: [{ name: "ภรรยา" }, { name: "ลูก" }] },
  { layout: "beneficiary", title: ["ผู้รับประโยชน์", "ใครได้รับเงิน"], rows: LONG_NAMES.map((name) => ({ name, share: 25 })) },
  { layout: "beneficiary", title: ["ผู้รับประโยชน์", ""], rows: [{ name: "แม่", share: 100 }] },
  { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"], sum: 1_000_000, note: "ใช้รักษาหรือทดแทนรายได้" },
  { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"] },
  { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 30_000, months: 6 },
  { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 30_000 },
  { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], months: 6 },
  { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"] },
];

/** the moment every piece of a show is in: the end of its last movement */
const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("the four devices draw", () => {
  it("in every look and size, at the start, the middle and the end of the animation, with no NaN and no shared id", () => {
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) for (const t of [0, 1.5, end(show)]) {
      let out = "";
      expect(() => { out = html(show, t, size, art); }, `${show.layout} ${size} ${art.art} ${t}`).not.toThrow();
      expect(out, `${show.layout} ${size} ${art.art} ${t}`).not.toContain("NaN");
      expect(out).not.toMatch(/ id="/);
      expect(words(out)).not.toMatch(/-\d/);
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
  }, 120_000);

  it("each draws more than its title (it is not the empty fall-through)", () => {
    for (const show of SHOWS) for (const size of SIZES) expect(html(show, end(show), size).length, `${show.layout} ${size}`).toBeGreaterThan(1500);
  });

  it("every movement is over within 6 s", () => {
    for (const show of SHOWS) expect(end(show), show.layout).toBeLessThanOrEqual(6);
  });
});

describe("lifeneed", () => {
  const full = SHOWS[0] as LifeShow<"lifeneed">;
  it("the blocks with their amounts, the need, what is had and the gap: the helper's figures", () => {
    const tot = lifeneedTotals(full);
    for (const size of SIZES) for (const art of ARTS) {
      const out = words(html(full, end(full), size, art));
      for (const w of [LW.debts, LW.living, LW.education, LW.need, LW.have, LW.gap]) expect(out, `${size} ${art.art} ${w}`).toContain(w);
      for (const b of tot.blocks) expect(out, `${size} ${b.key}`).toContain(n(b.amount));
      expect(out).toContain(n(tot.need!));
      expect(out).toContain(n(tot.have!));
      expect(out).toContain(n(tot.gap!));
      expect(out).toContain(`10 ${LW.years}`);
      expect(out).not.toContain(LW.enough);
    }
    // 1,800,000 + 240,000 × 10 + 800,000 = 5,000,000; 5,000,000 − 1,000,000 = 4,000,000
    expect(words(html(full))).toContain("5,000,000");
    expect(words(html(full))).toContain("4,000,000");
  });

  it("what is had covers the need: the enough words in place of a gap, never a negative", () => {
    const out = words(html(SHOWS[1]));
    expect(out).toContain(LW.enough);
    expect(out).not.toContain(LW.gap);
  });

  it("some inputs missing: the card says รวมที่กรอกไว้, not ควรมีทุนรวม", () => {
    for (const size of SIZES) {
      const out = words(html(SHOWS[2], end(SHOWS[2]), size));
      expect(out).toContain(LW.partial);
      expect(LW.partial).toBe("รวมที่กรอกไว้");
      expect(out).not.toContain(LW.need);
      expect(out).toContain("1,800,000");
      expect(out).toContain("1,300,000");
    }
  });

  it("no figures: the blocks named, no number, and the words line", () => {
    for (const size of SIZES) for (const art of ARTS) {
      const out = words(html(SHOWS[3], end(SHOWS[3]), size, art));
      for (const w of [LW.debts, LW.living, LW.education]) expect(out, `${size} ${art.art}`).toContain(w);
      // the words line, set as two lines (it has no space to wrap at)
      expect(out.replace(/ /g, ""), `${size} ${art.art}`).toContain(LW.needWords);
      expect(out.replace("ทุนชีวิต ควรมีเท่าไหร่", "")).not.toMatch(/\d/);
      expect(out).not.toContain(LW.need);
    }
  });

  it("a sum on the show is never read: only the inputs", () => {
    const forged = { ...full, need: 9_999_999, gap: 7_777_777 } as unknown as KnowShow;
    const out = words(html(forged));
    expect(out).not.toContain("9,999,999");
    expect(out).not.toContain("7,777,777");
  });
});

describe("beneficiary", () => {
  it("the policy, each name with its share, and the line", () => {
    for (const size of SIZES) for (const art of ARTS) {
      const out = words(html(SHOWS[4], end(SHOWS[4]), size, art));
      for (const w of [LW.policy, "ภรรยา", "ลูกคนโต", "ลูกคนเล็ก", "60%", "20%", LW.name]) expect(out, `${size} ${art.art} ${w}`).toContain(w);
    }
  });

  it("no shares: the names, no %", () => {
    const out = words(html(SHOWS[5]));
    expect(out).toContain("ภรรยา");
    expect(out).toContain("ลูก");
    expect(out).not.toContain("%");
  });

  it("four long Thai names fit their columns at every size, wrapped at their spaces, readable", () => {
    const rows = LONG_NAMES.map((name) => ({ name, share: 25 }));
    const FLOOR: Record<VideoSize, number> = { portrait: 28, square: 20, landscape: 24 };
    for (const size of SIZES) {
      const geo = beneficiaryGeo(size, rows);
      expect(geo.nameSize, size).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const { name } of rows) {
        // each piece between spaces fits the column on its own line (Mali: 0.7 em a letter, marks none)
        for (const piece of name.split(" ")) expect(handLines(piece, geo.nameSize, geo.nameRoom), `${size} ${piece}`).toBe(1);
        expect(handLines(name, geo.nameSize, geo.nameRoom) * geo.nameSize * 1.3, `${size} ${name}`).toBeLessThanOrEqual(geo.nameBand);
      }
      // the line stays inside the device's room
      expect(geo.lineBottom, size).toBeLessThanOrEqual(geo.bottom);
      for (const art of ARTS) {
        const out = html(SHOWS[6], end(SHOWS[6]), size, art);
        for (const { name } of rows) expect(out, `${size} ${art.art}`).toMatch(new RegExp(`font-size:${geo.nameSize}px[^>]*>${name}<`));
      }
    }
  });

  it("a 40-letter name with no space still fits, shrunk", () => {
    const name = "ก".repeat(40);
    for (const size of SIZES) {
      const geo = beneficiaryGeo(size, [{ name }, { name: "ภรรยา" }, { name: "ลูก" }, { name: "แม่" }]);
      expect(handLines(name, geo.nameSize, geo.nameRoom), size).toBe(1);
      expect(geo.nameSize, size).toBeGreaterThan(0);
    }
  });
});

describe("cilump", () => {
  it("the certificate, the lump and its sum, the line and the note", () => {
    for (const size of SIZES) for (const art of ARTS) {
      const out = words(html(SHOWS[8], end(SHOWS[8]), size, art));
      for (const w of [LW.certificate, LW.lump, "1,000,000", "ใช้รักษาหรือทดแทนรายได้"]) expect(out, `${size} ${art.art} ${w}`).toContain(w);
      // the conditions line, on two lines in a narrow column
      expect(out.replace(/ /g, ""), `${size} ${art.art}`).toContain(LW.diagnosed);
    }
  });

  it("no sum: the lump in words, no figure", () => {
    const out = words(html(SHOWS[9]));
    expect(out).toContain(LW.lump);
    expect(out.replace(/ /g, "")).toContain(LW.diagnosed);
    expect(out).not.toMatch(/\d/);
  });
});

describe("incomestop", () => {
  it("the gap's months, and a month's income × the months = the helper's lost", () => {
    const show = SHOWS[10] as LifeShow<"incomestop">;
    for (const size of SIZES) for (const art of ARTS) {
      const out = words(html(show, end(show), size, art));
      for (const w of [`${LW.stop} 6 ${LW.months}`, LW.lost, "30,000", "× 6", n(incomestopLost(show)!), LW.income]) expect(out, `${size} ${art.art} ${w}`).toContain(w);
    }
    expect(words(html(show))).toContain("180,000");
  });

  it("without both inputs: no product, no stray figures", () => {
    const monthOnly = words(html(SHOWS[11]));
    expect(monthOnly).toContain("30,000");
    expect(monthOnly).not.toContain("×");
    const monthsOnly = words(html(SHOWS[12]));
    expect(monthsOnly).toContain(`${LW.stop} 6 ${LW.months}`);
    expect(monthsOnly).not.toContain("×");
    const none = words(html(SHOWS[13]));
    expect(none).toContain(LW.stop);
    expect(none).toContain(LW.lost);
    expect(none).not.toMatch(/\d/);
  });
});

it("hands the new card word to the hand font", () => {
  const text = knowText({ scenes: SHOWS.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "", contactVoice: "" });
  expect(text).toContain("รวมที่กรอกไว้");
});
