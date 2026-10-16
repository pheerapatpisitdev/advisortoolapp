import { describe, expect, it } from "vitest";
import { mayPromptStory, PROMPT_STORY_CLOSED } from "@/lib/prompt-story/access";

describe("who may make a คลิปตามโจทย์ (prompt-story/access.ts)", () => {
  it("is the owner alone (owner, 2026-10-17)", () => {
    const owner = { owner: true, publish: true, connect: true, admin: true };
    const assistant = { owner: false, publish: true, connect: true, admin: true };
    expect(mayPromptStory({ kind: "unitos", agentId: "o1", staff: owner } as never)).toBe(true);
    expect(mayPromptStory({ kind: "unitos", agentId: "s1", staff: assistant } as never)).toBe(false);
    expect(mayPromptStory({ kind: "unitos", agentId: "a1", staff: null } as never)).toBe(false);
    expect(mayPromptStory({ kind: "member", agentId: "m1", staff: null } as never)).toBe(false);
    expect(mayPromptStory(null)).toBe(false);
  });
  it("tells everyone else the same words as เสียงของฉัน", () => {
    expect(PROMPT_STORY_CLOSED).toBe("ฟังก์ชันนี้ปิดใช้งานอยู่");
  });
});
