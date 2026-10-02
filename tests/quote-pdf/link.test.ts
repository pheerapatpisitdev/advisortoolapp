import { describe, expect, it } from "vitest";
import {
  pagePathFor, planInitialFrom, planQueryFor, quotePdfPath, type PlanInitial,
} from "@/lib/quote-pdf/link";
import { PLAN_PAGES, pageForPlan, type PlanPage } from "@/lib/quote-pdf/pages";

/** The link from a quote to its PDF and to the sales page pre-filled with the same numbers. */

const parse = (q: string) => Object.fromEntries(new URLSearchParams(q));

const ONE_PER_PAGE: Record<PlanPage, PlanInitial> = {
  lifeprotect: { age: 35, sex: "M", sumAssured: 1_000_000, variant: "WLF99H" },
  easyprotect: { age: 40, sex: "F", sumAssured: 1_000_000, variant: "W99F06A" },
  ishield: { age: 35, sex: "F", sumAssured: 1_000_000, variant: "WLCI10" },
  lifetreasure: { age: 45, sex: "M", sumAssured: 10_000_000, variant: "H99F18A" },
  plb: { age: 35, sex: "F", sumAssured: 1_000_000, variant: "PLB12" },
};

describe("the PDF path for a quote", () => {
  it("makes a path for a Life Protect quote on the slider", () => {
    expect(quotePdfPath({ kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000 }))
      .toMatch(/^\/api\/quote-pdf\?page=lifeprotect&age=35&sex=M&sum=1000000&variant=WLF99H&v=.+$/);
  });

  it("makes none for a sum the page cannot show", () => {
    expect(quotePdfPath({ kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 2_300_000 })).toBeUndefined();
  });

  it("makes none for a plan with no page of its own", () => {
    expect(pageForPlan("ISMART")).toBeUndefined();
    expect(quotePdfPath({ kind: "plan", planCode: "ISMART", variant: "X", age: 35, sex: "M", sumAssured: 1_000_000 })).toBeUndefined();
  });

  it("carries an iHealthy query through untouched", () => {
    expect(quotePdfPath({ kind: "ihealthy", query: "age=30&sex=M" })).toMatch(/^\/api\/quote-pdf\?page=ihealthy-ultra&age=30&sex=M&v=.+$/);
    expect(quotePdfPath({ kind: "ihealthy", query: "age=30&sex=M", lang: "en" }))
      .toMatch(/^\/api\/quote-pdf\?page=ihealthy-ultra&age=30&sex=M&l=en&v=.+$/);
    // the page reads its language from a cookie, so its own link carries none
    expect(pagePathFor("/api/quote-pdf?page=ihealthy-ultra&age=30&sex=M&l=en&v=1")).toBe("/ihealthy-ultra?age=30&sex=M");
  });
});

describe("a page's initial values from its query", () => {
  it("rejects an iShield term the age cannot have", () => {
    // WLCI10 stops at 51
    expect(planInitialFrom("ishield", parse(planQueryFor({ ...ONE_PER_PAGE.ishield, age: 55 })))).toBeUndefined();
    expect(planInitialFrom("ishield", parse(planQueryFor({ ...ONE_PER_PAGE.ishield, age: 51 })))).toBeDefined();
  });

  it("reads back what it wrote, on every page", () => {
    for (const page of Object.keys(ONE_PER_PAGE) as PlanPage[]) {
      const x = ONE_PER_PAGE[page];
      expect(planInitialFrom(page, parse(planQueryFor(x))), page).toEqual(x);
    }
  });

  it("rejects repeated or missing keys", () => {
    const q = parse(planQueryFor(ONE_PER_PAGE.plb));
    expect(planInitialFrom("plb", { ...q, sum: ["1000000", "2000000"] })).toBeUndefined();
    const { sex: _sex, ...noSex } = q;
    expect(planInitialFrom("plb", noSex)).toBeUndefined();
  });

  it("rejects values the page's own controls do not offer", () => {
    const base = ONE_PER_PAGE.plb;
    expect(planInitialFrom("plb", parse(planQueryFor({ ...base, variant: "PLB99" })))).toBeUndefined();
    expect(planInitialFrom("plb", parse(planQueryFor({ ...base, age: 19 })))).toBeUndefined();
    expect(planInitialFrom("plb", { ...parse(planQueryFor(base)), age: "35.5" })).toBeUndefined();
    expect(planInitialFrom("plb", { ...parse(planQueryFor(base)), sex: "X" })).toBeUndefined();
    // EasyProtect's page has no term picker: only its one term is on offer
    expect(planInitialFrom("easyprotect", parse(planQueryFor({ ...ONE_PER_PAGE.easyprotect, variant: "WLF99H" })))).toBeUndefined();
  });

  it("only accepts sums on that page's slider", () => {
    for (const page of Object.keys(PLAN_PAGES) as PlanPage[]) {
      const x = ONE_PER_PAGE[page];
      expect(PLAN_PAGES[page].sums).toContain(x.sumAssured);
      expect(planInitialFrom(page, parse(planQueryFor({ ...x, sumAssured: x.sumAssured + 1 }))), page).toBeUndefined();
    }
  });
});

describe("the page link for a PDF path", () => {
  it("turns a pdf path into the page link", () => {
    expect(pagePathFor("/api/quote-pdf?page=plb&age=35&sex=F&sum=1000000&variant=PLB12&v=x"))
      .toBe("/plb?age=35&sex=F&sum=1000000&variant=PLB12");
  });

  it("points an iHealthy PDF at its own page, and knows no other", () => {
    expect(pagePathFor("/api/quote-pdf?page=ihealthy-ultra&age=30&v=x")).toBe("/ihealthy-ultra?age=30");
    // LINE's flag is the route's, not the page's
    expect(pagePathFor("/api/quote-pdf?page=ihealthy-ultra&age=30&v=x&openExternalBrowser=1")).toBe("/ihealthy-ultra?age=30");
    expect(pagePathFor("/api/quote-pdf?page=constructor&age=30&v=x")).toBeUndefined();
    expect(pagePathFor("/api/quote-pdf?age=30")).toBeUndefined();
  });
});
