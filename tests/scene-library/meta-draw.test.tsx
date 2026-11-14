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
import { balanceGeo, beamAngle, BRIDGE, bridgeWalk, metaFigures, metaGeo, pillarGeo, seedGeo, shieldGeo, TILT, UMBRELLA_RIM } from "@/lib/quote-video/story-meta-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES as FRAME, type VideoSize } from "@/lib/quote-video/timeline";

/** device round 3, Tasks 2 and 3: the eight metaphors drawn in paper, warm and line */
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
/** fourteen of them: the widest an arrow's word can be */
const WIDE_ARROW = "มมมมมมมมมมมมมม";
const FIVE_RISKS = ["จากไปเร็ว", "อยู่นานเกิน", "ป่วยหนัก", "อุบัติเหตุ", "ทุพพลภาพ"];

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
  /* 14 */ { layout: "seedtree", title: ["“เบี้ยแพง", "ไม่มีงบ”"], note: "เริ่มเล็ก ดีกว่าไม่เริ่ม" },
  /* 15 */ { layout: "seedtree", title: LONG_TITLE, note: LONG_NOTE, from: WIDE_WORD, to: WIDE_WORD },
  /* 16 */ { layout: "seedtree", title: ["เมล็ดโตเป็นต้นไม้", ""], from: "เริ่มออมวันนี้", to: "วันที่ลูกโต" },
  /* 17 */ { layout: "balance", title: ["“ฝากธนาคาร", "ดีกว่า”"], note: "ออมไว้ใช้ ประกันกันเรื่องใหญ่", sides: ["เงินออม", "ประกัน"], tilt: "even" },
  /* 18 */ { layout: "balance", title: LONG_TITLE, note: LONG_NOTE, sides: [WIDE_WORD, WIDE_WORD], tilt: "left" },
  /* 19 */ { layout: "balance", title: ["ตาชั่ง", ""], sides: ["จ่ายวันนี้", "เสี่ยงเอง"], tilt: "right" },
  /* 20 */ { layout: "balance", title: ["ตาชั่ง", "สองทางเลือก"], sides: ["ทางซ้าย", "ทางขวา"] },
  /* 21 */ { layout: "bridge", title: ["“มีบัตรทอง", "ประกันสังคมแล้ว”"], note: "ช่วงป่วย รายได้หาย ต้องมีสะพาน" },
  /* 22 */ { layout: "bridge", title: LONG_TITLE, note: LONG_NOTE },
  /* 23 */ { layout: "bridge", title: ["สะพานข้ามช่วงยาก", ""] },
  /* 24 */ { layout: "shield", title: ["ประกันชีวิต", "คืออะไรกันแน่?"], note: "ประกันรับแทนเรา", arrows: FIVE_RISKS },
  /* 25 */ { layout: "shield", title: LONG_TITLE, note: LONG_NOTE, arrows: [WIDE_ARROW, WIDE_ARROW, WIDE_ARROW, WIDE_ARROW, WIDE_ARROW] },
  /* 26 */ { layout: "shield", title: ["โล่กันลูกศร", ""], arrows: ["ค่ารักษาพยาบาล"] },
  /* 27 */ { layout: "shield", title: ["โล่กันลูกศร", ""], note: "ประกันรับแทนเรา", arrows: ["ป่วยหนัก", "อุบัติเหตุ"] },
];
const of = <L extends MetaShow["layout"]>(layout: L) => SHOWS.filter((x): x is MetaShow<L> => x.layout === layout);
/** the layouts that draw someone */
const PEOPLE = ["umbrella", "housepillar", "lifering", "safetynet", "bridge", "shield"];

/** the moment every piece of a show is in: the end of its last movement */
const end = (show: KnowShow) => Math.max(...Object.values(kspec(show)).map((x) => x.at + x.dur));
/** the middle of the trouble beat: the rain falling, the pillar shaking, the waves up, the slip */
const mid = (show: KnowShow) => { const x = kspec(show).trouble; return x.at + x.dur / 2; };
const html = (show: KnowShow, t = end(show), size: VideoSize = "portrait", art?: Partial<StoryVideoInput>) => renderToStaticMarkup(showBody(show, ctx(size, art), t));
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const each = (fn: (size: VideoSize, art: Partial<StoryVideoInput>, label: string) => void) => {
  for (const size of SIZES) for (const art of ARTS) fn(size, art, `${size} ${art.art}`);
};

describe("the eight metaphors draw", () => {
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

  const FONTS = (): DrawFont[] => {
    const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
    return [
      { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
      { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
    ];
  };
  for (const group of [["umbrella", "housepillar", "lifering", "safetynet"], ["seedtree", "balance", "bridge", "shield"]]) {
    it(`draws through satori (as the stills and the clip frames do) in every look and size, mid-trouble and at the end: ${group.join(", ")}`, async () => {
      const fonts = FONTS();
      for (const show of SHOWS.filter((x) => group.includes(x.layout))) for (const size of SIZES) for (const art of ARTS) for (const t of [mid(show), end(show)]) {
        const { w, h } = FRAME[size];
        const el = <div style={{ display: "flex", position: "relative", width: w, height: h }}>{showBody(show, ctx(size, art), t)}</div>;
        await expect(drawPngHere(el, { width: w, height: h }, fonts), `${show.layout} ${size} ${art.art} ${t}`).resolves.toBeInstanceOf(Buffer);
      }
    }, 240_000);
  }

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

describe("the people", () => {
  const times = (show: KnowShow) => [0, 0.8, ...Array.from({ length: 61 }, (_, i) => i * 0.1), end(show) + 3];
  it("every head stays on the sheet (no head sliced at its top edge), every foot on it, in every look and size, all through", () => {
    each((size, art, label) => {
      for (const show of SHOWS as MetaShow[]) for (const t of times(show)) {
        const figs = metaFigures(show, ctx(size, art), t);
        if (!PEOPLE.includes(show.layout)) { expect(figs, `${show.layout} draws no one`).toEqual([]); continue; }
        expect(figs.length, `${show.layout} ${label}`).toBeGreaterThan(0);
        for (const f of figs) {
          const at = `${show.layout} ${label} t=${t.toFixed(1)}`;
          expect(f.foot - f.h, `${at}: the head inside the sheet`).toBeGreaterThanOrEqual(0);
          expect(f.foot, at).toBeLessThanOrEqual(300);
          expect(f.x - f.w / 2, at).toBeGreaterThanOrEqual(0);
          expect(f.x + f.w / 2, at).toBeLessThanOrEqual(400);
        }
      }
    });
  });

  it("under the umbrella every head is below the canopy's rim, in every look", () => {
    each((size, art, label) => {
      for (const show of [SHOWS[0], SHOWS[1], SHOWS[2]] as MetaShow[]) for (const f of metaFigures(show, ctx(size, art), end(show))) {
        expect(f.foot - f.h, `${label}: a head clear of the canopy`).toBeGreaterThan(UMBRELLA_RIM + 6);
      }
    });
  });

  it("the people are drawn where metaFigures puts them", () => {
    const show = SHOWS[13] as MetaShow<"safetynet">;
    for (const art of ARTS) {
      const f = metaFigures(show, ctx("portrait", art), 0.6)[0];
      const k = metaGeo("portrait").k;
      expect(html(show, 0.6, "portrait", art), art.art).toContain(`height:${Math.round(f.h * k)}px`);
    }
    for (const show of [SHOWS[23], SHOWS[26]] as MetaShow[]) for (const art of ARTS) {
      const t = end(show) - 0.7;
      const k = metaGeo("portrait").k;
      for (const f of metaFigures(show, ctx("portrait", art), t)) {
        expect(html(show, t, "portrait", art), `${show.layout} ${art.art}`).toContain(`left:${Math.round((f.x - f.w / 2) * k)}px;top:${Math.round(f.foot * k) - Math.round(f.h * k)}px`);
      }
    }
  });

  it("the bridge's walker: always on the cliff tops or the deck, and over the gap only once the bridge is whole", () => {
    each((size, art, label) => {
      for (const show of of("bridge")) for (const t of times(show)) {
        const w = bridgeWalk(show, t);
        const [f] = metaFigures(show, ctx(size, art), t);
        const at = `${label} t=${t.toFixed(1)}`;
        expect(f.foot, at).toBe(BRIDGE.deck);
        expect(f.x, at).toBe(w.x);
        if (f.x > BRIDGE.gap[0] - f.w / 4 && f.x < BRIDGE.gap[1] + f.w / 4) expect(w.built, `${at}: the bridge whole under them`).toBe(1);
      }
      const show = of("bridge")[0];
      expect(bridgeWalk(show, 0).x, label).toBeLessThan(BRIDGE.gap[0]);
      expect(bridgeWalk(show, end(show)).x, label).toBeGreaterThan(BRIDGE.gap[1]);
      expect(bridgeWalk(show, kspec(show).protect.at - 0.01).built, label).toBe(0);
    });
  });

  it("the shield's family stands behind it, clear of every arrow, in every look and size", () => {
    each((size, art, label) => {
      for (const show of of("shield")) {
        const figs = metaFigures(show, ctx(size, art), end(show));
        expect(figs, label).toHaveLength(3);
        const left = Math.min(...figs.map((f) => f.x - f.w / 2));
        for (const a of shieldGeo(size, show).arrows) {
          expect(a.tip, `${label} ${a.word}: the arrow stops in the shield`).toBeGreaterThan(a.face);
          expect(a.tip, `${label} ${a.word}: short of the family`).toBeLessThan(left);
        }
      }
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

/** a word's plaque: its word fits inside it */
type Tag = { word: string; size: number; pad: number; plaque: { x: number; y: number; w: number; h: number } };
const fitsTag = (p: Tag) => handWidth(p.word, p.size) <= p.plaque.w - 2 * p.pad;
const inside = (r: Tag["plaque"], box: Tag["plaque"]) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;
const apart = (a: Tag["plaque"], b: Tag["plaque"]) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
/** the 12-letter words' smallest sizes (as the pillar's plaques), and the 14-letter arrows' */
const WORD_FLOOR: Record<VideoSize, number> = { portrait: 32, square: 24, landscape: 28 };
const ARROW_FLOOR: Record<VideoSize, number> = { portrait: 26, square: 20, landscape: 23 };
/** real arrows' words come at their full size */
const RISK_FLOOR: Record<VideoSize, number> = { portrait: 34, square: 24, landscape: 28 };

describe("seedtree", () => {
  it("the ground's words: วันนี้ / วันข้างหน้า when none are given, its own when they are", () => {
    expect([META_DEFAULTS.from, META_DEFAULTS.to]).toEqual(["วันนี้", "วันข้างหน้า"]);
    each((size, art, label) => {
      const bare = words(html(SHOWS[14], end(SHOWS[14]), size, art));
      for (const x of [META_DEFAULTS.from, META_DEFAULTS.to]) expect(bare, label).toContain(x);
      const own = words(html(SHOWS[16], end(SHOWS[16]), size, art));
      for (const x of ["เริ่มออมวันนี้", "วันที่ลูกโต"]) expect(own, label).toContain(x);
      expect(own, label).not.toContain(META_DEFAULTS.to);
    });
  });

  it("grows left to right: the sprout, then the small tree, then the big one; nothing before the trouble beat, all at the end", () => {
    for (const show of of("seedtree")) {
      const s = kspec(show);
      expect(seedGeo("portrait", show).stages(s.trouble.at - 0.01)).toEqual([0, 0, 0]);
      expect(seedGeo("portrait", show).stages(end(show))).toEqual([1, 1, 1]);
      let last = [0, 0, 0];
      for (let t = 0; t <= end(show); t += 0.05) {
        const g = seedGeo("portrait", show).stages(t);
        g.forEach((v, i) => expect(v, `stage ${i} at ${t.toFixed(2)}`).toBeGreaterThanOrEqual(last[i]));
        // a stage starts only once the one to its left is grown
        for (let i = 1; i < 3; i += 1) if (g[i] > 0) expect(g[i - 1], `stage ${i} at ${t.toFixed(2)}`).toBe(1);
        last = g;
      }
    }
  });

  it("its words fit their plaques at the widest twelve letters, the two apart, on the sheet", () => {
    for (const size of SIZES) for (const show of of("seedtree")) {
      const g = seedGeo(size, show);
      for (const p of [g.from, g.to]) {
        expect(p.size, `${size} ${p.word}`).toBeGreaterThanOrEqual(WORD_FLOOR[size]);
        expect(fitsTag(p), `${size} ${p.word}`).toBe(true);
        expect(inside(p.plaque, g.geo.art), `${size} ${p.word}: on the sheet`).toBe(true);
      }
      expect(apart(g.from.plaque, g.to.plaque), size).toBe(true);
    }
  });
});

describe("balance", () => {
  it("the beam settles to the tilt: the left pan down for left, the right for right, level for even or none", () => {
    expect(TILT).toBeGreaterThan(5);
    const want = { 17: 0, 18: -TILT, 19: TILT, 20: 0 } as Record<number, number>;
    for (const [i, a] of Object.entries(want)) {
      const show = SHOWS[Number(i)] as MetaShow<"balance">;
      expect(beamAngle(show, end(show)), show.tilt ?? "none").toBe(a);
      expect(beamAngle(show, end(show) + 3), show.tilt ?? "none").toBe(a);
      // level until the trouble, then it swings
      expect(beamAngle(show, kspec(show).trouble.at - 0.01)).toBe(0);
      expect(Math.abs(beamAngle(show, kspec(show).trouble.at + 0.15))).toBeGreaterThan(2);
      // the words' feet, in their pans
      const g = balanceGeo("portrait", show, end(show));
      const [l, r] = [g.left.plaque.y + g.left.plaque.h, g.right.plaque.y + g.right.plaque.h];
      if (a < 0) expect(l).toBeGreaterThan(r);
      if (a > 0) expect(l).toBeLessThan(r);
      if (a === 0) expect(l).toBe(r);
    }
  });

  it("each side's word rides its pan: fits at the widest twelve letters, on the sheet, apart from the other and the post, all through", () => {
    for (const size of SIZES) for (const show of of("balance")) for (let t = 0; t <= end(show) + 0.5; t += 0.1) {
      const g = balanceGeo(size, show, t);
      const at = `${size} ${show.sides.join("/")} t=${t.toFixed(1)}`;
      for (const p of [g.left, g.right]) {
        expect(p.size, at).toBeGreaterThanOrEqual(WORD_FLOOR[size]);
        expect(fitsTag(p), at).toBe(true);
        expect(inside(p.plaque, g.geo.art), `${at}: on the sheet`).toBe(true);
        expect(apart(p.plaque, g.post), `${at}: clear of the post`).toBe(true);
      }
      expect(apart(g.left.plaque, g.right.plaque), at).toBe(true);
    }
  });

  it("both words are drawn, in every look and size", () => {
    each((size, art, label) => {
      for (const show of of("balance")) for (const x of show.sides) expect(words(html(show, end(show), size, art)), label).toContain(x);
    });
  });
});

describe("shield", () => {
  it("one movement per arrow, one to five, the protection after the last", () => {
    for (const show of of("shield")) {
      const s = kspec(show);
      const n = show.arrows.length;
      for (let i = 0; i < n; i += 1) expect(s[`arrow${i}`], `arrow${i}`).toBeDefined();
      expect(s[`arrow${n}`]).toBeUndefined();
      expect(s.protect.at).toBeGreaterThanOrEqual(s[`arrow${n - 1}`].at + s[`arrow${n - 1}`].dur);
    }
    // more than five (refused upstream) draws five
    const six = { layout: "shield", title: ["โล่", ""], arrows: ["ก", "ข", "ค", "ง", "จ", "ฉ"] } as MetaShow<"shield">;
    expect(Object.keys(kspec(six)).filter((k) => k.startsWith("arrow"))).toHaveLength(5);
    expect(shieldGeo("portrait", six).arrows).toHaveLength(5);
  });

  it("each arrow's word comes with its arrow, not before; all are there at the end, in every look and size", () => {
    each((size, art, label) => {
      for (const show of of("shield")) {
        const out = words(html(show, end(show), size, art));
        for (const x of show.arrows) expect(out, label).toContain(x);
      }
      const show = SHOWS[24] as MetaShow<"shield">;
      const s = kspec(show);
      const before = words(html(show, s.arrow2.at - 0.01, size, art));
      expect(before, label).toContain(show.arrows[1]);
      expect(before, label).not.toContain(show.arrows[2]);
    });
  });

  it("the arrows' words fit their tags, the tags on the sheet and apart, at the widest fourteen letters and five arrows", () => {
    for (const size of SIZES) for (const show of of("shield")) {
      const g = shieldGeo(size, show);
      const floor = show.arrows[0] === WIDE_ARROW ? ARROW_FLOOR : RISK_FLOOR;
      g.arrows.forEach((p, i) => {
        expect(p.size, `${size} ${p.word}`).toBeGreaterThanOrEqual(floor[size]);
        expect(fitsTag(p), `${size} ${p.word}`).toBe(true);
        expect(inside(p.plaque, g.geo.art), `${size} ${p.word}: on the sheet`).toBe(true);
        for (const q of g.arrows.slice(i + 1)) expect(apart(p.plaque, q.plaque), `${size} ${p.word} / ${q.word}`).toBe(true);
      });
    }
  });
});

it("hands the metaphors' words, the defaults among them, to the hand font", () => {
  const text = knowText({ scenes: SHOWS.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "", contactVoice: "" });
  for (const x of ["พกร่ม ไม่ได้ทำให้ฝนตก", META_DEFAULTS.label, SPARE, "ตาข่ายนี้ เราขึงเองได้", META_DEFAULTS.from, META_DEFAULTS.to, "เงินออม", ...FIVE_RISKS]) for (const ch of x.replace(/ /g, "")) expect(text).toContain(ch);
});
