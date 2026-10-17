import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoicePicker, type VoicePick } from "@/app/studio/quote-video/VoicePicker";
import { ELEVEN_VOICES } from "@/lib/voice/elevenlabs";
import { GEMINI_VOICES } from "@/lib/voice/gemini";

// เสียงพากย์ as one dropdown (owner, 2026-10-17, mockup ก) with all 30 Gemini voices
const draw = (pick: Partial<VoicePick> = {}, props: Partial<Parameters<typeof VoicePicker>[0]> = {}) =>
  renderToStaticMarkup(createElement(VoicePicker, {
    id: "v", pick: { narrator: "F", voice: "", gemini: "", ...pick }, eleven: ELEVEN_VOICES, extraBaht: "2", onPick: () => undefined, ...props,
  }));

describe("the voice dropdown", () => {
  it("holds Google's women and men, then the ElevenLabs men and women, each group with its price", () => {
    const html = draw();
    expect(html).toContain('<select id="v"');
    expect(html).toContain('label="Google ผู้หญิง · ราคาเดิม"');
    expect(html).toContain('label="Google ผู้ชาย · ราคาเดิม"');
    expect(html).toContain('label="ElevenLabs ผู้ชาย · +2 บาท"');
    expect(html).toContain('label="ElevenLabs ผู้หญิง · +2 บาท"');
    expect(html.match(/<option /g)).toHaveLength(30 + ELEVEN_VOICES.length);
    expect(html.match(/▶ ฟัง/g)).toHaveLength(1);
  });

  it("stands on the narrator's own voice until one is named", () => {
    expect(draw()).toMatch(/<option value="gemini:Kore" selected="">/);
    expect(draw({ narrator: "M" })).toMatch(/<option value="gemini:Orus" selected="">/);
    expect(draw({ narrator: "M", gemini: "Puck" })).toMatch(/<option value="gemini:Puck" selected="">/);
    // a name no longer on the list falls back to the narrator's own
    expect(draw({ narrator: "M", gemini: "Nobody" })).toMatch(/<option value="gemini:Orus" selected="">/);
  });

  it("shows an ElevenLabs voice when one is picked, with its price", () => {
    const html = draw({ voice: "nealpwJT5tCyJFKDzEq8", gemini: "Puck" });
    expect(html).toMatch(/<option value="nealpwJT5tCyJFKDzEq8" selected="">/);
    expect(html).toContain("ElevenLabs · +2 บาท");
  });

  it("leaves out the Thai ElevenLabs voices for a clip in another language, keeping all of Google's", () => {
    const html = draw({ voice: "nealpwJT5tCyJFKDzEq8", narrator: "F", gemini: "Zephyr" }, { foreign: true });
    expect(html.match(/<option /g)).toHaveLength(30);
    expect(html).not.toContain("ElevenLabs ผู้ชาย");
    expect(html).toMatch(/<option value="gemini:Zephyr" selected="">/);
  });

  it("drops the price from Google's groups when no ElevenLabs voice is offered", () => {
    const html = draw({}, { eleven: [] });
    expect(html).toContain('label="Google ผู้หญิง"');
    expect(html.match(/<option /g)).toHaveLength(30);
  });
});

describe("the 30 Gemini voices", () => {
  it("are 14 women and 16 men, each once, Kore and Orus first, every sample in public/", async () => {
    const { existsSync } = await import("node:fs");
    expect(GEMINI_VOICES).toHaveLength(30);
    expect(new Set(GEMINI_VOICES.map((v) => v.name)).size).toBe(30);
    expect(GEMINI_VOICES.filter((v) => v.sex === "F")).toHaveLength(14);
    expect(GEMINI_VOICES.find((v) => v.sex === "F")!.name).toBe("Kore");
    expect(GEMINI_VOICES.find((v) => v.sex === "M")!.name).toBe("Orus");
    for (const v of GEMINI_VOICES) expect(existsSync(`public${v.sample}`), v.sample).toBe(true);
  });
});
