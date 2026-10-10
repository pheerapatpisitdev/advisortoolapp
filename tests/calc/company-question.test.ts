import { describe, expect, it } from "vitest";
import { answerAny } from "@/lib/assistant/dispatch";
import { answerLegacy } from "@/lib/assistant/legacy/answer";
import { answerIShield } from "@/lib/assistant/ishield/answer";
import { ABOUT_INSURER } from "@/lib/assistant/common";

/**
 * "บริษัทอะไร" is answered with the owner's company text wherever the customer is in the
 * conversation. The legacy and iShield brains used to answer it with the quotation again.
 */
describe("which company, asked mid-conversation", () => {
  it("is answered in a Family Legacy conversation that has already been priced", () => {
    const a = answerLegacy("บริษัทอะไรครับ", { product: "legacy", age: 35, sex: "M", tier: 1, told: true }, "facebook");
    expect(a.messages[0].text).toContain(ABOUT_INSURER);
    expect(a.priced).toBeUndefined();
    // the conversation is kept, so the next question carries on from the same quotation
    expect(a.slots).toMatchObject({ product: "legacy", age: 35, sex: "M", tier: 1 });
  });

  it("is answered in an iShield conversation", () => {
    const a = answerIShield("ของบริษัทไหนคะ", { product: "ishield", age: 30, sex: "F" }, "facebook");
    expect(a.messages[0].text).toContain(ABOUT_INSURER);
  });

  it("is answered after a CI 123 quote", async () => {
    const a = await answerAny([{ role: "user", content: "บริษัทอะไรครับ" }], { product: "undecided", age: 35, sex: "M" }, "facebook");
    expect(a.messages[0].text).toContain(ABOUT_INSURER);
  });

  it("is answered alongside a CI 123 price asked in the same message", async () => {
    const a = await answerAny([{ role: "user", content: "CI123 ชาย 35 ทุน 1 ล้าน บริษัทอะไร" }], null, "facebook");
    expect(a.priced).toBe(true);
    expect(a.messages.map((m) => m.text).join("\n")).toContain(ABOUT_INSURER);
  });
});
