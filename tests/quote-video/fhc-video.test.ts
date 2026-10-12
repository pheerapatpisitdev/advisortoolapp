import { describe, expect, it } from "vitest";
import { cleanFhc, events, scores, toPlanInput, type Score } from "@/lib/fhc/health";
import { gapsOf } from "@/lib/fhc/gaps";
import { FIXED_PICK } from "@/lib/plan/order";
import { realPricer } from "@/lib/plan/pricer";
import { recommend } from "@/lib/plan/recommend";
import { fhcScript, fhcVideoFacts, isFhcInput, scoreValue, spokenList, type FhcVideoFacts } from "@/lib/quote-video/fhc";
import { fhcWindows } from "@/lib/quote-video/fhc-motion";
import { videoPrice } from "@/lib/quote-video/make";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import { fhcVideoHref, videoStartFrom } from "@/lib/quote-video/link";
import { MOTION_FPS } from "@/lib/quote-video/motion";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { planScenes } from "@/lib/quote-video/timeline";

/** the mockup's สมชาย: 35, short of life cover, no health or CI cover, a small pension */
function somchai(): FhcVideoFacts {
  const f = cleanFhc({
    age: 35, sex: "M", income: 45_000, expense: 32_000, cash: 50_000, fixed: 30_000, lifeCover: 500_000, ciCover: 0,
    healthNow: "none", hospital: "private", lifeWant: "save", retireAge: 60, retireMonthly: 25_000, pensionHave: 3_000,
    budget: 7_000, carLoan: 300_000, people: [{ relation: "child", age: 5 }, { relation: "spouse", age: 33 }],
  });
  if (typeof f === "string") throw new Error(f);
  const p = toPlanInput(f);
  const plan = recommend(p, realPricer(p.age, p.sex), FIXED_PICK);
  const sc = scores(f);
  return fhcVideoFacts({ age: f.age, sex: f.sex, createdAt: "2026-10-12T03:00:00Z", gaps: gapsOf(plan), snapshot: { scores: sc, events: events(f, sc, plan), plan } });
}

describe("วิดีโอสรุป FHC facts", () => {
  const f = somchai();

  it("takes the check's own figures: the date, six scores, four covers, five events, the plan in its order", () => {
    expect(f.checkedOn).toBe("12 ตุลาคม 2569");
    expect(f.scores.map((s) => [s.key, s.level, s.value])).toEqual([
      ["emergency", "red", "2.5 เดือน"], ["saving", "green", "29%"], ["debt", "green", "0.6 เท่าของรายได้"],
      ["life", "red", "8%"], ["healthCi", "red", "ขาดทั้งสองด้าน"], ["retire", "red", "12%"],
    ]);
    expect(f.gaps.map((g) => [g.key, g.state, g.have, g.should])).toEqual([
      ["life", "short", 580_000, 7_698_000], ["health", "missing", 0, 5_500], ["ci", "missing", 0, 1_620_000], ["retire", "short", 3_000, 25_000],
    ]);
    expect(f.events.map((e) => [e.name, e.level])).toEqual([
      ["เจ็บป่วย", "red"], ["อุบัติเหตุ", "none"], ["ทุพพลภาพถาวร", "none"], ["จากไปไม่ทันตั้งตัว", "red"], ["ตกงาน", "red"],
    ]);
    expect(f.plan).toEqual([
      { key: "life", label: "ชีวิต", product: "Life Protect x 2 ชำระ 19 ปี", detail: "ทุน 2,500,000 บาท", monthly: 5_979, per: "ออมเดือนละ" },
      { key: "ci", label: "โรคร้ายแรง", product: "CI 123", detail: "ทุน 2,000,000 บาท", monthly: 932, per: "ปีแรก เดือนละ" },
    ]);
  });

  it("never carries the customer's income, spending or debts (owner, 2026-10-12, choice ก)", () => {
    const all = JSON.stringify({ f, s: fhcScript(f, "สมชาย") });
    // income, spending, the car loan, six months' spending, the savings — each as a whole figure
    for (const secret of ["45,?000", "32,?000", "300,?000", "192,?000", "80,?000"]) expect(all).not.toMatch(new RegExp(`(?<![\\d,])${secret}(?![\\d,])`));
    expect(f.events.find((e) => e.key === "jobLoss")?.line).toBe("ไม่มีประกัน · ควรมีเงินสำรอง 6 เดือน");
  });
});

describe("วิดีโอสรุป FHC script", () => {
  const f = somchai();

  it("speaks the six lines in the casual wording, the customer's name in the first and the last", () => {
    expect(fhcScript(f, "สมชาย")).toEqual([
      { key: "fhcOpen", voice: "สวัสดีค่ะ คุณสมชาย นี่คือสรุปผลตรวจสุขภาพการเงินของคุณนะคะ" },
      { key: "fhcScores", voice: "ข่าวดีก่อนนะคะ เงินเหลือต่อเดือน กับภาระหนี้ อยู่ในเกณฑ์ดีค่ะ ส่วนที่ต้องแก้ คือ เงินสำรองฉุกเฉิน ความคุ้มครองชีวิต ค่ารักษาและโรคร้ายแรง และเงินเกษียณค่ะ" },
      { key: "fhcGaps", voice: "ถ้าเป็นอะไรไป ครอบครัวควรมีเงินก้อน 7,698,000 บาท ตอนนี้มี 580,000 บาท ค่ารักษายังไม่มีเลย โรคร้ายแรงยังไม่มีเลย เงินเกษียณยังขาดอีกเดือนละ 22,000 บาทค่ะ" },
      { key: "fhcEvents", voice: "ชีวิตมีห้าเรื่องที่เราควบคุมไม่ได้ค่ะ เจ็บป่วย อุบัติเหตุ ทุพพลภาพ จากไปไม่ทันตั้งตัว และตกงาน ตอนนี้ค่ารักษา กับโรคร้ายแรงยังไม่มี และทุนชีวิตยังไม่พอ ส่วนเรื่องตกงาน ไม่มีประกันช่วยได้ ควรมีเงินสำรองไว้หกเดือนนะคะ" },
      { key: "fhcPlan", voice: "แนะนำให้เริ่มที่ประกันชีวิตก่อนค่ะ ทุน 2,500,000 บาท ออมเดือนละ 5,979 บาท ทั้งแผนรวมเดือนละ 6,911 บาทค่ะ" },
      { key: "fhcContact", voice: "คุณสมชายอยากคุยรายละเอียด ทักมาได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ" },
    ]);
  });

  it("greets without a name when the tick is off, and a man ends with ครับ", () => {
    const lines = fhcScript(f, "", "M").map((s) => s.voice);
    expect(lines[0]).toBe("สวัสดีครับ นี่คือสรุปผลตรวจสุขภาพการเงินของคุณนะครับ");
    expect(lines[5]).toBe("อยากคุยรายละเอียด ทักมาได้เลยนะครับ ยินดีช่วยดูแผนให้ครับ");
    for (const l of lines) expect(l).not.toMatch(/ค่ะ|คะ/);
  });

  it("says a customer with every cover met is done, and has nothing to start on", () => {
    const done: FhcVideoFacts = {
      ...f,
      scores: f.scores.map((s) => ({ ...s, level: "green" })),
      gaps: f.gaps.map((g) => ({ ...g, state: "ok", have: g.should })),
      events: f.events.map((e) => ({ ...e, level: e.level === "none" ? "none" : "green" })),
      plan: [],
    };
    const lines = fhcScript(done).map((s) => s.voice);
    expect(lines[1]).toBe("ข่าวดีก่อนนะคะ เงินสำรองฉุกเฉิน เงินเหลือต่อเดือน ภาระหนี้ ความคุ้มครองชีวิต ค่ารักษาและโรคร้ายแรง และเงินเกษียณ อยู่ในเกณฑ์ดีค่ะ");
    expect(lines[2]).toBe("ทั้งสี่ด้านมีพอแล้วค่ะ");
    expect(lines[3]).toBe("ชีวิตมีห้าเรื่องที่เราควบคุมไม่ได้ค่ะ เจ็บป่วย อุบัติเหตุ ทุพพลภาพ จากไปไม่ทันตั้งตัว และตกงาน ตอนนี้คุณเตรียมรับมือไว้ดีแล้วค่ะ");
    expect(lines[4]).toBe("ครบทุกด้านแล้ว ดูแลต่อแบบนี้ได้เลยค่ะ");
  });

  it("says the price of a plan with one offer once", () => {
    const one = fhcScript({ ...f, plan: f.plan.slice(0, 1) }).map((s) => s.voice);
    expect(one[4]).toBe("แนะนำให้เริ่มที่ประกันชีวิตก่อนค่ะ ทุน 2,500,000 บาท ออมเดือนละ 5,979 บาทค่ะ");
  });

  it("splits every line into subtitle words on single spaces", () => {
    for (const s of fhcScript(f, "สมชาย")) expect(s.voice).not.toMatch(/\s{2,}|^\s|\s$/);
  });
});

describe("scoreValue", () => {
  const s = (key: Score["key"], shown: string): Score => ({ key, label: "", level: "red", shown });
  it("keeps the ratio and drops any baht a score names", () => {
    expect(scoreValue(s("saving", "ใช้เกินรายได้ 5,000 บาท/เดือน"))).toBe("ใช้เกินรายได้");
    expect(scoreValue(s("emergency", "สำรองได้ 0.4 เดือน"))).toBe("0.4 เดือน");
    expect(scoreValue(s("debt", "ไม่มีหนี้"))).toBe("ไม่มีหนี้");
    expect(scoreValue(s("retire", "40% ของที่อยากมี"))).toBe("40%");
    expect(scoreValue(s("life", "—"))).toBe("");
  });
});

it("spokenList joins as Thai says it", () => {
  expect(spokenList(["ก"])).toBe("ก");
  expect(spokenList(["ก", "ข"])).toBe("ก กับข");
  expect(spokenList(["ก", "ข", "ค"])).toBe("ก ข และค");
});

describe("วิดีโอสรุป FHC clip", () => {
  const f = somchai();

  it("costs ฿3, and ฿2 more with an ElevenLabs voice (owner, 2026-10-12)", () => {
    const input = { product: "FHC" as const, customerId: "x", age: 35, sex: "M" as const, style: "motion" as const, length: "full" as const, fhc: f };
    expect(isFhcInput(input)).toBe(true);
    expect(videoPrice(input, DEFAULT_PRICES)).toBe(300);
    expect(videoPrice({ ...input, voice: "abc" }, DEFAULT_PRICES)).toBe(500);
  });

  it("plans six motion scenes, each with its frames and a transition", () => {
    const script = fhcScript(f, "สมชาย");
    const plans = planScenes(script.map((s) => ({ key: s.key, voice: s.voice, voiceSec: 8, windows: fhcWindows(s.key, f), fps: MOTION_FPS })));
    expect(plans.map((p) => p.key)).toEqual(["fhcOpen", "fhcScores", "fhcGaps", "fhcEvents", "fhcPlan", "fhcContact"]);
    for (const p of plans) {
      expect(p.frames.length).toBeGreaterThan(10);
      expect(TRANSITIONS[p.key]).toBeTruthy();
    }
  });

  it("opens the Studio form on a customer from the customer page", () => {
    const id = "6fc789ce-6405-461e-925c-76c0d407ece2";
    const href = fhcVideoHref(id);
    expect(href).toBe(`/studio/quote-video?product=FHC&fhc=${id}`);
    expect(videoStartFrom(Object.fromEntries(new URLSearchParams(href.split("?")[1])))).toEqual({ product: "FHC", fhc: id });
    expect(videoStartFrom({ product: "FHC", fhc: "not-an-id" })).toEqual({ product: "FHC" });
  });
});
