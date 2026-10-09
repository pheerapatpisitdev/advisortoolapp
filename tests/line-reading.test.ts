import { describe, expect, it } from "vitest";
import { answerAny, withoutInvisible } from "@/lib/assistant/dispatch";
import { answerIShield, type IShieldSlots } from "@/lib/assistant/ishield/answer";
import { peopleIn } from "@/lib/assistant/common";
import { productNamedIn } from "@/lib/assistant/choose";

// real messages from LINE, 2026-10-07 and 10-09: the keyboard put a zero-width space in them
const Z = "​";

const quoted: IShieldSlots = {
  product: "ishield", age: 34, sex: "F", variant: "WLCI05", termChosen: true, sumAssured: 1_000_000, told: true,
};

describe("invisible characters", () => {
  it("are taken out before a message is read", () => {
    expect(withoutInvisible(`ขอ${Z} ญ${Z}42 ชำระ99`)).toBe("ขอ ญ42 ชำระ99");
    expect(peopleIn(withoutInvisible(`ขอ${Z} ญ${Z}42 ชำระ99`))).toEqual([{ age: 42, sex: "F" }]);
  });

  it("do not turn a woman into a man in the dispatcher", async () => {
    const a = await answerAny([{ role: "user", content: `ญ${Z}42` }], { product: "ishield" } as IShieldSlots, "line");
    expect(a.slots).toMatchObject({ age: 42, sex: "F" });
  });

  it("let PLB be asked for by name", () => {
    expect(productNamedIn(withoutInvisible(`มี${Z}  PLB${Z}  ไหม`))).toBe("plb");
    expect(productNamedIn(withoutInvisible(`ขอ${Z}  protection life 15`))).toBe("plb");
  });
});

describe("iShield: the customer corrects the age", () => {
  it.each([["อายุ53"], ["อายุ 53"], ["53"], ["เพศหญิงอายุ53"], ["ไม่ใช่ อายุ43"]])("%s", (said) => {
    const a = answerIShield(said, quoted, "line");
    expect(a.slots.sex).toBe("F");
    expect(a.slots.age).not.toBe(34);
    expect(a.messages[0].text).toContain("สำหรับหญิงอายุ");
  });

  it("a paying term on its own is still a term", () => {
    const a = answerIShield("20 ปี", quoted, "line");
    expect(a.slots.age).toBe(34);
    expect(a.slots.variant).toBe("WLCI20");
  });

  it("'not 34' with nothing to put right asks, and does not quote 34 again", () => {
    const a = answerIShield("ไม่ใช่ 34", quoted, "line");
    expect(a.messages[0].text).toContain("ขอทราบเพศกับอายุ");
    expect(a.messages[0].card).toBeUndefined();
  });
});

describe("start over", () => {
  it("empties the conversation, whatever plan it was on", async () => {
    const a = await answerAny([{ role: "user", content: "ล้างข้อมูลเลยนะคะ" }], quoted, "line");
    expect(a.slots).toEqual({ product: "undecided" });
    expect(a.messages[0].text).toContain("ล้างข้อมูลให้แล้ว");
  });
});

describe("iShield written without its mark", () => {
  it("ไอชิลด is iShield", () => {
    expect(productNamedIn("ไอชิลด")).toBe("ishield");
    expect(productNamedIn("ไอชิลด์")).toBe("ishield");
  });
});
