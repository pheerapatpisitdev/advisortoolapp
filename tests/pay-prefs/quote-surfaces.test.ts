import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/quote-pdf/render", () => ({ renderQuotePdf: vi.fn() }));

import { GET } from "@/app/api/quote-pdf/route";
import { canonicalCardUrl, HEALTH_QUOTE_KEYS, QUOTE_CARD_ONLY_KEYS } from "@/app/api/card/canonical";
import { cardPath, cardInputFrom, quoteCard, type CardInput } from "@/lib/quote-card";
import { cardVersionFor } from "@/lib/card-theme";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { iHealthyCompareCard } from "@/lib/ihealthy-compare-card";
import { cardQuery, initialFrom, queryFrom } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { renderQuotePdf } from "@/lib/quote-pdf/render";
import { siteOrigin } from "@/lib/site-url";
import { pensionQuoteText } from "@/lib/pension-cta";
import { quotePension } from "@/calc/pension/engine";

/** ตั้งค่าส่วนตัว on the quote pictures, iHealthy, the PDF route and บำนาญ 95 (src/lib/pay-prefs.ts). */

const WHILE_CURRENT = new Date("2026-09-05");
const MAN35: CardInput = {
  kind: "plan", planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, mode: "monthly",
};
const fromPath = (path: string) => cardInputFrom(new URLSearchParams(path.split("?")[1]))!;

describe("quote card", () => {
  it("with no hide is the card it always was: monthly headline, every instalment", () => {
    const card = quoteCard(fromPath(cardPath(MAN35)), WHILE_CURRENT)!;
    expect(card.premium?.per).toBe("ต่อเดือน");
    expect(card.summary?.rows.map((r) => r.label)).toEqual(["รายปี", "ราย 6 เดือน", "รายเดือน"]);
  });

  it("hide=monthly leaves no monthly row and headlines the year", () => {
    const path = cardPath({ ...MAN35, hide: ["monthly"] });
    expect(path).toContain("hide=monthly");
    const card = quoteCard(fromPath(path), WHILE_CURRENT)!;
    expect(card.premium?.per).toBe("ต่อปี");
    expect(card.summary?.rows.map((r) => r.label)).toEqual(["รายปี", "ราย 6 เดือน"]);
    expect(card.summary?.rows.some((r) => r.after)).toBe(false);
  });

  it("hide=semi.monthly leaves the year alone", () => {
    const card = quoteCard(fromPath(cardPath({ ...MAN35, hide: ["semi", "monthly"] })), WHILE_CURRENT)!;
    expect(card.summary?.rows.map((r) => r.label)).toEqual(["รายปี"]);
  });

  it("Life Protect's split box names the year when monthly is hidden", () => {
    const withRider: CardInput = { ...MAN35, riders: { medical: 1000 } };
    const plain = quoteCard(fromPath(cardPath(withRider)), WHILE_CURRENT);
    const hidden = quoteCard(fromPath(cardPath({ ...withRider, hide: ["monthly"] })), WHILE_CURRENT);
    expect(plain!.summary!.split!.title).toContain("รายเดือน");
    expect(hidden!.summary!.split!.title).toContain("รายปี");
    expect(hidden!.premium?.per).toBe("ต่อปี");
  });

  it("the canonical check keeps hide rather than redirecting it away", () => {
    const url = new URL(`http://x${cardPath({ ...MAN35, hide: ["monthly"] })}`);
    expect(canonicalCardUrl(url, QUOTE_CARD_ONLY_KEYS)).toBeNull();
  });
});

describe("iHealthy", () => {
  const table = iHealthyTable();

  it("a link's hidden mode falls back to the year, and hide round-trips", () => {
    const v = initialFrom(table, { mode: "monthly", hide: "monthly" });
    expect(v.mode).toBe("annual");
    expect(v.hide).toEqual(["monthly"]);
    expect(queryFrom(table, v)).toContain("hide=monthly");
    expect(initialFrom(table, {}).hide).toBeUndefined();
    expect(queryFrom(table, IHEALTHY_OPENING)).not.toContain("hide");
  });

  it("the card picture drops hidden premium rows; no hide keeps all three", () => {
    const all = iHealthyCard(new URLSearchParams(cardQuery(table, IHEALTHY_OPENING)));
    const cut = iHealthyCard(new URLSearchParams(cardQuery(table, { ...IHEALTHY_OPENING, hide: ["semi", "monthly"] })));
    if (all.premiumRows.length) {
      expect(all.premiumRows).toHaveLength(3);
      expect(cut.premiumRows).toHaveLength(1);
      expect(cut.premiumRows[0].label).toBe(all.premiumRows[0].label);
    }
  });

  it("the compare picture prices the rows it keeps, not the ones by position", () => {
    const all = iHealthyCompareCard(new URLSearchParams(cardQuery(table, IHEALTHY_OPENING)));
    const cut = iHealthyCompareCard(new URLSearchParams(cardQuery(table, { ...IHEALTHY_OPENING, hide: ["semi"] })));
    if (all.premiumRows.length) {
      expect(cut.premiumRows.map((r) => r.label)).toEqual([all.premiumRows[0].label, all.premiumRows[2].label]);
      expect(cut.premiumRows[1].cells).toEqual(all.premiumRows[2].cells);
    }
  });

  it("the health card's canonical keys accept hide", () => {
    const url = new URL(`http://x/api/ihealthy-card?${cardQuery(table, { ...IHEALTHY_OPENING, hide: ["monthly"] })}`);
    expect(canonicalCardUrl(url, HEALTH_QUOTE_KEYS, ["r"])).toBeNull();
  });
});

describe("GET /api/quote-pdf with hide", () => {
  const render = vi.mocked(renderQuotePdf);
  beforeEach(() => {
    render.mockReset();
    render.mockResolvedValue(Buffer.from("%PDF-1.4"));
  });

  it("accepts hide and prints the page with it", async () => {
    const query = queryFrom(iHealthyTable(), { ...IHEALTHY_OPENING, hide: ["monthly"] });
    const res = await GET(new Request(`http://localhost/api/quote-pdf?page=ihealthy-ultra&${query}&v=${cardVersionFor()}`, {
      headers: { "x-real-ip": "10.9.9.1" },
    }));
    expect(res.status).toBe(200);
    expect(render.mock.calls[0][0]).toBe(`${siteOrigin()}/ihealthy-ultra?${query}`);
    expect(render.mock.calls[0][0]).toContain("hide=monthly");
  });
});

describe("บำนาญ 95 copied text", () => {
  const r = quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "monthlyPension", amount: 10_000 });
  if (!r.ok) throw new Error(r.error);
  const q = r.quote;
  const who = { age: 40, sex: "M" as const };

  it("names both other instalments with nothing hidden", () => {
    expect(pensionQuoteText(who, q)).toMatch(/ราย 6 เดือน [\d,]+ · รายเดือน [\d,]+ บาท/);
  });

  it("drops a hidden one, and the line when both are", () => {
    const one = pensionQuoteText(who, q, ["monthly"]);
    expect(one).toMatch(/ราย 6 เดือน [\d,]+ บาท/);
    expect(one).not.toContain("รายเดือน");
    const none = pensionQuoteText(who, q, ["semi", "monthly"]);
    expect(none).not.toContain("ราย 6 เดือน");
    expect(none).not.toContain("รายเดือน");
    // the payout is a benefit, not a premium, and stays
    expect(none).toContain("บำนาญเดือนละ");
  });
});
