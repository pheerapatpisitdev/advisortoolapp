import { describe, expect, it } from "vitest";
import { mayPromptStory, PROMPT_STORY_CLOSED } from "@/lib/prompt-story/access";

describe("who may make a คลิปตามโจทย์ (prompt-story/access.ts)", () => {
  it("is every agent and member again (owner chose ก, 2026-11-18)", () => {
    const owner = { owner: true, publish: true, connect: true, admin: true };
    const assistant = { owner: false, publish: true, connect: true, admin: true };
    expect(mayPromptStory({ kind: "unitos", agentId: "o1", staff: owner } as never)).toBe(true);
    expect(mayPromptStory({ kind: "unitos", agentId: "s1", staff: assistant } as never)).toBe(true);
    expect(mayPromptStory({ kind: "unitos", agentId: "a1", staff: null } as never)).toBe(true);
    expect(mayPromptStory({ kind: "member", agentId: "m1", staff: null } as never)).toBe(true);
    expect(mayPromptStory({ kind: "super", agentId: "", staff: null } as never)).toBe(false);
    expect(mayPromptStory(null)).toBe(false);
  });
  it("tells everyone else the same words as เสียงของฉัน", () => {
    expect(PROMPT_STORY_CLOSED).toBe("ฟังก์ชันนี้ปิดใช้งานอยู่");
  });
});
