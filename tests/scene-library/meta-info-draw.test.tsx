import { readFileSync } from "node:fs";
import path from "node:path";
import { cloneElement, createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { textClips } from "../helpers/text-clips";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { META_DEFAULTS, META_LAYOUTS, type KnowShow, type MetaShow } from "@/lib/quote-video/story-knowledge";
import { kspec } from "@/lib/quote-video/story-knowledge-motion";
import { devArea, infoDrawn, infoShow, kitFor } from "@/lib/quote-video/story-info-motion";
import { handWidth } from "@/lib/quote-video/story-life-motion";
import { metaInfoPlace, metaTitleSize, pillarInfoGeo } from "@/lib/quote-video/story-meta-info";
import { balanceGeo, MAIN_X, metaFigures, metaGeo, SPARE_X, seedGeo, shieldGeo, UMBRELLA_RIM } from "@/lib/quote-video/story-meta-motion";
import { storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/**
 * device round 3, Task 4: the eight metaphors in the info route — ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน, บลูพริ้นท์ and the
 * retired อินโฟกราฟิก — drawn with the Kit, telling the same little story as the paper (the same sheet, beats and words).
 */
const SIZES: VideoSize[] = ["portrait", "square", "landscape"];
/** a fully clear paint draws nothing: the pen's layer of a piece holding words, whose words fade in over it (owner chose ก, 2026-11-16) */
const CLEARED = /^rgba\(0,\s*0,\s*0,\s*0\)$/;
const LOOKS = ["plot", "board", "neon", "blueprint", "info"] as const;
type Look = (typeof LOOKS)[number];
const DARK = ["neon", "blueprint"] as const;

const ctx = (size: VideoSize, art: Look): StoryContext => ({
  input: { product: "STORY", topic: "mythjinx", style: "story", length: "full", palette: "reveal", size, narrator: "F", faces: { hero: "w15", narrator: "m03" }, art } as StoryVideoInput,
  size, customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

/* the longest words a metaphor may carry (META_LIMITS): title lines 20, note 34, words 12, arrows 14 */
const LONG_TITLE: [string, string] = ["ครอบครัวไม่ต้องเปียก", "ประกันคือร่มของบ้าน"];
const LONG_NOTE = "รายได้หลักของบ้าน ถ้าหายไปจะลำบาก";
const SOLID_NOTE = "เงินก้อนมาถึงมือตอนที่ต้องการที่สุด";
const WIDE_WORD = "มมมมมมมมมมมม";
const WIDE_ARROW = "มมมมมมมมมมมมมม";
const FIVE_RISKS = ["จากไปเร็ว", "อยู่นานเกิน", "ป่วยหนัก", "อุบัติเหตุ", "ทุพพลภาพ"];

const X = {
  umbrella: { layout: "umbrella", title: ["“ซื้อประกัน", "เหมือนแช่งตัวเอง”"], note: "พกร่ม ไม่ได้ทำให้ฝนตก" },
  umbrellaLong: { layout: "umbrella", title: LONG_TITLE, note: LONG_NOTE },
  umbrellaBare: { layout: "umbrella", title: ["ร่มกันฝน", ""] },
  pillar: { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""], note: "รายได้หลักของบ้าน", label: "รายได้" },
  pillarBare: { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""] },
  pillarSpare: { layout: "housepillar", title: ["เสาหลัก", "ของบ้าน"], note: "ประกันคือเสาสำรอง", spare: "ประกันชีวิต" },
  pillarLong: { layout: "housepillar", title: LONG_TITLE, note: LONG_NOTE, label: WIDE_WORD, spare: WIDE_WORD },
  ring: { layout: "lifering", title: ["ป่วยหนัก", "รายได้หายไปไหน?"], note: "เงินก้อนมาตอนที่ต้องการที่สุด" },
  ringLong: { layout: "lifering", title: LONG_TITLE, note: SOLID_NOTE },
  net: { layout: "safetynet", title: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"], note: "ตาข่ายนี้ เราขึงเองได้" },
  netLong: { layout: "safetynet", title: LONG_TITLE, note: LONG_NOTE },
  seed: { layout: "seedtree", title: ["“เบี้ยแพง", "ไม่มีงบ”"], note: "เริ่มเล็ก ดีกว่าไม่เริ่ม" },
  seedLong: { layout: "seedtree", title: LONG_TITLE, note: LONG_NOTE, from: WIDE_WORD, to: WIDE_WORD },
  bal: { layout: "balance", title: ["“ฝากธนาคาร", "ดีกว่า”"], note: "ออมไว้ใช้ ประกันกันเรื่องใหญ่", sides: ["เงินออม", "ประกัน"], tilt: "even" },
  balLong: { layout: "balance", title: LONG_TITLE, note: LONG_NOTE, sides: [WIDE_WORD, WIDE_WORD], tilt: "left" },
  balRight: { layout: "balance", title: ["ตาชั่ง", ""], sides: ["จ่ายวันนี้", "เสี่ยงเอง"], tilt: "right" },
  bridge: { layout: "bridge", title: ["“มีบัตรทอง", "ประกันสังคมแล้ว”"], note: "ช่วงป่วย รายได้หาย ต้องมีสะพาน" },
  bridgeLong: { layout: "bridge", title: LONG_TITLE, note: LONG_NOTE },
  shield: { layout: "shield", title: ["ประกันชีวิต", "คืออะไรกันแน่?"], note: "ประกันรับแทนเรา", arrows: FIVE_RISKS },
  shieldLong: { layout: "shield", title: LONG_TITLE, note: LONG_NOTE, arrows: [WIDE_ARROW, WIDE_ARROW, WIDE_ARROW, WIDE_ARROW, WIDE_ARROW] },
  shieldOne: { layout: "shield", title: ["โล่กันลูกศร", ""], arrows: ["ค่ารักษาพยาบาล"] },
} satisfies Record<string, KnowShow>;
const ALL: MetaShow[] = Object.values(X) as MetaShow[];
/** one of each, as the story openers carry them */
const MAIN: MetaShow[] = [X.umbrella, X.pillar, X.ring, X.net, X.seed, X.bal, X.bridge, X.shield] as MetaShow[];

const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
const mid = (show: KnowShow) => { const x = kspec(show).trouble; return x.at + x.dur / 2; };
const draw = (show: KnowShow, size: VideoSize = "portrait", art: Look = "plot", t = end(show)) => renderToStaticMarkup(<>{infoDrawn(show, ctx(size, art), t)}</>);
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const flat = (markup: string) => words(markup).replace(/ /g, "");
const each = (fn: (size: VideoSize, art: Look, label: string) => void) => {
  for (const size of SIZES) for (const art of LOOKS) fn(size, art, `${size} ${art}`);
};
const times = (show: KnowShow) => {
  const s = kspec(show);
  return [0, 0.8, mid(show), ...(s.protect ? [s.protect.at + s.protect.dur / 2] : []), ...(s.fall ? [s.fall.at + s.fall.dur / 2] : []), ...(s.walk ? [s.walk.at + s.walk.dur / 2] : []), end(show), end(show) + 3];
};

describe("the eight metaphors draw in the info route", () => {
  it("every layout has its drawer in every look and size: none falls through to nothing", () => {
    expect(new Set(ALL.map((x) => x.layout))).toEqual(new Set(META_LAYOUTS));
    for (const show of ALL) each((size, art, label) => expect(infoShow(show, ctx(size, art), end(show)), `${show.layout} ${label}`).not.toBeNull());
  });

  it("in every look and size, from the start through every beat to the end, with no NaN, no Infinity and no shared id", () => {
    for (const show of ALL) each((size, art, label) => {
      for (const t of times(show)) {
        let out = "";
        expect(() => { out = draw(show, size, art, t); }, `${show.layout} ${label} ${t}`).not.toThrow();
        expect(out, `${show.layout} ${label} ${t}`).not.toContain("NaN");
        expect(out, `${show.layout} ${label} ${t}`).not.toContain("Infinity");
        expect(out).not.toMatch(/ id="/);
      }
    });
  });

  it("each draws its picture, not only its title", () => {
    for (const show of ALL) each((size, art, label) => expect(draw(show, size, art).length, `${show.layout} ${label}`).toBeGreaterThan(2000));
  });

  it("before its moment the picture is hidden: the pieces come in on their beats", () => {
    for (const show of MAIN) for (const art of LOOKS) expect(draw(show, "portrait", art, 0), `${show.layout} ${art}`).toContain("opacity:0");
  });

  it("draws no figure of its own: no digit in any word on screen", () => {
    for (const show of ALL) each((size, art, label) => expect(words(draw(show, size, art)), `${show.layout} ${label}`).not.toMatch(/[\d๐-๙]/));
  });
});

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
  for (const group of [["umbrella", "housepillar", "lifering", "safetynet"], ["seedtree", "balance", "bridge", "shield"]]) {
    it(`every look and size, mid-trouble and at the end: ${group.join(", ")}`, async () => {
      for (const show of ALL.filter((x) => group.includes(x.layout))) for (const size of SIZES) for (const art of LOOKS) for (const t of [mid(show), end(show)]) {
        const bytes = await png(frame(show, size, art, t), size);
        expect(bytes.length, `${show.layout} ${size} ${art} ${t}`).toBeGreaterThan(1000);
      }
    }, 900_000);
  }
});

describe("they tell the paper's story with its words", () => {
  it("the title whole (the longest too), and the note at the end, not before its beat", () => {
    for (const show of ALL) each((size, art, label) => {
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

  it("the title is set to fit the frame's width, in every size", () => {
    for (const size of SIZES) for (const show of ALL) {
      const t = metaTitleSize(size, show.title);
      const room = FRAME[size].w - 80;
      expect(handWidth(show.title[0], t.first), `${size} ${show.title[0]}`).toBeLessThanOrEqual(room);
      expect(handWidth(show.title[1], t.second), `${size} ${show.title[1]}`).toBeLessThanOrEqual(room);
    }
  });

  it("housepillar: รายได้ when no word is given; no spare, no second pillar ever; a spare comes in with its word", () => {
    each((size, art, label) => {
      expect(flat(draw(X.pillarBare, size, art)), label).toContain(META_DEFAULTS.label);
      for (const t of times(X.pillar)) expect(draw(X.pillar, size, art, t), `${label} ${t}`).not.toContain("data-spare");
      const spare = draw(X.pillarSpare, size, art);
      expect(spare, label).toContain("data-spare");
      expect(flat(spare), label).toContain(X.pillarSpare.spare);
      expect(draw(X.pillarSpare, size, art, kspec(X.pillarSpare).protect.at - 0.01), label).not.toContain("data-spare");
    });
  });

  it("seedtree: วันนี้ / วันข้างหน้า when none are given, its own words when they are", () => {
    each((size, art, label) => {
      const say = flat(draw(X.seed, size, art));
      expect(say, label).toContain(META_DEFAULTS.from);
      expect(say, label).toContain(META_DEFAULTS.to);
      expect(flat(draw(X.seedLong, size, art)).split(WIDE_WORD).length - 1, label).toBe(2);
    });
  });

  it("balance: both sides' words; the left word rides lower when the scale tips left", () => {
    each((size, art, label) => {
      const say = flat(draw(X.bal, size, art));
      for (const x of X.bal.sides) expect(say, `${label} ${x}`).toContain(x);
    });
    const geo = balanceGeo("portrait", X.balLong as MetaShow<"balance">, end(X.balLong), metaInfoPlace("portrait", X.balLong.note));
    expect(geo.left.plaque.y).toBeGreaterThan(geo.right.plaque.y);
  });

  it("shield: each arrow's word comes with its arrow, not before; all five at the end", () => {
    each((size, art, label) => {
      const s = kspec(X.shield);
      for (let i = 0; i < FIVE_RISKS.length; i++) {
        expect(flat(draw(X.shield, size, art, s[`arrow${i}`].at - 0.01)), `${label} ${i}`).not.toContain(FIVE_RISKS[i]);
      }
      const say = flat(draw(X.shield, size, art));
      for (const x of FIVE_RISKS) expect(say, `${label} ${x}`).toContain(x);
    });
  });
});

describe("the people and the helper lines", () => {
  it("every head on the sheet and under the umbrella's rim, in every info look and size, all through", () => {
    each((size, art, label) => {
      for (const show of ALL) for (const t of [...Array.from({ length: 61 }, (_, i) => i * 0.1), end(show) + 3]) {
        for (const f of metaFigures(show, ctx(size, art), t)) {
          const at = `${show.layout} ${label} ${t.toFixed(1)}`;
          expect(f.foot - f.h, `${at}: the head on the sheet`).toBeGreaterThanOrEqual(0);
          expect(f.foot, `${at}: the foot on the sheet`).toBeLessThanOrEqual(300);
          expect(f.x - f.w / 2, at).toBeGreaterThanOrEqual(0);
          expect(f.x + f.w / 2, at).toBeLessThanOrEqual(400);
          if (show.layout === "umbrella") expect(f.foot - f.h, `${at}: under the canopy`).toBeGreaterThan(UMBRELLA_RIM + 6);
        }
      }
    });
  });

  it("the people are drawn where metaFigures puts them", () => {
    for (const show of [X.umbrella, X.pillar, X.ring, X.net, X.bridge, X.shield] as MetaShow[]) for (const art of LOOKS) for (const size of SIZES) {
      const t = end(show);
      const geo = metaGeo(size, show.note, metaInfoPlace(size, show.note));
      const out = draw(show, size, art, t);
      const figs = metaFigures(show, ctx(size, art), t);
      expect(out.match(/data-who=/g)?.length, `${show.layout} ${art} ${size}`).toBe(figs.length);
      for (const f of figs) {
        const left = Math.round((f.x - f.w / 2) * geo.k);
        const top = Math.round(f.foot * geo.k) - Math.round(f.h * geo.k);
        expect(out, `${show.layout} ${art} ${size}`).toMatch(new RegExp(`data-who="[^"]*"[^>]*left:${left}px;top:${top}px`));
      }
    }
  });

  it("the helper lines (the throw, the fall, the stones, the hits) are there in their beat and gone after it", () => {
    for (const art of LOOKS) {
      const ring = kspec(X.ring);
      expect(draw(X.ring, "portrait", art, ring.protect.at + ring.protect.dur / 2), art).toContain("data-helper");
      const net = kspec(X.net);
      expect(draw(X.net, "portrait", art, net.fall.at + 0.1), art).toContain("data-helper");
      const br = kspec(X.bridge);
      expect(draw(X.bridge, "portrait", art, br.trouble.at + br.trouble.dur / 2), art).toContain("data-helper");
      const sh = kspec(X.shield);
      expect(draw(X.shield, "portrait", art, sh.arrow0.at + sh.arrow0.dur + 0.05), art).toContain("data-helper");
      for (const show of ALL) for (const t of [end(show), end(show) + 3]) expect(draw(show, "portrait", art, t), `${show.layout} ${art} ${t}`).not.toContain("data-helper");
    }
  });
});

describe("Review Focus 2: the longest words fit at every size", () => {
  const FLOOR: Record<VideoSize, number> = { portrait: 30, square: 20, landscape: 22 };
  const inside = (b: { x: number; y: number; w: number; h: number }, r: { x: number; y: number; w: number; h: number }, at: string) => {
    expect(b.x, at).toBeGreaterThanOrEqual(r.x - 1);
    expect(b.y, at).toBeGreaterThanOrEqual(r.y - 1);
    expect(b.x + b.w, at).toBeLessThanOrEqual(r.x + r.w + 1);
    expect(b.y + b.h, at).toBeLessThanOrEqual(r.y + r.h + 1);
  };
  const apart = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
  const fits = (p: { word: string; size: number; pad: number; plaque: { w: number } }, at: string) => {
    expect(handWidth(p.word, p.size) + p.pad * 2, at).toBeLessThanOrEqual(p.plaque.w + 1);
  };

  it("the note's lines inside its card, the picture and the card inside the room and apart", () => {
    for (const size of SIZES) for (const note of [LONG_NOTE, SOLID_NOTE, "พกร่ม ไม่ได้ทำให้ฝนตก"]) {
      const place = metaInfoPlace(size, note);
      inside(place.room, devArea(size), size);
      const geo = metaGeo(size, note, place);
      expect(geo.noteSize, `${size} ${note}`).toBeGreaterThanOrEqual(FLOOR[size]);
      for (const l of geo.noteLines) expect(handWidth(l, geo.noteSize), `${size} ${l}`).toBeLessThanOrEqual(geo.noteRoom);
      inside(geo.art, place.room, size);
      inside(geo.noteBox!, place.room, size);
      expect(apart(geo.art, geo.noteBox!), size).toBe(true);
    }
  });

  it("the plaques' words (twelve wide letters, five fourteen-letter arrows) fit, on the sheet, apart and clear of the note", () => {
    for (const size of SIZES) {
      const place = metaInfoPlace(size, LONG_NOTE);
      const pg = pillarInfoGeo(size, X.pillarLong as MetaShow<"housepillar">);
      const sg = seedGeo(size, X.seedLong as MetaShow<"seedtree">, place);
      const sh = shieldGeo(size, X.shieldLong as MetaShow<"shield">, place);
      const tags = [
        [pg.geo, [pg.main, pg.spare!]],
        [sg.geo, [sg.from, sg.to]],
        [sh.geo, sh.arrows],
      ] as const;
      for (const [geo, list] of tags) {
        for (const p of list) {
          fits(p, `${size} ${p.word}`);
          expect(p.size, `${size} ${p.word}`).toBeGreaterThanOrEqual(FLOOR[size] - 2);
          inside(p.plaque, geo.art, `${size} ${p.word}`);
          if (geo.noteBox) expect(apart(p.plaque, geo.noteBox), `${size} ${p.word}`).toBe(true);
        }
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(apart(list[i].plaque, list[j].plaque), `${size} ${i} ${j}`).toBe(true);
      }
      // each pillar's plaque still hangs on its own pillar
      for (const [p, x] of [[pg.main, MAIN_X], [pg.spare!, SPARE_X]] as const) {
        const px = pg.geo.art.x + x * pg.geo.k;
        expect(p.plaque.x, `${size} ${x}`).toBeLessThan(px);
        expect(p.plaque.x + p.plaque.w, `${size} ${x}`).toBeGreaterThan(px);
      }
      for (let t = 0; t <= end(X.balLong) + 0.01; t += 0.1) {
        const bg = balanceGeo(size, X.balLong as MetaShow<"balance">, t, place);
        for (const p of [bg.left, bg.right]) { fits(p, `${size} ${t}`); inside(p.plaque, bg.geo.art, `${size} ${t}`); }
        expect(apart(bg.left.plaque, bg.right.plaque), `${size} ${t}`).toBe(true);
      }
    }
  });
});

describe("drawn with the Kit", () => {
  const weights = (html: string) => [...html.matchAll(/font-weight:(\d+)/g)].map((m) => Number(m[1]));

  it("นีออน writes in Sriracha and never above 400; the other looks keep their bold", () => {
    for (const show of ALL) for (const size of SIZES) {
      const html = draw(show, size, "neon");
      expect(html, `${show.layout} ${size}`).toContain("font-family:Sriracha");
      for (const w of weights(html)) expect(w, `${show.layout} ${size}`).toBeLessThanOrEqual(400);
    }
    for (const art of ["plot", "board", "blueprint", "info"] as const) expect(MAIN.flatMap((x) => weights(draw(x, "portrait", art))), art).toContain(600);
  });

  it("every colour drawn is one of the look's own", () => {
    const COLOR = /(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\))/g;
    for (const art of LOOKS) {
      const kit = kitFor({ art });
      const own = new Set([...Object.values(kit).filter((v): v is string => typeof v === "string"), S.plotRail, S.plotRailEdge, S.plotHead, S.plotPaper, S.plotPen].map((x) => x.replace(/\s/g, "")));
      for (const show of ALL) for (const size of SIZES) for (const t of [mid(show), end(show)]) {
        for (const m of draw(show, size, art, t).matchAll(COLOR)) expect(CLEARED.test(m[1]) || own.has(m[1].replace(/\s/g, "")), `${art} ${show.layout} ${size} ${m[1]}`).toBe(true);
      }
    }
  });

  it("glows only in นีออน", () => {
    for (const show of MAIN) {
      expect(draw(show, "portrait", "neon"), show.layout).toMatch(/text-shadow:0 0|box-shadow:0 0|stroke-opacity/);
      for (const art of ["plot", "board", "blueprint", "info"] as const) {
        const html = draw(show, "portrait", art);
        expect(html, `${art} ${show.layout}`).not.toContain("text-shadow");
        expect(html, `${art} ${show.layout}`).not.toContain("box-shadow");
      }
    }
  });

  it("puts the plotter's machine over plot only", () => {
    for (const show of MAIN) {
      expect(draw(show, "portrait", "plot", 1), show.layout).toContain(S.plotRail);
      for (const art of ["board", "neon", "blueprint", "info"] as const) expect(draw(show, "portrait", art, 1), `${art} ${show.layout}`).not.toContain(S.plotRail);
    }
  });
});

/* ── Review Focus 3: on the dark looks every word can be read where it is drawn ───────────────────────────────────── */

/** the frame's tree with its components run; `hide` draws every word's ink transparent and its glow off */
function expand(node: ReactNode, hide: boolean): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((x) => expand(x, hide));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode; style?: React.CSSProperties }>;
  if (typeof el.type === "function") return expand((el.type as (p: unknown) => ReactNode)(el.props), hide);
  const kids = el.props.children;
  if ((el.type as unknown) === Fragment) return createElement(Fragment, null, expand(kids, hide));
  const list = Array.isArray(kids) ? kids.flat(Infinity) : [kids];
  const text = list.some((k) => typeof k === "string" || typeof k === "number");
  const style = hide && text ? { ...el.props.style, color: "transparent", textShadow: "none" } : el.props.style;
  return cloneElement(el, { style }, expand(kids, hide));
}
const lum = (p: number[]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
async function pixels(bytes: Buffer) {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  return (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
}

describe("Review Focus 3: นีออน and บลูพริ้นท์ keep every metaphor's words readable", () => {
  /**
   * A word's own pixels are where the frame differs from the same frame with its words' ink transparent; of those, the
   * glyphs' cores are in one of the look's inks (นีออน's glow around them is softer by design and not counted). Every
   * core must stand 3:1 off what is under it there: the plaque, the card, the ground, a line of the picture.
   */
  const hexes = (art: Look) => {
    const K = kitFor({ art });
    return [K.white, K.soft, K.gold, K.sub, K.sky, K.red, K.green, K.ground, K.dim, K.mute].filter((x) => x.startsWith("#")).map(rgb);
  };
  for (const art of DARK) {
    it(`every word's ink stands 3:1 off what is under it in ${art}, every metaphor and size`, async () => {
      for (const show of [...MAIN, X.pillarSpare, X.shieldLong, X.balLong, X.seedLong] as MetaShow[]) for (const size of SIZES) {
        const inks = hexes(art);
        const t = end(show);
        const body = infoDrawn(show, ctx(size, art), t);
        const shown = await pixels(await png(frame(show, size, art, t, expand(body, false)), size));
        const blank = await pixels(await png(frame(show, size, art, t, expand(body, true)), size));
        const { w, h } = FRAME[size];
        let drawn = 0;
        let core = 0;
        let read = 0;
        for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
          const [p, q] = [shown(x, y), blank(x, y)];
          if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 24) continue;
          drawn++;
          if (!inks.some((c) => c.every((v, i) => Math.abs(v - p[i]) <= 10))) continue;
          core++;
          if (contrast(p, q) >= 3) read++;
        }
        const label = `${art} ${show.layout} ${size} (${read}/${core} of ${drawn})`;
        expect(core, label).toBeGreaterThan(300);
        expect(read / core, label).toBeGreaterThan(0.97);
      }
    }, 900_000);
  }
});

describe("a word or figure is whole or not there at every frame (owner chose ก, 2026-11-16)", () => {
  it("no text is ever drawn under a clip, in any look, size or beat", () => {
    let seen = 0;
    for (const show of ALL) for (const size of SIZES) for (const art of LOOKS) {
      const e = end(show);
      for (let i = 0; i <= 24; i++) {
        const out = textClips(infoDrawn(show, ctx(size, art), (e * i) / 24));
        seen += out.length;
        for (const f of out) expect(f.clipped, `${show.layout} ${size} ${art} ${i}/24 "${f.text}"`).toBe(false);
      }
    }
    expect(seen).toBeGreaterThan(1000);
  });
});
