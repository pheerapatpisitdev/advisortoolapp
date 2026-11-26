import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { figureLines } from "@/lib/prompt-story/frames";
import { motionBody, type MotionCtx } from "@/lib/prompt-story/motion/layouts";
import { MotionSubtitle, motionBars, motionContact, motionWipe } from "@/lib/prompt-story/motion/chrome";
import { clamp, ease, inout, rise, spring } from "@/lib/prompt-story/motion/ease";
import { fitSize, letters } from "@/lib/prompt-story/motion/fit";
import { GEO } from "@/lib/prompt-story/motion/geo";
import { MOTION_ICONS, type MotionLayout, type PromptScene, type PromptStoryInput } from "@/lib/prompt-story/types";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";
import { VIDEO_WORDS } from "@/lib/quote-video/video-words";
import { LEAD, wordTimes, type VideoSize } from "@/lib/quote-video/timeline";

/** โมชันกราฟิก's layouts drawn as functions of scene time (owner, 2026-11-26, mockup ข round 2) */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const LAYOUTS: Record<MotionLayout["kind"], { m: MotionLayout; words: string[] }> = {
  hook: { m: { kind: "hook", lines: ["ลูกป่วยทีเดียว", "ค่ารักษา", "เท่าไหร่?"], key: 2, icon: "fever" }, words: ["ลูกป่วยทีเดียว", "ค่ารักษา", "เท่าไหร่?"] },
  card: { m: { kind: "card", tag: "เคสจริงของลูกค้า", chips: ["ไข้เลือดออก", "นอน รพ. 5 วัน"] }, words: ["เคสจริงของลูกค้า", "ไข้เลือดออก", "นอน รพ. 5 วัน"] },
  number: { m: { kind: "number", value: 68000, unit: "บาท", tag: "ค่ารักษา 5 วัน", bill: "ใบแจ้งค่ารักษา" }, words: ["ค่ารักษา 5 วัน", "บาท", "ใบแจ้งค่ารักษา", "68,000"] },
  compare: {
    m: { kind: "compare", title: "ถ้าลูกป่วยแบบนี้", bad: { head: "ไม่มีแผนไว้", lines: ["ควักเงินเก็บ", "จ่ายเอง 68,000 บาท"] }, good: { head: "วางแผนไว้ก่อน", lines: ["เบิกตามแผน", "ที่ทำไว้"] } },
    words: ["ถ้าลูกป่วยแบบนี้", "ไม่มีแผนไว้", "ควักเงินเก็บ", "จ่ายเอง 68,000 บาท", "วางแผนไว้ก่อน", "เบิกตามแผน", "ที่ทำไว้"],
  },
  check: {
    m: { kind: "check", lines: ["วางแผนไว้ก่อน", "ไม่ต้องห่วง"], ticks: ["เลือกแผนตามงบที่จ่ายไหว", "เลือกโรงพยาบาลที่ใช้ประจำ", "เริ่มได้ตั้งแต่ลูกยังเล็ก"], photo: true },
    words: ["วางแผนไว้ก่อน", "ไม่ต้องห่วง", "เลือกแผนตามงบที่จ่ายไหว", "เลือกโรงพยาบาลที่ใช้ประจำ", "เริ่มได้ตั้งแต่ลูกยังเล็ก"],
  },
  full: { m: { kind: "full", lines: ["ดูแลคนที่เรารัก", "ทุกวัน"], key: 1 }, words: ["ดูแลคนที่เรารัก", "ทุกวัน"] },
};
const PIC = "data:image/png;base64,iVBORw0KGgo=";
const scene = (m: MotionLayout, extra: Partial<PromptScene> = {}): PromptScene => ({ voice: "ทดสอบ เสียง", screen: "คำบนจอ", picture: "ภาพ", motion: m, ...extra });
const ctx = (size: VideoSize, extra: Partial<MotionCtx> = {}): MotionCtx => ({ size, dur: 4, picture: PIC, figure: null, ...extra });
const body = (m: MotionLayout, size: VideoSize, t: number, extra: Partial<MotionCtx> = {}) => renderToStaticMarkup(motionBody(scene(m), ctx(size, extra), t));
/** a line of exactly 22 letters (MOTION_LIMITS.line), no marks */
const LONG = "กขคงจฉชซฌญฎฏฐฑฒณดตถทธน";
const fontOf = (html: string, text: string) => Number(new RegExp(`font-size:(\\d+(?:\\.\\d+)?)px[^"]*"[^>]*>(?:<[^>]*>)*${text}<`).exec(html)?.[1] ?? NaN);

describe("โมชันกราฟิก's timing helpers", () => {
  it("eases as the mockup's", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.875);
    expect(inout(0.25)).toBeCloseTo(0.0625);
    expect(inout(0.75)).toBeCloseTo(0.9375);
    expect(spring(0)).toBe(0);
    expect(spring(-1)).toBe(0);
    expect(spring(3)).toBeCloseTo(1, 3);
  });

  it("rises from nothing, a little low and small, to its place", () => {
    expect(rise(0, 0.5).opacity).toBe(0);
    const done = rise(5, 0.5);
    expect(done.opacity).toBe(1);
    expect(done.transform).toBe("translateY(0px) scale(1)");
    expect(rise(0.5, 0.5, 40, 0.8).transform).toBe("translateY(40px) scale(0.8)");
  });
});

describe("fitting a line to its box", () => {
  it("counts the base letters, not Thai marks", () => {
    expect(letters("ค่ารักษา")).toBe(6);
    expect(letters("ที่")).toBe(1);
    expect(letters(LONG)).toBe(22);
  });

  it("shrinks a long line to its box and leaves a short one at its size", () => {
    const w = GEO.square.hook.head.w;
    expect(fitSize(LONG, w, 200)).toBeLessThanOrEqual(w / (22 * 0.62));
    expect(fitSize("ค่ารักษา", w, 60)).toBe(60);
  });

  it("keeps the longest line of a hook or a full screen inside its box in all three sizes", () => {
    for (const size of SIZES) {
      for (const kind of ["hook", "full"] as const) {
        const m: MotionLayout = kind === "hook" ? { kind, lines: ["สั้น", LONG], key: 1, icon: "home" } : { kind, lines: [LONG], key: 0 };
        const fs = fontOf(body(m, size, 3.4), LONG);
        expect(fs, `${kind} ${size}`).toBeGreaterThan(0);
        expect(fs * 22 * 0.62, `${kind} ${size}`).toBeLessThanOrEqual(GEO[size][kind].head.w);
      }
    }
  });
});

describe("motionBody", () => {
  it("draws every layout's words in Prompt, in all three sizes", () => {
    for (const size of SIZES) {
      for (const [kind, { m, words }] of Object.entries(LAYOUTS)) {
        const html = body(m, size, 4 - 0.6);
        expect(html, `${kind} ${size}`).toContain("font-family:Prompt");
        for (const w of words) expect(html, `${kind} ${size} ${w}`).toContain(w);
      }
    }
  });

  it("counts the big number up from nought", () => {
    const m = LAYOUTS.number.m;
    expect(body(m, "portrait", 0)).toContain(">0<");
    expect(body(m, "portrait", 0)).not.toContain("68,000<");
    expect(body(m, "portrait", 2.5)).toContain(">68,000<");
    // half way it is between the two, never a number of its own past the value
    const mid = Number(/>([\d,]+)<\/div>/.exec(body(m, "portrait", 0.9))?.[1].replace(/,/g, ""));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(68000);
  });

  it("sweeps the hook's key line with gold once it has risen", () => {
    const m = LAYOUTS.hook.m;
    for (const size of SIZES) {
      expect(body(m, size, 2), size).toContain(`background:${S.mgGold}`);
      expect(body(m, size, 0.2), size).not.toContain(`background:${S.mgGold}`);
    }
    // no key: no sweep
    expect(body({ ...m, key: -1 } as MotionLayout, "portrait", 3)).not.toContain(`background:${S.mgGold}`);
  });

  it("draws each of the six icons, stroke by stroke", () => {
    for (const icon of MOTION_ICONS) {
      const at = (t: number) => body({ kind: "hook", lines: ["หัวข้อ"], key: 0, icon }, "portrait", t);
      expect(at(0), icon).toContain('stroke-dashoffset="1"');
      expect(at(3), icon).toContain('stroke-dashoffset="0"');
      expect(at(3), icon).toContain(`stroke="${S.mgGold}"`);
      expect(at(3), icon).toContain(`stroke="${S.mgCoral}"`);
    }
  });

  it("lays the scene's picture in a card, a full screen and a check's photo, and none in a check without one", () => {
    expect(body(LAYOUTS.card.m, "portrait", 2)).toContain(PIC);
    expect(body(LAYOUTS.full.m, "portrait", 2)).toContain(PIC);
    expect(body(LAYOUTS.check.m, "portrait", 2)).toContain(PIC);
    expect(body({ ...LAYOUTS.check.m, photo: false } as MotionLayout, "portrait", 2)).not.toContain("<img");
    for (const kind of ["hook", "number", "compare"] as const) expect(body(LAYOUTS[kind].m, "portrait", 2), kind).not.toContain("<img");
    // the editor's preview, before anything is painted: no picture, nothing broken
    expect(body(LAYOUTS.card.m, "portrait", 2, { picture: undefined })).not.toContain("<img");
  });

  it("pushes a full screen's picture in from 1.06 to 1.16", () => {
    expect(body(LAYOUTS.full.m, "portrait", 0)).toContain("scale(1.06)");
    expect(body(LAYOUTS.full.m, "portrait", 4)).toContain("scale(1.16)");
  });

  it("draws the figure card in place of a showFigure scene's layout", () => {
    const input = { figure: { plan: "LIFEPROTECT", variant: "WLF19H", sex: "M", age: 35, sumAssured: 1_000_000, annual: 20000, monthly: 1700 } } as unknown as PromptStoryInput;
    const figure = figureLines(input)!;
    for (const size of SIZES) {
      const html = renderToStaticMarkup(motionBody(scene(LAYOUTS.hook.m, { showFigure: true }), ctx(size, { figure }), 3));
      for (const l of figure) expect(html, `${size} ${l.text}`).toContain(l.text);
      expect(html, size).not.toContain("ลูกป่วยทีเดียว");
      expect(html, size).toContain("font-family:Prompt");
    }
    // no figure to show: the layout as written
    expect(renderToStaticMarkup(motionBody(scene(LAYOUTS.hook.m, { showFigure: true }), ctx("portrait"), 3))).toContain("ลูกป่วยทีเดียว");
  });

  it("draws a scene the writer gave no layout as a full screen of its words", () => {
    const html = renderToStaticMarkup(motionBody({ voice: "ก ข", screen: "คำบนจอของฉาก", picture: "ภาพ" }, ctx("portrait"), 3));
    expect(html).toContain("คำบนจอของฉาก");
    expect(html).toContain(PIC);
  });

  it("is the frame's size and transparent outside its ground", () => {
    const html = body(LAYOUTS.hook.m, "landscape", 1);
    expect(html).toMatch(/^<div style="[^"]*width:1920px;height:1080px/);
    expect(html).not.toMatch(/^<div style="[^"]*background/);
  });
});

describe("the clip's chrome", () => {
  const words = ["ลูกป่วย", "ทีเดียว", "ค่ารักษา", "ไปเท่าไหร่"];
  const voiceSec = 3;
  const sub = (t: number, size: VideoSize = "portrait") => renderToStaticMarkup(<MotionSubtitle words={words} voiceSec={voiceSec} size={size} t={t} />);
  const lit = (html: string) => /background:#f2c75c[^>]*>([^<]+)</.exec(html)?.[1];

  it("lights the word being spoken on gold, the ones to come quieter", () => {
    const times = wordTimes(words.join(" "), voiceSec, LEAD);
    for (const size of SIZES) {
      for (const i of [1, 2]) {
        const t = (times[i].from + times[i].to) / 2;
        const html = sub(t, size);
        expect(lit(html), `${size} ${i}`).toBe(words[i]);
        expect(html).toContain("font-family:Prompt");
        expect(html).toContain(`background:${S.mgScrim}`);
        if (i < words.length - 1 && html.includes(words[i + 1])) expect(html).toMatch(new RegExp(`opacity:0.5[^>]*>${words[i + 1]}<`));
      }
    }
    // before the voice: nothing lit
    expect(lit(sub(0))).toBeUndefined();
  });

  it("shows the agent's card: name, phone, both lines, the kicker", () => {
    const contact = { name: "มินตรา ใจดี", phone: "089-123-4567", line: "@mintra.plan", more: "ตัวแทนประกันชีวิต\nใบอนุญาต 123" };
    const vw = VIDEO_WORDS.th;
    for (const size of SIZES) {
      const html = renderToStaticMarkup(motionContact({ contact, customer: "สมชาย", narrator: "M", size, t: 3 }));
      expect(html, size).toContain("มินตรา ใจดี");
      for (const l of vw.contactLines("M")) expect(html, size).toContain(l);
      expect(html, size).toContain(vw.contactFor("สมชาย"));
      expect(html, size).toContain("089-123-4567");
      expect(html, size).toContain("@mintra.plan");
      expect(html, size).toContain("ตัวแทนประกันชีวิต");
      expect(html, size).toContain("ใบอนุญาต 123");
      expect(html, size).toContain("Application by www.advisortool.app");
      expect(html, size).toContain("font-family:Prompt");
      // no photo: the initial
      expect(html, size).toContain(">ม<");
    }
    const withPhoto = renderToStaticMarkup(motionContact({ contact: { name: "ก", phone: "081", photo: PIC }, customer: "", narrator: "F", size: "portrait", t: 3 }));
    expect(withPhoto).toContain(`src="${PIC}"`);
    expect(withPhoto).toContain(vw.contactMore);
    for (const l of vw.contactLines("F")) expect(withPhoto).toContain(l);
  });

  it("fills the progress bar segment by segment", () => {
    const html = renderToStaticMarkup(motionBars({ size: "portrait", T: 4.5, starts: [0, 3.5, 7], durs: [4, 4, 4] }));
    const widths = [...html.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBe(100);
    expect(widths[1]).toBeGreaterThan(0);
    expect(widths[1]).toBeLessThan(100);
    expect(widths[2]).toBe(0);
    expect(html).toContain(`background:${S.mgGold}`);
  });

  it("draws the gold edge where the wipe has reached", () => {
    const html = renderToStaticMarkup(motionWipe({ x: 0.5, size: "landscape" }));
    expect(html).toContain(`background:${S.mgGold}`);
    expect(html).toContain("left:952.5px");
    expect(html).toContain("height:1080px");
  });
});

describe("a pure function of time", () => {
  it("never asks the browser to animate", () => {
    const all = [
      ...SIZES.flatMap((size) => Object.values(LAYOUTS).map(({ m }) => body(m, size, 1.3))),
      renderToStaticMarkup(<MotionSubtitle words={["ก", "ข"]} voiceSec={1} size="square" t={0.6} />),
      renderToStaticMarkup(motionContact({ contact: { name: "ก", phone: "081", line: "@x" }, customer: "", narrator: "F", size: "square", t: 2 })),
      renderToStaticMarkup(motionBars({ size: "square", T: 1, starts: [0, 3], durs: [3.5, 3] })),
      renderToStaticMarkup(motionWipe({ x: 0.3, size: "square" })),
    ];
    for (const html of all) {
      expect(html).not.toMatch(/animation/);
      expect(html).not.toMatch(/transition/);
    }
  });
});
