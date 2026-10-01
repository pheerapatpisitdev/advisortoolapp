import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Every Studio page asks who is calling itself (review, 2026-10-01). The layout's gate is not
 * re-run on every client navigation between pages under it, so a page that leans on the layout
 * alone can be drawn for a session the layout would now turn away.
 */

const STUDIO = path.resolve(__dirname, "../../src/app/studio");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? pages(full) : name === "page.tsx" ? [full] : [];
  });
}

describe("Studio's pages", () => {
  const found = pages(STUDIO);

  it("are found", () => {
    expect(found.length).toBeGreaterThan(5);
  });

  for (const file of found) {
    it(`${path.relative(STUDIO, file)} calls gatePage`, () => {
      expect(readFileSync(file, "utf8")).toMatch(/await gatePage\(/);
    });
  }
});
