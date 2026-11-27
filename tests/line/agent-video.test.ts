import { describe, expect, it } from "vitest";
import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import { videoFormLink, videoStartOfChat } from "@/lib/line/agent-video";
import { videoStartFrom } from "@/lib/quote-video/link";

describe("the quote the chat holds", () => {
  const lp = {
    intent: "quote", product: "lifeprotect", age: 35, sex: "M", coverWanted: 2_000_000,
    pdf: { paths: ["/api/quote-pdf?page=lifeprotect&age=35&sex=M&sum=1000000&variant=WLF19H&v=7"], asked: [] },
  } as unknown as WithPdf<AnySlots>;

  it("Life Protect takes the sum assured off the latest PDF, not the cover the family gets", () => {
    expect(videoStartOfChat(lp)).toEqual({ product: "LIFEPROTECT", age: 35, sex: "M", sumAssured: 1_000_000, variant: "WLF19H" });
  });
  it("a PDF of another plan gives Life Protect no sum", () => {
    const other = { ...lp, pdf: { paths: ["/api/quote-pdf?page=plb&age=35&sex=M&sum=500000&variant=PLB10"], asked: [] } } as WithPdf<AnySlots>;
    expect(videoStartOfChat(other)).toEqual({ product: "LIFEPROTECT", age: 35, sex: "M" });
  });
  it("iShield, iHealthy and มรดก from their own slots", () => {
    expect(videoStartOfChat({ product: "ishield", age: 40, sex: "F", sumAssured: 500_000, variant: "WLCI10" } as AnySlots))
      .toEqual({ product: "ISHIELD", age: 40, sex: "F", sumAssured: 500_000, variant: "WLCI10" });
    expect(videoStartOfChat({ product: "ihealthy", intent: "quote", age: 42, sex: "F", plan: "GOLD" } as AnySlots))
      .toEqual({ product: "IHEALTHY", age: 42, sex: "F", plan: "GOLD" });
    expect(videoStartOfChat({ product: "legacy", age: 50, sex: "M", tier: 3 } as AnySlots))
      .toEqual({ product: "LEGACY", age: 50, sex: "M", tier: 3 });
  });
  it("no person, or another plan, is no quote", () => {
    expect(videoStartOfChat({ product: "ishield", sex: "F" } as AnySlots)).toBeNull();
    expect(videoStartOfChat({ product: "undecided", age: 30, sex: "M" } as AnySlots)).toBeNull();
    expect(videoStartOfChat(null)).toBeNull();
  });
  it("the link opens the form on that quote, in the phone's own browser", () => {
    const url = new URL(videoFormLink(videoStartOfChat(lp)));
    expect(url.pathname).toBe("/studio/quote-video");
    expect(url.searchParams.get("openExternalBrowser")).toBe("1");
    expect(videoStartFrom(Object.fromEntries(url.searchParams))).toMatchObject({ product: "LIFEPROTECT", sex: "M", age: 35, sumAssured: 1_000_000 });
  });
});
