import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reading a picture into a prompt, as the round sees it: what is checked before anything is
 * taken, what is set aside, and that a read that gave nothing leaves nothing held and nothing
 * delivered (so payRound hands the round back).
 */

const ip = vi.hoisted(() => ({ current: "10.0.0.1" }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (n: string) => (n === "x-forwarded-for" ? ip.current : null) }) }));

class FakeBudgetExceeded extends Error {}
const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ chat: ai.chat, BudgetExceeded: FakeBudgetExceeded }));

const auth = vi.hoisted(() => ({ requireMember: vi.fn(async () => ({ agentId: "a1", staff: null })) }));
vi.mock("@/lib/auth/viewer", () => auth);
const quota = vi.hoisted(() => ({ takeRound: vi.fn() }));
vi.mock("@/lib/auth/quota", () => quota);
const ceiling = vi.hoisted(() => ({ ceilingBeforeRound: vi.fn(async (): Promise<number | null> => null) }));
vi.mock("@/lib/content/ceiling", () => ceiling);
const store = vi.hoisted(() => ({
  contentSpentThisMonth: vi.fn(), contentCap: vi.fn(), holdContentBudget: vi.fn(), releaseContentBudget: vi.fn(async () => undefined),
}));
vi.mock("@/lib/content/store", () => store);
const round = vi.hoisted(() => ({ payRound: vi.fn(async (_pass: unknown, run: () => Promise<unknown>) => run()) }));
vi.mock("@/lib/wallet/round", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/round")>()), ...round }));

const { describePicture, DESCRIBE_HOLD_THB, DESCRIBE_TASK } = await import("@/lib/content/describe-run");
const { delivered } = await import("@/lib/wallet/round");
const { MAX_IMAGE_BASE64 } = await import("@/lib/content/describe");

const IMG = { base64: "AAAA", mimeType: "image/jpeg" };
const ANSWER = JSON.stringify({
  subject: "A family.", scene: "A park.", lighting: "Golden.", camera: "Wide.", color: "Warm.", texture: "Linen.", style: "Photo.", summaryTh: "ครอบครัวในสวน",
});
const chatOk = (text = ANSWER) => ({ text, model: "m", provider: "p", inputTokens: 1, outputTokens: 1, costThb: 0.42 });

let n = 0;
beforeEach(() => {
  vi.clearAllMocks();
  ip.current = `10.1.0.${++n}`;
  quota.takeRound.mockResolvedValue({ ok: true, paidBy: "staff" });
  store.contentSpentThisMonth.mockResolvedValue(1);
  store.contentCap.mockResolvedValue(30);
  store.holdContentBudget.mockResolvedValue({ ok: true, id: "hold-1" });
  ai.chat.mockResolvedValue(chatOk());
});

describe("describePicture", () => {
  it("sets aside ฿0.50 for a read: its two measured calls cost ฿0.27 and ฿0.30 (2026-10-08), with half as much again", () => {
    expect(DESCRIBE_HOLD_THB).toBe(0.5);
  });

  it("reads the picture, charges the round once and lets the hold go", async () => {
    const r = await describePicture(IMG);
    expect(r).toMatchObject({ ok: true, summaryTh: "ครอบครัวในสวน", costThb: 0.42 });
    expect((r as { prompt: string }).prompt).toMatch(/^Subject: A family\./);
    expect(ai.chat).toHaveBeenCalledTimes(1);
    expect(ai.chat.mock.calls[0][0]).toMatchObject({ tier: "large", task: DESCRIBE_TASK, json: true });
    expect(DESCRIBE_TASK).toBe("content-describe-picture");
    expect(quota.takeRound).toHaveBeenCalledWith(expect.anything(), "ai-describe", null, DESCRIBE_HOLD_THB);
    expect(store.holdContentBudget).toHaveBeenCalledWith(DESCRIBE_HOLD_THB, 30);
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
    expect(round.payRound).toHaveBeenCalledTimes(1);
  });

  it("reads with a model that can see pictures, and no fallback that cannot (GLM drops images and would invent one)", async () => {
    await describePicture(IMG);
    expect(ai.chat.mock.calls[0][0]).toMatchObject({ prefer: "gemini-3.7-flash", within: ["gpt-5", "claude-sonnet-5"] });
  });

  it("gives up after 50 seconds however the fallbacks run, releasing the hold and delivering nothing", async () => {
    vi.useFakeTimers();
    try {
      ai.chat.mockReturnValueOnce(new Promise(() => undefined));
      const pending = describePicture(IMG);
      await vi.advanceTimersByTimeAsync(50_001);
      const r = await pending;
      expect(r).toMatchObject({ ok: false });
      expect(delivered(r)).toBe(false);
      expect((r as { error: string }).error).toContain("ตอบไม่ทัน");
      expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells the model the measured colours, and writes the measured codes and shares into the prompt", async () => {
    ai.chat.mockResolvedValueOnce(chatOk(JSON.stringify({
      ...JSON.parse(ANSWER), palette: [{ hex: "#C41E3A", role: "dominant", where: "paper banners" }],
    })));
    const r = await describePicture({ ...IMG, palette: [{ hex: "#C41E3A", share: 38 }, { hex: "#FFFFFF", share: 22 }] });
    expect((r as { prompt: string }).prompt).toContain("Color palette: #C41E3A dominant (paper banners, 38%); #FFFFFF (22%)");
    const asked = ai.chat.mock.calls[0][0].messages[1].content as string;
    expect(asked).toContain("#C41E3A 38%");
    expect(asked).toContain("#FFFFFF 22%");
  });

  it("writes no palette line when no colours came with the picture, and still reads it", async () => {
    const r = await describePicture(IMG);
    expect(r).toMatchObject({ ok: true });
    expect((r as { prompt: string }).prompt).not.toContain("Color palette");
  });

  it("reads for a library person when asked: the model is told, and Subject names the reference person", async () => {
    const r = await describePicture({ ...IMG, asPerson: true });
    expect((r as { prompt: string }).prompt.split("\n")[0]).toMatch(/^Subject: Main person: the person from the reference photos\./);
    expect(ai.chat.mock.calls[0][0].messages[1].content).toContain("the person from the reference photos");
  });

  it("refuses the 21st read in an hour from one address, before taking a round", async () => {
    for (let i = 0; i < 20; i++) expect(await describePicture(IMG)).toMatchObject({ ok: true });
    quota.takeRound.mockClear();
    const r = await describePicture(IMG);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("20");
    expect(quota.takeRound).not.toHaveBeenCalled();
  });

  it("says so when the month's content ceiling is reached, and takes nothing", async () => {
    ceiling.ceilingBeforeRound.mockResolvedValueOnce(300);
    const r = await describePicture(IMG);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("300");
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it("gives the round's refusal back and does not call the model", async () => {
    quota.takeRound.mockResolvedValueOnce({ ok: false, refusal: "รอบฟรีหมดแล้ว" });
    expect(await describePicture(IMG)).toEqual({ ok: false, error: "รอบฟรีหมดแล้ว" });
    expect(ai.chat).not.toHaveBeenCalled();
    expect(round.payRound).not.toHaveBeenCalled();
  });

  it("says what is left when the content budget cannot hold the read", async () => {
    store.holdContentBudget.mockResolvedValueOnce({ ok: false, left: 0.2 });
    const r = await describePicture(IMG);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("0.20");
    expect(ai.chat).not.toHaveBeenCalled();
    expect(store.releaseContentBudget).not.toHaveBeenCalled();
  });

  it.each([["{}"], ["I cannot describe this picture."]])("fails cleanly on an answer with nothing usable (%s), releasing the hold and delivering nothing", async (text) => {
    ai.chat.mockResolvedValueOnce(chatOk(text));
    const r = await describePicture(IMG);
    expect(r).toEqual({ ok: false, error: "อ่านรูปนี้ไม่สำเร็จ ลองรูปอื่นนะครับ" });
    expect(delivered(r)).toBe(false);
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("fails cleanly when the model throws, releasing the hold", async () => {
    ai.chat.mockRejectedValueOnce(new Error("boom"));
    expect(await describePicture(IMG)).toEqual({ ok: false, error: "อ่านรูปนี้ไม่สำเร็จ ลองรูปอื่นนะครับ" });
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("says the AI budget is out when the whole system's budget is", async () => {
    ai.chat.mockRejectedValueOnce(new FakeBudgetExceeded("over"));
    const r = await describePicture(IMG);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("งบ");
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it.each([
    [{ base64: "AAAA", mimeType: "image/gif" }],
    [{ base64: "A".repeat(MAX_IMAGE_BASE64 + 1), mimeType: "image/jpeg" }],
    [{ base64: "", mimeType: "image/jpeg" }],
  ])("refuses a bad picture before taking a round", async (bad) => {
    expect(await describePicture(bad)).toMatchObject({ ok: false });
    expect(quota.takeRound).not.toHaveBeenCalled();
  });
});
