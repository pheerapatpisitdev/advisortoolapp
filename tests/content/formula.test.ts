import { describe, expect, it } from "vitest";
import {
  FORMULA_NAME, formulaHookRules, formulaOf, formulaRules, markFormula, outputFormula, readFormula,
} from "@/lib/content/formula";
import { FINISH_HOOK_RULES, FINISH_NAME, finishRules } from "@/lib/content/finish";
import { PRO_HOOK_RULES, PRO_NAME, proRules } from "@/lib/content/pro";
import type { ContentOutput } from "@/lib/content/output";

/** Two writing formulas, one at a time (formula.ts). */

const piece: ContentOutput = { hooks: ["หัว"], body: "เนื้อ", closing: "", hashtags: [], imagePrompt: "", disclaimer: "" };

describe("reading a pick", () => {
  it("knows the two formulas and nothing else", () => {
    expect(readFormula("pro")).toBe("pro");
    expect(readFormula("finish")).toBe("finish");
    for (const v of ["", "none", "PRO", true, null, undefined, 1]) expect(readFormula(v)).toBeNull();
  });

  it("takes a page loaded before there were two, and gives an ad none", () => {
    expect(formulaOf({ pro: true }, "post")).toBe("pro");
    expect(formulaOf({ formula: "finish", pro: true }, "script")).toBe("finish");
    expect(formulaOf({ formula: "finish" }, "ad")).toBeNull();
    expect(formulaOf({ pro: true }, "ad")).toBeNull();
    expect(formulaOf({ formula: "junk" }, "post")).toBeNull();
    expect(formulaOf({ formula: "", pro: false }, "post")).toBeNull();
  });

  it("reads a piece written before formulas as สูตรคอนเทนต์โปร", () => {
    expect(outputFormula({ pro: true })).toBe("pro");
    expect(outputFormula({ formula: "finish" })).toBe("finish");
    expect(outputFormula({})).toBeNull();
    expect(FORMULA_NAME).toEqual({ pro: PRO_NAME, finish: FINISH_NAME });
  });
});

describe("one formula at a time", () => {
  it("gives the planner one formula's hook rules", () => {
    expect(formulaHookRules("pro")).toBe(PRO_HOOK_RULES);
    expect(formulaHookRules("finish")).toBe(FINISH_HOOK_RULES);
    expect(formulaHookRules(null)).toBe("");
  });

  it("gives a writer one formula's rules and never the other's", () => {
    const pro = formulaRules("pro", "post", null, false);
    const finish = formulaRules("finish", "post", null, false);
    expect(pro).toBe(proRules("post"));
    expect(finish).toBe(finishRules("post"));
    expect(pro).not.toContain(FINISH_NAME);
    expect(finish).not.toContain(PRO_NAME);
  });

  it("puts the hook rules in front for a writer that writes its own hook", () => {
    expect(formulaRules("finish", "script", "60", false, true)).toBe(`${FINISH_HOOK_RULES}\n${finishRules("script", "60", false, true)}`);
    expect(formulaRules("pro", "post", null, false, true)).toBe(`${PRO_HOOK_RULES}\n${proRules("post")}`);
  });

  it("writes nothing for no formula, or for an ad", () => {
    expect(formulaRules(null, "post", null, false, true)).toBe("");
    expect(formulaRules("finish", "ad", null, false, true)).toBe("");
    expect(formulaRules("pro", "ad", null, false, true)).toBe("");
  });
});

describe("marking a written piece", () => {
  it("names สูตรโปร, adds the guides' reports for สูตรอ่าน-ดูจนจบ, and leaves a piece with none alone", () => {
    expect(markFormula(piece, "pro", "{}")).toEqual({ ...piece, formula: "pro" });
    expect(markFormula(piece, null, "{}")).toBe(piece);
    expect(markFormula(piece, "finish", JSON.stringify({ shareWhy: "use" }))).toMatchObject({ formula: "finish", shareWhy: "use" });
  });
});
