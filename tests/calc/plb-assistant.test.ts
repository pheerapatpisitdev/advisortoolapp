import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { plbModes } from "@/lib/plb-quote";
import { plbTable } from "@/lib/plb-table";
import { answerPlb, PLB_LABEL, type PlbAnswer, type PlbSlots } from "@/lib/assistant/plb/answer";
import { PLB_WAITING } from "@/lib/assistant/plb/faq";

const text = (a: PlbAnswer) => a.messages.map((m) => m.text).join("\n");
const cards = (a: PlbAnswer) => a.messages.filter((m) => m.card);
const baht = (n: number) => n.toLocaleString("en-US");
const start = (said: string, from: PlbSlots | null = null) => answerPlb(said, from, "facebook");

/** a customer who holds a PLB quotation, built through the brain itself */
function held(): PlbAnswer {
  const a = start("PLB ชาย 35 ทุน 1 ล้าน ชำระ 10 ปี");
  expect(a.priced).toBe(true);
  return a;
}

describe("the figures", () => {
  const cases = [
    { age: 35, sex: "M" as const, sum: 1_000_000, variant: "PLB10", years: 10 },
    { age: 30, sex: "F" as const, sum: 5_000_000, variant: "PLB05", years: 5 },
    { age: 50, sex: "M" as const, sum: 2_000_000, variant: "PLB15", years: 15 },
  ];
  for (const c of cases) {
    it(`quotes ${c.variant} at ${c.age} the way the engine does, with card and file`, () => {
      const a = start(`PLB ${c.sex === "M" ? "ชาย" : "หญิง"} ${c.age} ทุน ${baht(c.sum)} ชำระ ${c.years} ปี`);
      const engine = quote({ planCode: "PLB", variant: c.variant, age: c.age, sex: c.sex, mode: "annual", sumAssured: c.sum, riders: [] });
      expect(a.priced).toBe(true);
      // Messenger draws no markdown, so the bold marks are gone; the figure is the engine's
      expect(text(a)).toContain(`เบี้ยปีละ ${Math.round(engine.totalAnnual / 100).toLocaleString("en-US")} บาท`);
      expect(a.messages[0].card).toBeTruthy();
      expect(a.messages[0].pdfPath).toBeTruthy();
      expect(a.slots).toMatchObject({ product: "plb", age: c.age, sex: c.sex, sumAssured: c.sum, variant: c.variant });
    });
  }
});

describe("a quotation over several messages", () => {
  it("asks for one thing at a time and quotes once, then re-prices with the rest kept", () => {
    const name = start("Protection Life");
    expect(name.priced).toBeFalsy();
    expect(text(name)).toContain("อายุกับเพศ");

    const who = start("ชาย 35", name.slots);
    expect(who.slots).toMatchObject({ age: 35, sex: "M" });
    expect(text(who)).toContain("ทุนประกัน");

    const sum = start("ทุน 1 ล้าน", who.slots);
    expect(sum.slots.sumAssured).toBe(1_000_000);
    expect(text(sum)).toContain("ระยะเวลาชำระเบี้ย");

    const priced = start("ชำระ 10 ปี", sum.slots);
    expect(priced.priced).toBe(true);
    expect(cards(priced).length).toBeGreaterThan(0);

    const bigger = start("ทุน 2 ล้านล่ะ", priced.slots);
    expect(bigger.priced).toBe(true);
    expect(bigger.slots).toMatchObject({ age: 35, sex: "M", sumAssured: 2_000_000, variant: "PLB10" });

    const shorter = start("ถ้าจ่าย 5 ปีล่ะ", bigger.slots);
    expect(shorter.priced).toBe(true);
    expect(shorter.slots).toMatchObject({ age: 35, sumAssured: 2_000_000, variant: "PLB05" });
  });

  it("takes a lone age as the answer to the question it was asked", () => {
    const a = start("35", { product: "plb", sex: "M" });
    expect(a.slots).toMatchObject({ age: 35, sex: "M" });
  });

  it("reads every button it offers: each one moves the conversation on", () => {
    const states: PlbSlots[] = [
      start("Protection Life").slots,
      start("ชาย 35", null).slots,
      start("ชาย 35 ทุน 1 ล้าน").slots,
      held().slots,
    ];
    for (const state of states) {
      const here = start("ขอดูหน่อย", state);
      const labels = here.replies ?? [];
      expect(labels.length, JSON.stringify(state)).toBeGreaterThan(0);
      for (const label of labels) {
        const next = start(label, state);
        const moved = JSON.stringify(next.slots) !== JSON.stringify(state) || next.priced === true;
        expect(moved, `${JSON.stringify(state)} + "${label}"`).toBe(true);
      }
    }
  });
});

describe("what a customer already quoted is not sent again", () => {
  it("answers the real question about conditions and the waiting period in words alone", () => {
    const a = start("สอบถามเงื่อนไขเพิ่มเติมครับ ต้องตรวจสุขภาพหรือไม่ มีระยะเวลารอคอยหรือไม่", held().slots);
    expect(cards(a)).toHaveLength(0);
    expect(a.priced).toBeFalsy();
    expect(text(a)).toContain("แถลงข้อมูลสุขภาพ");
    expect(text(a)).toContain(PLB_WAITING);
  });

  it("sends one short answer, no card, to thanks, a written question, and 'let me think'", () => {
    for (const said of ["ขอบคุณค่ะ สำหรับข้อมูล", "ลดหย่อนภาษีได้ไหม", "มีเงินคืนไหม", "เดี๋ยวคิดดูก่อน"]) {
      const a = start(said, held().slots);
      expect(a.messages, said).toHaveLength(1);
      expect(cards(a), said).toHaveLength(0);
      expect(a.priced, said).toBeFalsy();
    }
  });

  it("still prices when the question comes with a figure", () => {
    const a = start("ลดหย่อนภาษีได้ไหม ทุน 2 ล้านล่ะ", held().slots);
    expect(a.priced).toBe(true);
    expect(a.slots.sumAssured).toBe(2_000_000);
    expect(text(a)).toContain("ลดหย่อนภาษี");
  });
});

describe("what a message can mean", () => {
  it("reads 'ชาย 15 ปี' as a fifteen-year-old, and 'จ่าย 10 ปี' as the term", () => {
    const boy = start("ชาย 15 ปี");
    expect(boy.slots).toMatchObject({ age: 15, sex: "M" });
    expect(boy.slots.variant).toBeUndefined();
    const priced = start("PLB ชาย 35 จ่าย 10 ปี ทุน 1 ล้าน");
    expect(priced.slots).toMatchObject({ age: 35, variant: "PLB10" });
    expect(text(priced)).toContain("ชำระเบี้ย 10 ปี");
  });

  it("gives the engine's own refusal for a sum under the minimum, and keeps the person", () => {
    const min = baseSumAssuredLimits(getPlan("PLB")!.rules, "PLB10").min;
    const a = start(`PLB ชาย 35 ทุน ${baht(min - 10_000)} ชำระ 10 ปี`);
    expect(a.priced).toBe(false);
    expect(cards(a)).toHaveLength(0);
    expect(a.slots).toMatchObject({ age: 35, sex: "M", variant: "PLB10" });
    const fixed = start("ทุน 1 ล้าน", a.slots);
    expect(fixed.priced).toBe(true);
  });

  it("refuses an age past the plan's range, then prices a person inside it", () => {
    const over = plbTable().ageMax + 1;
    const a = start(`PLB ชาย ${over} ทุน 1 ล้าน ชำระ 10 ปี`);
    expect(a.priced).toBe(false);
    expect(start("ชาย 40", a.slots).priced).toBe(true);
  });

  it("prints no monthly line where the monthly share is under the company's floor", () => {
    const table = plbTable();
    const term = table.terms.find((t) => t.variant === "PLB10")!;
    const min = baseSumAssuredLimits(getPlan("PLB")!.rules, "PLB10").min;
    let found: number | undefined;
    for (let sum = min; sum <= 1_000_000 && found === undefined; sum += 10_000) {
      const monthly = plbModes(table, term, { sex: "M", age: 35, sumAssured: sum })?.find((m) => m.mode === "monthly");
      if (monthly?.belowMinimum) found = sum;
    }
    expect(found, "a sum with a monthly share under the floor").toBeDefined();
    const a = start(`PLB ชาย 35 ทุน ${baht(found!)} ชำระ 10 ปี`);
    expect(a.priced).toBe(true);
    expect(text(a)).not.toContain("รายเดือน");
  });

  it("prices the first of two people and says the other can be sent next", () => {
    const a = start("PLB ผญ 32 ผช 33 ทุน 1 ล้าน ชำระ 10 ปี");
    expect(a.priced).toBe(true);
    expect(text(a)).toContain("หญิง อายุ 32");
    expect(text(a)).toContain("อีกท่านบอกได้เลยครับ");
  });

  it("names the plan on the page it came from", () => {
    expect(PLB_LABEL).toBe("Protection Life (PLB)");
    expect(text(start("PLB ชาย 35 ทุน 1 ล้าน ชำระ 10 ปี"))).toContain("Protection Life (PLB)");
  });
});

describe("the rest of what a customer says", () => {
  it("hands the form over on a wish to apply, once, and thanks them when it is filled in", () => {
    const apply = start("สมัครยังไง", held().slots);
    expect(apply.slots.formSent).toBe(true);
    const done = start("กรอกแล้วครับ", apply.slots);
    expect(done.formDone).toBe(true);
  });

  it("answers a condition with the declaration and never a promise", () => {
    const a = start("เป็นเบาหวาน ทำได้ไหม", held().slots);
    expect(text(a)).toContain("แถลงข้อมูลสุขภาพ");
    expect(cards(a)).toHaveLength(0);
  });
});
