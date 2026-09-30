import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Posting a piece draws its poster on the server, inside the page the owner pressed from, and
 * the drawing reads two .wasm files off disk at run time — which the bundler cannot see, so
 * each such page must list them. On 2026-09-25 the calendar (then /content/calendar) shipped without them and
 * every post from the calendar failed with ENOENT on index_bg.wasm.
 *
 * Merely importing the drawing is enough to need them: satori starts loading hb.wasm when its
 * module loads, and a missing file is an unhandled rejection that ends the whole Node process.
 * On 2026-10-01 the API routes that reuse Studio's actions (content-generate, -draw, -draft)
 * died that way mid-request — a picture drawn and paid for, then lost with the process.
 */

const WASM = ["./node_modules/harfbuzzjs/hb.wasm", "./node_modules/@resvg/resvg-wasm/index_bg.wasm"];
/** the pages whose server actions reach drawPoster (publish-flow) */
const DRAWING_PAGES = ["/api/content-poster", "/studio", "/studio/calendar"];

/** a route's key in outputFileTracingIncludes: exact, `/**` for a subtree, `*` within one segment */
function covers(key: string, route: string): boolean {
  if (key === route) return true;
  if (key.endsWith("/**")) return route === key.slice(0, -3) || route.startsWith(key.slice(0, -2));
  if (key.includes("*")) return new RegExp(`^${key.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`).test(route);
  return false;
}

function listed(route: string): string[] {
  return Object.entries(nextConfig.outputFileTracingIncludes ?? {})
    .filter(([key]) => covers(key, route))
    .flatMap(([, files]) => files);
}

/** every API route whose own imports reach the poster drawing — through Studio's actions or directly */
function drawingApiRoutes(): string[] {
  const root = path.resolve(__dirname, "../../src/app/api");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/^route\.tsx?$/.test(name)) {
        const src = readFileSync(full, "utf8");
        if (/from "@\/app\/studio\/actions"|publish-flow|poster-draw|poster-png/.test(src)) {
          found.push(`/api/${path.relative(root, dir).split(path.sep).join("/")}`);
        }
      }
    }
  };
  walk(root);
  return found.sort();
}

describe("every page that draws a poster ships the poster's wasm", () => {
  it.each(DRAWING_PAGES)("%s", (route) => {
    for (const file of WASM) expect(listed(route), `${route} → ${file}`).toContain(file);
  });
});

describe("every API route that imports the drawing ships the poster's wasm (2026-10-01)", () => {
  const routes = drawingApiRoutes();

  it("finds the routes that reuse Studio's actions", () => {
    expect(routes).toEqual(expect.arrayContaining(["/api/content-draft", "/api/content-draw", "/api/content-generate"]));
  });

  it.each(routes)("%s", (route) => {
    for (const file of WASM) expect(listed(route), `${route} → ${file}`).toContain(file);
  });
});
