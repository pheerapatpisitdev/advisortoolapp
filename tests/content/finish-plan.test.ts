import { beforeEach, describe, expect, it, vi } from "vitest";
import { FINISH_HOOK_RULES, FINISH_NAME, SHARE_WHY, finishRules } from "@/lib/content/finish";
import { parsePlans, planMessages } from "@/lib/content/plan";
import { buildMessages, type Ask } from "@/lib/content/prompt";
import { PRO_HOOK_RULES, PRO_NAME } from "@/lib/content/pro";

/** สูตรอ่าน-ดูจนจบ in a plan's round: the planner picks the reason to share, the writer reports its loops. */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
const { write } = await import("@/lib/content/write");

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const planOpts = { brief: "ข้อมูล", count: 1, angle: "", avoid: [], template: null };
const ask = (over: Partial<Ask> = {}): Ask => ({
  brief: "ข้อมูล", format: "post", angle: "", custom: "", length: null, plans: [{ angle: "มุม", hook: "หัว" }], ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("the planner", () => {
  it("gets the guide's hook rules and is asked for a reason to share", () => {
    const t = text(planMessages({ ...planOpts, formula: "finish" }));
    expect(t).toContain(FINISH_HOOK_RULES);
    expect(t).toContain('"shareWhy"');
    expect(t).not.toContain(PRO_HOOK_RULES);
  });

  it("is asked for no reason under สูตรโปร or no formula", () => {
    expect(text(planMessages({ ...planOpts, formula: "pro" }))).not.toContain('"shareWhy"');
    expect(text(planMessages(planOpts))).not.toContain(FINISH_NAME);
  });

  it("keeps a known reason from its reply and drops an unknown one", () => {
    const reply = JSON.stringify({ plans: [{ angle: "a", hook: "h", shareWhy: "insider" }, { angle: "b", hook: "i", shareWhy: "fear" }] });
    expect(parsePlans(reply, 2)).toEqual([{ angle: "a", hook: "h", shareWhy: "insider" }, { angle: "b", hook: "i" }]);
  });
});

describe("the writer", () => {
  it("is told the piece's reason to share and the guide's rules, and nothing of สูตรโปร", () => {
    const t = text(buildMessages(ask({ formula: "finish", plans: [{ angle: "มุม", hook: "หัว", shareWhy: "use" }] })));
    expect(t).toContain(finishRules("post"));
    expect(t).toContain(SHARE_WHY.use.say);
    expect(t).not.toContain(PRO_NAME);
  });

  it("marks each piece with its plan's reason and the loops it reported", async () => {
    const loops = [{ open: "เดี๋ยวบอกข้อที่พลาดบ่อย", close: "ข้อที่พลาดบ่อยคือค่าห้อง" }];
    ai.chat.mockResolvedValue({ text: JSON.stringify({ pieces: [{ body: "ข้อที่พลาดบ่อยคือค่าห้อง", loops, shareWhy: "voice" }] }), model: "m", costThb: 0.5, outputTokens: 10 });
    const round = await write(ask({ formula: "finish", plans: [{ angle: "มุม", hook: "เดี๋ยวบอกข้อที่พลาดบ่อย", shareWhy: "use" }] }));
    expect(round.pieces[0].output).toMatchObject({ formula: "finish", shareWhy: "use", loops });
  });

  it("marks a สูตรโปร piece as such, with nothing of the guides", async () => {
    ai.chat.mockResolvedValue({ text: JSON.stringify({ pieces: [{ body: "เนื้อ" }] }), model: "m", costThb: 0.5, outputTokens: 10 });
    const out = (await write(ask({ formula: "pro" }))).pieces[0].output;
    expect(out.formula).toBe("pro");
    expect(out.loops).toBeUndefined();
  });
});
