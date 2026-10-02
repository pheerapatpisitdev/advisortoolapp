import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
let worded = "ยินดีครับ";
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route_health" ? JSON.stringify(routed) : worded,
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerHealth } = await import("@/lib/assistant/ihealthy/answer");
const { healthQuote } = await import("@/lib/assistant/ihealthy/quote");
const { hospitalReply } = await import("@/lib/assistant/hospitals");

const said = (content: string) => [{ role: "user" as const, content }];
const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const };

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; worded = "ยินดีครับ"; });

describe("before it knows who it is quoting", () => {
  it("asks for what is missing and nothing else", async () => {
    routed = { intent: "quote" };
    const answer = await answerHealth(said("ขอราคาหน่อย"), null);
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).toContain("เพศ");
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("asks only for the sex when the age is already in", async () => {
    routed = { intent: "quote", age: 35 };
    const answer = await answerHealth(said("35"), null);
    expect(answer.messages[0].text).toContain("เพศ");
    expect(answer.messages[0].text).not.toContain("ขออายุ");
  });
});

describe("the button the customer taps to get here", () => {
  it("asks for an age and a sex, without paying a model to say so", async () => {
    const answer = await answerHealth(said("🏥 ประกันสุขภาพ"), null);
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).toContain("เพศ");
    expect(chat).not.toHaveBeenCalled();
  });

  it("goes straight to the menu when the person is already known", async () => {
    const answer = await answerHealth(said("🏥 ประกันสุขภาพ"), KNOWN);
    expect(answer.replies).toEqual(["Bronze", "Silver", "Gold"]);
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("once it knows an age and a sex", () => {
  it("sends the menu, not a quote", async () => {
    routed = { intent: "quote", age: 35, sex: "F" };
    const answer = await answerHealth(said("หญิง 35"), null);
    expect(answer.replies).toEqual(["Bronze", "Silver", "Gold"]);
    expect(answer.messages[0].card).toContain("/api/ihealthy-card/table?");
  });

  it("quotes the plan that is tapped, exactly as the quote module words it", async () => {
    routed = { intent: "quote" };
    const answer = await answerHealth(said("Gold"), KNOWN);
    const expected = healthQuote({ ...KNOWN, plan: "GOLD" });
    expect(answer.messages[0].text).toBe(expected.messages[0].text);
    expect(answer.messages[0].card).toBe(expected.messages[0].card);
    expect(answer.priced).toBe(true);
    expect(answer.slots.plan).toBe("GOLD");
  });
});

describe("the answers it gives without paying a model", () => {
  const quoted = { ...KNOWN, plan: "GOLD" };

  it("offers the plans the menu left out", async () => {
    const answer = await answerHealth(said("ดูแผนอื่น"), quoted);
    expect(answer.replies).toEqual(["Smart", "Diamond", "Platinum"]);
    expect(chat).not.toHaveBeenCalled();
  });

  it("points at the cheaper plan when the price is called too high", async () => {
    const answer = await answerHealth(said("แพงไป"), { ...quoted, plan: "SILVER" });
    expect(answer.replies).toContain("Bronze");
    expect(chat).not.toHaveBeenCalled();
  });

  it("says so when there is nothing cheaper left", async () => {
    const answer = await answerHealth(said("แพงไป"), { ...quoted, plan: "SMART" });
    expect(answer.messages[0].text).toContain("ถูกที่สุด");
  });

  it("turns down a territory the plan is not written for, and names the two that are", async () => {
    const answer = await answerHealth(said("คุ้มครองเอเชียด้วยไหม"), quoted);
    expect(answer.messages[0].text).toContain("Diamond");
    expect(answer.replies).toEqual(["Diamond", "Platinum"]);
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("re-prices in a territory the plan is written for", async () => {
    const answer = await answerHealth(said("เอเชียล่ะ"), { ...quoted, plan: "DIAMOND" });
    expect(answer.messages[0].text).toContain("เอเชีย");
    expect(answer.messages[0].card).toBeDefined();
    expect(answer.slots.territory).toBe("เอเชีย");
  });

  it("describes the two ways of sharing a bill without pricing either", async () => {
    const answer = await answerHealth(said("มีแบบรับผิดส่วนแรกไหม"), quoted);
    expect(answer.messages[0].text).toContain("เฉพาะประเทศไทย");
    expect(answer.messages[0].card).toBeUndefined();
    expect(chat).not.toHaveBeenCalled();
  });

  it("sends the whole sheet as a link to the page, opened where the customer is", async () => {
    const answer = await answerHealth(said("ขอตารางเต็ม"), quoted);
    const link = answer.messages.map((m) => m.text).join("\n");
    expect(link).toContain("/ihealthy-ultra?");
    expect(link).toContain("plan=GOLD");
    expect(chat).not.toHaveBeenCalled();
  });

  /**
   * A customer asking whether there is a picture must never be told there is not.
   *
   * There is: the plans side by side, which the bot sends unprompted the moment it knows an
   * age and a sex. But "มีรูปตารางไหม" matched nothing — the full-sheet pattern wants
   * เต็ม/ทั้งหมด/ครบ after ตาราง — so the turn fell through to the model, which knows nothing
   * about what this system can draw and answered "ผมไม่มีรูปภาพตารางส่งให้นะครับ". The
   * agency's own chat denying it has the thing it sends every day.
   *
   * So the model must not be reached at all for this, which is what `chat` asserts.
   */
  for (const asked of ["มีรูปตารางไหม", "ขอรูปหน่อย", "มีภาพเปรียบเทียบไหม", "ขอการ์ด", "ส่งรูปตารางมาหน่อย"]) {
    it(`answers "${asked}" with the picture rather than with the model`, async () => {
      const answer = await answerHealth(said(asked), quoted);
      expect(answer.messages.some((m) => m.card)).toBe(true);
      expect(chat).not.toHaveBeenCalled();
    });
  }

  it("still treats a request for the whole sheet as the page, not the picture", async () => {
    // the picture carries the headline rows; the sheet has twenty-three categories and is a
    // web page, so asking for everything must not be answered with the smaller thing
    const answer = await answerHealth(said("ขอตารางผลประโยชน์ทั้งหมด"), quoted);
    expect(answer.messages.map((m) => m.text).join("\n")).toContain("/ihealthy-ultra?");
  });

  it("hands over the form when the customer decides", async () => {
    const answer = await answerHealth(said("สมัครยังไง"), quoted);
    expect(answer.messages.some((m) => m.text.includes("ktaxaform"))).toBe(true);
    expect(answer.slots.formSent).toBe(true);
    expect(chat).not.toHaveBeenCalled();
  });

  it("lets a customer leave without being sold to", async () => {
    const answer = await answerHealth(said("ขอคิดดูก่อนนะคะ"), quoted);
    expect(answer.messages).toHaveLength(1);
    expect(chat).not.toHaveBeenCalled();
  });

  it("answers the health declaration before anything else", async () => {
    const answer = await answerHealth(said("เป็นเบาหวาน ทำได้ไหม"), quoted);
    expect(answer.messages[0].text).toContain("แถลงข้อมูลสุขภาพตามจริง");
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("a question asked after a quotation", () => {
  const quoted = { ...KNOWN, plan: "GOLD" };

  it("is answered, not quoted at all over again", async () => {
    // the model has the plan in its context and hands it back; that is not a request to re-price
    routed = { intent: "quote", plan: "GOLD" };
    worded = "Gold ได้ OPD 12,000 บาทต่อปีครับ";
    const answer = await answerHealth(said("OPD ได้ไหม"), quoted);
    expect(answer.messages[0].text).toBe(worded);
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("still quotes when the customer names a different plan", async () => {
    routed = { intent: "quote" };
    const answer = await answerHealth(said("Diamond ล่ะ"), quoted);
    expect(answer.messages[0].card).toContain("plan=DIAMOND");
    expect(answer.priced).toBe(true);
  });

  it("still quotes when the customer asks for the same plan again by name", async () => {
    routed = { intent: "quote" };
    const answer = await answerHealth(said("ขอราคา Gold อีกที"), quoted);
    expect(answer.priced).toBe(true);
  });
});

describe("what it asks a model for", () => {
  it("reads the message, then words a benefit answer from the sheet", async () => {
    routed = { intent: "plan_info" };
    worded = "Gold ได้ OPD 12,000 บาทต่อปีครับ";
    const answer = await answerHealth(said("OPD ได้ไหม"), { ...KNOWN, plan: "GOLD" });
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route_health", "plan_info_health"]);
    const system = String(chat.mock.calls[1][0].messages[0].content);
    expect(system).toContain("Gold");
    expect(system).not.toContain("Platinum");
    expect(answer.messages[0].text).toBe(worded);
  });

  it("never words a premium itself", async () => {
    routed = { intent: "quote" };
    await answerHealth(said("Gold"), KNOWN);
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route_health"]);
  });
});

describe("a question about the hospital network", () => {
  it("is answered from Krungthai-AXA's list, without a model", async () => {
    const answer = await answerHealth(said("ใช้ รพ.บำรุงราษฎร์ ได้ไหม"), KNOWN);
    expect(answer.messages[0].text).toBe(hospitalReply("ใช้ รพ.บำรุงราษฎร์ ได้ไหม", "th"));
    expect(chat).not.toHaveBeenCalled();
  });

  it("does not take a question about the room for one about hospitals", async () => {
    worded = "ค่าห้องตามแผนครับ";
    routed = { intent: "plan_info" };
    const answer = await answerHealth(said("ค่าห้องโรงพยาบาลเท่าไหร่"), KNOWN);
    expect(answer.messages[0].text).not.toContain("Fax Claim");
  });
});
