import { describe, expect, it } from "vitest";
import { pricedAnswer } from "@/lib/assistant/priced";

describe("the bubbles of a priced reply", () => {
  it("puts the card and the file on the first bubble and each further card on a bubble of its own", () => {
    const a = pricedAnswer({ text: "เบี้ย", priced: true, cards: ["/api/card?a", "/api/card/table?a"], pdfPath: "/api/quote-pdf?page=plb" }, "facebook");
    expect(a.messages).toEqual([
      { text: "เบี้ย", card: "/api/card?a", pdfPath: "/api/quote-pdf?page=plb" },
      { text: "", card: "/api/card/table?a" },
    ]);
    expect(a.priced).toBe(true);
  });

  it("is one bubble with neither card nor file when there is none, and leaves an empty guide out", () => {
    const a = pricedAnswer({ text: "ขอ อายุ", priced: false, guide: [] }, "facebook");
    expect(a.messages).toEqual([{ text: "ขอ อายุ" }]);
    expect("guide" in a).toBe(false);
  });

  it("carries the guide when there is one", () => {
    const guide = [{ label: "ทุน 1 ล้าน", ask: "PLB ทุน 1 ล้าน" }];
    expect(pricedAnswer({ text: "x", priced: false, guide }, "web").guide).toEqual(guide);
  });
});
