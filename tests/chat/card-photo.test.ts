import { beforeAll, describe, expect, it } from "vitest";
import { signCardPhoto, verifyCardPhoto, withCustomerPhoto } from "@/lib/card-photo";
import { canonicalCardUrl, QUOTE_CARD_KEYS, QUOTE_CARD_ONLY_KEYS } from "@/app/api/card/canonical";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
});

describe("the ask for a customer's photo", () => {
  it("names the Page and the customer, for ten minutes", () => {
    const t = signCardPhoto("page1", "psid1", 1_000);
    expect(verifyCardPhoto(t, 1_000 + 9 * 60_000)).toEqual({ pageId: "page1", psid: "psid1" });
    expect(verifyCardPhoto(t, 1_000 + 11 * 60_000)).toBeNull();
  });

  it("is refused when any of it has been touched", () => {
    const t = signCardPhoto("page1", "psid1");
    const [body, sig] = t.split(".");
    const other = signCardPhoto("page1", "psid2").split(".")[0];
    expect(verifyCardPhoto(`${other}.${sig}`)).toBeNull();
    expect(verifyCardPhoto(`${body}.${sig}x`)).toBeNull();
    expect(verifyCardPhoto(body)).toBeNull();
    expect(verifyCardPhoto("")).toBeNull();
  });

  it("is only added to the plain quote card, not to the tables or the other cards", () => {
    expect(withCustomerPhoto("/api/card?plan=LP&age=35", "p", "u")).toMatch(/^\/api\/card\?plan=LP&age=35&ph=/);
    expect(withCustomerPhoto("/api/card/table?plan=LP", "p", "u")).toBeNull();
    expect(withCustomerPhoto("/api/ihealthy-card?age=35", "p", "u")).toBeNull();
  });

  it("is a key the quote card reads and its table does not", () => {
    const path = withCustomerPhoto("/api/card?plan=LP&age=35&sex=M&sum=1&v=x", "p", "u")!;
    const url = new URL(path, "https://example.test");
    expect(canonicalCardUrl(url, QUOTE_CARD_ONLY_KEYS)).toBeNull();
    expect(canonicalCardUrl(url, QUOTE_CARD_KEYS)?.search).not.toContain("ph=");
  });
});
