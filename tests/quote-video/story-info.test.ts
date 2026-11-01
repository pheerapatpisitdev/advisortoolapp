import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkedStory, storyScript, type StoryVideoInput } from "@/lib/quote-video/story";
import { clipFrame } from "@/lib/quote-video/story-frames";
import { fitSize } from "@/lib/quote-video/story-info-motion";
import { INFO_GROUND, paperInk, storyBackground, type StoryContext } from "@/lib/quote-video/story-motion";
import { INFO_SHELVES, STORY_TOPICS } from "@/lib/story/topics";

const LIFE30 = { plan: "LIFEPROTECT", variant: "WLF99H", sex: "M", age: 30, sumAssured: 1_000_000 };
const info = (over: Record<string, unknown> = {}): StoryVideoInput => {
  const s = checkedStory({ topic: "fiverisks", faces: { narrator: "w26", hero: "m09" }, art: "info", ...over } as never, "F");
  if (typeof s === "string") throw new Error(s);
  return s;
};

describe("อินโฟกราฟิก's input (story.ts checkedStory)", () => {
  it("keeps the look on ความรู้ประกัน and ตอบข้อโต้แย้ง, and on no other shelf", () => {
    expect(INFO_SHELVES).toEqual(["knowledge", "objection"]);
    for (const t of STORY_TOPICS) {
      const s = checkedStory({ topic: t.key, faces: { narrator: "w26", hero: "m09" }, art: "info", festival: "newyear", due: { date: "2026-12-01" } } as never, "F");
      if (typeof s === "string") continue;
      expect(s.art, t.key).toBe(INFO_SHELVES.includes(t.shelf) ? "info" : undefined);
    }
  });

  it("draws on Motion's navy, with the words written straight on it in white", () => {
    expect(renderToStaticMarkup(storyBackground("portrait", info()))).toContain(INFO_GROUND);
    expect(paperInk(info())).toBe("#ffffff");
  });
});

describe("อินโฟกราฟิก on screen (story-info-motion.tsx)", () => {
  const contact = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
  const ctx = (input: StoryVideoInput, size: StoryContext["size"], voice: string): StoryContext => ({
    input, size, customer: "", narrator: "F", contact, crowd: [], faces: {}, words: voice.split(" "), voiceSec: 5,
  });

  it("draws every scene of every episode it is offered for, in every shape, with no one's face", () => {
    for (const t of STORY_TOPICS.filter((x) => INFO_SHELVES.includes(x.shelf))) for (const size of ["portrait", "square", "landscape"] as const) {
      for (const over of [{}, t.key === "bank" || t.key === "pricey" ? { figure: LIFE30 } : t.figure === "ladder" ? { ladder: true } : {}]) {
        const input = info({ topic: t.key, size, ...over });
        for (const s of storyScript(input)) {
          const html = renderToStaticMarkup(clipFrame(s.key, ctx(input, size, s.voice), 7));
          expect(html.length, `${t.key} ${size} ${s.key}`).toBeGreaterThan(400);
          if (s.key !== "storyContact") expect(html, `${t.key} ${s.key}`).not.toContain("<img");
        }
      }
    }
  });

  it("gives each point of 5 เรื่องใหญ่ its number and its own icon", () => {
    const input = info();
    const [, , two] = storyScript(input);
    const html = renderToStaticMarkup(clipFrame(two.key, ctx(input, "portrait", two.voice), 7));
    for (const w of ["จากไปเร็ว", "อยู่นานเกิน", "ป่วยโรคร้ายแรง", ">1<", ">2<", ">3<"]) expect(html).toContain(w);
    expect(html.match(/<svg/g)?.length).toBe(3);
  });

  it("sets a long run with no space smaller, so it stays on its tile", () => {
    expect(fitSize("สอบ", 58, 600)).toBe(58);
    expect(fitSize("จ่ายได้เดือนละเท่าไรไม่เดือดร้อน", 58, 600)).toBeLessThan(58);
    expect(fitSize("จ่ายได้เดือนละเท่าไรไม่เดือดร้อน", 58, 10)).toBe(35);
  });
});
