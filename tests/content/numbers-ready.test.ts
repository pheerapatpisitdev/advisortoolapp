import { describe, expect, it } from "vitest";
import { numbersReady } from "@/lib/content/numbers-plans";
import { CONTENT_PRODUCTS } from "@/lib/content/products";

/** ตัวเลขชัดๆ is refused before a round is counted, with the right words (owner, 2026-10-18) */
describe("numbersReady", () => {
  it("says none for a product with no numbers plan", () => {
    expect(numbersReady("/not-a-plan")).toBe("none");
  });

  it("says ok for some product that has one, and stale once its table no longer prices today", () => {
    const ready = CONTENT_PRODUCTS.map((p) => numbersReady(p.href));
    expect(ready).toContain("ok");
    const href = CONTENT_PRODUCTS[ready.indexOf("ok")].href;
    expect(["stale", "ok"]).toContain(numbersReady(href, new Date("2099-01-01")));
  });
});
