import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_HERO_FACE, faceOf, narratorFaceFor } from "@/lib/story/faces";

/**
 * เอาหน้าวาดมือออก (owner chose ก ก, 2026-11-17): the forms no longer offer the hand-drawn faces, as the clips draw
 * paper dolls; the system picks every character. วาดมือบนกระดาษ opens on the shield and the family like every theme.
 */
describe("the hand-drawn faces left the forms", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("offers no face to pick in คลิปเล่าเรื่อง or คลิปตามโจทย์", () => {
    for (const p of ["src/app/studio/story-clip/StoryClipBoard.tsx", "src/app/studio/prompt-story/LookStep.tsx", "src/app/studio/prompt-story/PromptStoryBoard.tsx"]) {
      expect(read(p), p).not.toMatch(/FacePicker|faceSrc|story-narrator-face/);
    }
  });

  it("gives the agent's own character the narrator voice's sex, never the hero's default", () => {
    expect(faceOf(narratorFaceFor("F"))?.sex).toBe("F");
    expect(faceOf(narratorFaceFor("M"))?.sex).toBe("M");
    for (const s of ["F", "M"] as const) for (const h of ["F", "M"] as const) expect(narratorFaceFor(s)).not.toBe(DEFAULT_HERO_FACE[h]);
  });

  it("opens วาดมือบนกระดาษ on the shield and the family: no theme draws faces into the opening", () => {
    expect(read("src/lib/quote-video/themes.tsx")).not.toMatch(/themeHero|faceUris/);
    expect(read("remotion/src/Clip.tsx")).not.toMatch(/themeHero/);
  });
});
