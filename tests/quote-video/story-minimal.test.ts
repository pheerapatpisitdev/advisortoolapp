import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkedStory, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { clipCrowd, clipFrame } from "@/lib/quote-video/story-frames";
import { lookFor, paperInk, storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import { FACES, faceOf, GRANDMAS, GRANDPAS, KIDS } from "@/lib/story/faces";
import { checkedLook, DEFAULT_CAST, FIGURE_GROUNDS, footDrop, GROUNDS, lookFromId, POSES } from "@/lib/story/figure";
import { STORY_TOPICS } from "@/lib/story/topics";

const MAN = DEFAULT_CAST.hero.M;
const AGENT = DEFAULT_CAST.narrator;
const minimal = (over: Record<string, unknown> = {}): StoryVideoInput => {
  const s = checkedStory({ topic: "pool48", faces: { narrator: "w26", hero: "m09" }, art: "minimal", cast: { hero: MAN, narrator: AGENT }, ...over } as never, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};

describe("มินิมอล's input (story.ts checkedStory)", () => {
  it("keeps the style, the ground and the two the agent dressed; the ground is ม่วงอ่อน unless picked", () => {
    const s = minimal();
    expect(s.art).toBe("minimal");
    expect(s.ground).toBe("lav");
    expect(s.cast).toEqual({ hero: MAN, narrator: AGENT });
    expect(minimal({ ground: "dark" }).ground).toBe("dark");
    expect(minimal({ ground: "neon" }).ground).toBe("lav");
  });

  it("keeps no look for the faces' clips", () => {
    const s = checkedStory({ topic: "pool48", faces: { narrator: "w26", hero: "m09" }, cast: { hero: MAN, narrator: AGENT }, ground: "dark" } as never, "F");
    expect(typeof s).not.toBe("string");
    expect(s).not.toHaveProperty("art");
    expect(s).not.toHaveProperty("cast");
    expect(s).not.toHaveProperty("ground");
  });

  it("refuses a look the form does not offer, and a hero dressed as the other sex", () => {
    expect(checkedStory({ topic: "pool48", faces: { narrator: "w26", hero: "m09" }, art: "minimal", cast: { hero: { ...MAN, shirt: "#123456" }, narrator: AGENT } } as never, "F")).toBe("แต่งตัวละครให้ครบอีกครั้ง");
    expect(checkedStory({ topic: "pool48", faces: { narrator: "w26", hero: "m09" }, art: "minimal", cast: { hero: DEFAULT_CAST.hero.F, narrator: AGENT } } as never, "F")).toMatch(/เพศของตัวละครหลัก/);
    expect(checkedLook({ ...MAN, hair: "mohawk" })).toBeNull();
    expect(checkedLook({ ...MAN, glasses: "yes" })).toEqual({ ...MAN, glasses: false });
  });
});

describe("มินิมอล's people (lib/story/figure.tsx)", () => {
  it("draws the hero and the agent as dressed, everyone else the same every time, of their face's sex", () => {
    const s = minimal();
    expect(lookFor("m09", s)).toMatchObject({ ...MAN, age: "adult" });
    expect(lookFor("w26", s)).toMatchObject({ ...AGENT, age: "adult" });
    for (const f of FACES) {
      expect(lookFromId(f.id)).toEqual(lookFromId(f.id));
      expect(lookFromId(f.id).sex).toBe(faceOf(f.id)!.sex);
    }
    for (const k of KIDS) expect(lookFromId(k).age).toBe("kid");
    for (const e of GRANDPAS) expect(lookFromId(e)).toMatchObject({ age: "old", sex: "M" });
    for (const e of GRANDMAS) expect(lookFromId(e)).toMatchObject({ age: "old", sex: "F" });
  });

  it("stands a person's feet on the ground in every standing pose", () => {
    for (const name of ["stand", "think", "point", "give", "cheer", "sad", "wave", "hand"] as const) {
      expect(footDrop(POSES[name](0))).toBeGreaterThan(120);
      expect(footDrop(POSES[name](0))).toBeLessThan(135);
    }
  });

  it("writes on the ground in a colour that shows: light on the dark one", () => {
    expect(paperInk(minimal({ ground: "dark" }))).toBe(GROUNDS.dark.ink);
    expect(paperInk(minimal({ ground: "lav" }))).toBe(GROUNDS.lav.ink);
  });
});

describe("มินิมอล on screen (story-frames.tsx)", () => {
  const contact = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
  const ctx = (input: StoryVideoInput, size: StoryContext["size"], voice: string): StoryContext => ({
    input, size, customer: "", narrator: "F", contact, crowd: [], faces: {}, words: voice.split(" "), voiceSec: 5,
  });

  it("draws every scene of every story, in every shape and on every ground, with people and no faces", () => {
    for (const topic of STORY_TOPICS) for (const size of ["portrait", "square", "landscape"] as const) {
      const ground = FIGURE_GROUNDS[(STORY_TOPICS.indexOf(topic) + size.length) % 3];
      const input = minimal({
        topic: topic.key, size, ground, ...(topic.heroSex ? { faces: { narrator: "w26", hero: "w15" }, cast: { hero: DEFAULT_CAST.hero.F, narrator: AGENT } } : {}),
        ...(topic.figureRequired ? { figure: { plan: topic.plans?.[0] ?? "ISHIELD", variant: topic.plans?.[0] === "LIFEPROTECT" ? "WLF19H" : "WLCI20", sex: topic.heroSex ?? "M", age: 35, sumAssured: 1_000_000 } } : {}),
        ...(topic.ask === "due" ? { due: { date: "2026-12-01" } } : {}), ...(topic.ask === "festival" ? { festival: "newyear" } : {}),
      });
      const c = { ...ctx(input, size, ""), crowd: clipCrowd(input) };
      for (const s of storyScript(input)) {
        for (const t of [0.3, 1.5, 3]) {
          const html = renderToStaticMarkup(clipFrame(s.key, { ...c, words: s.voice.split(" ") }, t));
          expect(html, `${topic.key} ${size} ${s.key}`).not.toContain("<img");
        }
      }
    }
  });

  it("lays the ground the agent picked under every scene, and the paper under a faces' clip", () => {
    expect(renderToStaticMarkup(storyBackground("portrait", minimal({ ground: "dark" })))).toContain(GROUNDS.dark.bg);
    expect(renderToStaticMarkup(storyBackground("portrait"))).not.toContain(GROUNDS.dark.bg);
  });
});
