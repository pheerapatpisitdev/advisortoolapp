import { describe, expect, it } from "vitest";
import { costLine } from "@/app/studio/quote-video/QuoteVideoBoard";

/** the line under the วิดีโอนำเสนอ button says the clip's whole price (owner, 2026-10-18) */
describe("costLine with an ElevenLabs voice or AI cut-outs", () => {
  const wallet = (satang: number) => ({
    kind: "wallet" as const, balance: `฿${satang / 100}`, satang,
    prices: { videoClassic: { price: "฿5.00", enough: satang >= 500, satang: 500 } },
  });

  it("says the look's price alone when nothing is added", () => {
    expect(costLine(wallet(1000), "videoClassic", 500)?.text).toContain("หักจากกระเป๋า ฿5.00 ");
  });

  it("says the whole price, look plus voice, and checks the balance against it", () => {
    const l = costLine(wallet(1000), "videoClassic", 700)!;
    expect(l.text).toContain("฿7.00 (คลิป ฿5.00 + เสียง/ภาพ ฿2.00)");
    expect(l.blocked).toBe(false);
    const short = costLine(wallet(600), "videoClassic", 700)!;
    expect(short.blocked).toBe(true);
    expect(short.text).toContain("ยอดในกระเป๋าไม่พอ");
  });
});
