import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { HEALTH_WORDS, knowText, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { fitHand, type StoryContext } from "@/lib/quote-video/story-motion";
import type { VideoSize } from "@/lib/quote-video/timeline";

/** ชุดประกันสุขภาพ (scene library phase 1): split, limit, room and overflow, drawn in paper, warm and line */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const ARTS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];

const ctx = (size: VideoSize, art: Partial<StoryVideoInput> = { art: "paper" }): StoryContext => ({
  input: { product: "STORY", topic: "mythclaim", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

const SHOWS: KnowShow[] = [
  { layout: "split", title: ["เหมาจ่าย", "ต่างจากแยกจ่ายยังไง"], parts: ["ห้อง", "ยา", "ผ่าตัด", "แพทย์"], whole: "จ่ายตามจริง" },
  { layout: "limit", title: ["วงเงินต่อปี", "ใช้ไปเท่าไหร่"], limit: 5_000_000, used: 325_000, planName: "iHealthy Silver" },
  { layout: "limit", title: ["วงเงินต่อปี", ""], limit: 1_000_000, planName: "iHealthy Smart" },
  { layout: "room", title: ["ค่าห้องเดี่ยว", "ต่อคืน"], plan: 4000, real: 6000, planName: "iHealthy Smart" },
  { layout: "room", title: ["ค่าห้องเดี่ยว", "ต่อคืน"], plan: 4000, planName: "iHealthy Smart" },
  { layout: "overflow", title: ["บิลเกินวงเงิน", "ใครจ่าย?"], bill: 300_000, limit: 200_000 },
  { layout: "overflow", title: ["บิลเกินวงเงิน", "ใครจ่าย?"] },
];

const html = (show: KnowShow, t = 6, size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
/** the words a frame shows, its tags and styles left out */
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ");
/** the first font size in a frame's markup: its title's first line */
const firstSize = (markup: string) => Number(markup.match(/font-size:(\d+)px/)![1]);

describe("kspec for the four health layouts", () => {
  it("returns a record of movements that are all over within 6 s", () => {
    for (const show of SHOWS) {
      const s = kspec(show);
      expect(Object.keys(s).length, show.layout).toBeGreaterThan(0);
      for (const an of Object.values(s)) expect(an.at + an.dur, show.layout).toBeLessThanOrEqual(6);
    }
  });
});

describe("showBody", () => {
  it("draws each layout in every size and look, at the start, the middle and the end", () => {
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) for (const t of [0, 2, 6]) {
      expect(() => html(show, t, size, art), `${show.layout} ${size} ${art.art} ${t}`).not.toThrow();
    }
  });

  it("puts the title, the parts and the whole of split on screen", () => {
    const out = words(html(SHOWS[0]));
    for (const w of ["เหมาจ่าย", "แยกจ่าย", "ห้อง", "ยา", "ผ่าตัด", "แพทย์", "จ่ายตามจริง"]) expect(out).toContain(w);
  });

  it("fills limit's tube to what was used, the year's limit labelled ต่อปี", () => {
    const out = words(html(SHOWS[1]));
    expect(out).toContain("5,000,000");
    expect(out).toContain("ต่อปี");
    expect(out).toContain("325,000");
    expect(out).toContain("4,675,000");
    // with nothing used, no "ใช้ไป"
    expect(words(html(SHOWS[2]))).not.toContain("ใช้ไป");
  });

  it("room: the night's difference the customer pays when the room costs more than the plan pays", () => {
    const out = words(html({ layout: "room", title: ["ค่าห้อง", ""], real: 6000, plan: 4000, planName: "iHealthy Smart" }));
    expect(out).toContain("2,000");
    expect(out).toContain("จ่ายเองต่อคืน");
  });

  it("room: a room within the plan says the plan pays it, never a negative number", () => {
    const out = words(html({ layout: "room", title: ["ค่าห้อง", ""], real: 1200, plan: 1500, planName: "iHealthy Smart" }));
    expect(out).toContain("แผนนี้จ่ายพอ");
    expect(out).not.toContain("-");
    expect(out).not.toContain("จ่ายเองต่อคืน");
  });

  it("room without the real room: the plan's figure under the words-only line", () => {
    const out = words(html(SHOWS[4]));
    expect(out).toContain("4,000");
    expect(out).toContain("ค่าห้อง รพ. เอกชนมักเกินวงเงินของแผนเล็ก");
  });

  it("overflow: the part of the bill above the limit, and a words card with no bill", () => {
    expect(words(html({ layout: "overflow", title: ["บิล", ""], bill: 300_000, limit: 200_000 }))).toContain("100,000");
    expect(words(html({ layout: "overflow", title: ["บิล", ""] }))).toContain("เลือกวงเงินให้พอ");
    expect(words(html({ layout: "overflow", title: ["บิล", ""], bill: 300_000 }))).toContain("เลือกวงเงินให้พอ");
  });

  it("overflow: a bill within the limit says the plan pays it, never a negative number", () => {
    const out = words(html({ layout: "overflow", title: ["บิล", ""], bill: 150_000, limit: 200_000 }));
    expect(out).toContain("แผนนี้จ่ายพอ");
    expect(out).not.toContain("-");
  });

  it("shrinks a 40-letter title to fit the frame, in landscape below the portrait title's size", () => {
    const title = "ก".repeat(40);
    // มินิมอล+warm draws the title in the handwriting face as plain lines: the first size in the markup is the title's
    const sizeOf = (size: VideoSize) => firstSize(html({ ...SHOWS[0], title: [title, ""] } as KnowShow, 6, size, { art: "minimal", ground: "warm" }));
    const landscape = sizeOf("landscape");
    expect(landscape).toBe(fitHand(title, 1920 - 80, 80));
    expect(landscape).toBeLessThan(80);
    expect(landscape).toBeLessThan(104);
    expect(sizeOf("portrait")).toBe(fitHand(title, 1080 - 80, 104));
    // a short title keeps its size
    expect(firstSize(html(SHOWS[0], 6, "landscape", { art: "minimal", ground: "warm" }))).toBe(80);
  });

  it("fits a 40-letter paper or line title once, at the look's own size, so it stays readable", () => {
    const title = "ก".repeat(40);
    const paperSize = firstSize(html({ ...SHOWS[0], title: [title, ""] } as KnowShow, 6, "portrait", { art: "paper" }));
    // shrunk twice it was 25 (fitted at the plain size, then paper's 0.6); once, the tile (ก is 0.7 em in Mali) still fits the frame
    expect(paperSize).toBeGreaterThanOrEqual(32);
    expect(paperSize * (0.7 * 40 + 0.75) + 18).toBeLessThanOrEqual(1000);
    const lineSize = firstSize(html({ ...SHOWS[0], title: [title, ""] } as KnowShow, 6, "portrait", { art: "line" }));
    expect(lineSize).toBeGreaterThanOrEqual(32);
    expect(lineSize * (0.7 * 40 + 1)).toBeLessThanOrEqual(1000);
    // a short title keeps the look's own size
    expect(firstSize(html(SHOWS[0], 6, "portrait", { art: "paper" }))).toBe(Math.round(104 * 0.78));
    expect(firstSize(html(SHOWS[0], 6, "portrait", { art: "line" }))).toBe(Math.round(104 * 0.72));
  });

  it("limit: used up says so, in red", () => {
    const out = words(html({ layout: "limit", title: ["วงเงิน", ""], limit: 1_000_000, used: 1_200_000, planName: "iHealthy Smart" }));
    expect(out).toContain("ใช้ครบวงเงินแล้ว");
    expect(out).not.toContain("เหลืออีก");
    expect(out).not.toContain("-");
  });

  it("limit: with nothing used the tube is empty, and no drawing needs an id another device could share", () => {
    const empty = html(SHOWS[2]);
    expect(empty).toContain("1,000,000");
    expect(empty).not.toContain(`fill="${STORY_CLIP_COLORS.coin}"`);
    for (const show of SHOWS) for (const size of SIZES) expect(html(show, 6, size)).not.toMatch(/ id="/);
  });

  it("room: a room the plan pays exactly says the plan pays it", () => {
    const out = words(html({ layout: "room", title: ["ค่าห้อง", ""], real: 4000, plan: 4000, planName: "iHealthy Smart" }));
    expect(out).toContain("แผนนี้จ่ายพอ");
    expect(out).not.toContain("จ่ายเองต่อคืน");
    expect(out).not.toContain("-");
  });

  it("overflow: a bill equal to the limit shows no negative; nothing to draw shows the words card", () => {
    const even = words(html({ layout: "overflow", title: ["บิล", ""], bill: 200_000, limit: 200_000 }));
    expect(even).toContain("แผนนี้จ่ายพอ");
    expect(even).not.toContain("-");
    for (const size of SIZES) {
      const zero = html({ layout: "overflow", title: ["บิล", ""], bill: 0, limit: 0 }, 6, size);
      expect(zero).not.toContain("NaN");
      expect(words(zero)).toContain("เลือกวงเงินให้พอ");
      expect(words(zero)).not.toContain("ค่ารักษา");
    }
  });
});

it("hands the words the devices draw themselves to the hand font", () => {
  const text = knowText({ scenes: SHOWS.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "", contactVoice: "" });
  for (const w of Object.values(HEALTH_WORDS)) expect(text).toContain(w);
});
