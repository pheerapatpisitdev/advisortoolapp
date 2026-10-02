import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * A "use server" file may export only async functions (and types). Next checks this when the
 * page is rendered, not when it compiles, so `export const RENDER_PROVIDERS` in actions.ts
 * passed tsc, eslint and every unit test and then crashed /admin/ai. Constants a client
 * component needs belong in a plain module.
 */

const SRC = path.join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

const isUseServer = (text: string) => /^\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*["']use server["']/.test(text);

/** The exports that are not an async function, a type or an interface. */
export function badExports(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^export\s+(?!type\b|interface\b|async\s+function\b)([^\n]*)/gm)) {
    const line = m[0].trim();
    // `export { type A }` is a type; any other brace export may carry a value
    if (/^export\s*\{\s*type\b[^,}]*\}/.test(line)) continue;
    out.push(line);
  }
  return out;
}

describe("a 'use server' file exports only async functions", () => {
  it("catches a constant, a class, a sync function and a value re-export, and lets types and async functions through", () => {
    expect(badExports('"use server";\nexport const A = 1;')).toHaveLength(1);
    expect(badExports('"use server";\nexport class A {}')).toHaveLength(1);
    expect(badExports('"use server";\nexport enum A { X }')).toHaveLength(1);
    expect(badExports('"use server";\nexport function f() {}')).toHaveLength(1);
    expect(badExports('"use server";\nexport { A } from "./a";')).toHaveLength(1);
    expect(badExports('"use server";\nexport async function f() {}\nexport type A = 1;\nexport interface B {}\nexport type { C } from "./c";')).toEqual([]);
  });

  it("holds for every server-action file in src", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      if (!isUseServer(text)) continue;
      for (const bad of badExports(text)) offenders.push(`${path.relative(process.cwd(), file)}: ${bad}`);
    }
    expect(offenders, "ย้ายค่าคงที่ไปไว้ในไฟล์ธรรมดา — ไฟล์ use server ส่งออกได้เฉพาะ async function").toEqual([]);
  });
});
