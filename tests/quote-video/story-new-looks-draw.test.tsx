import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CARD_PALETTE as P, STORY_CLIP_COLORS as S } from "@/lib/card-theme";
import { drawPngHere } from "@/lib/draw/core";
import type { DrawFont } from "@/lib/draw/fonts";
import { checkedStory, type StorySceneKey, type StoryVideoInput } from "@/lib/quote-video/story";
import { clipFrame } from "@/lib/quote-video/story-frames";
import { knowEpisode, type KnowSceneKey, type KnowShow } from "@/lib/quote-video/story-knowledge";
import { kspec } from "@/lib/quote-video/story-knowledge-motion";
import { infoBody, infoDrawn, infoShow, kitFor } from "@/lib/quote-video/story-info-motion";
import { info, INFO_GROUND, paperInk, plot, storyBackground, storyFrame, type StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";
import { INFO_SHELVES, STORY_TOPICS } from "@/lib/story/topics";

/**
 * ไวต์บอร์ด นีออน บลูพริ้นท์ (spec 2026-11-14-story-looks-board-neon-blueprint), Task 2: each look a Kit of the
 * อินโฟกราฟิก / ปากกาพล็อตเตอร์ route, so every knowledge layout and health device is drawn in its palette, its hand
 * face and its reveal: here a frame is the drawers' pieces on the Kit's own page colour. What is around the scenes
 * (background, title, subtitle, contact card, footer) is Task 3, at the end of the file.
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

  it("writes นีออน's bold words at 400: Sriracha has no bold, and the clip would draw a 600 line in Plex", () => {
    const weights = (html: string) => [...html.matchAll(/font-weight:(\d+)/g)].map((m) => Number(m[1]));
    const all = (art: string) => [...KNOWLEDGE.map((k) => markup(art, k.show, END, k.topic, k.key)), ...DEVICES.map((d) => markup(art, d))];
    expect(kitFor(inputOf("neon")).bold).toBe(400);
    for (const html of all("neon")) {
      expect(html).toContain("font-family:Sriracha");
      for (const w of weights(html)) expect(w).toBeLessThanOrEqual(400);
    }
    // Mali and Plex have their 600 face: the board and the blueprint keep their bold
    for (const art of ["board", "blueprint"]) expect(all(art).flatMap(weights), art).toContain(600);
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

/* ── Task 3: around the scenes ─────────────────────────────────────────────────────────────────────────────────────
 * The background (storyBackground), the opening title, the subtitle band, the agent's card and the footer, each in
 * the look's dress (the spec's table and the mockup's sketches). Review Focus 2: every word drawn on a dark look can be
 * read — counted as pixels that stand 3:1 or more off what is under them, at the word's own place in the frame.
 */
const AROUND: Record<New, { wall: string; band: string; words: string; foot: string; contactHead: string }> = {
  board: { wall: S.boardWall, band: S.boardSub, words: S.white, foot: S.boardFooter, contactHead: S.boardBlue },
  neon: { wall: S.neonEdge, band: S.neonSub, words: S.neonCyan, foot: S.neonFooter, contactHead: S.neonCyan },
  blueprint: { wall: S.bpGround, band: S.bpSub, words: S.bpInk, foot: S.bpMuted, contactHead: S.bpCyan },
};
const lum = (p: number[]) => {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
type Box = { x: number; y: number; w: number; h: number };
/** the pixels in `r` of the shot that stand 3:1 or more off what is under them: `under` a colour, or the background alone */
async function readable(shotPng: Buffer, under: Buffer | string, r: Box) {
  const over = await pixels(shotPng);
  const base = typeof under === "string" ? () => rgb(under) : await pixels(under);
  let hits = 0;
  for (let y = r.y; y < r.y + r.h; y += 2) for (let x = r.x; x < r.x + r.w; x += 2) if (contrast(over(x, y), base(x, y)) >= 3) hits++;
  return hits;
}
/** the frame as the clip shows it: the look's background under the scene */
const shot = (input: StoryVideoInput, key: StorySceneKey, t: number, words = ["ทดสอบ"]) => {
  const size = input.size ?? "portrait";
  return (
    <div style={{ display: "flex", position: "relative", width: SIZES[size].w, height: SIZES[size].h }}>
      <div style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>{storyBackground(size, input)}</div>
      <div style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>{clipFrame(key, { ...ctx(input), words }, t)}</div>
    </div>
  );
};
const bg = (input: StoryVideoInput) => png(storyBackground(input.size ?? "portrait", input), input.size ?? "portrait");
const SUB_WORDS = ["ห้องที่ใช้อยู่", "6,000", "บาทต่อคืน", "แผน", "iHealthy"];

describe("Task 3: the background, as the mockup's sketches", () => {
  it("ไวต์บอร์ด: the white board in its grey frame on the pale wall, a tray with a blue and a red marker", async () => {
    for (const size of ["portrait", "square", "landscape"] as VideoSize[]) {
      const input = inputOf("board", "roomcost", size);
      const html = renderToStaticMarkup(storyBackground(size, input));
      for (const c of [S.boardWall, S.boardFrame, S.boardBoard, S.boardBlue, S.boardRed]) expect(html, `${size} ${c}`).toContain(c);
      const at = await pixels(await bg(input));
      const { w, h } = SIZES[size];
      expect(near(at(4, 4), S.boardWall, 2), `${size} wall`).toBe(true);
      expect(near(at(Math.round(w / 2), Math.round(h * 0.45)), S.boardBoard, 2), `${size} board`).toBe(true);
    }
  }, 60_000);

  it("นีออน: violet from the centre to the edges, faint low lines, one thin pink frame that glows", async () => {
    for (const size of ["portrait", "square", "landscape"] as VideoSize[]) {
      const input = inputOf("neon", "roomcost", size);
      const html = renderToStaticMarkup(storyBackground(size, input));
      expect(html).toContain("radial-gradient");
      expect(html).toContain(S.neonLine);
      expect(html).toMatch(new RegExp(`box-shadow:[^;"]*${S.neonPink}`));
      expect(html).not.toContain("filter:blur");
      const at = await pixels(await bg(input));
      const { w, h } = SIZES[size];
      expect(near(at(2, 2), S.neonEdge, 10), `${size} edge ${at(2, 2)}`).toBe(true);
      expect(near(at(Math.round(w / 2), Math.round(h * 0.35)), S.neonCentre, 6), `${size} centre`).toBe(true);
    }
  }, 60_000);

  it("บลูพริ้นท์: the blue with its fine and coarse grid, a white border, the title block bottom right", async () => {
    for (const size of ["portrait", "square", "landscape"] as VideoSize[]) {
      const input = inputOf("blueprint", "roomcost", size);
      const html = renderToStaticMarkup(storyBackground(size, input));
      for (const c of [S.bpGround, S.bpGridFine, S.bpGridCoarse, S.bpInk]) expect(html, `${size} ${c}`).toContain(c);
      const at = await pixels(await bg(input));
      expect(near(at(30, 30), S.bpGround, 2), `${size} ground ${at(30, 30)}`).toBe(true);
    }
    // the block names the plan when a health figure is in the clip, else the topic, never more than 24 letters
    const block = (input: StoryVideoInput) => /data-block="([^"]*)"/.exec(renderToStaticMarkup(storyBackground("portrait", input)))?.[1];
    expect(block(inputOf("blueprint", "roomcost"))).toBe("iHealthy Silver");
    const myth = inputOf("blueprint", "mythclaim");
    const name = STORY_TOPICS.find((x) => x.key === "mythclaim")!.name;
    expect(block({ ...myth, health: undefined })).toBe([...name].length <= 24 ? name : `${[...name].slice(0, 23).join("")}…`);
    for (const t of STORY_TOPICS) expect([...(block({ ...inputOf("blueprint", "mythclaim"), topic: t.key, health: undefined }) ?? "")].length, t.key).toBeLessThanOrEqual(24);
  }, 60_000);

  it("is never อินโฟกราฟิก's navy", () => {
    for (const art of NEW) expect(renderToStaticMarkup(storyBackground("portrait", inputOf(art))), art).not.toContain(INFO_GROUND);
  });
});

describe("Task 3: the words around the scenes", () => {
  it("writes straight on the ground in the look's ink, and the footer in its own colour at full strength", () => {
    for (const art of NEW) {
      expect(paperInk(inputOf(art)), art).toBe(kitFor(inputOf(art)).white);
      const html = renderToStaticMarkup(clipFrame("knowOne", ctx(inputOf(art, "roomcost")), END));
      const foot = /<div style="([^"]*)">Application by/.exec(html)?.[1] ?? "";
      expect(foot, art).toContain(`color:${AROUND[art].foot}`);
      expect(foot, art).not.toContain("opacity");
    }
  });

  it("sets the subtitle on the look's band, in its words' colour, in Plex", () => {
    for (const art of NEW) {
      const html = renderToStaticMarkup(clipFrame("knowOne", { ...ctx(inputOf(art, "roomcost")), words: SUB_WORDS, voiceSec: 5 }, 4.9));
      expect(html, art).toContain(`background:${AROUND[art].band}`);
      expect(html, art).toContain(`color:${AROUND[art].words}`);
      expect(html, art).not.toContain("rgba(20,22,26,0.82)");
    }
  });

  it("draws the opening title in the look's hand: a blue marker underline, a glowing tube at 400, a dimension line", () => {
    const opening = (art: string) => renderToStaticMarkup(clipFrame("knowAsk", ctx(inputOf(art, "roomcost")), END));
    expect(opening("board")).toMatch(new RegExp(`data-underline[^>]*>.*stroke="${S.boardBlue}"`));
    expect(opening("blueprint")).toContain("data-dim");
    const neon = opening("neon");
    expect(neon).toContain("font-family:Sriracha");
    expect(neon).toMatch(new RegExp(`text-shadow:0 0 \\d+px ${S.neonCyan}`));
    for (const m of neon.matchAll(/font-weight:(\d+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(400);
    for (const art of ["plot", "neon", "blueprint"]) expect(opening(art), art).not.toContain("data-underline");
    expect(opening("board")).not.toContain("data-dim");
  });

  it("lays the agent's card light on the board, and light-on-dark in นีออน and บลูพริ้นท์, each headed in its accent", () => {
    const card = (art: string) => renderToStaticMarkup(clipFrame("storyContact", ctx(inputOf(art, "roomcost")), END));
    // the board's card is the paper's, white with its dark words; its heading in the blue marker and the board's ink
    expect(card("board")).toContain(`color:${S.boardBlue}`);
    expect(card("board")).toContain(`color:${S.boardInk}`);
    expect(card("board")).toContain(`color:${P.ink}`);
    for (const art of ["neon", "blueprint"] as const) {
      const html = card(art);
      expect(html, art).toContain(`color:${AROUND[art].contactHead}`);
      expect(html, art).toContain(`color:${kitFor(inputOf(art)).white}`);
      expect(html, art).not.toContain("Sriracha");
    }
  });

  it("draws กองกลาง's title in the look's face and accent, should a look reach it", () => {
    const pool = (art: string) => renderToStaticMarkup(storyFrame("storyHook", ctx({ ...inputOf(art), topic: "pool48" } as StoryVideoInput), END));
    expect(pool("neon")).toContain("font-family:Sriracha");
    for (const m of pool("neon").matchAll(/font-weight:(\d+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(400);
    expect(pool("neon")).toContain(`color:${S.neonCyan}`);
    expect(pool("blueprint")).toContain(`color:${S.bpCyan}`);
    expect(pool("board")).toContain(`color:${S.boardBlue}`);
  });
});

describe("Task 3, Review Focus 2: every word can be read where it is drawn", () => {
  const G = { portrait: { title: 160, sub: 96, band: 92, foot: 34 } };
  it("the opening title, the subtitle over a device, the agent's card and the footer, in each look", async () => {
    for (const art of NEW) {
      const input = inputOf(art, "roomcost");
      const under = await bg(input);
      // the opening title, over the background
      const title = await readable(await png(shot(input, "knowAsk", END)), under, { x: 60, y: G.portrait.title, w: W - 120, h: 240 });
      expect(title, `${art} title`).toBeGreaterThan(400);
      // a device scene with its subtitle: the words against the band they stand on
      const dev = await png(shot(input, "knowOne", 4.9, SUB_WORDS));
      const bandTop = H - G.portrait.sub - G.portrait.band;
      expect(await readable(dev, AROUND[art].band, { x: 200, y: bandTop + 22, w: W - 400, h: 50 }), `${art} subtitle`).toBeGreaterThan(150);
      // the footer, on the ground under it
      expect(await readable(dev, under, { x: 300, y: H - G.portrait.foot - 34, w: W - 600, h: 34 }), `${art} footer`).toBeGreaterThan(30);
      // the agent's card: its heading over the ground, its name on the card
      const card = await png(shot(input, "storyContact", END));
      expect(await readable(card, under, { x: 70, y: 220, w: W - 140, h: 260 }), `${art} card head`).toBeGreaterThan(400);
    }
  }, 120_000);

  it("the agent's own lines under the card (contact.more), on the ground, in each look", async () => {
    // the same card with the lines blank (a no-break space keeps each line's height): what differs is the lines' words alone
    const withMore = (input: StoryVideoInput, more: string) => {
      const c = { ...ctx(input), contact: { ...ctx(input).contact, more } };
      return (
        <div style={{ display: "flex", position: "relative", width: W, height: H }}>
          <div style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>{storyBackground("portrait", input)}</div>
          <div style={{ position: "absolute", left: 0, top: 0, display: "flex" }}>{clipFrame("storyContact", c, END)}</div>
        </div>
      );
    };
    for (const art of NEW) {
      const input = inputOf(art, "roomcost");
      const under = await pixels(await bg(input));
      const shown = await pixels(await png(withMore(input, "ใบอนุญาต 6501234567\nรับปรึกษาวางแผนฟรี")));
      const blank = await pixels(await png(withMore(input, "\u00a0\n\u00a0")));
      let words = 0, read = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const [p, q] = [shown(x, y), blank(x, y)];
        if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 12) continue;
        words++;
        if (contrast(p, under(x, y)) >= 3) read++;
      }
      expect(words, `${art} lines drawn`).toBeGreaterThan(300);
      expect(read / words, `${art} lines read (${read}/${words})`).toBeGreaterThan(0.5);
    }
    // the looks before these keep their lines as they were, in the card's ink
    for (const art of ["plot", "info"]) {
      const c = ctx(inputOf(art, "roomcost"));
      const html = renderToStaticMarkup(clipFrame("storyContact", { ...c, contact: { ...c.contact, more: "รับปรึกษาวางแผนฟรี" } }, END));
      expect(html, art).toMatch(new RegExp(`color:${P.ink};line-height:1.45[^>]*>(<[^>]*>)*รับปรึกษาวางแผนฟรี`));
    }
  }, 120_000);
});
