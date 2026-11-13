import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { HEALTH_WORDS, knowText, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { infoShow } from "@/lib/quote-video/story-info-motion";
import { kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { fitHand, type StoryContext } from "@/lib/quote-video/story-motion";
import type { VideoSize } from "@/lib/quote-video/timeline";

/** ชุดประกันสุขภาพ (scene library phase 1): the eight devices, drawn in paper, warm and line */
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
  { layout: "waiting", title: ["สมัครวันนี้", "คุ้มครองเมื่อไหร่"], rows: [{ at: "วันนี้", label: "อุบัติเหตุ" }, { at: "30 วัน", label: "ป่วยทั่วไป" }, { at: "120 วัน", label: "บางโรค" }] },
  { layout: "cashless", title: ["ยื่นบัตร", "ไม่ต้องสำรองจ่าย"], note: "ตามเงื่อนไขการเคลม" },
  { layout: "groupgap", title: ["ประกันกลุ่ม", "จ่ายได้แค่ไหน"], bill: 325_000, group: 50_000 },
  { layout: "groupgap", title: ["ประกันกลุ่ม", "จ่ายได้แค่ไหน"] },
  { layout: "agecost", title: ["เบี้ยสุขภาพ", "ขึ้นตามอายุ"], rows: [{ age: 30, annual: 18_000 }, { age: 40, annual: 24_500 }, { age: 50, annual: 39_000 }, { age: 60, annual: 61_000 }], source: "เบี้ยสัญญาเพิ่มเติมสุขภาพต่อปี ไม่รวมสัญญาหลัก" },
  { layout: "agecost", title: ["เบี้ยสุขภาพ", "ขึ้นตามอายุ"], rows: [{ age: 35, annual: 20_000 }], source: "ตัวอย่าง" },
];
const show = (layout: KnowShow["layout"], i = 0) => SHOWS.filter((x) => x.layout === layout)[i];

const html = (show: KnowShow, t = 6, size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
/** the words a frame shows, its tags and styles left out */
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ");
/** the first font size in a frame's markup: its title's first line */
const firstSize = (markup: string) => Number(markup.match(/font-size:(\d+)px/)![1]);

describe("kspec for the health layouts", () => {
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

  it("overflow: a bill within the limit says it is within the year's limit, never a negative number", () => {
    const out = words(html({ layout: "overflow", title: ["บิล", ""], bill: 150_000, limit: 200_000 }));
    expect(out).toContain("อยู่ในวงเงินต่อปี");
    expect(out).not.toContain("แผนนี้จ่ายพอ");
    expect(out).not.toContain("-");
  });

  it("overflow: what the insurer pays is said as an example under the plan's conditions, over the limit and within it", () => {
    for (const size of SIZES) for (const art of ARTS) for (const bill of [300_000, 150_000]) {
      const out = words(html({ layout: "overflow", title: ["บิล", ""], bill, limit: 200_000 }, 6, size, art));
      expect(out, `${size} ${art.art} ${bill}`).toContain("ประกันจ่าย");
      expect(out, `${size} ${art.art} ${bill}`).toContain("ตัวอย่าง ตามเงื่อนไข");
    }
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
    expect(even).toContain("อยู่ในวงเงินต่อปี");
    expect(even).not.toContain("-");
    for (const size of SIZES) {
      const zero = html({ layout: "overflow", title: ["บิล", ""], bill: 0, limit: 0 }, 6, size);
      expect(zero).not.toContain("NaN");
      expect(words(zero)).toContain("เลือกวงเงินให้พอ");
      expect(words(zero)).not.toContain("ค่ารักษา");
    }
  });
});

describe("waiting, cashless, groupgap and agecost", () => {
  it("waiting: each row on the line, what it covers under it, the plan's conditions on a card", () => {
    const out = words(html(show("waiting")));
    for (const w of ["วันนี้", "อุบัติเหตุ", "30 วัน", "ป่วยทั่วไป", "120 วัน", "บางโรค", "ตามเงื่อนไขของแต่ละแผน"]) expect(out).toContain(w);
    // no rows yet: the card alone
    expect(words(html({ layout: "waiting", title: ["ระยะรอคอย", ""], rows: [] }))).toContain("ตามเงื่อนไขของแต่ละแผน");
  });

  it("cashless: the network hospital and the show's note", () => {
    const out = words(html(show("cashless")));
    expect(out).toContain("รพ. ในเครือ");
    expect(out).toContain("ตามเงื่อนไขการเคลม");
  });

  it("groupgap: the bill, what the group plan pays, and what is still short", () => {
    const out = words(html(show("groupgap")));
    for (const w of ["ค่ารักษาจริง", "325,000", "ประกันกลุ่มจ่าย", "50,000", "ขาดอีก", "275,000"]) expect(out).toContain(w);
    expect(out).not.toContain("-");
  });

  it("groupgap: words only when a number is missing; a group plan that covers the bill shows no negative", () => {
    for (const x of [{}, { bill: 325_000 }, { group: 50_000 }, { bill: 0, group: 0 }]) {
      const out = html({ layout: "groupgap", title: ["ประกันกลุ่ม", ""], ...x });
      expect(words(out)).toContain("ประกันกลุ่มอาจไม่พอ");
      expect(words(out)).not.toContain("ขาดอีก");
      expect(out).not.toContain("NaN");
    }
    const covered = words(html({ layout: "groupgap", title: ["ประกันกลุ่ม", ""], bill: 40_000, group: 50_000 }));
    expect(covered).toContain("ประกันกลุ่มจ่ายพอ");
    expect(covered).not.toContain("ขาดอีก");
    expect(covered).not.toContain("-");
  });

  it("agecost: a bar for each age, its premium on it, the source under them", () => {
    const out = words(html(show("agecost")));
    for (const w of ["30 ปี", "40 ปี", "50 ปี", "60 ปี", "18,000", "61,000", "เบี้ยสัญญาเพิ่มเติมสุขภาพต่อปี ไม่รวมสัญญาหลัก"]) expect(out).toContain(w);
    const age = show("agecost") as Extract<KnowShow, { layout: "agecost" }>;
    const two = words(html({ ...age, rows: age.rows.slice(0, 2) }));
    expect(two.match(/\d+ ปี/g)).toHaveLength(2);
  });

  it("agecost: fewer than two rows is a words-only card with the title, no bars", () => {
    const out = words(html(show("agecost", 1)));
    expect(out).toContain("เบี้ยสุขภาพ");
    expect(out).toContain("ขึ้นตามอายุ");
    expect(out).not.toContain("35 ปี");
    expect(out).not.toContain("20,000");
  });
});

it("hands the words the devices draw themselves to the hand font", () => {
  const text = knowText({ scenes: SHOWS.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "", contactVoice: "" });
  for (const w of Object.values(HEALTH_WORDS)) expect(text).toContain(w);
});

describe("ปากกาพล็อตเตอร์ and อินโฟกราฟิก (infoShow)", () => {
  const LAYOUTS = ["split", "limit", "room", "overflow", "waiting", "cashless", "groupgap", "agecost"] as const;
  const draw = (show: KnowShow, t = 6, size: VideoSize = "portrait", art: Partial<StoryVideoInput> = { art: "plot" }) => {
    const out = infoShow(show, ctx(size, art), t);
    return out === null ? "" : renderToStaticMarkup(out);
  };

  it("draws every health layout in every size in the plotter look", () => {
    for (const layout of LAYOUTS) for (const size of SIZES) {
      expect(infoShow(show(layout), ctx(size, { art: "plot" }), 3), `${layout} ${size}`).not.toBeNull();
      expect(draw(show(layout), 3, size).length, `${layout} ${size}`).toBeGreaterThan(200);
    }
  });

  it("draws each show in plot and info, in every size, at the start, the middle and the end, with no NaN and no shared id", () => {
    for (const x of SHOWS) for (const size of SIZES) for (const art of [{ art: "plot" }, { art: "info" }] as Partial<StoryVideoInput>[]) for (const t of [0, 2, 6]) {
      const out = draw(x, t, size, art);
      expect(out, `${x.layout} ${size} ${art.art} ${t}`).not.toContain("NaN");
      expect(out).not.toMatch(/ id="/);
    }
  });

  it("says what the paper says: the figures, and never a negative one", () => {
    const say = (x: KnowShow) => words(draw(x));
    for (const w of ["เหมาจ่าย", "แยกจ่าย", "ห้อง", "ผ่าตัด", "จ่ายตามจริง", "ตัวอย่าง ตามเงื่อนไขแต่ละแผน"]) expect(say(show("split"))).toContain(w);
    for (const w of ["5,000,000", "ต่อปี", "325,000", "4,675,000", "iHealthy Silver"]) expect(say(show("limit"))).toContain(w);
    expect(say(show("limit", 1))).not.toContain("ใช้ไป");
    expect(say({ layout: "limit", title: ["วงเงิน", ""], limit: 1_000_000, used: 1_200_000, planName: "iHealthy Smart" })).toContain("ใช้ครบวงเงินแล้ว");
    for (const w of ["6,000", "4,000", "2,000", "จ่ายเองต่อคืน"]) expect(say(show("room"))).toContain(w);
    expect(say({ layout: "room", title: ["ค่าห้อง", ""], real: 1200, plan: 1500, planName: "iHealthy Smart" })).toContain("แผนนี้จ่ายพอ");
    expect(say(show("room", 1))).toContain("ค่าห้อง รพ. เอกชนมักเกินวงเงินของแผนเล็ก");
    for (const w of ["300,000", "200,000", "100,000", "จ่ายเอง", "วงเงิน"]) expect(say(show("overflow"))).toContain(w);
    expect(say({ layout: "overflow", title: ["บิล", ""], bill: 150_000, limit: 200_000 })).toContain("อยู่ในวงเงินต่อปี");
    expect(say({ layout: "overflow", title: ["บิล", ""], bill: 150_000, limit: 200_000 })).not.toContain("แผนนี้จ่ายพอ");
    for (const bill of [300_000, 150_000]) for (const art of [{ art: "plot" }, { art: "info" }] as Partial<StoryVideoInput>[]) {
      expect(words(draw({ layout: "overflow", title: ["บิล", ""], bill, limit: 200_000 }, 6, "portrait", art)), `${art.art} ${bill}`).toContain("ตัวอย่าง ตามเงื่อนไข");
    }
    expect(say(show("overflow", 1))).toContain("เลือกวงเงินให้พอ");
    for (const w of ["วันนี้", "อุบัติเหตุ", "120 วัน", "บางโรค", "ตามเงื่อนไขของแต่ละแผน"]) expect(say(show("waiting"))).toContain(w);
    expect(say({ layout: "waiting", title: ["ระยะรอคอย", ""], rows: [] })).toContain("ตามเงื่อนไขของแต่ละแผน");
    for (const w of ["รพ. ในเครือ", "ตามเงื่อนไขการเคลม"]) expect(say(show("cashless"))).toContain(w);
    for (const w of ["ค่ารักษาจริง", "325,000", "ประกันกลุ่มจ่าย", "50,000", "ขาดอีก", "275,000"]) expect(say(show("groupgap"))).toContain(w);
    expect(say({ layout: "groupgap", title: ["ประกันกลุ่ม", ""], bill: 40_000, group: 50_000 })).toContain("ประกันกลุ่มจ่ายพอ");
    expect(say(show("groupgap", 1))).toContain("ประกันกลุ่มอาจไม่พอ");
    for (const w of ["30 ปี", "60 ปี", "18,000", "61,000", "เบี้ยสัญญาเพิ่มเติมสุขภาพต่อปี ไม่รวมสัญญาหลัก"]) expect(say(show("agecost"))).toContain(w);
    const one = say(show("agecost", 1));
    expect(one).toContain("เบี้ยสุขภาพ");
    expect(one).not.toContain("35 ปี");
    for (const x of SHOWS) expect(words(draw(x)), x.layout).not.toMatch(/-\d/);
  });

  it("writes each piece with the pen: before its moment nothing of the device shows", () => {
    // at the very start only the pieces that begin at once could show; a figure written later is hidden
    expect(draw(show("groupgap"), 0)).toContain("opacity:0");
  });
});

describe("negative figures (a clamp shared by every look)", () => {
  const BAD: KnowShow[] = [
    { layout: "limit", title: ["วงเงิน", ""], limit: -5, used: -3, planName: "x" },
    { layout: "room", title: ["ห้อง", ""], plan: -4000, real: -100, planName: "x" },
    { layout: "overflow", title: ["บิล", ""], bill: -300, limit: 200 },
    { layout: "groupgap", title: ["กลุ่ม", ""], bill: 300, group: -50 },
    { layout: "agecost", title: ["เบี้ย", ""], rows: [{ age: 30, annual: -10 }, { age: 40, annual: 20 }], source: "x" },
  ];
  it("never shows a negative number, in paper or plot", () => {
    for (const x of BAD) for (const size of SIZES) {
      expect(words(html(x, 6, size)), `${x.layout} paper`).not.toMatch(/-\d/);
      const plotted = infoShow(x, ctx(size, { art: "plot" }), 6);
      expect(words(renderToStaticMarkup(plotted)), `${x.layout} plot`).not.toMatch(/-\d/);
    }
  });
});

describe("Task 12 fit fixes", () => {
  it("split in plot and info: four items fit their card under its heading in every shape", async () => {
    const { splitRows } = await import("@/lib/quote-video/story-info-motion");
    for (const size of SIZES) {
      const r = splitRows(size);
      expect(r.need, size).toBeLessThanOrEqual(r.room);
    }
  });

  it("overflow on paper: the limit's own figure under its word, apart from the bill's", () => {
    for (const size of SIZES) for (const art of ARTS) {
      const say = words(html({ layout: "overflow", title: ["บิล", ""], bill: 300_000, limit: 250_000 }, 6, size, art));
      expect(say, `${size} ${art.art}`).toMatch(/วงเงิน\s+250,000\s+(?!บาท)/);
      const within = words(html({ layout: "overflow", title: ["บิล", ""], bill: 150_000, limit: 200_000 }, 6, size, art));
      expect(within, `${size} ${art.art}`).toMatch(/วงเงิน\s+200,000\s+(?!บาท)/);
    }
  });

  it("a health device's words-only card in plot shows its own icon, not the episode's", async () => {
    const { iconOf } = await import("@/lib/quote-video/story-info-motion");
    expect(iconOf("groupins", "knowThree", { layout: "groupgap", title: ["ประกันกลุ่ม", ""] })).toBe("briefcase");
    expect(iconOf("groupins", "knowThree", { layout: "note", title: ["x", ""], note: [] } as unknown as KnowShow)).toBe("warn");
  });

  it("waiting: the card sits below the tallest label, a long two-word label too, in every shape and look", async () => {
    const { wrapLines, waitingGeo } = await import("@/lib/quote-video/story-health-motion");
    const { waitingInfoGeo } = await import("@/lib/quote-video/story-info-motion");
    const GEOS = { portrait: { text: 46, dev: { x: 90, y: 440, w: 900, h: 900 } }, square: { text: 32, dev: { x: 90, y: 225, w: 900, h: 580 } }, landscape: { text: 38, dev: { x: 240, y: 230, w: 1440, h: 580 } } };
    const rows = [{ at: "วันนี้", label: "กรมธรรม์มีผลบังคับ ตั้งแต่วันแรก" }, { at: "30 วัน", label: "ป่วยทั่วไป" }, { at: "120 วัน", label: "โรคบางโรค ตามที่ระบุไว้" }];
    for (const size of SIZES) {
      for (const geo of [waitingGeo(size, GEOS[size], rows), waitingInfoGeo(size, rows)]) {
        expect(geo.lines, size).toBeGreaterThanOrEqual(2);
        expect(geo.cardY, size).toBeGreaterThan(geo.labelBottom);
        expect(geo.labelBottom, size).toBe(geo.ly + Math.round(geo.dot / 2) + geo.margin + Math.ceil(geo.lines * geo.labelSize * 1.3));
      }
    }
    expect(wrapLines("ป่วยทั่วไป", 40, 300)).toBe(1);
    expect(wrapLines("กรมธรรม์มีผลบังคับ ตั้งแต่วันแรก", 40, 500)).toBe(2);
  });
});

it("split: a long เหมาจ่าย line wraps at its spaces in a readable size, in every look and shape", () => {
  const long: KnowShow = { layout: "split", title: ["เหมาจ่าย", "ต่างจากแยกจ่าย"], parts: ["ค่ายา", "ค่าผ่าตัด", "ค่าแพทย์", "ค่าตรวจ"], whole: "จ่ายตามจริง ภายใน วงเงินต่อปี" };
  const sizeOf = (markup: string) => Number(markup.match(/font-size:(\d+)px[^>]*>จ่ายตามจริง ภายใน วงเงินต่อปี</)![1]);
  const FLOOR: Record<VideoSize, number> = { portrait: 36, square: 26, landscape: 28 };
  for (const size of SIZES) {
    for (const art of ARTS) expect(sizeOf(html(long, 6, size, art)), `${size} ${art.art}`).toBeGreaterThanOrEqual(FLOOR[size]);
    for (const art of [{ art: "plot" }, { art: "info" }] as Partial<StoryVideoInput>[]) {
      expect(sizeOf(renderToStaticMarkup(infoShow(long, ctx(size, art), 6))), `${size} ${art.art}`).toBeGreaterThanOrEqual(FLOOR[size]);
    }
  }
});
