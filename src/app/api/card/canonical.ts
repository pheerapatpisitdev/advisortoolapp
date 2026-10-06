import { NextResponse, type NextRequest } from "next/server";

/**
 * One address per picture.
 *
 * The card routes are public and each drawing is a few hundred milliseconds of fonts and
 * layout. The CDN keeps a drawn card for a day, but it keeps it under the whole address, so
 * `?…&x=1`, `?…&x=2` and so on were each a fresh drawing for anyone who wanted to make the
 * server work — the route ignored the extra key and drew the same card every time (review,
 * 2026-10-01). A key repeated (`?age=35&age=36&…`) did the same.
 *
 * So a request carrying any key the route does not read, or a key twice that is only read
 * once, is sent with a 308 to the same address with only the keys the route reads, in a fixed
 * order, each once. Every link this app writes (src/lib/card-link.ts, src/lib/ihealthy-link.ts)
 * already is that address, so none of them is redirected and nothing that was sent to a
 * customer changes. Of a repeated key the first value is kept, which is the one the route
 * reads for the quote card; no link the app writes repeats one.
 *
 * Values are not touched: a different age is a different card.
 */

/** the quote card and its value table: src/lib/card-link.ts cardQuery, in its order */
export const QUOTE_CARD_KEYS = ["bundle", "tier", "plan", "variant", "age", "sex", "sum", "mode", "rider", "payer", "meb", "v"] as const;
/** one contract's illnesses: src/lib/card-link.ts diseaseCardPath */
export const DISEASE_CARD_KEYS = ["of"] as const;
/** the health card and its table: src/lib/ihealthy-link.ts cardQuery and cardPath, the menu's fit=phone */
export const HEALTH_CARD_KEYS = ["age", "sex", "base", "sa", "plan", "area", "cover", "mode", "r", "v", "cv", "l", "fit"] as const;
/** the one key a health link carries several of: one `r` per rider */
export const HEALTH_REPEATABLE = ["r"] as const;

/**
 * The canonical address for `url`, or null when `url` already is one. Exported for its test.
 */
export function canonicalCardUrl(
  url: URL, known: readonly string[], repeatable: readonly string[] = [],
): URL | null {
  const counts = new Map<string, number>();
  let canonical = true;
  for (const key of url.searchParams.keys()) {
    if (!known.includes(key)) {
      canonical = false;
      break;
    }
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > 1 && !repeatable.includes(key)) {
      canonical = false;
      break;
    }
  }
  if (canonical) return null;

  const out = new URLSearchParams();
  for (const key of known) {
    const values = url.searchParams.getAll(key);
    for (const value of repeatable.includes(key) ? values : values.slice(0, 1)) out.append(key, value);
  }
  const target = new URL(url.toString());
  target.search = out.toString();
  return target;
}

/** The 308 to the canonical address, or null when the request is already at it. */
export function toCanonical(
  req: NextRequest, known: readonly string[], repeatable: readonly string[] = [],
): NextResponse | null {
  const target = canonicalCardUrl(req.nextUrl, known, repeatable);
  return target ? NextResponse.redirect(target, 308) : null;
}
