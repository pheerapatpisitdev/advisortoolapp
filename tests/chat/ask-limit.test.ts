import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeAsks } from "@/lib/auth/free-asks";

/** ถาม AI: three free questions for somebody not signed in, then an invitation (owner, 2026-10-01). */

const KEY = "test-secret";
process.env.ADMIN_SESSION_SECRET = KEY;

const jar = vi.hoisted(() => ({ value: undefined as string | undefined, set: vi.fn(), ip: 0 }));
vi.mock("next/headers", () => ({
  // a fresh address per test, so the eight-a-minute burst limit never gets in the way
  headers: async () => new Headers({ "x-real-ip": `10.0.0.${jar.ip}` }),
  cookies: async () => ({ get: () => (jar.value === undefined ? undefined : { value: jar.value }), set: jar.set }),
}));
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => who.viewer }));
const brain = vi.hoisted(() => ({ answer: vi.fn() }));
vi.mock("@/lib/copilot/answer", () => ({ answerFromKnowledge: brain.answer }));

const { askCopilot } = await import("@/app/actions");

beforeEach(() => {
  vi.clearAllMocks();
  jar.value = undefined;
  who.viewer = null;
  brain.answer.mockResolvedValue({ text: "คำตอบ", model: "m" });
  jar.ip += 1;
});
const ip = () => jar.ip;

const written = () => jar.set.mock.calls.at(-1)?.[1] as string | undefined;

describe("askCopilot for somebody not signed in", () => {
  it("answers the first three and counts each in the signed cookie", async () => {
    for (const used of [0, 1, 2]) {
      jar.value = used === 0 ? undefined : encodeAsks(used, KEY);
      expect(await askCopilot(`ถาม ${used}-${ip()}`)).toEqual({ text: "คำตอบ", model: "m" });
      expect(written()).toBe(encodeAsks(used + 1, KEY));
    }
    const options = jar.set.mock.calls[0][2];
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("invites them to sign up on the fourth, without asking the model", async () => {
    jar.value = encodeAsks(3, KEY);
    const reply = await askCopilot(`ถาม ${ip()}`);
    expect(reply.text).toContain("ถามฟรีครบ 3 ข้อแล้ว");
    expect(reply.text).toContain("[สมัครสมาชิก](/signup?next=/)");
    expect(reply.text).toContain("[เข้าสู่ระบบ](/login?next=/)");
    expect(brain.answer).not.toHaveBeenCalled();
    expect(jar.set).not.toHaveBeenCalled();
  });

  it("treats a forged count as used up", async () => {
    jar.value = "0.forged";
    expect((await askCopilot(`ถาม ${ip()}`)).text).toContain("ถามฟรีครบ 3 ข้อแล้ว");
    expect(brain.answer).not.toHaveBeenCalled();
  });

  it("does not count an answer that failed", async () => {
    brain.answer.mockResolvedValue({ text: "ขัดข้อง", model: "—", failed: true });
    await askCopilot(`ถาม ${ip()}`);
    brain.answer.mockRejectedValue(new Error("boom"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await askCopilot(`ถาม ${ip()}-b`);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(jar.set).not.toHaveBeenCalled();
  });
});

describe("askCopilot for somebody signed in", () => {
  it("answers without counting, however many they have asked", async () => {
    who.viewer = { kind: "member", agentId: "m1" };
    jar.value = encodeAsks(3, KEY);
    expect(await askCopilot(`ถาม ${ip()}`)).toEqual({ text: "คำตอบ", model: "m" });
    expect(jar.set).not.toHaveBeenCalled();
  });
});
