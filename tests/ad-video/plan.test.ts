import { describe, expect, it } from "vitest";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { lineProblem } from "@/lib/quote-video/brief";
import { adInputOk, allowedNote, bodiesFor, cleanAdPlan, ctasFor, fixedBody, fixedCta, fixedPhoto, fixedPlan, nextYear } from "@/lib/ad-video/plan";

const TODAY = new Date("2026-11-22T00:00:00+07:00");
const LP: VideoInput = { variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 };
const IS: VideoInput = { product: "ISHIELD", variant: "WLCI20", age: 30, sex: "F", sumAssured: 1_000_000 };
const IH: VideoInput = { product: "IHEALTHY", age: 30, sex: "F", plan: "GOLD", compare: [] };

const lp = quoteVideoFacts(LP, TODAY)!;
const is = quoteVideoFacts(IS, TODAY)!;
const ih = quoteVideoFacts(IH, TODAY)!;
const next = nextYear(LP, TODAY);

function raw(over: Record<string, unknown> = {}) {
  const p = fixedPlan(lp, { art: "mixed", mode: "ai", next });
  return { ...p, ...over };
}

describe("ad video plan", () => {
  it("offers the bodies each product can say", () => {
    expect(bodiesFor(lp)).toEqual(["price", "cover", "value", "versus"]);
    expect(bodiesFor(is)).toEqual(["price", "cover", "versus"]);
    expect(bodiesFor(ih)).toEqual(["price", "cover"]);
  });

  it("finds next year's higher price", () => {
    expect(next).toEqual({ said: "81", per: "วันละ" });
    expect(ctasFor(next)).toContain("nextyear");
    expect(ctasFor(undefined)).not.toContain("nextyear");
    expect(allowedNote(next)).toBe("อายุถัดไป วันละ 81 บาท");
    expect(allowedNote(undefined)).toBe("");
    expect(fixedCta("nextyear", next!)).toBe("ถ้ารอปีหน้า ยอดออมขึ้นเป็นวันละ 81 บาท ทักมาคุยวันนี้เลยนะคะ");
  });

  it("always has a fixed body and cta line", () => {
    for (const k of bodiesFor(lp)) expect(fixedBody(lp, k).length).toBeGreaterThan(0);
    expect(fixedBody(ih, "versus").length).toBeGreaterThan(0);
    expect(fixedCta("chat", undefined)).toBe("บอกแค่อายุ ทักมาขอใบเสนอของคุณได้เลยนะคะ");
  });

  it("fixed photo prompts have no digits and no Thai", () => {
    for (const p of ["LIFEPROTECT", "ISHIELD", "IHEALTHY"] as const)
      for (const s of ["hook", "close", "body"] as const) expect(fixedPhoto(p, s)).not.toMatch(/[ก-๙0-9]/);
  });

  it("builds a fixed plan", () => {
    const p = fixedPlan(lp, { art: "mixed", mode: "pick" });
    expect(p.body.map((b) => b.key)).toEqual(["price", "cover"]);
    expect(p.cta.key).toBe("chat");
    expect(p.written).toBe(false);
  });

  it("replaces a hook with a figure of its own", () => {
    const r = cleanAdPlan(raw({ hook: { kind: "shock", voice: "วันละ 59 บาท ได้ 2 ล้าน", headline: ["ถ้าพรุ่งนี้"] } }), lp, next, TODAY);
    expect(r.fixed).toContain("hook");
    expect(r.plan.hook.voice).toBe(fixedPlan(lp, { art: "mixed", mode: "ai", hook: "shock" }).hook.voice);
  });

  it("keeps a next-year cta that says the quote's figure and replaces one that does not", () => {
    const ok = "ถ้ารอปีหน้า ยอดออมขึ้นเป็นวันละ 81 บาท ทักมาเลยค่ะ";
    const a = cleanAdPlan(raw({ cta: { key: "nextyear", voice: ok } }), lp, next, TODAY);
    expect(a.plan.cta.voice).toBe(ok);
    const b = cleanAdPlan(raw({ cta: { key: "nextyear", voice: "ถ้ารอปีหน้า ยอดออมขึ้นเป็นวันละ 90 บาท ทักมาเลยค่ะ" } }), lp, next, TODAY);
    expect(b.plan.cta.voice).toBe(fixedCta("nextyear", next!));
    expect(b.fixed).toContain("cta");
  });

  it("replaces a cta voice that says เบี้ย", () => {
    const r = cleanAdPlan(raw({ cta: { key: "chat", voice: "ทักมาดูเบี้ยของคุณได้เลยค่ะ" } }), lp, next, TODAY);
    expect(r.fixed).toContain("cta");
    expect(r.plan.cta.voice).toBe(fixedCta("chat", next));
  });

  it("never fixes a line with one the checker refuses", () => {
    for (const k of ctasFor(next)) expect(lineProblem(fixedCta(k, next), lp, 150, allowedNote(next))).toBeNull();
  });

  it("de-duplicates and cuts bodies to three", () => {
    const mk = (key: string) => ({ key, voice: fixedBody(lp, "price") });
    const r = cleanAdPlan(raw({ body: ["value", "value", "versus", "price", "cover"].map(mk) }), lp, next, TODAY);
    expect(r.plan.body.map((b) => b.key)).toEqual(["value", "versus", "price"]);
  });

  it("replaces photo prompts with Thai letters or digits", () => {
    const a = cleanAdPlan(raw({ photos: { hook: "พ่อ อุ้มลูก" } }), lp, next, TODAY);
    expect(a.plan.photos.hook).toBe(fixedPhoto("LIFEPROTECT", "hook"));
    expect(a.fixed).toContain("photos");
    const b = cleanAdPlan(raw({ photos: { close: "father, 2 kids" } }), lp, next, TODAY);
    expect(b.plan.photos.close).toBe(fixedPhoto("LIFEPROTECT", "close"));
  });

  it("refuses what the ad cannot carry", () => {
    expect(adInputOk(LP)).toBe(true);
    expect(adInputOk({ ...LP, riders: [] as never })).toBe(false);
    expect(adInputOk({ ...LP, budget: { baht: 1000, per: "month" } })).toBe(false);
    expect(adInputOk(IH)).toBe(true);
    expect(adInputOk({ ...IH, compare: ["SILVER"] } as VideoInput)).toBe(false);
    expect(adInputOk({ product: "LEGACY", age: 40, sex: "M", tier: 3 })).toBe(false);
  });
});
