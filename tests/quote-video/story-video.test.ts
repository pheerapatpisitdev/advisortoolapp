import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { videoPrice } from "@/lib/quote-video/make";
import { MOTION_FPS } from "@/lib/quote-video/motion";
import { clipKind } from "@/lib/quote-video/progress";
import { checkedStory, isStoryInput, storyCaption, storyFigure, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { noteLines, storyHandText, storyTitles, storyWindows } from "@/lib/quote-video/story-motion";
import { planScenes } from "@/lib/quote-video/timeline";
import { CROWD, CROWD_HERO, crowdOf, FACES, faceOf } from "@/lib/story/faces";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

const story = (over: Record<string, unknown> = {}): StoryVideoInput => {
  const s = checkedStory({ topic: "pool48", faces: { narrator: "w26", hero: "w15" }, ...over }, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};
const SHIELD = { plan: "ISHIELD", variant: "WLCI20", sex: "F", age: 35, sumAssured: 1_000_000 };

describe("คลิปเล่าเรื่อง's premium (story.ts storyFigure)", () => {
  it("is the plan's own rate table's, in whole baht", () => {
    expect(storyFigure(SHIELD)).toEqual({ ...SHIELD, annual: 33_800, monthly: 3_042 });
    // the mockup's figure: Life Protect, a woman of 35, 1 million, paid to 99
    expect(storyFigure({ plan: "LIFEPROTECT", variant: "WLF99H", sex: "F", age: 35, sumAssured: 1_000_000 })).toMatchObject({ annual: 14_200, monthly: 1_278 });
  });

  it("says what is wrong instead of guessing", () => {
    expect(storyFigure({ ...SHIELD, plan: "LEGACY" })).toBe("เลือกแบบประกัน");
    expect(storyFigure({ ...SHIELD, variant: "WLF19H" })).toBe("เลือกระยะชำระเบี้ย");
    expect(storyFigure({ ...SHIELD, sumAssured: 1_020_000 })).toMatch(/ทีละ 50,000/);
    expect(storyFigure({ ...SHIELD, sex: "X" })).toBe("เลือกเพศ");
  });
});

describe("คลิปเล่าเรื่อง's input (story.ts checkedStory)", () => {
  it("fills the defaults: the mockup's two faces, the crowd grey until covered, portrait", () => {
    expect(checkedStory({ topic: "pool48" }, "M")).toEqual({
      product: "STORY", topic: "pool48", narrator: "M", style: "story", length: "full", size: "portrait", palette: "reveal",
      faces: { narrator: "w26", hero: "w15" },
    });
  });

  it("works the premium out again, whatever the form sent", () => {
    const s = story({ figure: { ...SHIELD, annual: 1, monthly: 1 } });
    expect(s.figure).toMatchObject({ annual: 33_800, monthly: 3_042 });
  });

  it("refuses a story it cannot tell", () => {
    expect(checkedStory({ topic: "debt" as never }, "F")).toBe("เลือกเรื่อง");
    expect(checkedStory({ topic: "pool48", faces: { narrator: "w15", hero: "w15" } }, "F")).toMatch(/หน้าเดียวกัน/);
    expect(checkedStory({ topic: "pool48", figure: { ...SHIELD, age: 120 } }, "F")).toBe("ใส่อายุให้ถูกต้อง");
  });

  it("is told apart from a quote and an FHC summary", () => {
    expect(isStoryInput(story())).toBe(true);
    expect(isStoryInput({ product: "FHC" })).toBe(false);
    expect(clipKind(story())).toBe("story");
  });
});

describe("กองกลาง 48 คน's script (story.ts storyScript)", () => {
  it("is six scenes, the customer named where the mockup named them", () => {
    const lines = storyScript(story({ figure: SHIELD }), "นิด", "F");
    expect(lines.map((l) => l.key)).toEqual(["storyHook", "storyPool", "storyHit", "storyHelp", "storyAll", "storyContact"]);
    expect(lines[2].voice).toBe("วันหนึ่ง คนหนึ่งในนั้นป่วยเป็นโรคร้ายแรง และคนนั้นคือคุณนิดค่ะ");
    expect(lines[3].voice).toContain("ทั้งก้อน 1 ล้านบาท ทั้งที่หยอดไปแค่ปีละ 33,800 บาท");
    expect(lines[5].voice).toBe("อยากรู้ว่าคุณนิดต้องหยอดเท่าไร ทักมาได้เลยนะคะ");
  });

  it("tells only what the plan pays for: a life plan's money goes to the family", () => {
    const life = storyScript(story({ figure: { ...SHIELD, plan: "LIFEPROTECT", variant: "WLF99H" } }), "นิด", "F");
    expect(life[0].voice).toContain("จากไปไม่ทันตั้งตัว");
    expect(life[3].voice).toMatch(/^เงินในโหลไปถึงครอบครัวของคุณนิด/);
    // without a figure: an illness, and no premium spoken
    const plain = storyScript(story(), "", "F");
    expect(plain[0].voice).toContain("ป่วยหนัก");
    expect(plain.map((l) => l.voice).join(" ")).not.toMatch(/\d+,\d{3} บาท/);
    expect(plain[4].voice).toContain("แล้วคุณล่ะคะ");
  });

  it("ends a man's lines as a man says them", () => {
    const m = storyScript(story(), "", "M").map((l) => l.voice).join(" ");
    expect(m).not.toMatch(/ค่ะ|คะ(?=\s|$)/);
    expect(m).toContain("ทักมาได้เลยนะครับ");
  });
});

describe("กองกลาง 48 คน's crowd (lib/story/faces.ts)", () => {
  it("is 48 faces, the hero at their place, the narrator not among them, about half women", () => {
    const crowd = crowdOf("w15", "w26");
    expect(crowd).toHaveLength(CROWD);
    expect(new Set(crowd).size).toBe(CROWD);
    expect(crowd[CROWD_HERO]).toBe("w15");
    expect(crowd).not.toContain("w26");
    const women = crowd.filter((f) => faceOf(f)?.sex === "F").length;
    expect(women).toBeGreaterThanOrEqual(23);
    expect(women).toBeLessThanOrEqual(25);
  });

  it("is the same crowd every time for the same hero, so the form's preview and the clip agree", () => {
    expect(crowdOf("m09", "w26")).toEqual(crowdOf("m09", "w26"));
    expect(crowdOf("m09", "w26")).not.toEqual(crowdOf("w15", "w26"));
  });

  it("has every face's file, in colour and in grey", () => {
    for (const f of FACES) {
      expect(existsSync(join(process.cwd(), "public/story/faces", `${f.id}.jpg`)), f.id).toBe(true);
      expect(existsSync(join(process.cwd(), "public/story/faces", `${f.id}-g.jpg`)), f.id).toBe(true);
    }
  });
});

describe("กองกลาง 48 คน on screen (story-motion.tsx)", () => {
  it("draws a frame for every movement, in every shape", () => {
    for (const size of ["portrait", "square", "landscape"] as const) {
      const input = story({ size, figure: SHIELD });
      const plans = planScenes(storyScript(input, "นิด").map((s) => ({ ...s, voiceSec: 5, windows: storyWindows(s.key, input, size), fps: MOTION_FPS })));
      expect(plans).toHaveLength(6);
      for (const p of plans) {
        expect(p.frames.length).toBeGreaterThan(10);
        expect(TRANSITIONS[p.key]).toBeDefined();
      }
    }
  });

  it("writes the note only with a figure, and cuts the handwriting face to every title letter", () => {
    expect(noteLines(story())).toBeNull();
    expect(noteLines(story({ figure: SHIELD }))).toEqual(["หญิง 35 ปี · ทุน 1 ล้าน", "หยอดปีละ 33,800 บาท", "ตัวอย่างจาก iShield จ่าย 20 ปี"]);
    const hand = storyHandText(story({ figure: SHIELD }), "นิด");
    for (const t of Object.values(storyTitles(story({ figure: SHIELD }), "นิด")).flat()) for (const ch of t) expect(hand).toContain(ch);
  });

  it("goes up on a Page with no one's name in its caption", () => {
    const c = storyCaption(story({ figure: SHIELD }));
    expect(c).not.toContain("คุณนิด");
    expect(c).toContain("เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท");
  });
});

describe("คลิปเล่าเรื่อง's price", () => {
  it("is its own price on the owner's list, with ElevenLabs on top", () => {
    expect(videoPrice(story(), DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoStory);
    expect(videoPrice({ ...story(), voice: "x" }, DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoStory + DEFAULT_PRICES.elevenExtra);
  });
});
