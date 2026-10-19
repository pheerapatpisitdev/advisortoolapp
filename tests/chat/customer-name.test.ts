import { describe, expect, it } from "vitest";
import { addressedAs, cleanCustomerName, NAME_MAX, withCustomerName } from "@/lib/customer-name";
import { canonicalCardUrl, HEALTH_CARD_KEYS, HEALTH_QUOTE_KEYS, PENSION_TABLE_KEYS, QUOTE_CARD_KEYS } from "@/app/api/card/canonical";

describe("the customer's name on a quote", () => {
  it("is optional: nothing typed is no name", () => {
    expect(cleanCustomerName(undefined)).toBeUndefined();
    expect(cleanCustomerName("")).toBeUndefined();
    expect(cleanCustomerName("   ")).toBeUndefined();
    expect(cleanCustomerName("คุณ ")).toBeUndefined();
  });

  it("drops a typed คุณ, so the card does not say it twice", () => {
    expect(cleanCustomerName("คุณสมชาย")).toBe("สมชาย");
    expect(cleanCustomerName("คุณ สมชาย")).toBe("สมชาย");
    expect(addressedAs("สมชาย")).toBe("คุณสมชาย");
    expect(addressedAs("Anna", false)).toBe("Anna");
  });

  it("loses what a keyboard leaves behind and closes up spaces", () => {
    expect(cleanCustomerName("​สม​ชาย\n ใจดี ")).toBe("สมชาย ใจดี");
  });

  it("is cut to its length", () => {
    expect(Array.from(cleanCustomerName("ก".repeat(50))!)).toHaveLength(NAME_MAX);
  });

  it("rides last in the picture's address, which stays canonical", () => {
    const path = withCustomerName("/api/card?plan=LIFEPROTECT&age=35&sex=M&v=1", "สมชาย");
    expect(path).toBe(`/api/card?plan=LIFEPROTECT&age=35&sex=M&v=1&name=${encodeURIComponent("สมชาย")}`);
    expect(withCustomerName("/api/card?plan=X", undefined)).toBe("/api/card?plan=X");
    const at = (p: string) => new URL(p, "https://www.advisortool.app");
    expect(canonicalCardUrl(at(path), QUOTE_CARD_KEYS)).toBeNull();
    expect(canonicalCardUrl(at("/api/card/pension-table?age=35&sex=M&name=a"), PENSION_TABLE_KEYS)).toBeNull();
    expect(canonicalCardUrl(at("/api/ihealthy-card?age=35&sex=M&name=a"), HEALTH_QUOTE_KEYS)).toBeNull();
    // the bot's plans-side-by-side table draws no name: there it is padding
    expect(canonicalCardUrl(at("/api/ihealthy-card/table?age=35&sex=M&name=a"), HEALTH_CARD_KEYS)).not.toBeNull();
  });
});
