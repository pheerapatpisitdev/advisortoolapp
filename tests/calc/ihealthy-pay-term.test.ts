import { describe, expect, it } from "vitest";
import { iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { WORDS, baseWords } from "@/lib/ihealthy-words";

const WHILE_CURRENT = new Date("2026-09-12");
/** the owner's mockup: a woman of 35, x 2 at 150,000, โกลด์ in Thailand, yearly */
const CHOICE = { sex: "F" as const, age: 35, sumAssured: 150_000, plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage" };

describe("x 2 paid over 9 and 19 years", () => {
  const t = iHealthyTable(WHILE_CURRENT);
  const yearly = (base: string) => {
    const p = iHealthyPricing(t, { ...CHOICE, base })!;
    const at = (xs: { mode: string; total: number }[]) => xs.find((m) => m.mode === "annual")!.total / 100;
    return { base: at(p.base), total: at(p.total) };
  };

  it("prices the base on its own term and leaves the health cover as it was", () => {
    // 150 × 48.6, 24.5 and 14.2 per thousand; the rider and daily cash are 43,800 + 1,300
    expect(yearly("WLF09H")).toEqual({ base: 7_290, total: 52_390 });
    expect(yearly("WLF19H")).toEqual({ base: 3_675, total: 48_775 });
    expect(yearly("WLF99H")).toEqual({ base: 2_130, total: 47_230 });
  });

  it("names every term in every language the page is read in", () => {
    for (const [lang, w] of Object.entries(WORDS)) {
      for (const b of t.bases) {
        const words = baseWords(w, b.variant, b);
        // the button under a term is its group's, so it must not fall back to the Thai
        if (lang !== "th") expect(words.note ?? "", `${lang} ${b.variant}`).not.toMatch(/[ก-๙]/);
        if (lang !== "th") expect(words.label, `${lang} ${b.variant}`).not.toMatch(/[ก-๙]/);
      }
    }
  });
});
