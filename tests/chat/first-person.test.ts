import { describe, expect, it } from "vitest";
import {
  ABOUT_TRUST, APPLY_STEPS, FORM_NEXT, FORM_RECEIVED, HEALTH_DECLARATION, handOverGroup,
} from "@/lib/assistant/common";
import { HEALTH_HAND_OVER } from "@/lib/assistant/ihealthy/quote";
import { VOICE } from "@/lib/assistant/prompts";
import { HEALTH_PLAN_INFO_SYSTEM } from "@/lib/assistant/ihealthy/prompts";
import { PLAN_INFO_SYSTEM } from "@/lib/assistant/lifeprotect/prompts";
import * as en from "@/lib/assistant/ihealthy-en/words";
import { FAQ_EN } from "@/lib/assistant/ihealthy-en/faq";
import { HEALTH_PLAN_INFO_SYSTEM_EN, HEALTH_SMALL_TALK_SYSTEM_EN } from "@/lib/assistant/ihealthy-en/prompts";
import { hospitalReply } from "@/lib/assistant/hospitals";
import { forTheWebsite } from "@/lib/assistant/channel";

/**
 * The owner, 2026-10-02: the bot speaks as the one person looking after the Page — never "an
 * agent will come" — so a customer is not left wondering who they were talking to before. In
 * Thai that person is แอดมิน; in English, "I".
 */
const SOMEONE_ELSE = /ตัวแทน|มีคนมา|\ban agent\b|agents? will|\bthey will\b/i;

describe("the fixed sentences speak in the first person", () => {
  const thai = [
    ABOUT_TRUST, APPLY_STEPS, FORM_NEXT, FORM_RECEIVED, HEALTH_DECLARATION, HEALTH_HAND_OVER,
    ...handOverGroup().messages.map((m) => m.text),
  ];
  it.each(thai.map((t) => [t.slice(0, 40), t]))("Thai: %s…", (_, text) => {
    expect(text).not.toMatch(SOMEONE_ELSE);
  });

  it("calls itself แอดมิน in Thai when it cannot answer", () => {
    expect(HEALTH_HAND_OVER).toContain("แอดมิน");
  });

  const english = Object.entries(en).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v as string]);
  it.each(english)("English: %s", (_, text) => {
    expect(text).not.toMatch(SOMEONE_ELSE);
  });

  it.each(FAQ_EN.map((e) => [e.key, e]))("English FAQ: %s", (_, entry) => {
    expect(entry.answer()).not.toMatch(SOMEONE_ELSE);
  });

  it("the hospital answers too", () => {
    for (const lang of ["en", "th"] as const) {
      for (const q of ["Which hospitals in Mae Hong Son?", "โรงพยาบาลในแม่ฮ่องสอนมีไหม", "Can I use Bumrungrad?"]) {
        expect(hospitalReply(q, lang)?.text ?? "").not.toMatch(SOMEONE_ELSE);
      }
    }
  });
});

describe("what the models are told", () => {
  it.each([
    ["VOICE", VOICE], ["health", HEALTH_PLAN_INFO_SYSTEM], ["life", PLAN_INFO_SYSTEM],
  ])("Thai %s: speak as the Page, honest when asked if it is a bot", (_, prompt) => {
    expect(prompt).toContain("ผู้ช่วยตอบของเพจ");
    expect(prompt).not.toMatch(/ตัวแทนจะมาตอบ|ส่งต่อให้ตัวแทน/);
  });

  it.each([["plan info", HEALTH_PLAN_INFO_SYSTEM_EN], ["small talk", HEALTH_SMALL_TALK_SYSTEM_EN]])(
    "English %s: first person, honest when asked if it is a bot", (_, prompt) => {
      expect(prompt).toMatch(/assistant/i);
      expect(prompt).toMatch(/first person|"I"/);
      expect(prompt).not.toMatch(/say an agent will/i);
    },
  );
});

describe("the website, where nobody reads the chat", () => {
  it("turns 'I'll get back to you in this chat' into the form", () => {
    const out = forTheWebsite(HEALTH_HAND_OVER);
    expect(out).toContain("ฟอร์ม");
    expect(out).not.toContain("ในแชทนี้");
  });
});
