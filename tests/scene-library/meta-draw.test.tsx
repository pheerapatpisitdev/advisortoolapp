import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS as C } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { knowText, META_DEFAULTS, META_LIMITS, type KnowShow, type MetaShow } from "@/lib/quote-video/story-knowledge";
import { kspec, showBody } from "@/lib/quote-video/story-knowledge-motion";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import { metaGeo, pillarGeo } from "@/lib/quote-video/story-meta-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/** device round 3, Task 2: umbrella, housepillar, lifering and safetynet drawn in paper, warm and line */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
const ARTS: Partial<StoryVideoInput>[] = [{ art: "paper" }, { art: "minimal", ground: "warm" }, { art: "line" }];

const ctx = (size: VideoSize, art: Partial<StoryVideoInput> = { art: "paper" }): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, ...art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

/* the longest words a metaphor may carry (META_LIMITS): title lines 20, note 34, label / spare 12 */
const LONG_TITLE: [string, string] = ["ครอบครัวไม่ต้องเปียก", "ประกันคือร่มของบ้าน"];
const LONG_NOTE = "รายได้หลักของบ้าน ถ้าหายไปจะลำบาก";
/** a note with no space to break at: it shrinks onto one line */
const SOLID_NOTE = "เงินก้อนมาถึงมือตอนที่ต้องการที่สุด";
const LONG_WORD = "รายได้ของพ่อ";
const SPARE = "ทุนประกันสูง";
/** twelve letters that each take a full width: the widest a label or spare can be */
const WIDE_WORD = "มมมมมมมมมมมม";

const SHOWS: KnowShow[] = [
  /* 0 */ { layout: "umbrella", title: ["“ซื้อประกัน", "เหมือนแช่งตัวเอง”"], note: "พกร่ม ไม่ได้ทำให้ฝนตก" },
  /* 1 */ { layout: "umbrella", title: LONG_TITLE, note: LONG_NOTE },
  /* 2 */ { layout: "umbrella", title: ["ร่มกันฝน", ""] },
  /* 3 */ { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""], note: "รายได้หลักของบ้าน", label: "รายได้" },
  /* 4 */ { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""] },
  /* 5 */ { layout: "housepillar", title: LONG_TITLE, note: LONG_NOTE, label: LONG_WORD, spare: SPARE },
  /* 6 */ { layout: "housepillar", title: ["เสาหลัก", "ของบ้าน"], note: "ประกันคือเสาสำรอง", spare: "ประกันชีวิต" },
  /* 7 */ { layout: "housepillar", title: ["เสาหลัก", "ของบ้าน"], label: WIDE_WORD, spare: WIDE_WORD },
  /* 8 */ { layout: "lifering", title: ["ป่วยหนัก", "รายได้หายไปไหน?"], note: "เงินก้อนมาตอนที่ต้องการที่สุด" },
  /* 9 */ { layout: "lifering", title: LONG_TITLE, note: SOLID_NOTE },
  /* 10 */ { layout: "lifering", title: ["ห่วงชูชีพ", ""] },
  /* 11 */ { layout: "safetynet", title: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"], note: "ตาข่ายนี้ เราขึงเองได้" },
  /* 12 */ { layout: "safetynet", title: LONG_TITLE, note: LONG_NOTE },
  /* 13 */ { layout: "safetynet", title: ["ตาข่ายนิรภัย", ""] },
];

/** the moment every piece of a show is in: the end of its last movement */
const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
/** the middle of the trouble beat: the rain falling, the pillar shaking, the waves up, the slip */
const mid = (show: KnowShow) => { const x = kspec(show).trouble; return x.at + x.dur / 2; };
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const each = (fn: (size: VideoSize, art: Partial<StoryVideoInput>, label: string) => void) => {
  for (const size of SIZES) for (const art of ARTS) fn(size, art, `${size} ${art.art}`);
};

describe("the four metaphors draw", () => {
  it("in every look and size, from the start through the trouble to the end, with no NaN and no shared id", () => {
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) for (const t of [0, 0.8, mid(show), 1.5, 2.2, end(show), end(show) + 3]) {
      let out = "";
      const label = `${show.layout} ${size} ${art.art} ${t}`;
      expect(() => { out = html(show, t, size, art); }, label).not.toThrow();
      expect(out, label).not.toContain("NaN");
      expect(out, label).not.toContain("Infinity");
      expect(out).not.toMatch(/ id="/);
    }
  });

  it("draws through satori (as the stills and the clip frames do) in every look and size, mid-trouble and at the end", async () => {
    const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
    const FONTS: DrawFont[] = [
      { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
    ];
    for (const show of SHOWS) for (const size of SIZES) for (const art of ARTS) for (const t of [mid(show), end(show)]) {
      const { w, h } = FRAME[size];
      const el = <div style={{ display: "flex", position: "relative", width: w, height: h }}>{showBody(show, ctx(size, art), t)}</div>;
      await expect(drawPngHere(el, { width: w, height: h }, FONTS), `${show.layout} ${size} ${art.art} ${t}`).resolves.toBeInstanceOf(Buffer);
    }
  }, 240_000);

  it("each draws more than its title (it is not the empty fall-through)", () => {
    for (const show of SHOWS) for (const size of SIZES) expect(html(show, end(show), size).length, `${show.layout} ${size}`).toBeGreaterThan(3000);
  });

  it("every movement is over within 6 s, the note last", () => {
    for (const show of SHOWS) {
      const s = kspec(show);
      expect(end(show), show.layout).toBeLessThanOrEqual(6);
      for (const [k, x] of Object.entries(s)) if (k !== "note") expect(x.at + x.dur, `${show.layout} ${k}`).toBeLessThanOrEqual(s.note.at);
    }
  });

  it("draws no figure of its own: no digit anywhere but in what it was given", () => {
    each((size, art, label) => {
      for (const show of SHOWS) expect(words(html(show, end(show), size, art)), `${show.layout} ${label}`).not.toMatch(/[\d๐-๙]/);
    });
  });
});

describe("the words", () => {
  it("the note under the picture, at the end and not before its beat", () => {
    each((size, art, label) => {
      for (const show of SHOWS.filter((x): x is MetaShow => "note" in x && !!x.note)) {
        expect(words(html(show, end(show), size, art)), `${show.layout} ${label}`).toContain(show.note);
      }
    });
    const show = SHOWS[0];
    expect(html(show, kspec(show).note.at - 0.01)).toMatch(/opacity:0[;"][^>]*>(<[^>]+>)*พกร่ม/);
  });

  it("the longest note, title and words fit every size: the note's lines inside its card, at a readable size", () => {
    const FLOOR: Record<VideoSize, number> = { portrait: 34, square: 24, landscape: 28 };
    for (const size of SIZES) {
      for (const note of [LONG_NOTE, "พกร่ม ไม่ได้ทำให้ฝนตก", "เงินก้อนมาตอนที่ต้องการที่สุด"]) {
        expect([...note].length).toBeLessThanOrEqual(META_LIMITS.note);
        const geo = metaGeo(size, note);
        expect(geo.noteSize, `${size} ${note}`).toBeGreaterThanOrEqual(FLOOR[size]);
        for (const x of geo.noteLines) expect(handWidth(x, geo.noteSize), `${size} ${x}`).toBeLessThanOrEqual(geo.noteRoom);
        expect(geo.noteLines.join(" ").replace(/ /g, "")).toBe(note.replace(/ /g, ""));
        // the picture and the card stay inside the device's room, apart
        const r = geo.room;
        for (const b of [geo.art, geo.noteBox!]) {
          expect(b.x, size).toBeGreaterThanOrEqual(r.x);
          expect(b.y, size).toBeGreaterThanOrEqual(r.y);
          expect(b.x + b.w, size).toBeLessThanOrEqual(r.x + r.w);
          expect(b.y + b.h, size).toBeLessThanOrEqual(r.y + r.h);
        }
        const [a, n] = [geo.art, geo.noteBox!];
        expect(a.y + a.h <= n.y || a.x + a.w <= n.x, `${size}: the picture clear of the note`).toBe(true);
      }
      // with no space to break at, it shrinks onto one line, still inside its card
      const solid = metaGeo(size, SOLID_NOTE);
      expect(solid.noteLines, size).toEqual([SOLID_NOTE]);
      expect(handWidth(SOLID_NOTE, solid.noteSize), size).toBeLessThanOrEqual(solid.noteRoom);
      expect(solid.noteSize, size).toBeGreaterThanOrEqual(FLOOR[size] - 6);
      // with no note, the picture has the room: never smaller; larger in square, where the note takes height it needs
      // (portrait's is as wide as the room either way; landscape's note stands beside it, as tall as the room either way)
      const bare = metaGeo(size);
      expect(bare.noteBox, size).toBeNull();
      expect(bare.art.w * bare.art.h, size).toBeGreaterThanOrEqual(geo(size).art.w * geo(size).art.h);
      if (size === "square") expect(bare.art.h, size).toBeGreaterThan(geo(size).art.h);
    }
    function geo(size: VideoSize) { return metaGeo(size, LONG_NOTE); }
  });

  it("the long title is drawn whole in every look and size", () => {
    each((size, art, label) => {
      const out = words(html(SHOWS[1], end(SHOWS[1]), size, art)).replace(/ /g, "");
      for (const x of LONG_TITLE) expect(out, label).toContain(x);
    });
  });
});

describe("housepillar", () => {
  it("the pillar's word: รายได้ when none is given, its own when it is", () => {
    expect(META_DEFAULTS.label).toBe("รายได้");
    each((size, art, label) => {
      expect(words(html(SHOWS[4], end(SHOWS[4]), size, art)), label).toContain(META_DEFAULTS.label);
      const own = words(html(SHOWS[5], end(SHOWS[5]), size, art));
      expect(own, label).toContain(LONG_WORD);
      expect(own, label).not.toContain(` ${META_DEFAULTS.label} `);
    });
  });

  it("no spare: no second pillar, ever; a spare: the gold pillar slides in with its word", () => {
    each((size, art, label) => {
      for (const show of [SHOWS[3], SHOWS[4]]) {
        expect(pillarGeo(size, show as MetaShow<"housepillar">).spare, label).toBeNull();
        for (const t of [0, 1.5, end(show), end(show) + 2]) expect(html(show, t, size, art), `${label} ${t}`).not.toContain(C.coin);
      }
      const show = SHOWS[6] as MetaShow<"housepillar">;
      expect(pillarGeo(size, show).spare, label).not.toBeNull();
      const at = kspec(show).protect.at;
      expect(words(html(show, end(show), size, art)), label).toContain("ประกันชีวิต");
      expect(html(show, end(show), size, art), label).toContain(C.coin);
      // before its beat the spare is not yet there
      expect(html(show, at - 0.05, size, art), label).not.toContain(C.coin);
    });
  });

  it("the pillars' words fit their plaques at the widest twelve letters, the two plaques apart, clear of the note, in the frame", () => {
    const FLOOR: Record<VideoSize, number> = { portrait: 32, square: 24, landscape: 28 };
    for (const size of SIZES) {
      for (const show of [SHOWS[5], SHOWS[7]] as MetaShow<"housepillar">[]) {
        const geo = pillarGeo(size, show);
        for (const p of [geo.main, geo.spare!]) {
          expect(p.size, `${size} ${p.word}`).toBeGreaterThanOrEqual(FLOOR[size]);
          expect(handWidth(p.word, p.size), `${size} ${p.word}`).toBeLessThanOrEqual(p.plaque.w - 2 * p.pad);
        }
        const [m, s] = [geo.main.plaque, geo.spare!.plaque];
        expect(m.x + m.w, `${size}: the plaques apart`).toBeLessThan(s.x);
        const note = geo.geo.noteBox;
        if (note) expect(s.x + s.w <= note.x || s.y + s.h <= note.y, `${size}: the spare's plaque clear of the note`).toBe(true);
        expect(s.x + s.w, `${size}: inside the frame`).toBeLessThanOrEqual(FRAME[size].w - 40);
      }
    }
  });
});

it("hands the metaphors' words, the pillar's default among them, to the hand font", () => {
  const text = knowText({ scenes: SHOWS.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "", contactVoice: "" });
  for (const x of ["พกร่ม ไม่ได้ทำให้ฝนตก", META_DEFAULTS.label, SPARE, "ตาข่ายนี้ เราขึงเองได้"]) for (const ch of x.replace(/ /g, "")) expect(text).toContain(ch);
});
