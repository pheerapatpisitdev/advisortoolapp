import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { clipFrame } from "@/lib/quote-video/story-frames";
import { paper, PAPER_POSES, paperTime, storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import type { StoryVideoInput } from "@/lib/quote-video/story";

/** สต็อปโมชันกระดาษ (owner, 2026-11-12): cut paper on a wooden table, held to 12 poses a second */
const input = { product: "STORY", topic: "pool48", style: "story", length: "full", palette: "reveal", size: "portrait", narrator: "F", faces: { hero: "w15", narrator: "m03" }, art: "paper" } as StoryVideoInput;
const c: StoryContext = { input, size: "portrait", customer: "", narrator: "F", contact: { name: "ตัวอย่าง", phone: "081-234-5678" }, crowd: [], faces: {}, words: ["ทดสอบ"], voiceSec: 2 };

describe("สต็อปโมชันกระดาษ", () => {
  it("holds a scene's time to twelve poses a second", () => {
    expect(PAPER_POSES).toBe(12);
    expect(paperTime(0)).toBe(0);
    expect(paperTime(0.99)).toBeCloseTo(11 / 12);
    expect(paperTime(1)).toBe(1);
    expect(paperTime(2.5)).toBe(2.5);
  });

  it("draws the same frame between two poses, and another at the next pose", () => {
    const at = (t: number) => renderToStaticMarkup(clipFrame("storyHook", c, t));
    // the title's second tile is put down at 0.45 s: not before the pose at 0.5
    expect(at(0.42)).toBe(at(0.42 + 1 / 30));
    expect(at(0.42)).not.toBe(at(0.42 + 1 / 12));
  });

  it("leaves an older clip, with no art, moving at every frame", () => {
    const old = { ...c, input: { ...input, art: undefined } as StoryVideoInput };
    expect(paper(old.input)).toBe(false);
    expect(renderToStaticMarkup(clipFrame("storyHook", old, 0.5))).not.toBe(renderToStaticMarkup(clipFrame("storyHook", old, 0.5 + 1 / 30)));
  });

  it("lays the title's words on tiles and pins a sheet on the table", () => {
    expect(renderToStaticMarkup(clipFrame("storyHook", c, 3))).toContain("rotate(");
    const table = renderToStaticMarkup(storyBackground("portrait", input));
    expect(table).toContain("#6e4a30");
    expect(table).toContain("#dcc7a3");
    expect(renderToStaticMarkup(storyBackground("portrait", { ...input, art: undefined } as StoryVideoInput))).not.toContain("#6e4a30");
  });
});

describe("ตัวละครกระดาษ", () => {
  it("draws the crowd as paper dolls, with no face picture", async () => {
    const { crowdOf } = await import("@/lib/story/faces");
    const crowd = crowdOf("w15", "m03");
    const html = renderToStaticMarkup(clipFrame("storyHook", { ...c, crowd }, 5));
    expect(html).not.toContain("<img");
    expect(html.match(/viewBox="0 0 100 130"/g)?.length).toBe(48);
  });
});

it("keeps ๆ on the tile of the word it repeats", async () => {
  const { PaperTitle } = await import("@/lib/quote-video/story-motion");
  const html = renderToStaticMarkup(PaperTitle({ w: 1080, top: 110, size: 104, t: 9, text: ["จำง่าย ๆ", ""] }));
  expect(html).toContain(">จำง่าย ๆ<");
});

describe("ฉากกระดาษใต้แสงอุ่น", () => {
  it("is มินิมอล on the warm ground: a lamp-lit stage, and no other ground gets the lamp", async () => {
    const { warm } = await import("@/lib/quote-video/story-motion");
    const { GROUNDS, isGround } = await import("@/lib/story/figure");
    const lit = { ...input, art: "minimal", ground: "warm" } as StoryVideoInput;
    expect(isGround("warm")).toBe(true);
    expect(warm(lit)).toBe(true);
    expect(warm({ ...lit, ground: "lav" } as StoryVideoInput)).toBe(false);
    const stage = renderToStaticMarkup(storyBackground("portrait", lit));
    expect(stage).toContain("radial-gradient");
    expect(stage).toContain(GROUNDS.warm.bg);
    expect(renderToStaticMarkup(storyBackground("portrait", { ...lit, ground: "lav" } as StoryVideoInput))).not.toContain("radial-gradient");
  });
});

describe("ปากกาพล็อตเตอร์", () => {
  const pen = { ...input, topic: "mythclaim", art: "plot" } as StoryVideoInput;
  const at = (i: StoryVideoInput, key: string, t: number) => renderToStaticMarkup(clipFrame(key as never, { ...c, input: i }, t));

  it("draws อินโฟกราฟิก's scenes on the plotter's sheet, in the pen's ink, with its rail", async () => {
    const { info, plot } = await import("@/lib/quote-video/story-motion");
    expect(info(pen)).toBe(true);
    expect(plot(pen)).toBe(true);
    expect(plot({ ...pen, art: "info" } as StoryVideoInput)).toBe(false);
    expect(renderToStaticMarkup(storyBackground("portrait", pen))).toContain("#f3efe4");
    const html = at(pen, "knowOne", 30);
    expect(html).toContain("#1f2126");
    expect(html).toContain("#b9bcc2");
  });

  it("leaves อินโฟกราฟิก as it was: navy, no rail", () => {
    const html = at({ ...pen, art: "info" } as StoryVideoInput, "knowOne", 30);
    expect(html).not.toContain("#b9bcc2");
    expect(html).not.toContain("#1f2126");
  });

  it("writes a piece in from the left over its own moments", () => {
    expect(at(pen, "knowOne", 0.5)).toContain("clip-path:inset(");
    expect(at(pen, "knowOne", 30)).not.toContain("clip-path:inset(");
  });
});

describe("การ์ตูนลายเส้น", () => {
  const ink = { ...input, art: "line", palette: "color" } as StoryVideoInput;

  it("draws the dolls in a black line on its white ground, with a sign for a title and no subtitle band", async () => {
    const { crowdOf } = await import("@/lib/story/faces");
    const { line, dolls, whole } = await import("@/lib/quote-video/story-motion");
    expect(line(ink)).toBe(true);
    expect(dolls(ink)).toBe(true);
    expect(whole(ink)).toBe(true);
    expect(renderToStaticMarkup(storyBackground("portrait", ink))).toContain("#fbfaf6");
    const html = renderToStaticMarkup(clipFrame("storyHook", { ...c, input: ink, crowd: crowdOf("w15", "m03") }, 5));
    expect(html).not.toContain("<img");
    expect(html.match(/viewBox="0 0 100 130"/g)?.length).toBe(48);
    expect(html).toContain("#e3e1da");
    expect(html).toContain("text-shadow");
    expect(html).not.toContain("rgba(20,22,26,0.82)");
    expect(html).toContain("border-radius:31px");
  });

  it("moves at every frame, unlike the cut paper", () => {
    const at = (t: number) => renderToStaticMarkup(clipFrame("storyHook", { ...c, input: ink }, t));
    expect(at(0.5)).not.toBe(at(0.5 + 1 / 30));
  });

  it("keeps the paper doll's white edge off the inked one", () => {
    const paperDoll = renderToStaticMarkup(clipFrame("storyHook", { ...c, crowd: ["w15"] }, 5));
    const inked = renderToStaticMarkup(clipFrame("storyHook", { ...c, input: ink, crowd: ["w15"] }, 5));
    expect(paperDoll).toContain('paint-order="stroke"');
    expect(inked).not.toContain('paint-order="stroke"');
  });
});
