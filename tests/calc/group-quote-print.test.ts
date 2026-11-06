import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialog = readFileSync("src/components/group-insurance/QuoteDialog.tsx", "utf8");
const css = readFileSync("src/app/group-insurance/theme.css", "utf8");
const printBlock = css.slice(css.indexOf("@media print"));

/**
 * An iPhone makes its PDF after the print button's code has finished, and no test here can run
 * one, so these hold the shape that survives that: two PDFs from the owner (2026-11-06) came out
 * as the whole page with the dialog's backdrop across the table.
 */
describe("the group quotation on paper", () => {
  it("hides the page for as long as the dialog is open, not around window.print()", () => {
    expect(dialog).toMatch(/useEffect\(\(\) => \{\s*const target = sheetRef\.current;\s*return target \? preparePrint\(target\) : undefined;/);
    expect(dialog).toContain("onClick={() => window.print()}");
  });

  it("lets the dialog off the screen's size and out of the app's frame", () => {
    expect(printBlock).toContain(".group-insurance .gi-quote-root");
    expect(dialog).toContain("gi-quote-root");
    expect(printBlock).toMatch(/\.group-insurance main \{\s*padding: 0 !important;/);
  });

  it("locks scrolling on screen only, so it cannot cut the sheet on paper", () => {
    expect(css).toMatch(/@media screen \{\s*html\.gi-modal-open, html\.gi-modal-open body \{ overflow: hidden; \}/);
  });
});
