import { describe, expect, it } from "vitest";
import { hospitalReply, hospitalsIn } from "@/lib/assistant/hospitals";

const THAI = /[฀-๿]/;

describe("finding a hospital the customer names", () => {
  it.each([
    ["Can I use Bumrungrad?", "bumrungrad-hospital"],
    ["ใช้ รพ.บำรุงราษฎร์ ได้ไหม", "bumrungrad-hospital"],
    ["is BNH in your network", "bnh-hospital"],
    ["Bangkok Hospital Phuket?", "phuket-hospital"],
    ["Vejthani hospital ok?", "vejthani-hospital"],
  ])("%s → %s", (text, id) => {
    expect(hospitalsIn(text).map((h) => h.id)).toContain(id);
  });

  it("finds one branch, not the whole chain, when the branch is named", () => {
    expect(hospitalsIn("Bangkok Hospital Phuket?").map((h) => h.id)).toEqual(["phuket-hospital"]);
  });

  it("finds every branch when only the chain is named", () => {
    expect(hospitalsIn("Is Samitivej in the network?").length).toBeGreaterThan(3);
  });

  it("does not read a city as a hospital chain", () => {
    expect(hospitalsIn("hospitals in Bangkok")).toEqual([]);
    expect(hospitalsIn("โรงพยาบาลในกรุงเทพ")).toEqual([]);
  });
});

describe("hospitalReply in English", () => {
  it("confirms a named hospital, with Fax Claim after 90 days and the list's link", () => {
    const r = hospitalReply("Can I use Bumrungrad?", "en")!;
    expect(r).toContain("Bumrungrad Hospital");
    expect(r).toContain("Fax Claim");
    expect(r).toContain("90 days");
    expect(r).toContain("krungthai-axa.co.th/en/customer-service/hospitals");
    expect(r).not.toMatch(THAI);
  });

  it("lists a chain's branches, a few of them", () => {
    const r = hospitalReply("Is Samitivej in the network?", "en")!;
    expect(r).toContain("Samitivej");
    expect((r.match(/^• /gm) ?? []).length).toBeLessThanOrEqual(6);
    expect(r).not.toMatch(THAI);
  });

  it("lists the hospitals in a province", () => {
    const r = hospitalReply("Which hospitals in Phuket can I use?", "en")!;
    expect(r).toContain("Phuket");
    expect(r).toMatch(/^• /m);
    expect(r).not.toMatch(THAI);
  });

  it("answers a general question with the size of the network and asks which one", () => {
    const r = hospitalReply("Which hospitals can I use?", "en")!;
    expect(r).toMatch(/\d+ hospitals/);
    expect(r).toContain("Bumrungrad");
    expect(r).not.toMatch(THAI);
  });

  it.each([
    "35 male", "Gold", "I have diabetes", "how much is it?",
    "does it cover outpatient visits at a clinic?", "Does it cover hospital stays?", "what is the room rate in hospital?",
  ])("says nothing to %s", (q) => {
    expect(hospitalReply(q, "en")).toBeUndefined();
  });
});

describe("hospitalReply in Thai", () => {
  it("confirms a named hospital in Thai", () => {
    const r = hospitalReply("ใช้ รพ.บำรุงราษฎร์ ได้ไหม", "th")!;
    expect(r).toContain("บำรุงราษฎร์");
    expect(r).toContain("Fax Claim");
    expect(r).toContain("90 วัน");
    expect(r).toContain("krungthai-axa.co.th/customer-service/hospitals");
  });

  it("answers which hospitals can be used, in Thai", () => {
    expect(hospitalReply("ใช้โรงพยาบาลไหนได้บ้าง", "th")).toContain("Fax Claim");
    expect(hospitalReply("มีโรงพยาบาลคู่สัญญาที่ไหนบ้าง", "th")).toContain("Fax Claim");
  });

  it("lists the hospitals in a province in Thai", () => {
    const r = hospitalReply("โรงพยาบาลในภูเก็ตมีที่ไหนบ้าง", "th")!;
    expect(r).toContain("ภูเก็ต");
    expect(r).toMatch(/^• /m);
  });

  it.each(["หญิง 35", "เบี้ยเท่าไหร่", "มีโรคประจำตัว", "กรุงไทยแอกซ่าใช่ไหม", "นอนโรงพยาบาลได้กี่วัน", "ค่าห้องโรงพยาบาลเท่าไหร่"])("says nothing to %s", (q) => {
    expect(hospitalReply(q, "th")).toBeUndefined();
  });
});
