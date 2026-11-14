import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import { checkedStory, type StoryVideoInput } from "@/lib/quote-video/story";
import { knowEpisode, type KnowSceneKey, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { kspec } from "@/lib/quote-video/story-knowledge-motion";
import { infoBody, infoDrawn, infoShow, kitFor } from "@/lib/quote-video/story-info-motion";
import { info, plot, type StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";
import { INFO_SHELVES, STORY_TOPICS } from "@/lib/story/topics";

/**
 * ไวต์บอร์ด นีออน บลูพริ้นท์ (spec 2026-11-14-story-looks-board-neon-blueprint), Task 2: each look a Kit of the
 * อินโฟกราฟิก / ปากกาพล็อตเตอร์ route, so every knowledge layout and health device is drawn in its palette, its hand
 * face and its reveal. What is around the scenes (background, title card, subtitle, contact card) is Task 3: here a
 * frame is the drawers' pieces on the Kit's own page colour.
 */
const NEW = ["board", "neon", "blueprint"] as const;
type New = (typeof NEW)[number];
const LOOKS = ["plot", ...NEW] as const;
const HEALTH = { plan: "SILVER", sex: "M", age: 35 };

const inputOf = (art: string, topic = "mythclaim", size: VideoSize = "portrait"): StoryVideoInput => {
  const s = checkedStory({ topic, faces: { narrator: "w26", hero: "m09" }, art, size, health: HEALTH } as never, "F");
  if (typeof s === "string") throw new Error(`${topic}: ${s}`);
  return { ...s, art } as StoryVideoInput;
};
const ctx = (input: StoryVideoInput): StoryContext => ({
  input, size: input.size ?? "portrait", customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 6,
});

/** the eight ชุดประกันสุขภาพ devices, with a figure and without */
const DEVICES: KnowShow[] = [
  { layout: "split", title: ["เหมาจ่าย", "ต่างจากแยกจ่ายยังไง"], parts: ["ห้อง", "ยา", "ผ่าตัด", "แพทย์"], whole: "จ่ายตามจริง" },
  { layout: "limit", title: ["วงเงินต่อปี", "ใช้ไปเท่าไหร่"], limit: 5_000_000, used: 325_000, planName: "iHealthy Silver" },
  { layout: "room", title: ["ค่าห้องเดี่ยว", "ต่อคืน"], plan: 4000, real: 6000, planName: "iHealthy Smart" },
  { layout: "room", title: ["ค่าห้องเดี่ยว", "ต่อคืน"], plan: 4000, planName: "iHealthy Smart" },
  { layout: "overflow", title: ["บิลเกินวงเงิน", "ใครจ่าย?"], bill: 300_000, limit: 200_000 },
  { layout: "overflow", title: ["บิลเกินวงเงิน", "ใครจ่าย?"] },
  { layout: "waiting", title: ["สมัครวันนี้", "คุ้มครองเมื่อไหร่"], rows: [{ at: "วันนี้", label: "อุบัติเหตุ" }, { at: "30 วัน", label: "ป่วยทั่วไป" }, { at: "120 วัน", label: "บางโรค" }] },
  { layout: "cashless", title: ["ยื่นบัตร", "ไม่ต้องสำรองจ่าย"], note: "ตามเงื่อนไขการเคลม" },
  { layout: "groupgap", title: ["ประกันกลุ่ม", "จ่ายได้แค่ไหน"], bill: 325_000, group: 50_000 },
  { layout: "agecost", title: ["เบี้ยสุขภาพ", "ขึ้นตามอายุ"], rows: [{ age: 30, annual: 18_000 }, { age: 40, annual: 24_500 }, { age: 50, annual: 39_000 }, { age: 60, annual: 61_000 }], source: "เบี้ยสัญญาเพิ่มเติมสุขภาพต่อปี ไม่รวมสัญญาหลัก" },
];
const ROOM = DEVICES[2] as Extract<KnowShow, { layout: "room" }>;

/** one scene of each knowledge layout an info-shelf topic tells, with its topic and key (the topic names its icons) */
const KNOWLEDGE: { topic: string; key: KnowSceneKey; show: KnowShow }[] = (() => {
  const seen = new Map<string, { topic: string; key: KnowSceneKey; show: KnowShow }>();
  for (const t of STORY_TOPICS.filter((x) => INFO_SHELVES.includes(x.shelf))) {
    for (const scene of knowEpisode(inputOf("plot", t.key)).scenes) if (!seen.has(scene.show.layout)) seen.set(scene.show.layout, { topic: t.key, key: scene.key, show: scene.show });
  }
  return [...seen.values()];
})();

const END = 30;
const W = SIZES.portrait.w;
const H = SIZES.portrait.h;
/** a frame: the info drawers' pieces on the Kit's page */
const frame = (input: StoryVideoInput, show: KnowShow, t = END, key?: KnowSceneKey) => (
  <div style={{ display: "flex", position: "relative", width: SIZES[input.size ?? "portrait"].w, height: SIZES[input.size ?? "portrait"].h, background: kitFor(input).page, fontFamily: "Plex" }}>
    {infoDrawn(show, ctx(input), t, key)}
  </div>
);
const markup = (art: string, show: KnowShow, t = END, topic = "roomcost", key?: KnowSceneKey) => renderToStaticMarkup(frame(inputOf(art, topic), show, t, key));

const face = (file: string) => readFileSync(path.join(process.cwd(), "remotion/public/fonts", file));
const FONTS: DrawFont[] = [
  { name: "Plex", data: face("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" },
  { name: "Plex", data: face("IBMPlexSansThai-SemiBold.ttf"), weight: 600, style: "normal" },
  { name: "Mali", data: face("Mali-400.ttf"), weight: 400, style: "normal" },
  { name: "Mali", data: face("Mali-600.ttf"), weight: 600, style: "normal" },
  { name: "Sriracha", data: face("Sriracha-400.ttf"), weight: 400, style: "normal" },
  { name: "Symbols", data: face("NotoSansSymbols2-400.ttf"), weight: 400, style: "normal" },
];
const png = (el: React.ReactElement, size: VideoSize = "portrait") => drawPngHere(el, { width: SIZES[size].w, height: SIZES[size].h }, FONTS);
async function pixels(bytes: Buffer) {
  const { data, info: meta } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  return (x: number, y: number) => { const i = (y * meta.width + x) * meta.channels; return [data[i], data[i + 1], data[i + 2]]; };
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const near = (p: number[], hex: string, tol = 14) => rgb(hex).every((v, i) => Math.abs(v - p[i]) <= tol);

/** each look's page, accent and the only inks its words may be in (Review Focus 2: no dark ink on a dark ground) */
const SPEC: Record<New, { page: string; accent: string; inks: string[] }> = {
  board: { page: S.boardBoard, accent: S.boardBlue, inks: [S.boardInk, S.boardBlue, S.boardRed, S.boardGreen, S.boardMuted] },
  neon: { page: S.neonCentre, accent: S.neonCyan, inks: [S.neonInk, S.neonCyan, S.neonPink, S.neonRed, S.neonGreen, S.neonMuted, S.white] },
  blueprint: { page: S.bpGround, accent: S.bpCyan, inks: [S.bpInk, S.bpCyan, S.bpAmber, S.bpMuted] },
};

describe("the info route takes the three looks", () => {
  it("draws them by infoBody / infoDrawn (info), and keeps plot meaning the plotter only", () => {
    for (const art of [...LOOKS]) expect(info(inputOf(art)), art).toBe(true);
    for (const art of NEW) expect(plot(inputOf(art)), art).toBe(false);
    expect(plot(inputOf("plot"))).toBe(true);
  });

  it("gives each look its hand face: Mali on the board, Sriracha in neon, IBM Plex in blueprint", () => {
    expect(kitFor(inputOf("plot")).hand).toBe("Mali");
    expect(kitFor(inputOf("board")).hand).toBe("Mali");
    expect(kitFor(inputOf("neon")).hand).toBe("Sriracha");
    expect(kitFor(inputOf("blueprint")).hand).toBe("Plex");
    expect(markup("neon", ROOM)).toContain("font-family:Sriracha");
    expect(markup("board", ROOM)).toContain("font-family:Mali");
    expect(markup("blueprint", ROOM)).toContain("font-family:Plex");
  });

  it("puts the plotter's machine over plot's sheet only", () => {
    expect(markup("plot", ROOM, 0.5)).toContain(S.plotRail);
    for (const art of NEW) expect(markup(art, ROOM, 0.5), art).not.toContain(S.plotRail);
  });
});

describe("every knowledge layout and health device in each look", () => {
  it("draws through satori at the end of the animation, in portrait, square and landscape", async () => {
    expect(KNOWLEDGE.length).toBeGreaterThan(5);
    for (const art of NEW) {
      for (const k of KNOWLEDGE) {
        const bytes = await png(frame(inputOf(art, k.topic), k.show, END, k.key));
        expect(bytes.length, `${art} ${k.topic} ${k.show.layout}`).toBeGreaterThan(1000);
      }
      for (const d of DEVICES) for (const size of ["portrait", "square", "landscape"] as VideoSize[]) {
        const bytes = await png(frame(inputOf(art, "roomcost", size), d), size);
        expect(bytes.length, `${art} ${d.layout} ${size}`).toBeGreaterThan(1000);
      }
    }
  }, 240_000);

  it("writes every word in the look's own inks, never another look's", () => {
    for (const art of NEW) {
      const all = [...KNOWLEDGE.map((k) => markup(art, k.show, END, k.topic, k.key)), ...DEVICES.map((d) => markup(art, d))];
      for (const html of all) {
        const inks = [...html.matchAll(/[;"]color:([^;"]+)/g)].map((m) => m[1]);
        expect(inks.length, art).toBeGreaterThan(0);
        for (const ink of inks) expect(SPEC[art].inks, `${art} ink ${ink}`).toContain(ink);
      }
    }
  });

  it("stands on the look's page: a corner pixel is its ground", async () => {
    for (const art of NEW) {
      expect(kitFor(inputOf(art)).page, art).toBe(SPEC[art].page);
      const at = await pixels(await png(frame(inputOf(art), ROOM)));
      for (const [x, y] of [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5]]) expect(near(at(x, y), SPEC[art].page, 2), `${art} ${x},${y} ${at(x, y)}`).toBe(true);
    }
  }, 60_000);

  it("writes the heading in the look's accent", async () => {
    for (const art of NEW) {
      const at = await pixels(await png(frame(inputOf(art), ROOM)));
      let hits = 0;
      for (let y = 160; y < 320; y += 2) for (let x = 60; x < W - 60; x += 2) if (near(at(x, y), SPEC[art].accent, 10)) hits++;
      expect(hits, art).toBeGreaterThan(40);
    }
  }, 60_000);
});

describe("the neon glow", () => {
  it("is a text and box shadow in the line's own colour, on neon only", () => {
    const neon = markup("neon", ROOM);
    expect(neon).toMatch(new RegExp(`text-shadow:0 0 \\d+px ${S.neonCyan}`));
    expect(neon).toContain("box-shadow:");
    expect(neon).not.toContain("filter:blur");
    for (const art of ["plot", "board", "blueprint"]) {
      const html = markup(art, ROOM);
      expect(html, art).not.toContain("text-shadow");
      expect(html, art).not.toContain("box-shadow");
    }
  });
});

describe("how a piece comes in", () => {
  const title = kspec(ROOM).title;
  const at = (p: number) => title.at + title.dur * p;

  it("ไวต์บอร์ด and บลูพริ้นท์: written in left to right, as the pen writes", () => {
    for (const art of ["board", "blueprint"]) {
      expect(markup(art, ROOM, at(0.5)), art).toContain("clip-path:inset(");
      expect(markup(art, ROOM, END), art).not.toContain("clip-path:inset(");
    }
  });

  it("นีออน: dark, then switched on with two quick dips, then full", () => {
    const titleAt = (p: number) => {
      const m = new RegExp(`<div style="([^"]*)"><div[^>]*>${ROOM.title[0]}<`).exec(markup("neon", ROOM, at(p)));
      return m ? /opacity:([\d.]+)/.exec(m[1])?.[1] ?? "1" : "missing";
    };
    expect(titleAt(-0.1)).toBe("0");
    expect(titleAt(0.1)).toBe("1");
    expect(Number(titleAt(0.25))).toBeLessThan(0.5);
    expect(titleAt(0.35)).toBe("1");
    expect(Number(titleAt(0.45))).toBeLessThan(0.5);
    expect(titleAt(0.7)).toBe("1");
    expect(markup("neon", ROOM, at(0.5))).not.toContain("clip-path:inset(");
  });

  it("บลูพริ้นท์: each figure row has its dimension line, and no other look has one", () => {
    for (const d of DEVICES.filter((x) => ["limit", "room", "overflow", "groupgap"].includes(x.layout) && JSON.stringify(x).match(/"(used|real|bill)"/))) {
      expect(markup("blueprint", d), d.layout).toContain("data-dim");
      for (const art of ["plot", "board", "neon"]) expect(markup(art, d), `${art} ${d.layout}`).not.toContain("data-dim");
    }
  });
});

describe("Review Focus 4: the Kit is the frame's own", () => {
  it("plot, then neon, then plot: each frame in its own look", () => {
    const first = markup("plot", ROOM);
    const neon = markup("neon", ROOM);
    const again = markup("plot", ROOM);
    expect(again).toBe(first);
    expect(neon).not.toContain(S.plotInk);
    expect(neon).toContain(S.neonCyan);
    // infoShow straight after another look's frame, and infoBody's own entry
    infoShow(ROOM, ctx(inputOf("blueprint")), END);
    expect(renderToStaticMarkup(<>{infoShow(ROOM, ctx(inputOf("board")), END)}</>)).toContain(S.boardBlue);
    const episode = knowEpisode(inputOf("neon", "roomcost"));
    renderToStaticMarkup(<>{infoShow(ROOM, ctx(inputOf("plot")), END)}</>);
    expect(renderToStaticMarkup(<>{infoBody(episode.scenes[1].key, ctx(inputOf("neon", "roomcost")), END, episode)}</>)).not.toContain(S.plotInk);
  });
});
