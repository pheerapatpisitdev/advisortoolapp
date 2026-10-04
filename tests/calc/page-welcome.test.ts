import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify({ intent: "other" }) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { askWhich, MENU_TEXT } = await import("@/lib/assistant/choose");
const { defaultWelcomeText, isWelcomePicture, readWelcomeInput } = await import("@/lib/assistant/page-welcome");
type PageWelcome = import("@/lib/assistant/page-welcome").PageWelcome;

const PAGE = "105982528649026";
const said = (content: string) => [{ role: "user" as const, content }];
const ask = (first: string, welcome?: PageWelcome, cameFor?: "legacy") =>
  answerAny(said(first), null, "facebook", cameFor, PAGE, welcome);

const ONE_PLAN: PageWelcome = {
  mode: "one_plan", product: "lifeprotect",
  text: "สวัสดีครับ 🙏 Life Protect\nขอทราบเพศกับอายุหน่อยครับ (เช่น ช 35)",
  pictures: ["/welcome/luckyplanner/agent.jpg"],
};
const MENU: PageWelcome = { mode: "menu", text: "หวัดดีครับ เลือกได้เลย", pictures: [] };

beforeEach(() => { chat.mockClear(); });

describe("a one-plan Page", () => {
  it.each(["สวัสดีครับ", "สนใจครับ", "ขอรายละเอียด", "hi"])("greets '%s' with its plan, and no model", async (first) => {
    const a = await ask(first, ONE_PLAN);
    expect(a.messages).toEqual([{ text: ONE_PLAN.text, opening: true }]);
    expect(a.replies ?? []).toEqual([]);
    expect(chat).not.toHaveBeenCalled();
  });

  it("then prices its plan for the person who answers", async () => {
    const first = await ask("สวัสดีครับ", ONE_PLAN);
    const history = [
      { role: "user" as const, content: "สวัสดีครับ" },
      { role: "assistant" as const, content: first.messages[0].text },
      { role: "user" as const, content: "ช 35" },
    ];
    const a = await answerAny(history, first.slots, "facebook", undefined, PAGE, ONE_PLAN);
    expect((a.slots as { product: string }).product).toBe("lifeprotect");
    expect(a.messages.some((m) => m.opening)).toBe(false);
  });

  it.each(["ชาย 35", "ทุน 1 ล้าน", "เวนคืนได้ไหม", "สนใจ iShield", "ค่าห้องเท่าไหร่"])(
    "does not greet '%s', which says something", async (first) => {
      const a = await ask(first, ONE_PLAN);
      expect(a.messages.some((m) => m.opening)).toBe(false);
    },
  );

  it("does not greet a customer an advertisement already placed", async () => {
    const a = await ask("สวัสดีครับ", ONE_PLAN, "legacy");
    expect(a.messages.some((m) => m.opening)).toBe(false);
    expect((a.slots as { product: string }).product).toBe("legacy");
  });

  it("does not greet a conversation already under way", async () => {
    const a = await answerAny(said("สวัสดีครับ"), { product: "undecided" }, "facebook", undefined, PAGE, ONE_PLAN);
    expect(a.messages.some((m) => m.opening)).toBe(false);
  });
});

describe("a menu Page", () => {
  it("says the menu in its own words, keeps the buttons, and opens with it", async () => {
    const a = await ask("สวัสดีครับ", MENU);
    expect(a.messages.at(-1)).toMatchObject({ text: MENU.text, opening: true, menu: true });
    expect(a.replies).toEqual(askWhich().replies);
  });

  it("says it again later in its words, but not as the opening", async () => {
    const a = await answerAny(said("อืม"), { product: "undecided" }, "facebook", undefined, PAGE, MENU);
    const menu = a.messages.find((m) => m.menu);
    expect(menu?.text).toBe(MENU.text);
    expect(menu?.opening).toBeUndefined();
  });
});

describe("a Page with nothing set", () => {
  it("greets with the built-in menu, as before", async () => {
    const a = await ask("สวัสดีครับ");
    expect(a.messages.at(-1)!.text).toBe(MENU_TEXT);
    expect(a.messages.some((m) => m.opening)).toBe(false);
  });
});

describe("what the back office may save", () => {
  const BUCKET = "https://x.supabase.co/storage/v1/object/public/page-welcome/";
  const read = (raw: unknown) => readWelcomeInput(raw, BUCKET);

  it("takes a one-plan greeting with an upload and a file of the site's own", () => {
    const r = read({ mode: "one_plan", product: "ishield", text: " สวัสดี \r\nครับ ", pictures: [`${BUCKET}a1b2.jpg`, "/welcome/luckyplanner/agent.jpg"] });
    expect(r).toEqual({ ok: true, value: { mode: "one_plan", product: "ishield", text: "สวัสดี \nครับ", pictures: [`${BUCKET}a1b2.jpg`, "/welcome/luckyplanner/agent.jpg"] } });
  });

  it("drops the plan from a menu greeting", () => {
    expect(read({ mode: "menu", product: "ishield", text: "x", pictures: [] })).toEqual({ ok: true, value: { mode: "menu", text: "x", pictures: [] } });
  });

  it.each([
    [{ mode: "other", text: "x" }, "แบบการต้อนรับ"],
    [{ mode: "one_plan", product: "plb", text: "x" }, "แบบประกัน"],
    [{ mode: "menu", text: "   " }, "ว่าง"],
    [{ mode: "menu", text: "ก".repeat(1501) }, "ยาวเกิน"],
    [{ mode: "menu", text: "x", pictures: Array(6).fill("/welcome/a.jpg") }, "ไม่เกิน 5"],
    [{ mode: "menu", text: "x", pictures: ["https://evil.example/a.jpg"] }, "ไม่ได้อัปโหลด"],
    [{ mode: "menu", text: "x", pictures: ["/welcome/../secret.jpg"] }, "ไม่ได้อัปโหลด"],
  ])("refuses %j", (raw, error) => {
    const r = read(raw);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toContain(error);
  });

  it("knows its own pictures and nothing else", () => {
    expect(isWelcomePicture(`${BUCKET}0f-9.png`, BUCKET)).toBe(true);
    expect(isWelcomePicture(`${BUCKET}sub/0f.png`, BUCKET)).toBe(false);
    expect(isWelcomePicture("/welcome/x.gif", BUCKET)).toBe(false);
  });

  it("starts each mode from the words the bot already says", () => {
    expect(defaultWelcomeText("menu")).toBe(MENU_TEXT);
    expect(defaultWelcomeText("one_plan", "legacy")).toContain("มรดกเพื่อครอบครัว");
  });
});
