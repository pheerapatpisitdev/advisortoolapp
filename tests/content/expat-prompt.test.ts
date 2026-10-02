import { describe, expect, it } from "vitest";
import { ENGLISH_RULES, anglesFor, angleText, buildMessages, settleExpat } from "@/lib/content/prompt";
import { planMessages } from "@/lib/content/plan";

describe("expat angles", () => {
  it("offers the expat angles only with the tick, without tax and child", () => {
    const ids = (e: boolean) => anglesFor("post", "/ihealthy-ultra", e).map((a) => a.id);
    expect(ids(true).slice(0, 6)).toEqual(["expat_hospital", "expat_visa", "expat_job", "expat_travel", "expat_longstay", "expat_english"]);
    expect(ids(true)).not.toContain("tax");
    expect(ids(true)).not.toContain("child");
    expect(ids(true)).toContain("numbers");
    expect(ids(false)).toEqual(anglesFor("post", "/ihealthy-ultra").map((a) => a.id));
    expect(ids(false).some((id) => id.startsWith("expat_"))).toBe(false);
  });

  it("tells the model the restrictions in the visa and travel angles", () => {
    expect(angleText("expat_visa", "")).toMatch(/ห้ามระบุชื่อหรือประเภทวีซ่า/);
    expect(angleText("expat_travel", "")).toMatch(/ฉุกเฉิน/);
    expect(angleText("expat_travel", "")).toMatch(/90 วัน/);
    expect(angleText("expat_travel", "")).toMatch(/ห้ามพูดว่าคุ้มครองทั่วโลก/);
  });

  it.each([
    [{ href: "/ihealthy-ultra", format: "post", expat: true, angle: "expat_visa" }, { expat: true, angle: "expat_visa" }],
    [{ href: "/ihealthy-ultra", format: "post", expat: true, angle: "tax" }, { expat: true, angle: "" }],
    [{ href: "/ihealthy-ultra", format: "post", angle: "expat_visa" }, { expat: false, angle: "" }],
    [{ href: "/ihealthy-ultra", format: "script", expat: true, angle: "expat_visa" }, { expat: false, angle: "" }],
    [{ href: "/ihealthy-ultra", format: "ad", expat: true, angle: "" }, { expat: false, angle: "" }],
    [{ href: "/lifeprotect", format: "post", expat: true, angle: "family" }, { expat: false, angle: "family" }],
    [{ href: "/ihealthy-ultra", format: "post", expat: true, angle: "custom" }, { expat: true, angle: "custom" }],
  ])("settles %o", (input, want) => expect(settleExpat(input)).toEqual(want));
});

describe("English rules", () => {
  it("are added to the planner and writer only for an English piece", () => {
    const ask = { brief: "b", format: "post" as const, angle: "" as const, custom: "", length: null, plans: [{ angle: "a", hook: "h" }] };
    expect(buildMessages({ ...ask, lang: "en" })[0].content).toContain(ENGLISH_RULES);
    expect(buildMessages(ask)[0].content).not.toContain(ENGLISH_RULES);
    const plan = { brief: "b", count: 1, angle: "", avoid: [], template: null };
    expect(planMessages({ ...plan, lang: "en" })[0].content).toContain(ENGLISH_RULES);
    expect(planMessages(plan)[0].content).toBe(planMessages({ ...plan, lang: "th" })[0].content);
    expect(planMessages(plan)[0].content).not.toContain(ENGLISH_RULES);
  });
});

describe("the expat angles' figures (final review, 2026-10-02)", () => {
  it("come from the benefit sheet, so a change to it changes what the writer is told", async () => {
    const { iHealthyFacts } = await import("@/lib/ihealthy-facts");
    const { renewalToAge, outOfTerritoryDays } = iHealthyFacts().terms;
    expect(angleText("expat_job", "")).toContain(`ต่ออายุได้ถึงอายุ ${renewalToAge}`);
    expect(angleText("expat_longstay", "")).toContain(`ต่ออายุได้ถึงอายุ ${renewalToAge}`);
    expect(angleText("expat_travel", "")).toContain(`ภายใน ${outOfTerritoryDays} วันนับจากวันเดินทาง`);
    expect(angleText("expat_travel", "")).toContain(`“${outOfTerritoryDays} วัน”`);
  });
});

describe("the English rules say each thing once", () => {
  it("override the Thai-particle rule in one place", () => {
    expect(ENGLISH_RULES.split("ครับ/ค่ะ").length - 1).toBe(1);
  });
});
