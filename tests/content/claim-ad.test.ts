import { describe, expect, it } from "vitest";
import { adKind, kindChip } from "@/lib/ads/ad-kind";
import { AD_MONEY_EN, PRIMARY_MAX } from "@/lib/content/ads";
import {
  CLAIM_CAUTION_EN, CLAIM_DESCRIPTION, CLAIM_DESCRIPTION_EN, CLAIM_HEADLINE, CLAIM_HEADLINE_EN,
  assembleClaimAd, claimAdMessages, claimAdPoster, parseClaimAd, type ClaimAd,
} from "@/lib/content/claim-ad";
import type { ClaimFacts } from "@/lib/content/claim";
import { DISCLAIMER } from "@/lib/content/output";

/** the รีวิวเคลม ad's pure copy (spec 2026-10-06 claim review) */

const facts: ClaimFacts = {
  kind: "ipd", illness: "ไข้เลือดออก", nights: "3", billTotal: "48,000", paid: "45,000", selfPaid: "3,000",
  daysToApprove: "5", who: "ผู้หญิง วัย 40+", note: "",
};
const reply = (o: Record<string, unknown>) => JSON.stringify({ headline: "นอน รพ. 3 คืน", story: ["บรรทัดหนึ่ง", "บรรทัดสอง"], cta: "ทักแชทได้เลย", description: "ทักแชทถามเรื่องเคลม", imagePrompt: "x", poster: {}, ...o });
const ad = (o: Partial<ClaimAd> = {}): ClaimAd => ({ headline: "h", story: ["เรื่องหนึ่ง", "เรื่องสอง"], cta: "ทักแชทได้เลย", description: "d", imagePrompt: "", poster: {}, ...o });
const contact = "👉 คุณเอ\n📲 Line: @abc123";
const table = "ตารางเบี้ย\n1,000,000 บาท/ปี";

describe("the claim kind", () => {
  it("is a kind with its chip", () => {
    expect(adKind("claim")).toBe("claim");
    expect(kindChip({ kind: "claim" })).toBe("รีวิวเคลม");
  });
});

describe("parseClaimAd", () => {
  it("falls back on a headline or description over 27, keeps one of 27", () => {
    const over = parseClaimAd(reply({ headline: "ก".repeat(28), description: "ข".repeat(28) }), "th")!;
    expect(over.headline).toBe(CLAIM_HEADLINE);
    expect(over.description).toBe(CLAIM_DESCRIPTION);
    expect(parseClaimAd(reply({ headline: "ก".repeat(28), description: "d".repeat(28) }), "en")!.headline).toBe(CLAIM_HEADLINE_EN);
    expect(parseClaimAd(reply({ description: "d".repeat(28) }), "en")!.description).toBe(CLAIM_DESCRIPTION_EN);
    const ok = parseClaimAd(reply({ headline: "ก".repeat(27), description: "ข".repeat(27) }), "th")!;
    expect(ok.headline).toBe("ก".repeat(27));
    expect(ok.description).toBe("ข".repeat(27));
  });

  it("returns null without a headline or a story", () => {
    expect(parseClaimAd(reply({ story: [] }), "th")).toBeNull();
    expect(parseClaimAd(reply({ headline: "" }), "th")).toBeNull();
    expect(parseClaimAd("not json", "th")).toBeNull();
  });

  it("says money number-first in English", () => {
    const en = parseClaimAd(reply({ story: ["Paid THB 25,000 in five days"], cta: "Pay THB 1,000" }), "en")!;
    expect(en.story[0]).toBe("Paid 25,000 THB in five days");
    expect(en.cta).toBe("Pay 1,000 THB");
    expect(parseClaimAd(reply({ story: ["THB 25,000"] }), "th")!.story[0]).toBe("THB 25,000");
  });
});

describe("assembleClaimAd", () => {
  it("puts the table after the cta and before the contact", () => {
    const out = assembleClaimAd(ad(), { table, contact }, "th");
    expect(out.indexOf("ทักแชทได้เลย")).toBeLessThan(out.indexOf(table));
    expect(out.indexOf(table)).toBeLessThan(out.indexOf(contact));
    expect(out.split("\n.\n")).toEqual(["เรื่องหนึ่ง\nเรื่องสอง", "ทักแชทได้เลย", table, contact, DISCLAIMER]);
  });

  it("has no table block without a table", () => {
    expect(assembleClaimAd(ad(), { table: null, contact }, "th")).not.toContain("บาท/ปี");
  });

  it("ends on the caution of its language", () => {
    expect(assembleClaimAd(ad(), { table: null, contact }, "th").endsWith(DISCLAIMER)).toBe(true);
    expect(assembleClaimAd(ad(), { table: null, contact }, "en").endsWith(CLAIM_CAUTION_EN)).toBe(true);
  });

  it("trims story lines from the last, keeping the table, contact and caution", () => {
    const long = ad({ story: Array.from({ length: 23 }, (_, i) => `${i}${"ก".repeat(98)}`) });
    const out = assembleClaimAd(long, { table, contact }, "th");
    expect([...out].length).toBeLessThanOrEqual(PRIMARY_MAX);
    expect(out).toContain(table);
    expect(out).toContain(contact);
    expect(out.endsWith(DISCLAIMER)).toBe(true);
    expect(out).toContain("0ก");
    expect(out).not.toContain("22ก");
  });
});

describe("claimAdPoster", () => {
  const sub = (p: ReturnType<typeof claimAdPoster>) => p.blocks.find((b) => b.kind === "sub");
  it("shows what the insurer paid when known", () => {
    expect(sub(claimAdPoster(ad(), facts, "th"))?.text).toBe("ประกันจ่ายให้ 45,000 บาท");
    const en = claimAdPoster(ad({ headline: "Three nights, paid" }), facts, "en");
    expect(sub(en)?.text).toBe("Insurer paid 45,000 THB");
    expect(en.blocks.find((b) => b.kind === "badge")?.text).toBe("Real claim review");
    expect(en.blocks.find((b) => b.kind === "headline")?.text).toBe("Three nights, paid");
  });

  it("has no sub block without an amount", () => {
    expect(sub(claimAdPoster(ad(), { ...facts, paid: "" }, "th"))).toBeUndefined();
    expect(sub(claimAdPoster(ad(), { ...facts, paid: "" }, "en"))).toBeUndefined();
  });
});

describe("claimAdMessages", () => {
  const system = (withTable: boolean, lang: "th" | "en") => claimAdMessages(facts, { say: "มุมหนึ่ง" }, "", withTable, lang)[0].content;
  it("tells the writer about the table only when there is one", () => {
    expect(system(true, "th")).toContain("ตารางเบี้ย");
    expect(system(false, "th")).not.toContain("ตารางเบี้ย");
    expect(system(true, "en")).toContain("premium table");
    expect(system(false, "en")).not.toContain("premium table");
  });

  it("writes English money number-first and says the facts are Thai", () => {
    expect(system(false, "en")).toContain(AD_MONEY_EN);
    expect(system(false, "en")).toContain("in Thai");
    expect(system(false, "th")).toContain('"story"');
  });

  it("carries the facts and the angle in the user message", () => {
    const user = claimAdMessages(facts, { say: "มุมหนึ่ง" }, "พ่อแม่", false, "th")[1].content;
    expect(user).toContain("ไข้เลือดออก");
    expect(user).toContain("มุมหนึ่ง");
    expect(user).toContain("พ่อแม่");
  });
});
