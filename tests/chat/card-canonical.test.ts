import { describe, expect, it } from "vitest";
import {
  canonicalCardUrl, DISEASE_CARD_KEYS, HEALTH_CARD_KEYS, HEALTH_REPEATABLE, QUOTE_CARD_KEYS,
} from "@/app/api/card/canonical";
import { cardPath, diseaseCardPath, valueTablePath } from "@/lib/card-link";

/**
 * The card routes are public and drawing is the expensive part. A key the route never reads
 * made every address a fresh drawing past the CDN; such a request is now sent to the one
 * address that picture has (review, 2026-10-01). The links the app writes must never move.
 */

const at = (path: string) => new URL(path, "https://example.test");

describe("the links the app writes", () => {
  it("are already canonical, so none of them is redirected", () => {
    const plan = { kind: "plan" as const, planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000, mode: "monthly" as const };
    const bundle = { kind: "bundle" as const, bundleCode: "LEGACY", tier: 2, age: 40, sex: "F" as const };
    expect(canonicalCardUrl(at(cardPath(plan)), QUOTE_CARD_KEYS)).toBeNull();
    expect(canonicalCardUrl(at(cardPath(bundle)), QUOTE_CARD_KEYS)).toBeNull();
    expect(canonicalCardUrl(at(valueTablePath(plan)), QUOTE_CARD_KEYS)).toBeNull();
    expect(canonicalCardUrl(at(diseaseCardPath("CI123")), DISEASE_CARD_KEYS)).toBeNull();
  });

  it("keeps a health link's riders, empty fields and language as they are", () => {
    const link = "/api/ihealthy-card?age=35&sex=M&base=HU&sa=50000&plan=GOLD&area=&cover=&mode=annual&r=MEB%3A1000&r=DCI%3A%3A500000&v=abc&cv=6&l=en";
    expect(canonicalCardUrl(at(link), HEALTH_CARD_KEYS, HEALTH_REPEATABLE)).toBeNull();
    expect(canonicalCardUrl(at("/api/ihealthy-card/table?age=35&sex=M&v=abc&cv=6&fit=phone"), HEALTH_CARD_KEYS, HEALTH_REPEATABLE)).toBeNull();
  });
});

describe("an address padded to get past the cache", () => {
  it("is sent to the same card without the keys the route does not read", () => {
    const moved = canonicalCardUrl(at("/api/card?plan=LP&variant=W&age=35&sex=M&sum=1000000&v=x&bust=123"), QUOTE_CARD_KEYS);
    expect(moved?.pathname).toBe("/api/card");
    expect(moved?.search).toBe("?plan=LP&variant=W&age=35&sex=M&sum=1000000&v=x");
  });

  it("puts the keys in one order and keeps the first of a repeated key", () => {
    const moved = canonicalCardUrl(at("/api/card?age=35&age=99&sex=M&plan=LP&sum=1"), QUOTE_CARD_KEYS);
    expect(moved?.search).toBe("?plan=LP&age=35&sex=M&sum=1");
  });

  it("drops a key with no name at all", () => {
    expect(canonicalCardUrl(at("/api/card/diseases?of=CI&=x"), DISEASE_CARD_KEYS)?.search).toBe("?of=CI");
  });

  it("keeps every rider of a health link while it drops the padding", () => {
    const moved = canonicalCardUrl(at("/api/ihealthy-card?r=A&age=35&r=B&junk=1"), HEALTH_CARD_KEYS, HEALTH_REPEATABLE);
    expect(moved?.search).toBe("?age=35&r=A&r=B");
  });
});
