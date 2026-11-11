import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

// the form's preview, asked with no sign-in and no database: the owner's default prices stand in for the stored ones
vi.mock("@/lib/auth/viewer", () => ({
  requireMember: vi.fn(async () => ({ kind: "agent", agentId: "a1", role: "agent", code: "000001", name: "ทดสอบ" })),
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/wallet/store", async (original) => ({
  ...(await original<typeof import("@/lib/wallet/store")>()),
  walletPrices: vi.fn(async () => DEFAULT_PRICES),
}));

/**
 * The form sends a recipe with the standing clip's fields as they are set (final review, 2026-11-12): the brief's
 * written lines go along too, and a recipe clip, which never speaks them, is not refused over them.
 */
describe("a recipe asked with the whole standing input", () => {
  const standing = {
    product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, narrator: "F", style: "motion",
    theme: "kinetic", mascot: true, carry: true, length: "long", size: "portrait",
    // lines the checks refuse: no headline
    brief: { hook: "question" }, lines: { kind: "question", hook: "ถามจริง", headline: [] },
  } as const;

  it("is not refused over brief lines it will not use, and is priced as a Motion clip", async () => {
    const { previewQuote } = await import("@/app/studio/quote-video/actions");
    const got = await previewQuote({ ...standing, recipe: "life" } as never);
    expect("error" in got).toBe(false);
    if ("error" in got) return;
    expect(got.recipes).toEqual(["ask", "life", "versus"]);
    // the 15-second and the whole Motion clip share one price key: the recipe clip costs what Motion does
    expect(got.clipSatang).toBe(DEFAULT_PRICES.videoMotion);
  });

  it("still has its lines checked where the recipe does not fit (the standing clip is made and speaks them)", async () => {
    const { previewQuote } = await import("@/app/studio/quote-video/actions");
    // หญิง 58 pays to 76, past the step at 60: เส้นชีวิต does not fit
    const got = await previewQuote({ ...standing, sex: "F", age: 58, recipe: "life" } as never);
    expect("error" in got && got.error).toMatch(/พาดหัว/);
    expect("error" in (await previewQuote(standing as never))).toBe(true);
  });

  it("where the recipe does not fit, is priced as the standing clip the agent set up", async () => {
    const { previewQuote } = await import("@/app/studio/quote-video/actions");
    const got = await previewQuote({ ...standing, sex: "F", age: 58, brief: undefined, lines: undefined, recipe: "life" } as never);
    expect("error" in got).toBe(false);
    if ("error" in got) return;
    expect(got.clipSatang).toBe(DEFAULT_PRICES.videoLongMotion);
  });
});
