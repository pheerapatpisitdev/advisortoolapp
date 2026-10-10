import { describe, expect, it } from "vitest";
import { answerIShield, COVER_CHOICES, ishieldTermIn, fitBudget, savingIn, termFor } from "@/lib/assistant/ishield/answer";
import { quote } from "@/calc/quote";
import { formatBaht } from "@/calc/money";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { ISHIELD_SUMS } from "@/lib/quote-pdf/pages";
import { BUDGET_INVITE } from "@/lib/assistant/common";

/** The rate table behind these figures is current on this date. */
const WHILE_CURRENT = new Date("2026-09-05");

const answer = (said: string, previous: Parameters<typeof answerIShield>[1] = null) =>
  answerIShield(said, previous, "facebook", WHILE_CURRENT);

const spoken = (a: ReturnType<typeof answerIShield>) => a.messages.map((m) => m.text).join("\n");

describe("the monthly saving a customer names", () => {
  it("reads the buttons it offers, and the ways a person types the same thing", () => {
    for (const said of ["ออมเดือนละ 2,000 บาท", "ออมเดือนละ 3,000 บาท"]) {
      expect(savingIn(said)).toBeGreaterThan(0);
    }
    expect(savingIn("เดือนละ 3000")).toBe(3000);
    expect(savingIn("3,000 บาท")).toBe(3000);
    expect(savingIn("5000")).toBe(5000);
  });

  /**
   * A bare two-digit number in this conversation is an age, not a premium.
   *
   * The plan asks for a saving where every other plan asks for a sum, so the reader that
   * fills that slot sits next to the one that reads "ชาย 35" — and a reader willing to take
   * any number at all would price a thirty-five-baht premium for a man of no stated age.
   */
  it("does not read an age as a saving", () => {
    expect(savingIn("ชาย 35")).toBeUndefined();
    expect(savingIn("35")).toBeUndefined();
    expect(savingIn("อายุ 40 ครับ")).toBeUndefined();
  });
});

describe("the paying term", () => {
  it("opens on the one the sales page opens on", () => {
    expect(termFor(35)).toBe("WLCI10");
  });

  /**
   * The terms do not all end at the same age — the ten-year stops at 51 and the fifteen
   * runs to 56 — so an age past the usual one is quoted on a term that takes it rather than
   * refused on the term that does not.
   */
  it("moves to a term that takes the customer rather than turning them away", () => {
    expect(termFor(55)).toBe("WLCI15");
  });

  it("gives up only when no term will have them", () => {
    expect(termFor(60)).toBeUndefined();
  });
});

describe("a paying term the customer names", () => {
  it("reads the ways a person asks for one", () => {
    expect(ishieldTermIn("ส่ง 20 ปี")).toBe("WLCI20");
    expect(ishieldTermIn("ขอแบบส่ง 20 ปีด้วย")).toBe("WLCI20");
    expect(ishieldTermIn("จ่าย 15 ปี")).toBe("WLCI15");
    expect(ishieldTermIn("ชำระเบี้ย 5 ปี")).toBe("WLCI05");
    expect(ishieldTermIn("แบบ 10 ปี")).toBe("WLCI10");
    expect(ishieldTermIn("20 ปีจบ")).toBe("WLCI20");
  });

  /** "อายุ 20 ปี" is an insured, not a term, and a term this plan is not sold in is no term */
  it("does not read an age, or a term the plan does not have", () => {
    expect(ishieldTermIn("อายุ 20 ปี")).toBeUndefined();
    expect(ishieldTermIn("ชาย 20")).toBeUndefined();
    expect(ishieldTermIn("ส่ง 7 ปี")).toBeUndefined();
  });

  const tenYear = { product: "ishield" as const, age: 35, sex: "M" as const, variant: "WLCI10", sumAssured: 1_000_000, told: true as const };

  /** the inbox, 2026-10-02: asked for the twenty-year premium and was sent the ten-year one again */
  it("re-quotes the same sum on the term asked for", () => {
    const a = answer("ขอเบี้ยแบบส่ง 20 ปี", tenYear);
    expect(a.priced).toBe(true);
    expect(a.slots.variant).toBe("WLCI20");
    expect(a.slots.sumAssured).toBe(1_000_000);
    expect(spoken(a)).toContain("ชำระเบี้ย 20 ปี");
    expect(a.messages[0].card).toContain("variant=WLCI20");
  });

  it("takes the term said in the same breath as the person and the sum", () => {
    const a = answer("iShield ชาย 35 ทุน 1 ล้าน ส่ง 20 ปี");
    expect(a.slots.variant).toBe("WLCI20");
    expect(spoken(a)).toContain("ชำระเบี้ย 20 ปี");
  });

  it("keeps a term named before the customer said who they are", () => {
    const first = answer("ส่ง 20 ปี");
    const person = answer("ชาย 35", first.slots);
    const a = answer(COVER_CHOICES[1], person.slots);
    expect(a.slots.variant).toBe("WLCI20");
    expect(spoken(a)).toContain("ชำระเบี้ย 20 ปี");
  });

  /** the twenty-year term is issued to 52; a customer of 55 is told so, not quoted on it */
  it("says so when the term asked for will not take their age", () => {
    const fifteen = { ...tenYear, age: 55, variant: "WLCI15" };
    const a = answer("ส่ง 20 ปี", fifteen);
    expect(a.priced).toBeFalsy();
    expect(spoken(a)).toContain("52");
    expect(spoken(a)).toContain("15 ปี");
    expect(a.slots.variant).toBe("WLCI15");
  });
});

describe("a customer who says they are unwell", () => {
  const tenYear = { product: "ishield" as const, age: 35, sex: "M" as const, variant: "WLCI10", sumAssured: 1_000_000, told: true as const };

  /**
   * The inbox, 2026-10-02: "เป็นเบาหวานสมัครได้ไหม" read as "สมัคร" and was sent the form. On a
   * critical-illness contract that is the costliest wrong answer there is, so a condition is
   * answered with the declaration before anything else is read — the form included.
   */
  it("is told about the health declaration, not sent the form", () => {
    for (const said of ["เป็นเบาหวานสมัครได้ไหม", "ความดันสูง กินยาอยู่ สนใจสมัคร", "เคยผ่าตัดไส้ติ่ง ทำได้ไหม"]) {
      const a = answer(said, tenYear);
      expect(spoken(a), said).toContain("แถลงข้อมูลสุขภาพ");
      expect(a.slots.formSent, said).toBeUndefined();
      expect(a.priced, said).toBeFalsy();
    }
  });

  it("is told before being asked who they are", () => {
    const a = answer("มีโรคประจำตัว ทำได้ไหมครับ");
    expect(spoken(a)).toContain("แถลงข้อมูลสุขภาพ");
    expect(spoken(a)).not.toContain("เพศกับอายุ");
  });

  /** on this plan "มะเร็ง" is as often what is covered as what someone has */
  it("leaves a question about what the plan pays for alone", () => {
    for (const said of ["มะเร็งคุ้มครองไหม", "โรคหัวใจคุ้มครองไหม", "ถ้าเป็นมะเร็งรับเงินแล้วยังคุ้มครองต่อไหม"]) {
      expect(spoken(answer(said, tenYear)), said).not.toContain("แถลงข้อมูลสุขภาพ");
    }
    expect(answer("มีโรคอะไรบ้าง", tenYear).messages[0].card).toBeDefined();
  });
});

describe("the other paying terms, offered under the quotation", () => {
  it("are the terms that take the customer, less the one just quoted", async () => {
    const { WANTS_IN } = await import("@/lib/assistant/common");
    const a = answer(COVER_CHOICES[1], { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    expect(a.replies?.[0]).toBe(WANTS_IN);
    expect(a.replies).toEqual(expect.arrayContaining(["ส่ง 5 ปี", "ส่ง 15 ปี", "ส่ง 20 ปี"]));
    expect(a.replies).not.toContain("ส่ง 10 ปี");
  });

  it("are each read back as the term they name, and priced", () => {
    const first = answer(COVER_CHOICES[1], { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    for (const tap of (first.replies ?? []).filter((r) => r.startsWith("ส่ง "))) {
      const a = answer(tap, first.slots);
      expect(a.priced, tap).toBe(true);
      expect(spoken(a), tap).toContain(`ชำระเบี้ย ${tap.replace(/\D/g, "")} ปี`);
    }
  });

  /** at 53 only the fifteen-year term takes them, so there is nothing else to offer */
  it("leave out a term the age is past", () => {
    const a = answer(COVER_CHOICES[1], { product: "ishield", age: 53, sex: "M", variant: "WLCI15" });
    expect(a.replies?.filter((r) => r.startsWith("ส่ง "))).toEqual([]);
  });
});

describe("a budget turned into a sum", () => {
  const WHO = { age: 35, sex: "M" as const, variant: "WLCI10" };

  it("buys the biggest sum on the sales page's list that fits, priced at what it actually costs", () => {
    const fit = fitBudget(WHO, { baht: 3000, per: "month" }, WHILE_CURRENT);
    expect(fit).toBeDefined();
    expect(ISHIELD_SUMS).toContain(fit!.sum);
    // the premium lands at or under what the customer said — the next sum up does not
    expect(fit!.total / 100).toBeLessThanOrEqual(3000);
    const next = ISHIELD_SUMS[ISHIELD_SUMS.indexOf(fit!.sum) + 1];
    const priced = quote({ planCode: "ISHIELD", ...WHO, mode: "monthly", sumAssured: next, riders: [] }, WHILE_CURRENT);
    expect(priced.totalModal / 100).toBeGreaterThan(3000);
  });

  it("reads a yearly budget in yearly instalments", () => {
    const fit = fitBudget(WHO, { baht: 60_000, per: "year" }, WHILE_CURRENT);
    expect(fit!.total / 100).toBeLessThanOrEqual(60_000);
  });

  it("never sells below the plan's own minimum: a budget that does not reach it buys nothing", () => {
    expect(fitBudget(WHO, { baht: 500, per: "month" }, WHILE_CURRENT)).toBeUndefined();
  });
});

describe("the conversation", () => {
  /**
   * The question is the whole of the first answer.
   *
   * The leaflet used to come first and the question under it, which spent a customer's one
   * willing moment on reading. It is still said — on the turn after, once they have answered.
   */
  it("asks who they are first, and says what the plan is once they have answered", () => {
    const first = answer("สนใจครับ");
    expect(spoken(first)).toContain("เพศกับอายุ");
    expect(spoken(first)).not.toContain("70 โรค");

    const next = answer("ชาย 35", first.slots);
    expect(spoken(next)).toContain("70 โรค");
    expect(spoken(next)).toContain("85");
  });

  /**
   * The sum is asked for outright, in the six amounts the contract is sold in.
   *
   * A saving is still read where a customer names one — the question changed, not the
   * arithmetic — and every button has to be a phrase the reader takes back as a sum.
   */
  it("asks what cover they want, in sums the plan is written for", () => {
    const a = answer("ชาย 35");
    expect(spoken(a)).toContain("ทุนประกันเท่าไหร่");
    expect(a.replies).toEqual(COVER_CHOICES);
    for (const said of COVER_CHOICES) {
      const priced = answer(said, { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
      expect(priced.priced).toBe(true);
    }
  });

  it("turns away an age no term will take, and names one that would", () => {
    const a = answer("ชาย 60");
    expect(spoken(a)).toContain("สมัครแบบนี้ไม่ได้");
    expect(spoken(a)).toContain("เบี้ยไม่ทิ้ง");
    expect(a.slots.age).toBeUndefined();
  });

  const priced = answer("ออมเดือนละ 3,000 บาท", { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });

  it("quotes the sum, the premium and what the contract pays back", () => {
    expect(priced.priced).toBe(true);
    expect(priced.messages[0].card).toContain("plan=ISHIELD");
    // a budget lands on a sum the sales page's slider stops at, so the page's PDF of it exists
    const sum = Number(new URL(`https://x${priced.messages[0].card}`).searchParams.get("sum"));
    expect(ISHIELD_SUMS).toContain(sum);
    expect(priced.messages[0].pdfPath).toBeDefined();
    expect(spoken(priced)).toContain("ทุนประกัน");
    expect(spoken(priced)).toContain("85");
  });

  it("invites a budget once, after the first quote and its table, before the health line", () => {
    const first = answer(COVER_CHOICES[0], { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    const texts = first.messages.map((m) => m.text);
    const at = texts.indexOf(BUDGET_INVITE);
    expect(at).toBeGreaterThan(0);
    expect(first.messages[at - 1].card).toContain("/api/card/table");
    expect(at).toBe(texts.length - 2);
    expect(first.slots.budgetAsked).toBe(true);

    const again = answer(COVER_CHOICES[1], first.slots);
    expect(again.messages.some((m) => m.text === BUDGET_INVITE)).toBe(false);
  });

  it("quotes a budget as card, table and PDF, then stays on it for another term", () => {
    const asked = answer("งบเดือนละ 3,000", { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    expect(asked.priced).toBe(true);
    expect(spoken(asked)).toContain("งบเดือนละ 3,000 บาท");
    expect(spoken(asked)).not.toContain(BUDGET_INVITE);
    const sum10 = asked.slots.sumAssured!;
    const then = answer("ส่ง 20 ปี", asked.slots);
    expect(then.slots.variant).toBe("WLCI20");
    expect(then.slots.budget).toEqual({ baht: 3000, per: "month" });
    // the longer term is cheaper a year, so the same money buys at least as much cover
    expect(then.slots.sumAssured!).toBeGreaterThanOrEqual(sum10);
    expect(then.messages[0].card).toContain(`sum=${then.slots.sumAssured}`);
  });

  it("takes a yearly budget and leads with the yearly instalment", () => {
    const asked = answer("ปีละ 60,000", { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    expect(asked.priced).toBe(true);
    expect(asked.messages[0].text).toMatch(/เบี้ย [\d,]+ บาท\/ปี \(เดือนละ/);
  });

  it("keeps a budget given before the person, and prices it when they arrive", () => {
    const first = answer("มีงบเดือนละ 3,000");
    expect(spoken(first)).toContain("เพศกับอายุ");
    expect(first.slots.budget).toEqual({ baht: 3000, per: "month" });
    const then = answer("ชาย 35", first.slots);
    expect(then.priced).toBe(true);
  });

  it("does not lift a budget to the minimum sum: it says the budget is short", () => {
    const a = answer("งบเดือนละ 600", { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    expect(a.priced).toBeFalsy();
    expect(a.messages.some((m) => m.card)).toBe(false);
    expect(spoken(a)).toContain("ทุนขั้นต่ำ");
    expect(spoken(a)).toContain("100,000");
    expect(a.slots.sumAssured).toBeUndefined();
  });

  it("remembers the sales page's PDF of the same arrangement as the card", () => {
    const onSlider = answer(COVER_CHOICES[0], { product: "ishield", age: 35, sex: "M", variant: "WLCI10" });
    const card = new URL(`https://x${onSlider.messages[0].card}`).searchParams;
    expect(onSlider.messages[0].pdfPath).toBe(quotePdfPath({
      kind: "plan", planCode: "ISHIELD", variant: card.get("variant")!, age: Number(card.get("age")),
      sex: card.get("sex") as "M" | "F", sumAssured: Number(card.get("sum")),
    }));
    expect(onSlider.messages[0].pdfPath).toContain("page=ishield&age=35&sex=M&sum=500000");
    // only the quote carries it: the value table beside it is not what the file prints
    expect(onSlider.messages.slice(1).some((m) => m.pdfPath)).toBe(false);
  });

  /**
   * The table is the argument, so it travels with the claim rather than behind a button.
   *
   * This is the plan whose whole case is that the premium comes back. The year-by-year cash
   * value against the premiums paid is where that case is actually made, and making the
   * customer ask for it is making them ask for the evidence of what they were just told.
   */
  it("sends the year-by-year value table beside the quotation", () => {
    const table = priced.messages.find((m) => m.card?.includes("/api/card/table"));
    expect(table).toBeDefined();
    expect(table!.text).toBe("กราฟและตารางมูลค่าทุกปี\nเบี้ยต่อปี | เวนคืน | ความคุ้มครอง");
    // a chat's table carries the little people on its chart
    expect(table!.card).toContain("&fig=1&v=");
  });

  /**
   * What this contract does not do, said by this contract rather than left to be found out.
   *
   * It pays for an illness and it pays nothing towards a hospital bill: the room, the doctor
   * and the drugs arrive every time somebody is admitted, and they are a different contract.
   * The customer holding this quotation is the one person in the day who wants to hear it.
   */
  it("names the gap it leaves, in its own bubble, with the health plan under it", async () => {
    const { CHOOSE_HEALTH } = await import("@/lib/assistant/choose");
    expect(priced.messages.at(-1)?.text).toContain("ค่าห้อง");
    expect(priced.messages.at(-1)?.card).toBeUndefined();
    expect(priced.replies).toContain(CHOOSE_HEALTH);
  });

  it("says the same figure the engine says", () => {
    const sum = priced.slots.sumAssured!;
    const engine = quote({
      planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", mode: "annual",
      sumAssured: sum, riders: [],
    }, WHILE_CURRENT);
    expect(spoken(priced)).toContain(formatBaht(engine.totalAnnual));
  });

  /**
   * The customer carried across from the other arrangement arrives with an age and no term.
   *
   * The term is this plan's business and nothing outside it knows to set one, so a person
   * handed over by the dispatcher was being told the plan would not take them — at an age it
   * takes perfectly well. The slots below are exactly what the hand-over produces.
   */
  it("takes a person handed over from another plan without turning them away", () => {
    const a = answer("สนใจครับ", { product: "ishield", age: 35, sex: "M" });
    expect(spoken(a)).not.toContain("สมัครแบบนี้ไม่ได้");
    expect(a.slots.variant).toBe("WLCI10");
  });

  /** And is told what the plan is, which is the thing they pressed a button to find out. */
  it("introduces itself to that person rather than going straight to a question", () => {
    const a = answer("🌱 มรดก+ออม+โรคร้าย", { product: "ishield", age: 35, sex: "M" });
    expect(spoken(a)).toContain("70 โรค");
    expect(spoken(a)).toContain("ทุนประกันเท่าไหร่");
  });

  it("does not introduce itself twice", () => {
    const a = answer("ครับ", { product: "ishield", age: 35, sex: "M", variant: "WLCI10", told: true });
    expect(spoken(a)).not.toContain("70 โรค");
  });
});

describe("short answers after the plan has been described", () => {
  /**
   * The website, 2026-10-08: a man of 35 was asked what cover he wanted, typed "1000000", and
   * was asked again — the bare number was tried as a monthly saving, which stops at 500,000.
   * The question in front of him was the sum, so a bare figure of a sum's size is the sum.
   */
  const told = { product: "ishield" as const, age: 35, sex: "M" as const, variant: "WLCI10", told: true as const };

  it("reads a bare figure of a sum's size as the sum asked for", () => {
    for (const said of ["1000000", "1,000,000", "500000"]) {
      const a = answer(said, told);
      expect(a.priced, said).toBe(true);
      expect(a.slots.sumAssured, said).toBe(Number(said.replace(/,/g, "")));
    }
  });

  it("still reads a small bare figure as a monthly saving", () => {
    expect(answer("3000", told).slots.budget).toEqual({ baht: 3000, per: "month" });
  });

  /**
   * "20ปี", once the age is known, cannot be the age: it is one of the four terms the leaflet
   * just listed. The same customer was quoted the ten-year term.
   */
  it("reads a bare term once the age is already known", () => {
    for (const [said, variant] of [["20ปี", "WLCI20"], ["15 ปี", "WLCI15"], ["5ปี", "WLCI05"]] as const) {
      const a = answer(said, told);
      expect(a.slots.variant, said).toBe(variant);
      expect(a.slots.termChosen, said).toBe(true);
    }
  });

  it("does not take a bare number of years for a term before the age is known", () => {
    expect(answer("20ปี").slots.variant).toBeUndefined();
  });
});

describe("a customer already quoted, thanking", () => {
  it("is not quoted again for saying thank you (Messenger, 2026-10-07)", async () => {
    const { answerIShield } = await import("@/lib/assistant/ishield/answer");
    for (const said of ["ขอบคุณค่ะ สำหรับข้อมูล", "ขอบคุณครับ"]) {
      const a = answerIShield(said, { product: "ishield", age: 40, sex: "M", variant: "WLCI10", sumAssured: 1_000_000, told: true } as never);
      expect(a.priced, said).toBeFalsy();
      expect(a.messages, said).toHaveLength(1);
      expect(a.messages[0].card, said).toBeUndefined();
    }
  });
});
