import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import claims from "../../data/claims/admission-criteria.json";
import contract from "../../data/riders/ihealthy-ultra-contract.json";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { videoPrice } from "@/lib/quote-video/make";
import { MOTION_FPS } from "@/lib/quote-video/motion";
import { clipKind } from "@/lib/quote-video/progress";
import { checkedStory, isStoryInput, storyCaption, storyFigure, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { noteLines, storyHandText, storyTitles } from "@/lib/quote-video/story-motion";
import { clipFaces, clipHandText, clipWindows } from "@/lib/quote-video/story-frames";
import { planScenes } from "@/lib/quote-video/timeline";
import { BABY, CHILDREN, CROWD, CROWD_HERO, crowdOf, ELDERS, FACES, faceOf, familyOf, GRANDMAS, GRANDPAS, KIDS } from "@/lib/story/faces";
import { figureShown, STORY_TOPICS, topicOf } from "@/lib/story/topics";
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
    for (const f of [...FACES, ...[...KIDS, BABY, ...ELDERS].map((id) => ({ id }))]) {
      expect(existsSync(join(process.cwd(), "public/story/faces", `${f.id}.jpg`)), f.id).toBe(true);
      expect(existsSync(join(process.cwd(), "public/story/faces", `${f.id}-g.jpg`)), f.id).toBe(true);
    }
  });
});

describe("กองกลาง 48 คน on screen (story-motion.tsx)", () => {
  it("draws a frame for every movement, in every shape", () => {
    for (const size of ["portrait", "square", "landscape"] as const) {
      const input = story({ size, figure: SHIELD });
      const plans = planScenes(storyScript(input, "นิด").map((s) => ({ ...s, voiceSec: 5, windows: clipWindows(s.key, input, size), fps: MOTION_FPS })));
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

describe("ความรู้ประกัน 1 นาที (story-knowledge.ts)", () => {
  const episodes = STORY_TOPICS.filter((t) => t.shelf === "knowledge");

  it("is five episodes of six scenes, the agent's card last", () => {
    expect(episodes.map((t) => t.key)).toEqual(["sumvspremium", "declare", "mythclaim", "mythyoung", "mythjinx"]);
    for (const t of episodes) {
      expect(storyScript(story({ topic: t.key }), "นิด").map((l) => l.key)).toEqual(["knowAsk", "knowOne", "knowTwo", "knowThree", "knowRecap", "storyContact"]);
    }
  });

  it("shows ทุน กับ เบี้ย's example from the plan's table, and claims no figure without one", () => {
    const withFig = storyScript(story({ topic: "sumvspremium", figure: SHIELD }), "นิด");
    expect(withFig[3].voice).toBe("เช่น ผู้หญิงอายุ 35 จ่ายเบี้ยปีละ 33,800 บาท ได้ความคุ้มครองโรคร้ายแรง ทุน 1 ล้านบาทค่ะ");
    expect(withFig[5].voice).toBe("คุณนิด อยากรู้ว่าทุนเท่าไรถึงพอ ทักมาได้เลยนะคะ");
    const plain = storyScript(story({ topic: "sumvspremium" }), "").map((l) => l.voice).join(" ");
    expect(plain).not.toMatch(/\d/);
  });

  it("keeps a premium only where the episode shows one", () => {
    expect(story({ topic: "declare", figure: SHIELD }).figure).toBeUndefined();
    expect(story({ topic: "sumvspremium", ladder: true }).ladder).toBeUndefined();
    expect(story({ topic: "mythyoung", faces: { narrator: "w26", hero: "m23" }, ladder: true }).ladder).toEqual({
      sex: "M", rows: [{ age: 25, annual: 12_300 }, { age: 35, annual: 17_200 }, { age: 45, annual: 25_600 }],
    });
  });

  it("tells ยังหนุ่ม ไม่ต้องมี with the ladder's own figures, and to a woman as ยังสาว", () => {
    const man = storyScript(story({ topic: "mythyoung", faces: { narrator: "w26", hero: "m23" }, ladder: true }));
    expect(man[1].voice).toBe("ความจริงคือ ยิ่งเริ่มเร็ว เบี้ยยิ่งถูก ผู้ชายอายุ 25 จ่ายปีละ 12,300 บาท แต่ถ้ารอถึง 45 จ่ายปีละ 25,600 บาทค่ะ");
    const woman = story({ topic: "mythyoung", ladder: true });
    expect(woman.ladder?.sex).toBe("F");
    expect(clipHandText(woman, "")).toContain("“ยังสาว");
  });

  it("names no time limit for บอกล้างสัญญา: each policy has its own", () => {
    const lines = storyScript(story({ topic: "declare" })).map((l) => l.voice).join(" ");
    expect(lines).toContain("บริษัทมีสิทธิบอกล้างสัญญา");
    expect(lines).not.toMatch(/\d+ ?(ปี|เดือน|วัน)/);
  });

  it("draws in every shape, with the family's faces, and no child is ever the hero", () => {
    for (const t of episodes) for (const size of ["portrait", "square", "landscape"] as const) {
      const input = story({ topic: t.key, size });
      for (const s of storyScript(input)) {
        expect(TRANSITIONS[s.key]).toBeDefined();
        expect(clipWindows(s.key, input, size).length).toBeGreaterThan(0);
      }
    }
    expect(clipFaces(story({ topic: "mythjinx" }))).toEqual(expect.arrayContaining(["w15", "w26", ...CHILDREN]));
    expect(story({ topic: "declare", faces: { narrator: "w26", hero: "c01" } }).faces.hero).toBe("w15");
  });

  it("goes up on a Page with its own caption and no one's name", () => {
    for (const t of episodes) {
      const c = storyCaption(story({ topic: t.key }));
      expect(c).toContain("#ความรู้ประกัน");
      expect(c).not.toContain("คุณนิด");
    }
    expect(storyCaption(story({ topic: "mythyoung", ladder: true }))).toContain("ตัวอย่างจาก Life Protect");
  });
});

describe("เรื่องครอบครัว (story-family.ts)", () => {
  const episodes = STORY_TOPICS.filter((t) => t.shelf === "family");
  const LIFE = { plan: "LIFEPROTECT", variant: "WLF99H", sex: "M", age: 35, sumAssured: 3_000_000 };
  const dad = { narrator: "w26", hero: "m09" };

  it("is five episodes of six scenes, the agent's card last", () => {
    expect(episodes.map((t) => t.key)).toEqual(["pillar", "mompillar", "tuition", "prebaby", "eldercare"]);
    for (const t of episodes) {
      expect(storyScript(story({ topic: t.key }), "นิด").map((l) => l.key)).toEqual(["knowAsk", "knowOne", "knowTwo", "knowThree", "knowRecap", "storyContact"]);
    }
  });

  it("works เสาหลักหายไป's sum from the household's numbers, and the premium from the plan's table", () => {
    const s = story({ topic: "pillar", faces: dad, home: { monthly: 25_000, years: 10 }, figure: LIFE });
    expect(s.home).toEqual({ kind: "spend", monthly: 25_000, years: 10 });
    const lines = storyScript(s, "เอก").map((l) => l.voice);
    expect(lines[3]).toBe("ถ้าบ้านนี้ใช้เดือนละ 25,000 บาท และลูกยังต้องพึ่งอีก 10 ปี ครอบครัวต้องมีเงินราว 3 ล้านบาทค่ะ");
    expect(lines[4]).toBe("ประกันชีวิตทำหน้าที่แทนเสาหลัก เงินก้อนถึงมือครอบครัว เช่น ทุน 3 ล้านบาท ผู้ชายอายุ 35 จ่ายเบี้ยปีละ 51,600 บาทค่ะ");
  });

  it("claims no figure without the agent's numbers", () => {
    for (const t of episodes) {
      const lines = storyScript(story({ topic: t.key }), "").map((l) => l.voice).join(" ");
      expect(lines, t.key).not.toMatch(/\d{2},\d{3}|ล้านบาท|\d+ ปี/);
    }
  });

  it("counts ค่าเรียนลูก's years to a degree at 22", () => {
    const s = story({ topic: "tuition", home: { childAge: 6, tuition: 60_000 } });
    const lines = storyScript(s, "นิด").map((l) => l.voice);
    expect(lines[1]).toBe("กว่าจะเรียนจบปริญญาตรีตอนอายุ 22 ลูกยังต้องเรียนอีก 16 ปีค่ะ");
    expect(lines[2]).toBe("ถ้าค่าเรียนเฉลี่ยปีละ 60,000 บาท รวม 16 ปี เป็นเงิน 960,000 บาทค่ะ");
  });

  it("refuses numbers out of range, a plan the story does not pay on, and a father as แม่คือเสาหลักอีกต้น", () => {
    expect(checkedStory({ topic: "pillar", home: { monthly: 10, years: 10 } }, "F")).toMatch(/ค่าใช้จ่ายต่อเดือน/);
    expect(checkedStory({ topic: "tuition", home: { childAge: 22, tuition: 60_000 } }, "F")).toMatch(/อายุลูก/);
    expect(checkedStory({ topic: "pillar", figure: SHIELD }, "F")).toMatch(/Life Protect/);
    expect(checkedStory({ topic: "eldercare", figure: { ...LIFE, sex: "F" } }, "F")).toMatch(/iShield/);
    expect(checkedStory({ topic: "mompillar", faces: dad }, "F")).toMatch(/แม่/);
    // numbers are kept only where the story uses them
    expect(story({ topic: "prebaby", home: { monthly: 25_000, years: 10 } }).home).toBeUndefined();
  });

  it("takes a partner of the other sex, and none for a story without one", () => {
    expect(story({ topic: "pillar", faces: { ...dad, partner: "w40" } }).faces.partner).toBe("w40");
    expect(checkedStory({ topic: "pillar", faces: { ...dad, partner: "m14" } }, "F")).toMatch(/คู่ชีวิต/);
    expect(story({ topic: "declare", faces: { ...dad, partner: "w40" } }).faces.partner).toBeUndefined();
  });

  it("draws the same family for the same hero: children, the baby and grandparents from their own sheets", () => {
    const f = familyOf("w15");
    expect(f).toEqual(familyOf("w15"));
    expect(KIDS).toEqual(expect.arrayContaining(f.kids));
    expect(f.kids[0]).not.toBe(f.kids[1]);
    expect(GRANDPAS).toContain(f.grandpa);
    expect(GRANDMAS).toContain(f.grandma);
    expect(clipFaces(story({ topic: "eldercare" }))).toEqual(expect.arrayContaining([f.grandpa, f.grandma]));
    expect(clipFaces(story({ topic: "prebaby" }))).toContain(BABY);
  });

  it("draws in every shape, every letter in the handwriting face", () => {
    for (const t of episodes) for (const size of ["portrait", "square", "landscape"] as const) {
      const input = story({ topic: t.key, size });
      for (const s of storyScript(input)) {
        expect(TRANSITIONS[s.key]).toBeDefined();
        expect(clipWindows(s.key, input, size).length).toBeGreaterThan(0);
      }
    }
    expect(clipHandText(story({ topic: "tuition", home: { childAge: 6, tuition: 60_000 } }), "")).toContain("มหาวิทยาลัย");
    expect(clipHandText(story({ topic: "pillar" }), "")).toContain("ค่าเทอมลูก");
  });

  it("goes up on a Page with its own caption and no one's name", () => {
    for (const t of episodes) {
      const c = storyCaption(story({ topic: t.key }));
      expect(c).toContain("#ครอบครัว");
      expect(c).not.toContain("คุณนิด");
    }
  });
});

describe("หลังการขาย (story-after.ts)", () => {
  const after = STORY_TOPICS.filter((t) => t.shelf === "after");
  const SHIELD_BOUGHT = { plan: "ISHIELD", variant: "WLCI20", sex: "F", age: 35, sumAssured: 1_000_000 };
  const extra: Record<string, Record<string, unknown>> = {
    deliver: { figure: SHIELD_BOUGHT },
    remind: { due: { date: "2026-11-15", amount: 33_800 } },
    festival: { festival: "songkran" },
  };
  const clip = (topic: string, over: Record<string, unknown> = {}) => story({ topic, ...extra[topic], ...over });

  it("is three long clips of six scenes and three short ones of three, the agent's card last", () => {
    expect(after.map((t) => t.key)).toEqual(["deliver", "claimihu", "claimish", "remind", "birthday", "festival"]);
    for (const t of after) {
      const keys = storyScript(clip(t.key), "นิด").map((l) => l.key);
      expect(keys.length, t.key).toBe(t.short ? 3 : 6);
      expect(keys[keys.length - 1]).toBe("storyContact");
    }
  });

  it("hands over the policy only with the plan the customer bought, its cover from the plan's own table", () => {
    expect(checkedStory({ topic: "deliver" }, "F")).toBe("ใส่แบบที่ลูกค้าซื้อ");
    const lines = storyScript(clip("deliver"), "นิด").map((l) => l.voice);
    expect(lines[1]).toContain("ระยะเริ่มต้น 20 โรค จ่าย 25 เปอร์เซ็นต์ต่อโรค");
    expect(lines[2]).toBe("เบี้ยปีละ 33,800 บาท จ่าย 20 ปีค่ะ จ่ายให้ตรงเวลา ความคุ้มครองจะได้ต่อเนื่องนะคะ");
    expect(lines[3]).toContain("90 วัน");
    // Life Protect names the beneficiary instead of a waiting period
    const life = storyScript(clip("deliver", { figure: { plan: "LIFEPROTECT", variant: "WLF19H", sex: "F", age: 35, sumAssured: 2_000_000 } }), "นิด").map((l) => l.voice);
    expect(life[3]).toContain("ผู้รับประโยชน์");
    // the free-look period stays out until the owner confirms the company's days
    expect([...lines, ...life].join(" ")).not.toMatch(/ยกเลิก/);
  });

  it("tells iHealthy Ultra's claim in the contract's own days", () => {
    const lines = storyScript(clip("claimihu")).map((l) => l.voice).join(" ");
    expect(lines).toContain(`ภายใน ${contract.claimEvidenceDays} วัน บริษัทจ่ายภายใน ${contract.payoutDays} วัน`);
    expect(claims.timeline.steps.map((s) => s.when)).toEqual(["วันที่ 1", "30 วัน", "90 วัน", "120 วัน"]);
  });

  it("works iShield's payout from the customer's sum, and says it in shares without one", () => {
    const withSum = storyScript(clip("claimish", { figure: SHIELD_BOUGHT })).map((l) => l.voice);
    expect(withSum[2]).toBe("ถ้าทุน 1 ล้านบาท ระยะเริ่มต้นได้ 250,000 บาท ระยะรุนแรงได้สูงสุด 1 ล้านบาทค่ะ");
    expect(storyScript(clip("claimish")).map((l) => l.voice).join(" ")).not.toMatch(/\d{3},\d{3}/);
    expect(checkedStory({ topic: "claimish", figure: { ...SHIELD_BOUGHT, plan: "LIFEPROTECT", variant: "WLF19H" } }, "F")).toMatch(/iShield/);
  });

  it("reminds of the day in Thai, with the amount only when the agent gave one", () => {
    expect(storyScript(clip("remind"), "นิด")[0].voice).toBe("คุณนิดคะ เบี้ยประกันครบกำหนดวันที่ 15 พฤศจิกายน ยอด 33,800 บาทค่ะ");
    expect(storyScript(clip("remind", { due: { date: "2026-02-03" } }))[0].voice).toBe("เบี้ยประกันครบกำหนดวันที่ 3 กุมภาพันธ์ค่ะ");
    expect(checkedStory({ topic: "remind", due: { date: "2026-02-30" } }, "F")).toBe("ใส่วันครบกำหนดชำระเบี้ย");
    expect(checkedStory({ topic: "remind", due: { date: "2026-02-03", amount: -5 } }, "F")).toMatch(/ยอดเบี้ย/);
  });

  it("greets a festival from the agent's own face, and refuses one it does not know", () => {
    const s = clip("festival");
    expect(storyScript(s)[0].voice).toBe("สุขสันต์วันสงกรานต์ค่ะ");
    expect(clipFaces(s)).toContain("w26");
    expect(checkedStory({ topic: "festival", festival: "halloween" }, "F")).toBe("เลือกเทศกาล");
    expect(storyCaption(s)).toContain("#สงกรานต์");
  });

  it("prices the short clips as short, the rest as a story", () => {
    expect(videoPrice(clip("birthday"), DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoStoryShort);
    expect(videoPrice(clip("claimihu"), DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoStory);
  });

  it("draws in every shape, every letter in the handwriting face", () => {
    for (const t of after) for (const size of ["portrait", "square", "landscape"] as const) {
      const input = clip(t.key, { size });
      for (const s of storyScript(input)) {
        expect(TRANSITIONS[s.key]).toBeDefined();
        expect(clipWindows(s.key, input, size).length).toBeGreaterThan(0);
      }
    }
    expect(clipHandText(clip("remind"), "")).toContain("15");
    expect(clipHandText(clip("claimihu"), "")).toContain("120 วัน");
  });
});

describe("ตอบข้อโต้แย้ง (story-objection.ts)", () => {
  const episodes = STORY_TOPICS.filter((t) => t.shelf === "objection");
  const LIFE30 = { plan: "LIFEPROTECT", variant: "WLF99H", sex: "M", age: 30, sumAssured: 1_000_000 };
  const SHIELD25 = { plan: "ISHIELD", variant: "WLCI20", sex: "F", age: 25, sumAssured: 500_000 };

  it("is five episodes of six scenes, the agent's card last", () => {
    expect(episodes.map((t) => t.key)).toEqual(["thinkfirst", "groupins", "welfare", "bank", "pricey"]);
    for (const t of episodes) {
      expect(storyScript(story({ topic: t.key }), "นิด").map((l) => l.key)).toEqual(["knowAsk", "knowOne", "knowTwo", "knowThree", "knowRecap", "storyContact"]);
    }
  });

  it("shows the plans' own premiums in the scene the form names", () => {
    const bank = storyScript(story({ topic: "bank", figure: LIFE30 })).map((l) => l.voice);
    expect(bank[1]).toBe("ถ้าฝากธนาคารปีละ 14,400 บาท ครบปีแรกเราจะมีเงิน 14,400 บาท กับดอกเบี้ยอีกเล็กน้อยค่ะ");
    expect(bank[2]).toContain("ทุน 1 ล้านบาท");
    const pricey = storyScript(story({ topic: "pricey", figure: LIFE30 })).map((l) => l.voice);
    expect(pricey[1]).toBe("ผู้ชายอายุ 30 ทุนชีวิต 1 ล้านบาท จ่ายเดือนละ 1,296 บาท เฉลี่ยวันละราว 39 บาทค่ะ");
    const welfare = storyScript(story({ topic: "welfare", figure: SHIELD25 })).map((l) => l.voice);
    expect(welfare[3]).toContain("ผู้หญิงอายุ 25 จ่ายเบี้ยปีละ 13,870 บาท");
    const think = storyScript(story({ topic: "thinkfirst", faces: { narrator: "w26", hero: "m09" }, ladder: true })).map((l) => l.voice);
    expect(think[2]).toBe("ผู้ชายอายุ 25 จ่ายปีละ 12,300 บาท แต่ถ้ารอถึง 45 จ่ายปีละ 25,600 บาทค่ะ");
    for (const t of episodes) if (t.figure) expect(t.figureAt ?? 4, t.key).toBeGreaterThan(1);
  });

  it("claims no figure without the agent's numbers, and holds each story to the plan it tells of", () => {
    for (const t of episodes) {
      const lines = storyScript(story({ topic: t.key }), "").map((l) => l.voice).join(" ");
      expect(lines, t.key).not.toMatch(/\d{2},\d{3}|ล้านบาท/);
    }
    expect(checkedStory({ topic: "welfare", figure: LIFE30 }, "F")).toMatch(/iShield/);
    expect(checkedStory({ topic: "bank", figure: SHIELD25 }, "F")).toMatch(/Life Protect/);
    expect(story({ topic: "groupins", faces: { narrator: "w26", hero: "m09", partner: "w40" } }).faces.partner).toBeUndefined();
  });

  it("draws in every shape, every letter in the handwriting face", () => {
    for (const t of episodes) for (const size of ["portrait", "square", "landscape"] as const) {
      const input = story({ topic: t.key, size, ...(t.key === "bank" ? { figure: LIFE30 } : {}) });
      for (const s of storyScript(input)) {
        expect(TRANSITIONS[s.key]).toBeDefined();
        expect(clipWindows(s.key, input, size).length).toBeGreaterThan(0);
      }
    }
    expect(clipHandText(story({ topic: "groupins" }), "")).toContain("ลาออก");
  });

  it("goes up on a Page with its own caption and no one's name", () => {
    for (const t of episodes) {
      const c = storyCaption(story({ topic: t.key }));
      expect(c).toContain("#ตอบข้อสงสัย");
      expect(c).not.toContain("คุณนิด");
    }
    expect(storyCaption(story({ topic: "bank", figure: LIFE30 }))).toContain("ตัวอย่างจาก Life Protect");
  });
});

describe("ช่วงชีวิต (story-life.ts)", () => {
  const episodes = STORY_TOPICS.filter((t) => t.shelf === "life");
  const LIFE = { plan: "LIFEPROTECT", variant: "WLF99H", sex: "M", age: 35, sumAssured: 3_000_000 };
  const dad = { narrator: "w26", hero: "m09" };
  const PENSION = { sex: "M", age: 45, annuityAge: 60, pay: "untilAnnuity", monthly: 10_000 };

  it("is five episodes of six scenes, the agent's card last", () => {
    expect(episodes.map((t) => t.key)).toEqual(["firstjob", "wedding", "mortgage", "selfemployed", "preretire"]);
    for (const t of episodes) {
      expect(storyScript(story({ topic: t.key }), "นิด").map((l) => l.key)).toEqual(["knowAsk", "knowOne", "knowTwo", "knowThree", "knowRecap", "storyContact"]);
    }
  });

  it("tells ผ่อนบ้าน from the home loan typed, and the premium from the plan's table", () => {
    const s = story({ topic: "mortgage", faces: dad, home: { debt: 2_800_000, years: 22 }, figure: LIFE });
    expect(s.home).toEqual({ kind: "loan", debt: 2_800_000, years: 22 });
    const lines = storyScript(s, "เอก").map((l) => l.voice);
    expect(lines[0]).toBe("บ้านหลังแรกของคุณเอก ยังมีหนี้อีก 2.8 ล้านบาท ต้องผ่อนอีก 22 ปีค่ะ");
    expect(lines[3]).toBe("เช่น ผู้ชายอายุ 35 จ่ายปีละ 51,600 บาท ทุน 3 ล้านบาท พอปิดหนี้บ้าน บ้านยังเป็นของครอบครัวค่ะ");
    expect(storyScript(story({ topic: "mortgage", faces: dad, home: { debt: 5_000_000, years: 22 }, figure: LIFE })).map((l) => l.voice)[3]).toContain("ส่วนใหญ่");
  });

  it("prices ใกล้เกษียณ's pension on บำนาญ 95's engine, and counts the years from when it starts", () => {
    const s = story({ topic: "preretire", faces: dad, pension: PENSION, home: { monthly: 20_000 } });
    expect(s.pension).toMatchObject({ sex: "M", age: 45, annuityAge: 60, pay: "untilAnnuity", payYears: 15 });
    expect(s.pension!.monthlyPension).toBeGreaterThanOrEqual(9_900);
    expect(s.pension!.annual).toBeGreaterThan(0);
    const lines = storyScript(s).map((l) => l.voice);
    expect(lines[1]).toBe("อายุ 60 เกษียณ เงินเดือนหยุด แต่ถ้าอยู่ถึง 85 เรายังต้องใช้เงินอีก 25 ปีค่ะ");
    expect(lines[2]).toBe("ถ้าใช้เดือนละ 20,000 บาท 25 ปี ต้องมีเงิน 6 ล้านบาทค่ะ");
    expect(lines[3]).toContain(`ออมปีละ ${s.pension!.annual.toLocaleString("en-US")} บาท ตั้งแต่อายุ 60`);
    expect(storyCaption(s)).toContain("ตัวอย่างจาก บำนาญ สมาร์ท 95");
    const at65 = story({ topic: "preretire", pension: { ...PENSION, annuityAge: 65 } });
    expect(storyScript(at65).map((l) => l.voice)[1]).toContain("อีก 20 ปี");
  });

  it("refuses numbers out of range, a pension the engine will not price, and a plan the story does not pay on", () => {
    expect(checkedStory({ topic: "mortgage", home: { debt: 10, years: 22 } }, "F")).toMatch(/ยอดหนี้บ้าน/);
    expect(checkedStory({ topic: "mortgage", home: { debt: 2_800_000, years: 0 } }, "F")).toMatch(/ผ่อนอีก/);
    expect(checkedStory({ topic: "preretire", home: { monthly: 10 } }, "F")).toMatch(/หลังเกษียณ/);
    expect(checkedStory({ topic: "preretire", pension: { ...PENSION, age: 70 } }, "F")).toMatch(/อายุ/);
    expect(checkedStory({ topic: "preretire", pension: { ...PENSION, monthly: 0 } }, "F")).toMatch(/บำนาญต่อเดือน/);
    expect(checkedStory({ topic: "firstjob", figure: LIFE }, "F")).toMatch(/iShield/);
    expect(checkedStory({ topic: "wedding", figure: { ...LIFE, plan: "ISHIELD", variant: "WLCI20", sumAssured: 1_000_000 } }, "F")).toMatch(/Life Protect/);
    // numbers and a pension are kept only where the story uses them
    expect(story({ topic: "firstjob", home: { debt: 2_800_000, years: 22 } }).home).toBeUndefined();
    expect(story({ topic: "mortgage", pension: PENSION }).pension).toBeUndefined();
  });

  it("claims no premium without the agent's numbers", () => {
    for (const t of episodes) {
      const lines = storyScript(story({ topic: t.key }), "").map((l) => l.voice).join(" ");
      expect(lines, t.key).not.toMatch(/\d{2},\d{3}|ล้านบาท/);
    }
  });

  it("takes a partner of the other sex, and draws the hero's family", () => {
    expect(story({ topic: "wedding", faces: { ...dad, partner: "w40" } }).faces.partner).toBe("w40");
    expect(checkedStory({ topic: "wedding", faces: { ...dad, partner: "m14" } }, "F")).toMatch(/คู่ชีวิต/);
    expect(clipFaces(story({ topic: "mortgage", faces: dad }))).toEqual(expect.arrayContaining(familyOf("m09").kids));
  });

  it("draws in every shape, every letter in the handwriting face", () => {
    for (const t of episodes) for (const size of ["portrait", "square", "landscape"] as const) {
      const input = story({ topic: t.key, size, ...(t.key === "preretire" ? { pension: PENSION, home: { monthly: 20_000 } } : {}), ...(t.key === "mortgage" ? { home: { debt: 2_800_000, years: 22 } } : {}) });
      for (const s of storyScript(input)) {
        expect(TRANSITIONS[s.key]).toBeDefined();
        expect(clipWindows(s.key, input, size).length).toBeGreaterThan(0);
      }
    }
    expect(clipHandText(story({ topic: "mortgage", home: { debt: 2_800_000, years: 22 } }), "")).toContain("หนี้บ้าน");
  });

  it("goes up on a Page with its own caption and no one's name", () => {
    for (const t of episodes) {
      const c = storyCaption(story({ topic: t.key }));
      expect(c).toContain("#ช่วงชีวิต");
      expect(c).not.toContain("คุณนิด");
    }
  });
});

describe("the form's real figure (topics.ts figureShown)", () => {
  it("prices ส่งมอบกรมธรรม์'s plan without the ใส่ตัวเลขจริง switch it hides", () => {
    expect(figureShown(topicOf("deliver")!, false)).toBe(true);
  });
  it("prices other stories only when the switch is on, and never one with no figure", () => {
    expect(figureShown(topicOf("pool48")!, false)).toBe(false);
    expect(figureShown(topicOf("pool48")!, true)).toBe(true);
    expect(figureShown(topicOf("groupins")!, true)).toBe(false);
  });
});
