import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { deviceBody, figureLines, type FreeContext } from "@/lib/prompt-story/frames";
import { motionJoin, motionLayer } from "@/lib/prompt-story/motion/clip";
import { MotionSubtitle } from "@/lib/prompt-story/motion/chrome";
import { inout } from "@/lib/prompt-story/motion/ease";
import type { MotionLayout, PromptScene, PromptStoryInput } from "@/lib/prompt-story/types";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { XFADE, type VideoSize } from "@/lib/quote-video/timeline";
import { VIDEO_WORDS } from "@/lib/quote-video/video-words";

/**
 * โมชันกราฟิก's scene layers as StoryClip draws them (owner, 2026-11-26): the scenes of remotion/prepare's
 * st-free-motion block, each layer at three times of its scene.
 */

const BRIEF = "ลูกป่วยเป็นไข้เลือดออก นอนโรงพยาบาล 5 วัน ค่ารักษา 68,000 บาท มีประกันสุขภาพวงเงินปีละ 5,000,000 บาท";
const HOOK: MotionLayout = { kind: "hook", lines: ["ลูกป่วยทีเดียว", "ค่ารักษา", "เท่าไหร่?"], key: 2, icon: "fever" };
const CARD: MotionLayout = { kind: "card", tag: "เคสจริงของลูกค้า", chips: ["ไข้เลือดออก", "นอน รพ. 5 วัน"] };
const NUMBER: MotionLayout = { kind: "number", value: 68000, unit: "บาท", tag: "ค่ารักษา 5 วัน", bill: "ใบแจ้งค่ารักษา" };
const COMPARE: MotionLayout = {
  kind: "compare", title: "ถ้าลูกป่วยแบบนี้",
  bad: { head: "ไม่มีแผนไว้", lines: ["ควักเงินเก็บ", "จ่ายเอง 68,000 บาท"] }, good: { head: "วางแผนไว้ก่อน", lines: ["เบิกตามแผน", "ที่ทำไว้"] },
};
const CHECK: MotionLayout = { kind: "check", lines: ["วางแผนไว้ก่อน", "ไม่ต้องห่วง"], ticks: ["เลือกแผนตามงบที่จ่ายไหว", "เลือกโรงพยาบาลที่ใช้ประจำ", "เริ่มได้ตั้งแต่ลูกยังเล็ก"], photo: true };
const SCENES: PromptScene[] = [
  { voice: "ลูกป่วยทีเดียว ค่ารักษาเท่าไหร่ เคยคิดไว้ไหมคะ", screen: "ลูกป่วยทีเดียว ค่ารักษาเท่าไหร่?", picture: "", motion: HOOK },
  { voice: "เคสจริงของลูกค้า ลูกเป็นไข้เลือดออก นอนโรงพยาบาล 5 วัน", screen: "เคสจริงของลูกค้า", picture: "เด็กนอนพักบนเตียงโรงพยาบาล แม่นั่งจับมือข้างเตียง", motion: CARD },
  { voice: "ค่ารักษา 5 วัน รวมแล้ว 68,000 บาท", screen: "ค่ารักษา 68,000 บาท", picture: "", motion: NUMBER },
  { voice: "ถ้าไม่มีแผนไว้ ต้องควักเงินเก็บจ่ายเอง แต่ถ้าวางแผนไว้ก่อน ก็เบิกตามแผนที่ทำไว้", screen: "ถ้าลูกป่วยแบบนี้", picture: "", motion: COMPARE },
  { voice: "วางแผนไว้ก่อน เลือกแผนตามงบ เลือกโรงพยาบาลที่ใช้ประจำ เริ่มได้ตั้งแต่ลูกยังเล็ก", screen: "วางแผนไว้ก่อน ไม่ต้องห่วง", picture: "แม่กอดลูกยิ้มอยู่ในบ้าน แสงอบอุ่น", motion: CHECK },
  {
    voice: "วงเงินปีละ 5,000,000 บาท ใช้ไป 68,000 บาท ยังเหลืออีกมากค่ะ", screen: "", picture: "",
    device: { layout: "limit", title: ["วงเงินต่อปี", "ใช้ไปเท่าไหร่"], limit: 5_000_000, used: 68_000, planName: "iHealthy Silver" },
  },
];
/** each layout's words, every one of which its layer shows */
const WORDS: string[][] = [
  ["ลูกป่วยทีเดียว", "ค่ารักษา", "เท่าไหร่?"],
  ["เคสจริงของลูกค้า", "ไข้เลือดออก", "นอน รพ. 5 วัน"],
  ["ค่ารักษา 5 วัน", "บาท", "ใบแจ้งค่ารักษา", "รวม 68,000 บาท"],
  ["ถ้าลูกป่วยแบบนี้", "ไม่มีแผนไว้", "ควักเงินเก็บ", "จ่ายเอง 68,000 บาท", "วางแผนไว้ก่อน", "เบิกตามแผน", "ที่ทำไว้"],
  ["วางแผนไว้ก่อน", "ไม่ต้องห่วง", "เลือกแผนตามงบที่จ่ายไหว", "เลือกโรงพยาบาลที่ใช้ประจำ", "เริ่มได้ตั้งแต่ลูกยังเล็ก"],
];
const PICS = ["", "free/pic-0.jpg", "", "", "free/pic-1.jpg", ""];
const CLOSE = "สนใจรายละเอียดเพิ่มเติม ทักมาได้เลยนะคะ";
const CONTACT = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
const input: PromptStoryInput = {
  product: "FREESTORY", brief: BRIEF, title: "ลูกป่วยทีเดียว", caption: "", style: "cartoon3d", design: "motion", painter: "sharp",
  size: "portrait", narrator: "F", faces: { narrator: "w26" }, scenes: SCENES,
};
const DUR = 5;
const ctx = (size: VideoSize, voice: string, i: PromptStoryInput = input): StoryContext => ({
  // StoryClip's: the input in its look (frames.tsx freeLook)
  input: { ...i, art: "motion" } as unknown as StoryContext["input"], size, customer: "", narrator: "F", contact: CONTACT,
  crowd: [], faces: {}, words: voice.split(" ").filter(Boolean), voiceSec: 3,
});
const sub = (voice: string, size: VideoSize, t: number) => renderToStaticMarkup(<MotionSubtitle words={voice.split(" ").filter(Boolean)} voiceSec={3} size={size} t={t} />);
const layer = (s: number, size: VideoSize, t: number, extra: { figure?: ReturnType<typeof figureLines>; i?: PromptStoryInput } = {}) => {
  const i = extra.i ?? input;
  const scene = i.scenes[s];
  const c = ctx(size, scene.voice, i);
  const device = scene.device ? deviceBody(scene.device, c as unknown as FreeContext, t) : undefined;
  return renderToStaticMarkup(motionLayer({ scene, c, t, dur: DUR, picture: PICS[s] || undefined, figure: extra.figure ?? null, device }));
};

describe("a โมชันกราฟิก scene's layer", () => {
  for (const size of ["portrait", "landscape"] as const) {
    it(`draws each layout with its words and the voice's subtitle at three times (${size})`, () => {
      for (const t of [0.2, 1.6, DUR - 0.6]) {
        WORDS.forEach((words, s) => {
          const html = layer(s, size, t);
          for (const w of words) expect(html, `scene ${s + 1} at ${t}: ${w}`).toContain(`>${w}<`);
          expect(html, `scene ${s + 1} at ${t}`).toContain("font-family:Prompt");
          expect(html, `scene ${s + 1} at ${t}: subtitle`).toContain(sub(SCENES[s].voice, size, t));
        });
      }
    });
  }

  it("lays the scene's picture where its layout shows one, and nowhere else", () => {
    expect(layer(1, "portrait", 2)).toContain('src="free/pic-0.jpg"');
    expect(layer(4, "portrait", 2)).toContain('src="free/pic-1.jpg"');
    for (const s of [0, 2, 3]) expect(layer(s, "portrait", 2)).not.toContain("<img");
  });

  it("counts the big number up from nothing", () => {
    expect(layer(2, "portrait", 0.2)).toContain(">0<");
    expect(layer(2, "portrait", DUR - 0.6)).toContain(">68,000<");
  });

  it("draws a device scene in the look with its own title and the voice's subtitle", () => {
    for (const t of [0.2, 1.6, DUR - 0.6]) {
      const html = layer(5, "portrait", t);
      expect(html).toContain("วงเงินต่อปี");
      expect(html).toContain("font-family:Prompt");
      expect(html).toContain(sub(SCENES[5].voice, "portrait", t));
      // a device is drawn by the system: no picture
      expect(html).not.toContain("<img");
    }
  });

  it("lays a library part's picture in the middle of the frame, under the voice's subtitle", () => {
    const part: PromptScene = { voice: "แผนที่ดูแล ทั้งครอบครัว", screen: "ภาพจากคลัง", picture: "", asset: "up-1" };
    const c = ctx("portrait", part.voice);
    const html = renderToStaticMarkup(motionLayer({ scene: part, c, t: 1, dur: DUR, picture: "free/part.png", figure: null }));
    expect(html).toContain('src="free/part.png"');
    expect(html).toContain("object-fit:contain");
    expect(html).toContain(sub(part.voice, "portrait", 1));
    // the part is the whole scene: no layout drawn over it
    expect(html).not.toContain(">ภาพจากคลัง<");
  });

  it("shows the plan's figure card on a figure scene", () => {
    const withFig: PromptStoryInput = {
      ...input, figure: { plan: "LIFEPROTECT", variant: "WLF19H", sex: "F", age: 35, sumAssured: 1_000_000, annual: 25_000, monthly: 2_200 },
      scenes: SCENES.map((s, i) => (i === 2 ? { ...s, showFigure: true } : s)),
    };
    const figure = figureLines(withFig);
    const html = layer(2, "portrait", 2, { figure, i: withFig });
    for (const l of figure!) expect(html).toContain(l.text);
    expect(html).not.toContain("ใบแจ้งค่ารักษา");
  });

  it("closes with the agent's card and the voice's subtitle", () => {
    for (const size of ["portrait", "square", "landscape"] as const) {
      const c = ctx(size, CLOSE);
      const html = renderToStaticMarkup(motionLayer({ scene: null, c, t: 2, dur: 4, figure: null }));
      expect(html).toContain(CONTACT.name);
      expect(html).toContain(VIDEO_WORDS.th.contactMore);
      expect(html).toContain(sub(CLOSE, size, 2));
    }
  });

  it("is a frame-sized box in Prompt", () => {
    const html = layer(0, "landscape", 1);
    expect(html).toMatch(/^<div style="display:flex;position:relative;width:1920px;height:1080px;overflow:hidden;font-family:Prompt/);
  });
});

describe("a join between two โมชันกราฟิก scenes", () => {
  it("uncovers the incoming scene left to right behind the gold edge", () => {
    for (const t of [0, 0.1, 0.25, 0.4]) {
      const e = inout(t / XFADE);
      expect(motionJoin(1, t, 10 + t, undefined)).toEqual({ style: { clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` }, wipe: e });
    }
  });

  it("slides the outgoing scene a little to the left as the next comes in", () => {
    for (const T of [4, 4.2, 4.5, 4.9]) {
      expect(motionJoin(0, T, T, 4)).toEqual({ style: { transform: `translateX(${-12 * inout((T - 4) / XFADE)}%)` } });
    }
  });

  it("leaves the first scene's opening and a scene's middle alone", () => {
    expect(motionJoin(0, 0.1, 0.1, 5)).toEqual({ style: {} });
    expect(motionJoin(2, 2, 12, 15)).toEqual({ style: {} });
    expect(motionJoin(3, 2, 20, undefined)).toEqual({ style: {} });
  });
});
