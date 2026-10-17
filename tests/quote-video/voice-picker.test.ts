import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoicePicker } from "@/app/studio/quote-video/VoicePicker";
import { ELEVEN_VOICES } from "@/lib/voice/elevenlabs";

// เสียงพากย์ as one dropdown (owner, 2026-10-17, mockup ก)
const draw = (props: Partial<Parameters<typeof VoicePicker>[0]> = {}) =>
  renderToStaticMarkup(createElement(VoicePicker, { id: "v", narrator: "F", voice: "", eleven: ELEVEN_VOICES, extraBaht: "2", onPick: () => undefined, ...props }));

describe("the voice dropdown", () => {
  it("holds Google's two, then the ElevenLabs men and women, each group with its price", () => {
    const html = draw();
    expect(html).toContain('<select id="v"');
    expect(html).toContain('label="Google · ราคาเดิม"');
    expect(html).toContain('label="ElevenLabs ผู้ชาย · +2 บาท"');
    expect(html).toContain('label="ElevenLabs ผู้หญิง · +2 บาท"');
    expect(html.match(/<option /g)).toHaveLength(2 + ELEVEN_VOICES.length);
    expect(html.match(/▶ ฟัง/g)).toHaveLength(1);
  });

  it("shows the voice picked, Gemini's narrator when no ElevenLabs voice is", () => {
    expect(draw({ narrator: "M" })).toMatch(/<option value="gemini:M" selected="">/);
    expect(draw({ voice: "nealpwJT5tCyJFKDzEq8" })).toMatch(/<option value="nealpwJT5tCyJFKDzEq8" selected="">/);
    expect(draw({ voice: "nealpwJT5tCyJFKDzEq8" })).toContain("+2 บาท");
  });

  it("leaves out the Thai ElevenLabs voices for a clip in another language", () => {
    const html = draw({ foreign: true, voice: "nealpwJT5tCyJFKDzEq8", narrator: "M" });
    expect(html.match(/<option /g)).toHaveLength(2);
    expect(html).not.toContain("ElevenLabs ผู้ชาย");
    expect(html).toMatch(/<option value="gemini:M" selected="">/);
  });

  it("is Google's two alone when no ElevenLabs voice is offered", () => {
    const html = draw({ eleven: [] });
    expect(html).toContain('label="Google"');
    expect(html.match(/<option /g)).toHaveLength(2);
  });
});
