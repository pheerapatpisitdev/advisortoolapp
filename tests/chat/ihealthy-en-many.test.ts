import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * The English health brain answering a message that asks several things at once, and the
 * ready answers it gained for the questions foreigners actually asked (owner chose ข ก,
 * 2026-11-23). The figures are checked against the benefit sheet and the rate table, never
 * typed here.
 */

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "Happy to help!",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerHealthEn } = await import("@/lib/assistant/ihealthy-en/answer");
const { premiumByAgeEn } = await import("@/lib/assistant/ihealthy-en/topics");
const { WANTS_IN_EN, APPLY_AGAIN_EN, SHARE_OF_BILL_EN } = await import("@/lib/assistant/ihealthy-en/words");
const { iHealthyTable } = await import("@/lib/ihealthy-table");

const said = (content: string) => [{ role: "user" as const, content }];
const THAI = /[฀-๿]/;
const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "M" as const, lang: "en" as const };
const all = (a: { messages: { text: string }[] }) => a.messages.map((m) => m.text).join("\n\n");

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

/** The Irish customer's second message on Expat Influencer Insurance, 2026-11-23. */
const IRISH = `Sawasdee krab! Thank you for your response.

I’m interested in learning more about your health insurance plans.

1. Date of birth/Gender: Male, 47 years old.
2. Visa: Thai Privilege
3. Nationality: Irish
4. Current province: Bangkok
5. Pre-existing conditions: I would like to understand how your policies handle pre-existing medical conditions and any exclusions before providing my medical history.

Could you please confirm:

* Which insurance company underwrites this policy?
* Does the ฿3 million annual coverage include both inpatient and outpatient treatment?
* Are there deductibles, co-payments, or treatment sublimits?
* Which private hospitals in Bangkok are covered?
* How much would the premiums increase as I get older?
* Could you send me the full policy benefits and exclusions?

I currently have international health insurance but am exploring more affordable options for long-term coverage in Thailand.

Thank you very much!`;

describe("a message asking several things", () => {
  it("answers each of them in one reply, in English, without a model", async () => {
    const a = await answerHealthEn(said(IRISH), null);
    const text = all(a);
    expect(THAI.test(text)).toBe(false);
    expect(chat).not.toHaveBeenCalled();
    expect(text).toMatch(/Krungthai-AXA Life Insurance/);
    expect(text).toMatch(/Outpatient visits depend on the plan/);
    expect(text).toMatch(/no deductible/);
    expect(text).toMatch(/Bumrungrad/);
    // the person was in the message: they are priced, and remembered
    expect(a.slots.age).toBe(47);
    expect(a.slots.sex).toBe("M");
    expect(a.messages.some((m) => m.card)).toBe(true);
    expect(a.priced ?? false).toBe(false);
    // asked for the benefits and exclusions: the full table goes as a file
    expect(a.messages.some((m) => m.file)).toBe(true);
    // asked how the premium rises: today's rates at older ages
    expect(text).toMatch(/at each age/);
    expect(a.replies?.length).toBeGreaterThan(0);
  });

  it("says the statement lines are not questions: no visa answer for \"Visa: Thai Privilege\"", async () => {
    const a = await answerHealthEn(said(IRISH), null);
    expect(all(a)).not.toMatch(/proof of health insurance/);
  });

  it("answers at most five in words and says it will come back for the rest", async () => {
    const many = [
      "Which insurance company is it?",
      "Does it cover outpatient?",
      "Are there sublimits?",
      "Is there a no-claim discount?",
      "Is there a waiting period?",
      "Can I pay monthly?",
      "Can I use it for tax?",
    ].join("\n");
    const a = await answerHealthEn(said(many), null);
    const first = a.messages[0].text;
    expect(first).toMatch(/Krungthai-AXA/);
    expect(first).not.toMatch(/\btax\b/i);
    expect(all(a)).toMatch(/I'll check the rest and get back to you here/);
  });

  it("says it will come back for a question it has no answer for", async () => {
    const a = await answerHealthEn(said("Which insurance company is it?\nDoes it cover outpatient?\nCan US citizens apply?"), null);
    expect(all(a)).toMatch(/I'll check the rest and get back to you here/);
  });

  it("leaves a one-question message to the single answer, as before", async () => {
    const a = await answerHealthEn(said("Is there a waiting period?"), null);
    expect(a.messages).toHaveLength(1);
    expect(a.messages[0].text).toMatch(/30-day waiting period/);
  });

  it("is not read as the reply to the health question when it asks several things", async () => {
    const a = await answerHealthEn(said(IRISH), { ...KNOWN, healthAsked: true });
    expect(all(a)).toMatch(/Krungthai-AXA Life Insurance/);
  });
});

describe("the new ready answers", () => {
  it("direct billing: Fax Claim at network hospitals, and asks the province", async () => {
    const a = await answerHealthEn(said("Does your insurance offer direct billing, or do I have to pay upfront?"), null);
    expect(a.messages[0].text).toMatch(/Fax Claim/);
    expect(a.messages[0].text).toMatch(/province/);
    expect(a.slots.hospitalAsked).toBe(true);
  });

  it("accidents: covered, and not met with the health declaration", async () => {
    const a = await answerHealthEn(said("So this is also if i have a accident? Or only when im sick?"), null);
    expect(a.messages[0].text).toMatch(/Accidents are covered straight away/);
    expect(a.messages[0].text).not.toMatch(/declare your health/);
  });

  it("outpatient: what each plan pays a year, from the benefit sheet", async () => {
    const a = await answerHealthEn(said("Does it cover outpatient?"), null);
    const t = a.messages[0].text;
    expect(t).toMatch(/Smart and Bronze don't include them/);
    expect(t).toMatch(/Silver 6,000/);
    expect(t).toMatch(/Platinum as charged/);
  });

  it("sublimits: no deductible on the standard version, the room is the one daily limit", async () => {
    const a = await answerHealthEn(said("Are there any sublimits?"), null);
    expect(a.messages[0].text).toMatch(/no deductible/);
    expect(a.messages[0].text).toMatch(/1,500 baht on Smart up to 21,000 on Platinum/);
  });

  it("a deductible for a lower premium still gets the share-of-bill answer", async () => {
    const a = await answerHealthEn(said("Is there a cheaper version with a deductible?"), null);
    expect(a.messages[0].text).toBe(SHARE_OF_BILL_EN);
  });

  it("no-claim discount: 10% after 3 years", async () => {
    const a = await answerHealthEn(said("Is there a no-claim discount?"), null);
    expect(a.messages[0].text).toMatch(/10% discount on the renewal premium after 3 consecutive policy years/);
  });

  it("ages: apply from 6 to 80, renew to 98", async () => {
    const a = await answerHealthEn(said("Up to what age can I renew?"), null);
    expect(a.messages[0].text).toMatch(/from age 6 to 80, and renew up to age 98/);
  });

  it("terms and conditions: not the health declaration; asks the person first when unknown", async () => {
    const a = await answerHealthEn(said("Can I see the terms and conditions?"), null);
    expect(a.messages[0].text).not.toMatch(/declare your health/);
    expect(a.messages[0].text).toMatch(/21 exclusions/);
    expect(a.messages.some((m) => m.file)).toBe(false);
  });

  it("terms and conditions: the PDF when the person is known", async () => {
    const a = await answerHealthEn(said("Please send me the policy exclusions"), KNOWN);
    expect(a.messages.some((m) => m.file)).toBe(true);
    expect(all(a)).toMatch(/21 exclusions/);
  });

  it("\"I want to apply\" a second time is not sent the steps again", async () => {
    const first = await answerHealthEn(said(WANTS_IN_EN), KNOWN);
    expect(first.slots.formSent).toBe(true);
    const again = await answerHealthEn(said(WANTS_IN_EN), first.slots);
    expect(again.messages).toHaveLength(1);
    expect(again.messages[0].text).toBe(APPLY_AGAIN_EN);
  });
});

describe("the premium at older ages (owner chose ข)", () => {
  it("prices the ages asked for, at today's rates, with the note that rates can change", () => {
    const t = premiumByAgeEn({ age: 47, sex: "M", asked: "what would it cost at ages 50, 55, 60, and 65?" });
    for (const age of [50, 55, 60, 65]) expect(t).toMatch(new RegExp(`Age ${age} —`));
    expect(t).toMatch(/stays level/);
    expect(t).toMatch(/can change/);
  });

  it("without ages named, shows now and every five years to the table's end", () => {
    const { ageMax } = iHealthyTable();
    const t = premiumByAgeEn({ age: 70, sex: "F", asked: "How much will it go up as I get older?" });
    expect(t).toMatch(/Age 70 —/);
    expect(t).toMatch(/Age 75 —/);
    expect(t).toMatch(new RegExp(`Age ${ageMax} —|after age ${ageMax}`));
    expect(t).not.toMatch(/Age 85 —/);
  });

  it("one plan when the customer has one", () => {
    const t = premiumByAgeEn({ age: 40, sex: "M", plan: "GOLD", asked: "premium at 50?" });
    expect(t).toMatch(/Gold/);
    expect(t).not.toMatch(/Smart|Platinum/);
  });

  it("is the answer to a single premium-rise question once the person is known", async () => {
    const a = await answerHealthEn(said("Does the premium go up every year?"), KNOWN);
    expect(a.messages[0].text).toMatch(/at each age/);
  });

  it("asks for the person when the gender is unknown", async () => {
    const a = await answerHealthEn(said("Does the premium go up every year?"), null);
    expect(a.messages[0].text).toMatch(/goes up with age/);
    expect(a.messages[0].text).toMatch(/age and gender/);
  });
});
