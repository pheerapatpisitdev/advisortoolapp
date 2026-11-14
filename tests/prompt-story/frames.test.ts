import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPng } from "@/lib/content/poster-png";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { freeFrame, freeHandText, freeWindows, type FreeContext } from "@/lib/prompt-story/frames";
import type { DeviceScene, PromptScene, PromptStoryInput } from "@/lib/prompt-story/types";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { HEALTH_WORDS, LIFE_WORDS } from "@/lib/quote-video/story-knowledge";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";

const SIZE_LIST: VideoSize[] = ["portrait", "square", "landscape"];
/** the scene's picture is its own layer under the frames (make.ts freeParts); a frame only knows whether there is one */
const PIC = true;
const scene = (i: number, screen = "สั้นๆ นะคะ"): PromptScene => ({ voice: `เสียงที่ ${i} ค่ะ`, screen, picture: "a calm room", ...(i === 2 ? { showFigure: true } : {}) });
const figure = { plan: "LIFEPROTECT" as const, variant: "WLF99H", sex: "M" as const, age: 35, sumAssured: 1_000_000, annual: 24_000, monthly: 2_000 };
const input = (count: number, o: Partial<PromptStoryInput> = {}): PromptStoryInput => ({
  product: "FREESTORY", brief: "b", title: "ชื่อเรื่อง", caption: "c", style: "cartoon", painter: "standard", faces: { narrator: "w26" },
  scenes: Array.from({ length: count }, (_, i) => scene(i + 1)), figure, ...o,
});
const ctx = (i: PromptStoryInput, size: VideoSize): FreeContext => ({
  input: i, size, customer: "", narrator: "F", contact: { name: "เอก", phone: "081" }, crowd: [], faces: {}, words: ["เสียงที่", "1", "ค่ะ"], voiceSec: 6,
});

describe("freeFrame", () => {
  it("moves nothing between words, and fades between scenes", () => {
    expect(freeWindows()).toEqual([]);
    expect(TRANSITIONS.freeScene).toBeDefined();
  });

  for (const count of [3, 8]) {
    it(`draws a ${count}-scene input in every size`, () => {
      for (const size of SIZE_LIST) {
        const i = input(count);
        for (const s of i.scenes) {
          expect(freeFrame(s, PIC, ctx(i, size), 2)).toBeTruthy();
          expect(freeFrame(s, false, ctx(i, size), 2)).toBeTruthy();
        }
      }
    });
  }

  it("renders the longest allowed title and screen, with and without a picture", async () => {
    const title = "ก".repeat(28);
    const screen = "ข".repeat(40);
    const i = input(2, { title, scenes: [{ ...scene(1, screen), showFigure: true }, scene(2, screen)] });
    for (const size of SIZE_LIST) {
      const { w, h } = SIZES[size];
      for (const pic of [true, false]) {
        const png = await renderPng(freeFrame(i.scenes[0], pic, ctx(i, size), 3), { width: w, height: h }, { hand: freeHandText(i) });
        expect(png.length).toBeGreaterThan(1000);
      }
    }
  });

  it("draws the figure card in place of the figure scene's words", () => {
    const i = input(3, { scenes: [scene(1, "คำฉากหนึ่ง"), { ...scene(2, "ซ่อนฉากสอง"), showFigure: true }, scene(3, "คำฉากสาม")] });
    // what is drawn, leaving out the subtitles' context (which carries the whole input)
    const drawn = (el: unknown) => JSON.stringify(el, (k, v) => (k === "c" ? undefined : v));
    const f = drawn(freeFrame(i.scenes[1], true, ctx(i, "portrait"), 2));
    expect(f).toContain("ทุน");
    expect(f).not.toContain("ซ่อนฉากสอง");
    expect(freeHandText(i)).not.toContain("ซ่อนฉากสอง");
    // without a figure the card is not drawn, so the words stay
    const plain = input(3, { figure: undefined, scenes: [scene(1), { ...scene(2, "คำฉากสอง"), showFigure: true }, scene(3)] });
    expect(drawn(freeFrame(plain.scenes[1], true, ctx(plain, "portrait"), 2))).toContain("คำฉากสอง");
    expect(freeHandText(plain)).toContain("คำฉากสอง");
  });

  it("cuts the handwriting face to the title, every screen and the figure card", () => {
    const i = input(3, { title: "หัวเรื่องยาว", scenes: [scene(1, "คำที่หนึ่ง"), scene(2, "คำที่สอง"), scene(3, "คำที่สาม")] });
    const hand = freeHandText(i);
    for (const ch of [...i.title, ...i.scenes.flatMap((s) => [...s.screen]), ..."ชาย 35 ปี ทุน 1 ล้านเบี้ยปีละ 24,000 บาท"]) expect(hand).toContain(ch);
  });

  it("is transparent with no picture in it, and leaves the figure card to the showFigure scene", () => {
    const i = input(3);
    for (const pic of [true, false]) {
      const f = JSON.stringify(freeFrame(i.scenes[0], pic, ctx(i, "portrait"), 2));
      expect(f).not.toContain("<img");
      expect(f).not.toContain("\"img\"");
      expect(f).toContain("transparent");
    }
    expect(JSON.stringify(freeFrame(i.scenes[1], PIC, ctx(i, "portrait"), 2))).toContain("ทุน");
    expect(JSON.stringify(freeFrame(i.scenes[0], PIC, ctx(i, "portrait"), 2))).not.toContain("ทุน");
  });
});

/** every frame a clip without a device draws, in every style, size, picture or none, the figure scene with them */
function oldMarkup(): string {
  const styles: PromptStoryInput["style"][] = ["paper", "warm", "plot", "line", "real", "cartoon", "flat"];
  const out: string[] = [];
  for (const style of styles) for (const size of SIZE_LIST) for (const pic of [true, false]) {
    const i = input(3, { style, scenes: [scene(1, "คำฉากหนึ่ง"), { ...scene(2, "ฉากตัวเลข"), showFigure: true }, scene(3, "ไม่มีช่องว่างยาวมากมายเลยนะ")] });
    for (const s of i.scenes) for (const t of [0, 1.3, 4]) out.push(renderToStaticMarkup(freeFrame(s, pic, ctx(i, size), t)));
  }
  return createHash("sha256").update(out.join("\n")).digest("hex").slice(0, 16);
}

describe("freeFrame without a device", () => {
  it("draws the very markup it drew before devices", () => {
    expect(oldMarkup()).toBe("779bc72e21a996f6");
  });
});

/** a health device in place of a scene's picture (Task 11): drawn by the clip's own look */
const SPLIT: DeviceScene = { layout: "split", title: ["เหมาจ่าย", "ต่างจากแยกจ่ายยังไง"], parts: ["ห้อง", "ยา", "ผ่าตัด", "แพทย์"], whole: "จ่ายตามจริง" };
const LIMIT: DeviceScene = { layout: "limit", title: ["วงเงินต่อปี", "ใช้ไปเท่าไหร่"], limit: 5_000_000, used: 325_000, planName: "iHealthy Silver" };
const deviceScene = (device: DeviceScene, o: Partial<PromptScene> = {}): PromptScene => ({ voice: "เสียงอุปกรณ์ค่ะ", screen: "คำบนจอซ่อนไว้", picture: "", device, ...o });
const LOOKS: PromptStoryInput["style"][] = ["paper", "warm", "plot", "line"];
/** the words a frame shows, its tags and styles left out */
const shown = (markup: string) => markup.replace(/<[^>]+>/g, " ");

describe("freeFrame with a device", () => {
  it("draws the device's title and its words in every look and size, with no picture and no screen words", () => {
    for (const style of [...LOOKS, "real" as const]) for (const size of SIZE_LIST) for (const t of [0, 2, 6]) {
      const i = input(2, { style, scenes: [deviceScene(SPLIT), deviceScene(LIMIT)] });
      const html = renderToStaticMarkup(freeFrame(i.scenes[0], false, ctx(i, size), t));
      expect(html, `${style} ${size} ${t}`).not.toContain("<img");
      if (t < 6) continue;
      const out = shown(html);
      for (const w of ["เหมาจ่าย", "แยกจ่าย", "ผ่าตัด", "จ่ายตามจริง"]) expect(out, `${style} ${size}`).toContain(w);
      expect(out, `${style} ${size}`).not.toContain("คำบนจอซ่อนไว้");
      // the subtitle is the clip's own
      expect(out).toContain("เสียงที่");
      const lim = shown(renderToStaticMarkup(freeFrame(i.scenes[1], false, ctx(i, size), 6)));
      expect(lim, `${style} ${size}`).toContain("5,000,000");
    }
  });

  it("draws the device in its look: the paper's cut title, the pen's rail on the plotter's sheet", () => {
    const at = (style: PromptStoryInput["style"]) => {
      const i = input(1, { style, scenes: [deviceScene(SPLIT)] });
      return renderToStaticMarkup(freeFrame(i.scenes[0], false, ctx(i, "portrait"), 6));
    };
    expect(at("paper")).not.toBe(at("line"));
    expect(at("plot")).not.toBe(at("warm"));
    // the plotter writes a device as it writes a story clip's scene: its rail and carriage over the sheet
    expect(at("plot").length).toBeGreaterThan(at("line").length / 4);
    expect(at("plot")).toContain(STORY_CLIP_COLORS.plotRail);
  });

  it("draws every frame of the seven AI styles as it draws the retired plain styles, devices too", () => {
    // สไตล์ภาพ AI (spec 2026-11-14-ai-picture-styles-design): the plain paper band, no look of their own
    const AI: PromptStoryInput["style"][] = ["cartoon3d", "clay", "anime", "watercolor", "isometric", "collage", "pixel"];
    const all = (style: PromptStoryInput["style"]) => {
      const out: string[] = [];
      for (const size of SIZE_LIST) for (const pic of [true, false]) {
        const i = input(3, { style, scenes: [scene(1, "คำฉากหนึ่ง"), { ...scene(2, "ฉากตัวเลข"), showFigure: true }, deviceScene(SPLIT), deviceScene(LIMIT)] });
        for (const sc of i.scenes) for (const t of [0, 1.3, 6]) out.push(renderToStaticMarkup(freeFrame(sc, pic, ctx(i, size), t)));
      }
      return out.join("\n");
    };
    const plain = all("real");
    expect(all("cartoon")).toBe(plain);
    for (const style of AI) expect(all(style) === plain, style).toBe(true);
  });

  it("lets the device win over the figure card on a device scene, and keeps the card on a picture scene", () => {
    const i = input(2, { style: "paper", scenes: [deviceScene(SPLIT, { showFigure: true }), { ...scene(2, "คำฉากสอง"), showFigure: true }] });
    const dev = shown(renderToStaticMarkup(freeFrame(i.scenes[0], false, ctx(i, "portrait"), 6)));
    expect(dev).toContain("เหมาจ่าย");
    expect(dev).not.toContain("ทุน");
    const pic = shown(renderToStaticMarkup(freeFrame(i.scenes[1], true, ctx(i, "portrait"), 6)));
    expect(pic).toContain("ทุน");
    expect(pic).not.toContain("คำฉากสอง");
  });

  it("renders a device scene in satori in every look and size", async () => {
    for (const style of LOOKS) for (const size of SIZE_LIST) {
      const i = input(2, { style, scenes: [deviceScene(SPLIT), deviceScene(LIMIT)] });
      const { w, h } = SIZES[size];
      const png = await renderPng(freeFrame(i.scenes[1], false, ctx(i, size), 6), { width: w, height: h }, { hand: freeHandText(i) });
      expect(png.length, `${style} ${size}`).toBeGreaterThan(1000);
    }
  }, 60_000);
});

/** the ชีวิต ภาษี มรดก devices (round 2, Task 6): each drawn in a prompt clip, every look and size */
const LIFE: DeviceScene[] = [
  { layout: "lifeneed", title: ["ทุนชีวิต", "ควรมีเท่าไหร่"], debts: 2_000_000, expenses: 300_000, years: 15, education: 1_000_000, have: 1_500_000 },
  { layout: "beneficiary", title: ["ผู้รับประโยชน์", "ใครได้รับเงิน"], rows: [{ name: "ภรรยา", share: 60 }, { name: "ลูกคนเล็ก", share: 40 }] },
  { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"], sum: 1_000_000, note: "ใช้รักษาหรือทดแทนรายได้" },
  { layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"], monthly: 50_000, months: 6 },
  { layout: "taxback", title: ["ลดหย่อนภาษี", "ได้คืนเท่าไหร่"], premium: 60_000, bracket: 20 },
  { layout: "taxcap", title: ["เพดานลดหย่อน", "รวมทุกแบบ"] },
  { layout: "moneysplit", title: ["แบ่งเงินก้อน", "ให้คนในบ้าน"], total: 1_500_000, parts: [{ label: "ภรรยา", amount: 1_000_000 }, { label: "ลูก", amount: 500_000 }] },
  { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["รุ่นปู่ย่า", "รุ่นพ่อแม่", "รุ่นลูก"], note: "ส่งต่อเงินก้อนให้ลูกหลาน" },
];
/** the word each device draws once it is all in, beside its title */
const LIFE_SHOWN: Record<string, string> = {
  lifeneed: "2,000,000", beneficiary: "ลูกคนเล็ก", cilump: "1,000,000", incomestop: "50,000", taxback: "20%", taxcap: "100,000", moneysplit: "500,000", threegen: "รุ่นพ่อแม่",
};
const ALL_LOOKS: PromptStoryInput["style"][] = ["paper", "warm", "line", "plot", "board", "neon", "blueprint"];

describe("freeFrame with a ชีวิต ภาษี มรดก device", () => {
  it("draws each of the eight in every look and size: its title and words, no picture, no screen words", () => {
    for (const d of LIFE) for (const style of ALL_LOOKS) for (const size of SIZE_LIST) {
      const i = input(1, { style, scenes: [deviceScene(d)] });
      const at = (t: number) => renderToStaticMarkup(freeFrame(i.scenes[0], false, ctx(i, size), t));
      expect(at(0), `${d.layout} ${style} ${size}`).not.toContain("<img");
      const out = shown(at(12));
      for (const w of [d.title[0], LIFE_SHOWN[d.layout]]) expect(out, `${d.layout} ${style} ${size}: ${w}`).toContain(w);
      expect(out, `${d.layout} ${style} ${size}`).not.toContain("คำบนจอซ่อนไว้");
      expect(out).toContain("เสียงที่");
    }
  });

  it("renders each in satori, paper and one dark look, every size", async () => {
    for (const d of LIFE) for (const style of ["paper", "neon"] as const) for (const size of SIZE_LIST) {
      const i = input(1, { style, scenes: [deviceScene(d)] });
      const { w, h } = SIZES[size];
      const png = await renderPng(freeFrame(i.scenes[0], false, ctx(i, size), 12), { width: w, height: h }, { hand: freeHandText(i) });
      expect(png.length, `${d.layout} ${style} ${size}`).toBeGreaterThan(1000);
    }
  }, 120_000);

  it("cuts the hand face to each device's own words, the drawn fixed words and marks", () => {
    const i = input(LIFE.length, { scenes: LIFE.map((d) => deviceScene(d)) });
    const hand = freeHandText(i);
    for (const w of [...LIFE.flatMap((d) => d.title), "ลูกคนเล็ก", "รุ่นปู่ย่า", "ส่งต่อเงินก้อนให้ลูกหลาน", ...Object.values(LIFE_WORDS)]) expect(hand).toContain(w);
    expect(hand).not.toContain("คำบนจอซ่อนไว้");
  });
});

describe("freeHandText with a device", () => {
  it("cuts the face to every word a device draws: its fields, its own words, digits and บาท", () => {
    const i = input(3, { scenes: [scene(1, "คำที่หนึ่ง"), deviceScene(SPLIT), deviceScene(LIMIT, { screen: "อีกคำซ่อน" })] });
    const hand = freeHandText(i);
    for (const w of [...SPLIT.title, ...SPLIT.parts, SPLIT.whole, "iHealthy Silver", ...Object.values(HEALTH_WORDS), "0123456789,บาท", "คำที่หนึ่ง"]) expect(hand).toContain(w);
    // a device scene's screen words are not drawn
    expect(hand).not.toContain("คำบนจอซ่อนไว้");
    expect(hand).not.toContain("อีกคำซ่อน");
  });

  it("keeps the figure card's words while a device takes the figure scene", () => {
    const i = input(2, { scenes: [deviceScene(SPLIT, { showFigure: true }), scene(2, "คำฉากสอง")] });
    expect(freeHandText(i)).toContain("เบี้ยปีละ 24,000 บาท");
  });
});
