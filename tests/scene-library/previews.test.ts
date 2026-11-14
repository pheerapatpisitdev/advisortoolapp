import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LIBRARY } from "@/lib/scene-library/catalog";

/** คลังแอนิเมชัน's preview pictures (remotion/library-stills.mjs): one for every path the catalogue names, and no other */
const PUBLIC = join(process.cwd(), "public");
const named = [...new Set(LIBRARY.flatMap((i) => [i.preview, ...(i.looks ?? []).map((l) => l.preview)]).filter((p): p is string => Boolean(p)))];

describe("library previews", () => {
  it("names pictures under /library/", () => {
    expect(named.length).toBeGreaterThan(0);
    for (const p of named) expect(p, p).toMatch(/^\/library\/[a-z0-9-]+\.jpg$/);
  });
  it("every named picture is there, 216×384 JPEG, under 40 KB", async () => {
    for (const p of named) {
      const file = join(PUBLIC, p);
      expect(existsSync(file), p).toBe(true);
      expect(statSync(file).size, p).toBeLessThan(40 * 1024);
      const m = await sharp(file).metadata();
      expect([m.format, m.width, m.height], p).toEqual(["jpeg", 216, 384]);
    }
  });
  it("no picture in public/library/ goes unused", () => {
    const files = existsSync(join(PUBLIC, "library")) ? readdirSync(join(PUBLIC, "library")).filter((f) => !f.startsWith(".")).map((f) => `/library/${f}`) : [];
    expect(files.filter((f) => !named.includes(f))).toEqual([]);
  });
});
