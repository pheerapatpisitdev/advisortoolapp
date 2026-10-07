import { beforeEach, describe, expect, it, vi } from "vitest";

const reply = { text: "", model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0 };
const chat = vi.fn(async () => reply);

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { asksValueTable, boostedCoverIn, mergeSlots, routeMessage } = await import("@/lib/assistant/lifeprotect/route");
// these read a customer rather than a plan, and now live where both brains can reach them
const { businessDate } = await import("@/calc/calendar");
const { affirms, ageFromBirthdate, asksCheaper, saysFormDone, stalls, wantsToBuy } = await import("@/lib/assistant/common");

/** The age someone born on that date is today in Bangkok, counted the way a person counts it. */
function ageOn(today: Date, day: number, month: number, year: number): number {
  const [y, m, d] = businessDate(today).split("-").map(Number);
  const passed = m > month || (m === month && d >= day);
  return y - year - (passed ? 0 : 1);
}

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); });

describe("reading what the customer wants", () => {
  it("reads an age, a sex and a sum out of one line", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 35, sex: "M", coverWanted: 1000000 });
    expect(await routeMessage(said("ชาย 35 ล้านนึง"))).toMatchObject({
      intent: "quote", age: 35, sex: "M", coverWanted: 1000000,
    });
  });

  it("takes the term named in the message over the one the model guessed", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "WLF99H" });
    expect((await routeMessage(said("จ่าย 19 ปีเท่าไหร่"))).variant).toBe("WLF19H");
  });

  it("keeps the x 1.5 term the customer named, for the answer to turn down", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    expect((await routeMessage(said("แบบ x 1.5 จ่าย 9 ปี"))).variant).toBe("WLF09L");
  });

  it("refuses a code that is not one of this plan's packages", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "ISH10" });
    expect((await routeMessage(said("ขอราคา"))).variant).toBeUndefined();
  });

  it("drops an age outside what a person can be", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 140 });
    expect((await routeMessage(said("อายุ 140"))).age).toBeUndefined();
  });

  it("treats a question about what the family receives as a question about the plan", async () => {
    reply.text = JSON.stringify({ intent: "other" });
    expect((await routeMessage(said("ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม"))).intent).toBe("plan_info");
  });

  it("treats the advert's own button as a request for a price, whatever the model called it", async () => {
    reply.text = JSON.stringify({ intent: "plan_info", coverWanted: 1000000 });
    const routed = await routeMessage(said("สนใจประกันมรดก ทุน 1,000,000"));
    expect(routed.intent).toBe("quote");
    expect(routed.coverWanted).toBe(1000000);
  });

  it("leaves a question about what the family receives alone, sum or no sum", async () => {
    reply.text = JSON.stringify({ intent: "plan_info", coverWanted: 1000000 });
    expect((await routeMessage(said("ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม"))).intent).toBe("plan_info");
  });

  /**
   * A 56-year-old asked for 3,000,000, then checked that dying after sixty leaves 1,500,000 —
   * which it does. The bot read 1,500,000 as a new sum and quoted her "ทุน 750,000 เพิ่มเป็น
   * 1,500,000" instead of saying yes (chat 2026-10-06).
   */
  it("hears a customer checking what the family receives as a question, not a new sum", async () => {
    reply.text = JSON.stringify({ intent: "quote", coverWanted: 1500000 });
    for (const text of [
      "ถ้าเสียชีวิตหลัง 60 ปีความคุ้มครองจะเหลือ 1,500,000 บาท ใช่ไหม",
      "หลังอายุ 60 แล้ว ทุนเหลือ 1,500,000 ใช่ไหม",
    ]) {
      const routed = await routeMessage(said(text));
      expect(routed.intent).toBe("plan_info");
      expect(routed.checking).toBe(true);
      // the figure is hers to have right or wrong, not the cover she wants
      expect(routed.coverWanted).toBeUndefined();
    }
  });

  it("still prices a message that asks what the family receives and what it costs", async () => {
    reply.text = JSON.stringify({ intent: "quote", coverWanted: 2000000 });
    expect((await routeMessage(said("ทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม เบี้ยเท่าไหร่"))).intent).toBe("quote");
  });

  it("falls back to a plain conversation when the model answers with rubbish", async () => {
    reply.text = "ไม่ใช่ JSON";
    // a greeting holds nothing to read, so the fallback is a plain turn carrying its own words
    expect(await routeMessage(said("สวัสดี"))).toEqual({ intent: "other", question: "สวัสดี" });
  });
});

describe("an age given in months", () => {
  it("is a baby of nought, whatever age the model read out of it", async () => {
    // review 2026-10-01: "อายุ 8 เดือน" was priced as a child of eight
    reply.text = JSON.stringify({ intent: "quote", age: 8 });
    expect((await routeMessage(said("อายุ 8 เดือน ทุน 1 ล้าน"))).age).toBe(0);
    expect((await routeMessage(said("ลูกชาย อายุ 8 เดือน ทุน 1 ล้าน"))).age).toBe(0);
  });
});

describe("an age given as a birthdate", () => {
  it("is counted on the calendar, not by the model", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 43 });
    const routed = await routeMessage(said("เกิด 14/12/2523 ผู้หญิง"));
    expect(routed.age).toBe(ageOn(new Date(), 14, 12, 1980));
    expect(routed.age).not.toBe(43);
    // the sex is read from the message too: the year's last digits are not an age to pair it with
    expect(routed.sex).toBe("F");
  });

  it("reads a Christian-era year too", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    expect((await routeMessage(said("เกิด 14/12/1980"))).age).toBe(ageOn(new Date(), 14, 12, 1980));
  });

  it("does not count a birthday that has not come round yet", () => {
    expect(ageFromBirthdate("เกิด 31/12/2523", new Date("2026-09-13"))).toBe(45);
    expect(ageFromBirthdate("เกิด 01/01/2523", new Date("2026-09-13"))).toBe(46);
  });

  it("reads a bare birth year the way a Thai customer says it", () => {
    const today = new Date("2026-09-13");
    expect(ageFromBirthdate("เกิด2522 เพศญ", today)).toBe(47);
    expect(ageFromBirthdate("ปีเกิด 2519 ครับ", today)).toBe(50);
    expect(ageFromBirthdate("เกิด พ.ศ. 2530", today)).toBe(39);
    expect(ageFromBirthdate("เกิด 1979", today)).toBe(47);
  });

  it("does not read a birth year out of any four digits", () => {
    const today = new Date("2026-09-13");
    expect(ageFromBirthdate("สนใจประกันมรดก ทุน 1,000,000", today)).toBeUndefined();
    expect(ageFromBirthdate("ขอทุน 2000000 ครับ", today)).toBeUndefined();
    expect(ageFromBirthdate("จ่ายถึงปี 2599", today)).toBeUndefined();
  });

  it("still lets a whole date win over the year inside it", () => {
    expect(ageFromBirthdate("เกิด 31/12/2523", new Date("2026-09-13"))).toBe(45);
  });

  it("ignores a date that is not one", () => {
    expect(ageFromBirthdate("40/13/2523")).toBeUndefined();
  });
});

describe("the price being too much", () => {
  it("is heard in the words customers use for it", () => {
    for (const t of ["แพงไปหน่อย มีถูกกว่านี้ไหม", "ขอส่วนลดได้ไหม", "ลดหน่อยได้ไหมคะ", "เกินงบไปนิด"]) {
      expect(asksCheaper(t), t).toBe(true);
    }
  });

  it("is not heard in a question about the term or a request for a price", () => {
    for (const t of ["ต้องจ่ายถึงกี่ปี", "ชาย 35 ทุน 1 ล้าน", "จ่าย 19 ปีเท่าไหร่"]) {
      expect(asksCheaper(t), t).toBe(false);
    }
  });
});

describe("a bare yes", () => {
  it("is a short acceptance with nothing else in it", () => {
    for (const t of ["เอา", "เอาเลยครับ", "ตกลงค่ะ", "โอเค", "สนใจครับ", "เอาแบบลดทุน"]) {
      expect(affirms(t), t).toBe(true);
    }
  });

  it("is not a message that names an amount or asks something", () => {
    for (const t of ["เอา 3 ล้าน", "สนใจประกันมรดก ทุน 1,000,000", "ได้ไหม", "เอาแบบไหนดี"]) {
      expect(affirms(t), t).toBe(false);
    }
  });

  it("carries an offer across turns until something replaces it", () => {
    const offer = { coverWanted: 1_000_000, sumAssured: 500_000, variant: "WLF99H" };
    const merged = mergeSlots({ intent: "quote", age: 38, sex: "M", coverWanted: 2_000_000, offer }, { intent: "other" });
    expect(merged.offer).toEqual(offer);
  });
});

describe("leaving to think it over", () => {
  it("is heard in the ways people say it", () => {
    for (const t of ["เดี๋ยวคิดดูก่อนนะคะ", "ขอปรึกษาแฟนก่อนค่ะ", "ไว้จะติดต่อกลับค่ะ", "ขอเวลาคิดหน่อย", "ยังไม่ตัดสินใจครับ"]) {
      expect(stalls(t), t).toBe(true);
    }
  });

  it("is not a question that happens to mention thinking", () => {
    for (const t of ["ถ้าคิดดูแล้วสนใจ ต้องทำยังไงต่อ", "คิดดูก่อนได้ไหม", "ติดต่อกลับทางไหน", "ขอบคุณค่ะ"]) {
      expect(stalls(t), t).toBe(false);
    }
  });
});

describe("the cover a message names", () => {
  it("is read out of the message when the model missed it", async () => {
    // "ทุน1ล้าน", with no space, is what a real customer typed twice and was asked for twice
    reply.text = JSON.stringify({ intent: "quote" });
    expect((await routeMessage(said("ช 23 ทุน1ล้าน"))).coverWanted).toBe(1_000_000);
    expect((await routeMessage(said("ขอทุน 2 ล้านครับ"))).coverWanted).toBe(2_000_000);
    expect((await routeMessage(said("ทุน 500,000"))).coverWanted).toBe(500_000);
    expect((await routeMessage(said("สนใจ 5 แสน"))).coverWanted).toBe(500_000);
  });

  it("lets the model's own reading win when it has one", async () => {
    reply.text = JSON.stringify({ intent: "quote", coverWanted: 3_000_000 });
    expect((await routeMessage(said("ทุน 1 ล้าน"))).coverWanted).toBe(3_000_000);
  });

  it("is not read out of an age or a year", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    for (const t of ["ชาย 49", "เกิด2522", "จ่าย 19 ปี"]) {
      expect((await routeMessage(said(t))).coverWanted, t).toBeUndefined();
    }
  });
});

describe("when the model's reply is unusable", () => {
  it("still reads out of the message what the code can read for itself", async () => {
    // exactly what a customer sent at 06:58: a couple, one to a line, no spaces
    reply.text = "ขอโทษครับ ผมไม่เข้าใจ";
    const routed = await routeMessage(said("ญ40\nช49"));
    expect(routed.people).toEqual([{ age: 40, sex: "F" }, { age: 49, sex: "M" }]);
    expect(routed.age).toBe(40);
    expect(routed.sex).toBe("F");
  });

  it("still works out an age from a birth year", async () => {
    reply.text = "{ broken";
    expect((await routeMessage(said("เกิด2522 เพศญ"))).age).toBe(47);
  });

  it("still hears the payment term the customer named", async () => {
    reply.text = "";
    expect((await routeMessage(said("จ่าย 19 ปีเท่าไหร่"))).variant).toBe("WLF19H");
  });
});

describe("asking for the value table", () => {
  it("is heard in the ways people ask for it", () => {
    for (const t of ["ขอตารางมูลค่าหน่อยครับ", "มีตารางเวนคืนไหม", "ขอตารางครับ", "มูลค่าเวนคืนแต่ละปีเท่าไหร่", "เงินสดทุกปีดูได้ไหม", "ขอตารางผลประโยชน์"]) {
      expect(asksValueTable(t), t).toBe(true);
    }
  });

  it("is not every mention of what the policy is worth", () => {
    for (const t of ["เวนคืนได้ไหม", "ตอนอายุ 60 ได้เท่าไหร่", "ตารางเบี้ยหมดอายุหรือยัง", "ครบสัญญาได้เงินคืนไหม"]) {
      expect(asksValueTable(t), t).toBe(false);
    }
  });
});

describe("deciding to buy", () => {
  it("is heard in the ways people say it", () => {
    for (const t of ["เอาแผนนี้ครับ", "เอาแผ่นนี้", "ต้องทำยังไงต่อ", "สมัครยังไงคะ", "สนใจทำค่ะ ต้องเตรียมอะไรบ้าง", "ขั้นตอนเป็นยังไง", "ถ้าคิดดูแล้วสนใจ ต้องทำยังไงต่อ", "ใช้เอกสารอะไรบ้าง", "ซื้อได้เลยไหม"]) {
      expect(wantsToBuy(t, true), t).toBe(true);
    }
  });

  it("takes a bare ตกลง or เอา as buying only once a quotation is in hand", () => {
    for (const t of ["ตกลง", "ตกลงค่ะ", "เอาครับ"]) {
      expect(wantsToBuy(t, true), t).toBe(true);
      expect(wantsToBuy(t, false), t).toBe(false);
    }
    // an acknowledgement is not a decision
    for (const t of ["โอเค", "ครับ", "ได้ค่ะ", "รับทราบ"]) expect(wantsToBuy(t, true), t).toBe(false);
  });

  it("is not a question about paying, claiming, cancelling, or the price", () => {
    for (const t of ["จ่ายยังไง", "แพงไป ทำยังไงให้ถูกลง", "เคลมยังไง", "ยกเลิกต้องทำยังไง", "เวนคืนทำยังไง", "ผู้ชาย 35 ทุน 1 ล้านเท่าไหร่", "ต้องจ่ายถึงกี่ปี"]) {
      expect(wantsToBuy(t, true), t).toBe(false);
    }
  });

  it("hears that the form has been filled in", () => {
    for (const t of ["กรอกแล้วครับ", "กรอกเสร็จแล้วค่ะ", "ส่งฟอร์มแล้ว", "เรียบร้อยแล้วครับ", "ทำแล้วนะ"]) expect(saysFormDone(t), t).toBe(true);
    for (const t of ["กรอกยังไง", "กรอกไม่ได้", "ฟอร์มเปิดไม่ขึ้น"]) expect(saysFormDone(t), t).toBe(false);
  });
});

describe("carrying the conversation forward", () => {
  it("keeps the age and sex from an earlier turn", () => {
    const merged = mergeSlots(
      { intent: "quote", age: 35, sex: "M", coverWanted: 1000000 },
      { intent: "quote", variant: "WLF19H" },
    );
    expect(merged).toMatchObject({ age: 35, sex: "M", coverWanted: 1000000, variant: "WLF19H" });
  });

  it("stays on the quote when the customer answers what it asked for", () => {
    const merged = mergeSlots({ intent: "quote", coverWanted: 3_000_000 }, { intent: "plan_info", age: 45, sex: "F" });
    expect(merged.intent).toBe("quote");
    expect(merged.coverWanted).toBe(3_000_000);
  });

  it("does not force a quote onto a turn that supplies nothing", () => {
    const merged = mergeSlots({ intent: "quote", coverWanted: 3_000_000 }, { intent: "plan_info" });
    expect(merged.intent).toBe("plan_info");
  });

  it("does not turn a customer checking a figure back into a quotation", () => {
    const merged = mergeSlots(
      { intent: "quote", age: 56, sex: "F", coverWanted: 3_000_000 },
      { intent: "plan_info", checking: true },
    );
    expect(merged.intent).toBe("plan_info");
    expect(merged.coverWanted).toBe(3_000_000);
  });

  it("lets the newest turn overwrite what it names", () => {
    const merged = mergeSlots({ intent: "quote", coverWanted: 1000000 }, { intent: "quote", coverWanted: 500000 });
    expect(merged.coverWanted).toBe(500000);
  });
});

/**
 * "ทุน 2,500,000 เพิ่มเป็น 5,000,000 หละคะ" names the sum assured and what it doubles to.
 *
 * Read as a lone figure, 2,500,000 was taken for the family's amount and halved, and the
 * customer was quoted 1,250,000 rising to 2,500,000 — half of what she asked for.
 */
describe("a sum and what it doubles to, said together", () => {
  it("reads the second figure as what the family receives", () => {
    expect(boostedCoverIn("ทุน 2,500,000 เพิ่มเป็น 5,000,000 หละคะ")).toBe(5_000_000);
    expect(boostedCoverIn("ทุน 1,000,000 บาท เพิ่มเป็น 2,000,000")).toBe(2_000_000);
    expect(boostedCoverIn("2.5 ล้าน เพิ่มเป็น 5 ล้าน")).toBe(5_000_000);
    expect(boostedCoverIn("ทุน 3 ล้าน เพิ่มขึ้นเป็น 6 ล้าน")).toBe(6_000_000);
    expect(boostedCoverIn("1.1 ล้าน เพิ่มเป็น 2.2 ล้าน")).toBe(2_200_000);
  });

  it("does not read a pair that is not the plan's doubling", () => {
    expect(boostedCoverIn("ทุน 2 ล้าน เพิ่มเป็น 3 ล้าน")).toBeUndefined();
    expect(boostedCoverIn("ทุน 2,500,000")).toBeUndefined();
  });

  it("leaves a request to raise the sum to the reading it had", () => {
    expect(boostedCoverIn("จาก 1 ล้าน เพิ่มเป็น 2 ล้าน ได้ไหม")).toBeUndefined();
    expect(boostedCoverIn("ขอจาก 1,000,000 เพิ่มเป็น 2,000,000")).toBeUndefined();
  });

  it("wins over the model's reading of the same message", async () => {
    reply.text = JSON.stringify({ intent: "quote", coverWanted: 2_500_000 });
    const routed = await routeMessage(said("ทุน 2,500,000 เพิ่มเป็น 5,000,000 หละคะ"));
    expect(routed.coverWanted).toBe(5_000_000);
  });
});

describe("a thank-you", () => {
  it("is heard in the ways people say it, and only when it is nothing but thanks", async () => {
    const { thanksOnly } = await import("@/lib/assistant/common");
    for (const t of ["ขอบคุณค่ะ สำหรับข้อมูล", "ขอบคุณครับ", "ขอบคุณมากๆค่ะ 🙏", "ขอบคุณนะคะ", "ขอบคุณที่ให้ข้อมูลครับ"]) {
      expect(thanksOnly(t), t).toBe(true);
    }
    for (const t of ["ขอบคุณค่ะ แล้วทุน 2 ล้านล่ะ", "ขอบคุณค่ะ ขอตารางมูลค่า", "ขอบคุณ เบี้ยเท่าไหร่", "ขอบคุณค่ะ ขอปรึกษาแฟนก่อน", "สวัสดีค่ะ", "ค่ะ"]) {
      expect(thanksOnly(t), t).toBe(false);
    }
  });
});
