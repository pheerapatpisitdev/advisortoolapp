import { beforeEach, describe, expect, it, vi } from "vitest";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async () => ({
  text: JSON.stringify(routed),
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { personInEn, planNamedInEn, routeHealthEn, territoryNamedInEn } = await import("@/lib/assistant/ihealthy-en/route");

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("reading a person in English", () => {
  it.each([
    ["I'm 35, male", { age: 35, sex: "M" }],
    ["35 years old female", { age: 35, sex: "F" }],
    ["F 42", { age: 42, sex: "F" }],
    ["my age is 50 and I'm a woman", { age: 50, sex: "F" }],
    ["male", { sex: "M" }],
    ["I'm 35", { age: 35 }],
    ["I’m 40", { age: 40 }],
    ["35, male", { age: 35, sex: "M" }],
    ["F, 35", { age: 35, sex: "F" }],
    ["35/F", { age: 35, sex: "F" }],
    ["50/m", { age: 50, sex: "M" }],
    ["35yo m", { age: 35, sex: "M" }],
    ["70 M", { age: 70, sex: "M" }],
    ["25m", { age: 25, sex: "M" }],
    ["35", { age: 35 }],
    ["I've lived in Thailand 10 years, male 45", { age: 45, sex: "M" }],
  ])("personInEn(%s)", (text, want) => expect(personInEn(text)).toEqual(want));

  it.each([
    "Is a 3 day stay covered?", "Is a 30 day stay covered?", "How much is a private room for 2 nights?",
  ])("reads no age out of a question about days or nights: %s", (q) => {
    expect(personInEn(q).age).toBeUndefined();
  });

  it("does not read a plan ceiling or a year as an age", () => {
    expect(personInEn("10 million plan").age).toBeUndefined();
    expect(personInEn("since 2019").age).toBeUndefined();
  });
});

describe("reading a plan and a territory in English", () => {
  it("reads territories into the table's labels", () => {
    expect(territoryNamedInEn("Asia please")).toBe("เอเชีย");
    expect(territoryNamedInEn("worldwide cover")).toBe("ทั่วโลก");
    expect(territoryNamedInEn("Thailand only")).toBe("ประเทศไทย");
  });

  it("does not read Thailand mentioned in passing as a territory", () => {
    expect(territoryNamedInEn("Which hospitals in Thailand can I use?")).toBeUndefined();
    expect(territoryNamedInEn("I have lived in Thailand for 12 years")).toBeUndefined();
  });

  it("reads an age with an M after it as an age, never as a plan", () => {
    expect(planNamedInEn("70 M")).toBeUndefined();
    expect(planNamedInEn("25m")).toBeUndefined();
  });

  it("reads a plan by name and by its yearly limit", () => {
    expect(planNamedInEn("Gold please")).toBe("GOLD");
    expect(planNamedInEn("the 10 million one")).toBeDefined();
  });
});

describe("routeHealthEn", () => {
  it("carries age and sex into the turn that only names a plan", async () => {
    const first = await routeHealthEn(said("I'm 35, male"), null);
    const second = await routeHealthEn(said("Gold"), first);
    expect(second).toMatchObject({ age: 35, sex: "M", plan: "GOLD", intent: "quote", lang: "en" });
  });

  it("never takes the plan from the model", async () => {
    routed = { intent: "quote", plan: "PLATINUM" };
    const s = await routeHealthEn(said("how much is it"), { product: "ihealthy", intent: "quote", plan: "GOLD" });
    expect(s.plan).toBe("GOLD");
  });

  it("does not call the model when the message is read by pattern alone", async () => {
    await routeHealthEn(said("35 male"), null);
    expect(chat).not.toHaveBeenCalled();
  });

  it("asks the model what a longer question wants", async () => {
    routed = { intent: "plan_info", question: "Does Gold cover outpatient visits?" };
    const s = await routeHealthEn(said("does it cover outpatient visits to a clinic?"), null);
    expect(chat).toHaveBeenCalledOnce();
    expect(s.intent).toBe("plan_info");
  });
});
