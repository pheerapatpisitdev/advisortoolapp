import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The palette is the only place a colour is decided, and this is what says so.
 *
 * Every colour in this application was re-pointed at one set of `--bot-*` tokens in
 * globals.css, lifted from a Bank of Thailand deck. Nothing enforces that at the type level:
 * `bg-slate-50` compiles, renders, and looks almost right, which is exactly why one would
 * survive a review. A year of those and the palette is back to being a suggestion.
 *
 * So two things are checked here. That no component reaches past the tokens for a colour, and
 * that the tokens themselves still clear the contrast the palette was built to clear — the
 * derived ones exist only for that reason, and a well-meant nudge toward the deck's own
 * values would quietly undo them.
 */

const SRC = path.join(process.cwd(), "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") || full.endsWith(".ts") ? [full] : [];
  });
}

/** Tailwind's own scales — the thing this palette replaced. */
const SCALE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|accent|placeholder|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?\b/g;

describe("nothing in the application names a colour Tailwind's way", () => {
  it("has no palette-scale utility classes left anywhere in src", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const found = readFileSync(file, "utf8").match(SCALE);
      if (found) offenders.push(`${path.relative(process.cwd(), file)}: ${[...new Set(found)].join(", ")}`);
    }
    expect(offenders, "ใช้ token ใน globals.css แทนสีของ Tailwind").toEqual([]);
  });
});

/**
 * Hex literals, and the short list of places one is still the right answer.
 *
 * Three kinds survive and each is a real exception rather than an oversight: a palette has to
 * be written down somewhere; a drawing rendered at a fixed width cannot read a CSS variable;
 * and another company's brand colour is not ours to re-point — a Facebook button in navy is
 * a button people do not recognise.
 */
const MAY_HOLD_LITERALS = [
  "src/app/globals.css",
  "src/lib/card-theme.ts", // the palette a quote card is drawn in
  "src/lib/shell/menu.ts", // the menu's arc of chip colours
  "src/app/admin/crm/Funnel.tsx", // the funnel's five-step ramp
  "src/app/group-insurance/theme.css", // the risk-level ramp
  "src/components/group-insurance/QuoteSheetDoc.tsx", // a fixed 794px sheet, no variables to read
  "src/app/manifest.ts", // the PWA manifest takes colours, not variables
];

/**
 * Somebody else's brand, which we do not get to re-colour: Facebook's blue, and Google's
 * sign-in button — the four-colour G on white with its grey edge and ink (src/app/login/LoginForm.tsx).
 */
const FOREIGN_BRANDS = /#0866FF|#0653cc|#048A3D|#4285F4|#EA4335|#FBBC05|#34A853|#dadce0|#3c4043|#f8f9fa/i;

describe("hex literals are confined to the places that must hold them", () => {
  it("leaves none loose in a component", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const rel = path.relative(process.cwd(), file);
      if (MAY_HOLD_LITERALS.includes(rel)) continue;
      const text = readFileSync(file, "utf8");
      const hits = (text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).filter((h) => !FOREIGN_BRANDS.test(h));
      // an SVG data-URI encodes its stroke as %23xxxxxx, which is the same literal
      if (hits.length) offenders.push(`${rel}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders, "ย้ายสีไปไว้ใน globals.css").toEqual([]);
  });
});

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function ratio(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** the `--bot-*` declarations, which are plain hex by design so this can read them */
function palette(): Record<string, string> {
  const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--bot-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

/**
 * The one ramp that is allowed a palette of its own, and the price of the permission.
 *
 * iHealthy Ultra's six plans wear the company's own six colours, so that the printed benefit
 * sheet and this page are the same scale in the same order. What the printed sheet does not
 * have to answer for is contrast: white type on its own bands reads between 2.15 and 2.93,
 * which is under half of what a screen owes a reader. So the hues are the company's and the
 * lightness is ours, and this is what keeps it that way — a well-meant nudge back toward the
 * sheet's own swatches would undo it silently, which is exactly how the rest of the palette
 * came to need a test.
 */
function planRamp(): { name: string; band: string; wash: string }[] {
  const css = readFileSync(path.join(SRC, "app/ihealthy-ultra/theme.css"), "utf8");
  const found = new Map<string, string>();
  for (const m of css.matchAll(/(--ihu-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) found.set(m[1], m[2]);
  return [...found]
    .filter(([token]) => !token.endsWith("-wash"))
    .map(([token, band]) => ({
      name: token.replace("--ihu-", ""),
      band,
      wash: found.get(`${token}-wash`)!,
    }));
}

describe("the six plans' colours are the company's hues at our contrast", () => {
  it("names a band and a wash for each of the six", () => {
    expect(planRamp().map((p) => p.name)).toEqual([
      "smart", "bronze", "silver", "gold", "diamond", "platinum",
    ]);
    expect(planRamp().every((p) => p.wash !== undefined)).toBe(true);
  });

  it("carries white type on every band, and the page's ink on every wash", () => {
    const tokens = palette();
    const failures: string[] = [];
    for (const { name, band, wash } of planRamp()) {
      const onBand = ratio(tokens["--bot-surface"], band);
      if (onBand < 4.5) failures.push(`${name}: ขาวบนแถบ ${onBand.toFixed(2)}`);
      for (const ink of ["--bot-ink", "--bot-ink-mute"] as const) {
        const onWash = ratio(tokens[ink], wash);
        if (onWash < 4.5) failures.push(`${name}: ${ink} บนพื้น ${onWash.toFixed(2)}`);
      }
    }
    expect(failures, "แถบสีแผนต้องอ่านออกที่ 4.5:1").toEqual([]);
  });
});

/**
 * The pairs the palette promises.
 *
 * Text is held to 4.5:1 and the edge of a control to 3:1. The three surfaces are all listed
 * for anything that lands on more than one of them, because the panel is the darkest and is
 * the one a line is easiest to lose against — checking only white would pass a token that
 * disappears inside a table.
 */
const MUST_HOLD: [fg: string, bg: string, least: number][] = [
  ["--bot-ink", "--bot-surface", 4.5],
  ["--bot-ink", "--bot-band", 4.5],
  ["--bot-ink", "--bot-panel", 4.5],
  ["--bot-ink-mute", "--bot-surface", 4.5],
  ["--bot-ink-mute", "--bot-band", 4.5],
  ["--bot-ink-mute", "--bot-panel", 4.5],
  ["--bot-ink-foot", "--bot-surface", 4.5],
  ["--bot-navy", "--bot-surface", 4.5],
  ["--bot-navy", "--bot-band", 4.5],
  ["--bot-navy", "--bot-panel", 4.5],
  ["--bot-navy", "--bot-sand", 4.5],
  ["--bot-navy", "--bot-sand-soft", 4.5],
  ["--bot-navy", "--bot-navy-soft", 4.5],
  ["--bot-navy-lift", "--bot-surface", 4.5],
  ["--bot-surface", "--bot-navy", 4.5],
  ["--bot-surface", "--bot-navy-deep", 4.5],
  ["--bot-surface", "--bot-ok", 4.5],
  ["--bot-olive-ink", "--bot-surface", 4.5],
  ["--bot-olive-ink", "--bot-band", 4.5],
  ["--bot-red-ink", "--bot-surface", 4.5],
  ["--bot-red-ink", "--bot-red-soft", 4.5],
  ["--bot-ok", "--bot-surface", 4.5],
  ["--bot-ok", "--bot-ok-soft", 4.5],
  ["--bot-sand-ink", "--bot-sand-soft", 4.5],
  ["--bot-sand-ink", "--bot-surface", 4.5],
  // the edges of controls, which only have to be found rather than read
  ["--bot-line-strong", "--bot-surface", 3],
  ["--bot-line-strong", "--bot-band", 3],
  ["--bot-line-strong", "--bot-panel", 3],
  ["--bot-sand-line", "--bot-surface", 3],
  ["--bot-ink-faint", "--bot-surface", 3],
  ["--bot-ink-faint", "--bot-band", 3],
];

describe("the palette still clears what it was built to clear", () => {
  const p = palette();

  it("declares every token these checks name", () => {
    const named = new Set(MUST_HOLD.flatMap(([a, b]) => [a, b]));
    expect([...named].filter((n) => !p[n])).toEqual([]);
  });

  for (const [fg, bg, least] of MUST_HOLD) {
    it(`${fg} on ${bg} holds ${least}:1`, () => {
      expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(least);
    });
  }

  /**
   * The two that cannot carry small text, asserted as the limits they are.
   *
   * A later hand might see 3.49:1 as a near miss and nudge --bot-olive darker to "fix" it.
   * That token is the deck's own display colour and is meant to stay where the deck put it;
   * the fix for small olive text is --bot-olive-ink, which is checked above. The same goes
   * for the blue, which is a bar in a chart and never a word.
   */
  it("keeps the two display-only colours honest about being display-only", () => {
    expect(ratio(p["--bot-olive"], p["--bot-surface"])).toBeLessThan(4.5);
    expect(ratio(p["--bot-blue"], p["--bot-surface"])).toBeLessThan(3);
    // and what to reach for instead clears the bar with room
    expect(ratio(p["--bot-olive-ink"], p["--bot-surface"])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p["--bot-ink"], p["--bot-blue"])).toBeGreaterThanOrEqual(4.5);
  });
});
