import { beforeEach, describe, expect, it, vi } from "vitest";

/** ถาม AI is for members only (owner, 2026-10-12: "เป็นระบบปิด"); the three free questions are gone. */

const who = vi.hoisted(() => ({ viewer: null as unknown, n: 0 }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => who.viewer }));
const brain = vi.hoisted(() => ({ answer: vi.fn() }));
vi.mock("@/lib/copilot/answer", () => ({ answerFromKnowledge: brain.answer }));

const { askCopilot } = await import("@/app/actions");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = null;
  who.n += 1;
  brain.answer.mockResolvedValue({ text: "คำตอบ", model: "m" });
});

describe("askCopilot for somebody not signed in", () => {
  it("asks them to sign in, without asking the model", async () => {
    const reply = await askCopilot("iShield อายุ 40 เบี้ยเท่าไร");
    expect(reply.text).toContain("ใช้ได้เฉพาะสมาชิก");
    expect(reply.text).toContain("[เข้าสู่ระบบ](/?next=/home)");
    expect(brain.answer).not.toHaveBeenCalled();
  });

  it("treats a failed read of who is asking as nobody", async () => {
    vi.doMock("@/lib/auth/viewer", () => ({ getViewer: async () => { throw new Error("db down"); } }));
    vi.resetModules();
    const { askCopilot: fresh } = await import("@/app/actions");
    expect((await fresh("ถาม")).text).toContain("ใช้ได้เฉพาะสมาชิก");
    expect(brain.answer).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/auth/viewer");
  });
});

describe("askCopilot for somebody signed in", () => {
  it("answers, however many they have asked", async () => {
    who.viewer = { kind: "member", agentId: `m${who.n}` };
    for (const i of [1, 2, 3, 4]) expect(await askCopilot(`ถาม ${i}`)).toEqual({ text: "คำตอบ", model: "m" });
  });

  it("stops one person asking more than eight a minute", async () => {
    who.viewer = { kind: "member", agentId: `burst${who.n}` };
    const replies = [];
    for (let i = 0; i < 9; i++) replies.push(await askCopilot(`ถาม ${i}`));
    expect(replies.slice(0, 8).every((r) => r.text === "คำตอบ")).toBe(true);
    expect(replies[8]).toMatchObject({ failed: true });
    expect(brain.answer).toHaveBeenCalledTimes(8);
  });
});
