import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Every server action behind Studio and the back office asks who is calling before it does
 * anything. A "use server" file's exports are doors anybody can knock on — the page that shows
 * the button being gated does not gate the action behind it — so a new action that forgets to
 * ask would open a door nobody meant to open. This reads the files and fails when one does.
 */

const ROOT = path.resolve(__dirname, "../../src/app");
const GATED = ["admin", "studio"];
/** the only "use server" exports under those folders that are not doors from a browser */
const ALLOWED: string[] = [];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

/**
 * Where a function's body opens, given the index just past `function name(`: past the
 * parameters, then the first `{` outside every bracket that does not open a type (a return
 * type such as `Promise<{ ok: boolean }>` or `: { a: 1 }` has braces of its own).
 */
function bodyStart(src: string, i: number): number {
  for (let depth = 1; depth; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") depth--;
  }
  let angle = 0, brace = 0, square = 0, paren = 0, prev = ")";
  for (; ; i++) {
    const c = src[i];
    if (c === "=" && src[i + 1] === ">") { i++; prev = ">"; continue; }
    if (c === "<") angle++;
    else if (c === ">") angle--;
    else if (c === "(") paren++;
    else if (c === ")") paren--;
    else if (c === "[") square++;
    else if (c === "]") square--;
    else if (c === "{") {
      if (!angle && !brace && !square && !paren && !":|&=,".includes(prev)) return i;
      brace++;
    } else if (c === "}") brace--;
    if (!/\s/.test(c)) prev = c;
  }
}

const actionFiles = GATED.flatMap((d) => files(path.join(ROOT, d)))
  .filter((f) => /^\s*["']use server["'];?/.test(readFileSync(f, "utf8")));

describe("server actions ask who is calling", () => {
  it("finds the action files", () => {
    expect(actionFiles.length).toBeGreaterThan(5);
  });

  for (const file of actionFiles) {
    const rel = path.relative(ROOT, file);
    it(rel, () => {
      const src = readFileSync(file, "utf8");
      const unguarded: string[] = [];
      for (const m of src.matchAll(/export async function (\w+)\(/g)) {
        if (ALLOWED.includes(`${rel}#${m[1]}`)) continue;
        const first = src.slice(bodyStart(src, m.index! + m[0].length)).split("\n")[1]?.trim() ?? "";
        if (!/^(const \w+ = )?await require(Member|Staff)\(/.test(first)) unguarded.push(`${m[1]}: ${first}`);
      }
      expect(unguarded).toEqual([]);
    });
  }
});
