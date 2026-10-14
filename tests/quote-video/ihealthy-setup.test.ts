import { describe, expect, it } from "vitest";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { cleanSetup, setupQuery } from "@/lib/quote-video/ihealthy-setup";
import { quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { resolveBudget } from "@/lib/quote-video/budget";

const TODAY = new Date("2026-10-14T12:00:00+07:00");
const base = { product: "IHEALTHY" as const, age: 27, sex: "F" as const, plan: "SILVER", compare: [] };
const priceVoice = (setup?: string) => {
  const f = quoteVideoFacts({ ...base, ...(setup ? { setup } : {}) }, TODAY)!;
  return { f, voice: quoteVideoScript(f).find((s) => s.key === "price")!.voice };
};

describe("iHealthy clip priced on the page's arrangement (owner, 2026-10-14)", () => {
  it("prices the page's defaults when the clip did not come from the page", () => {
    const { f, voice } = priceVoice();
    expect(f.spokenPrice.amount).toBe("2,966");
    expect(f.includes).toEqual(["ประกันชีวิต", "ค่าชดเชยรายวัน"]);
    expect(voice).toContain("รวมประกันชีวิตกับค่าชดเชยรายวันไว้แล้ว");
  });

  it("follows the page when the daily cash was taken off: the page's figures, and the voice stops naming it", () => {
    const { f, voice } = priceVoice("r=");
    const page = iHealthyCard(new URLSearchParams({ age: "27", sex: "F", plan: "SILVER", r: "" }), TODAY);
    const at = page.columns.findIndex((c) => c.selected);
    expect(f.prices.map((p) => p.amount)).toEqual(page.premiumRows.map((r) => r.cells[at].text));
    expect(f.spokenPrice.amount).toBe("2,849");
    expect(f.includes).toEqual(["ประกันชีวิต"]);
    expect(voice).toContain("รวมประกันชีวิตไว้แล้ว");
    expect(voice).not.toContain("ค่าชดเชยรายวัน");
    expect(quoteVideoScript(f).find((s) => s.key === "cover")!.voice).not.toContain("นอนโรงพยาบาลรับเพิ่ม");
  });

  it("keeps only the arrangement's keys; the form's age, sex and plan win", () => {
    expect(cleanSetup("age=80&sex=M&plan=DIAMOND&base=WLF99HX&sa=50000&area=&cover=&mode=annual&r=MEB%3A1000&evil=1"))
      .toBe("base=WLF99HX&sa=50000&area=&cover=&r=MEB%3A1000");
    expect(cleanSetup("")).toBeUndefined();
    expect(cleanSetup("x".repeat(900))).toBeUndefined();
    expect(cleanSetup(42)).toBeUndefined();
    const q = setupQuery({ age: 27, sex: "F", plan: "SILVER", setup: "age=80&r=" });
    expect(q.get("age")).toBe("27");
    expect(q.has("r")).toBe(true);
  });

  it("travels from the page's button into the Studio form", () => {
    const href = videoStartHref({ product: "IHEALTHY", sex: "F", age: 27, plan: "SILVER", setup: "age=27&sex=F&base=WLF99HX&sa=50000&plan=SILVER&area=&cover=&mode=annual&r=" });
    const start = videoStartFrom(Object.fromEntries(new URL(href, "https://x.test").searchParams));
    expect(start).toMatchObject({ product: "IHEALTHY", plan: "SILVER", setup: "base=WLF99HX&sa=50000&area=&cover=&r=" });
    // another product never picks one up
    expect(videoStartFrom({ product: "LIFEPROTECT", ihu: "r=" })?.setup).toBeUndefined();
  });

  it("a budget picks the plan on the page's arrangement too", () => {
    // 2,900 a month buys Silver without the daily cash (2,849) but not with it (2,966)
    const withDaily = resolveBudget({ ...base }, { baht: 2_900, per: "month" }, TODAY);
    const without = resolveBudget({ ...base, setup: "r=" }, { baht: 2_900, per: "month" }, TODAY);
    expect(typeof withDaily !== "string" && withDaily.product === "IHEALTHY" && withDaily.plan).toBe("BRONZE");
    expect(typeof without !== "string" && without.product === "IHEALTHY" && without.plan).toBe("SILVER");
  });
});
