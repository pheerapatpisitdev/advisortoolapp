import { describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";
import { siteUrl } from "@/lib/site-url";

/**
 * What the website's chat says that the inbox says differently.
 *
 * The inbox is read by the agency and the website's chat is read by nobody, so a promise that
 * a person will answer "ในแชทนี้" is kept in one and broken in the other. And the application
 * form — the one message that turns a quotation into a sale — has to be something a visitor
 * can press.
 */
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify({ intent: "other" }) : "—",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});
vi.mock("@/lib/assistant/unanswered", () => ({ noteAfterAnswer: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => { throw new Error("no database in tests"); },
}));

const { answerFromKnowledge } = await import("@/lib/copilot/answer");
const { forTheWebsite } = await import("@/lib/assistant/channel");
const {
  ABOUT_TRUST, APPLICATION_FORM, FORM_NEXT, FORM_RECEIVED, HEALTH_DECLARATION, handOverGroup,
} = await import("@/lib/assistant/common");
const { HEALTH_HAND_OVER } = await import("@/lib/assistant/ihealthy/quote");
const { openingGuide } = await import("@/lib/copilot/guide");

describe("the website's chat", () => {
  it("hands over a form that can be pressed, and promises nobody in the chat", async () => {
    const reply = await answerFromKnowledge("สนใจสมัคร");
    expect(reply.text).toContain(`[📝 เปิดฟอร์มสมัคร](${APPLICATION_FORM})`);
    expect(reply.text).not.toContain("ในแชทนี้");
  });

  it("rewrites every inbox promise that a person will come to this chat", () => {
    const group = handOverGroup().messages.map((m) => m.text).join("\n\n");
    for (const said of [FORM_NEXT, FORM_RECEIVED, ABOUT_TRUST, HEALTH_DECLARATION, HEALTH_HAND_OVER, group,
      "เรื่องนี้เดี๋ยวตัวแทนจะมาตอบในแชทนี้นะครับ"]) {
      const written = forTheWebsite(said);
      expect(written, said).not.toMatch(/(?:ตอบ|คุยต่อ|ติดต่อกลับ|แจ้ง|ไว้)ในแชทนี้/);
    }
    // a page of this site on a line of its own becomes a path in it
    expect(forTheWebsite(siteUrl("/privacy"))).toContain("](/privacy)");
  });

  it("prices iShield from its own opening button instead of sending the reader away", async () => {
    const button = openingGuide().flatMap((g) => g.items).find((i) => /ishield/i.test(i.ask))!;
    const reply = await answerFromKnowledge(button.ask);
    expect(reply.priced, button.ask).toBe(true);
    expect(reply.text).not.toContain("/other-plans");
    expect(reply.cards?.length).toBeGreaterThan(0);
  });
});
