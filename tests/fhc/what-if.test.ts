import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FhcInput, Level } from "@/lib/fhc/health";

/** ลองปรับดู: the plan priced again from the rate tables at once — no AI, nothing logged. */

const net = vi.hoisted(() => ({ ip: 0 }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": `10.1.0.${net.ip}` }) }));
const log = vi.hoisted(() => ({ logRun: vi.fn() }));
vi.mock("@/lib/plan/log", () => log);
const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  chat: ai.chat,
}));

const { whatIfFhc } = await import("@/app/fhc/actions");

const F: FhcInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, lifeCover: 0, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 0, hospital: "private", lifeWant: "cover", retireAge: 60, retireMonthly: 17_500,
  pensionHave: 0, budget: 5_000, expectancy: 85, work: "full",
  cash: 100_000, fixed: 0, otherSaving: 0, homeLoan: 0, carLoan: 0, otherDebt: 0, taxFund: 0, stocks: 0,
  people: [],
};
const RANK: Record<Level, number> = { none: 0, red: 1, yellow: 2, green: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  net.ip += 1;
});

describe("whatIfFhc", () => {
  it("prices a bigger budget into more cover, without the AI and without a log row", async () => {
    const small = await whatIfFhc(F, ["health", "ci", "life", "retire"]);
    const big = await whatIfFhc({ ...F, budget: 15_000 }, ["health", "ci", "life", "retire"]);
    if (!small.ok || !big.ok) throw new Error("expected figures");
    expect(big.usedAnnual).toBeGreaterThan(small.usedAnnual);
    const retire = (r: typeof big) => RANK[r.after.find((s) => s.key === "retire")!.level];
    expect(retire(big)).toBeGreaterThan(retire(small));
    expect(ai.chat).not.toHaveBeenCalled();
    expect(log.logRun).not.toHaveBeenCalled();
  });
  it("answers with the form's own sentence when the form cannot be used", async () => {
    expect(await whatIfFhc({ ...F, expense: 0 })).toEqual({ ok: false, error: "กรอกค่าใช้จ่ายต่อเดือนก่อนนะครับ" });
  });
});
