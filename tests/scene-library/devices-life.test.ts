import { describe, expect, it } from "vitest";
import { briefRates, briefTax, checkDevice, checkScript, deviceAllowed } from "@/lib/prompt-story/check";
import { DEVICES, deviceInfo } from "@/lib/scene-library/devices";
import { TAX_CAPS, TAX_FOOT, TAX_RATES, TAX_YEAR } from "@/lib/scene-library/tax-th";
import {
  HEALTH_LAYOUTS, incomestopLost, isDevice, knowText, LIFE_LAYOUTS, LIFE_WORDS, lifeneedTotals, moneysplitRemainder, showText,
  taxbackLadder, taxbackRefund, type KnowEpisode, type KnowShow,
} from "@/lib/quote-video/story-knowledge";
import { deviceTail, kspec } from "@/lib/quote-video/story-knowledge-motion";
import type { PromptScene } from "@/lib/prompt-story/types";

type Show<L extends KnowShow["layout"]> = Extract<KnowShow, { layout: L }>;
const T: [string, string] = ["หัวบน", "หัวล่าง"];

/** one of each, every figure given */
const FULL: KnowShow[] = [
  { layout: "lifeneed", title: ["ทุนชีวิต", "ที่ควรมี"], debts: 2_000_000, expenses: 300_000, years: 10, education: 1_000_000, have: 1_000_000 },
  { layout: "beneficiary", title: ["ผู้รับ", "ประโยชน์"], rows: [{ name: "ลูกสาว", share: 50 }, { name: "ลูกชาย", share: 50 }] },
  { layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"], sum: 1_000_000, note: "ใช้ได้ตามใจ" },
  { layout: "incomestop", title: ["รายได้", "หยุด"], monthly: 40_000, months: 6 },
  { layout: "taxback", title: ["ภาษี", "ได้คืน"], premium: 50_000, bracket: 20 },
  { layout: "taxcap", title: ["เพดาน", "ลดหย่อน"] },
  { layout: "moneysplit", title: ["แบ่งเงิน", "ให้คนในบ้าน"], total: 3_000_000, parts: [{ label: "ภรรยา", amount: 1_500_000 }, { label: "ลูก", amount: 1_000_000 }] },
  { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["พ่อแม่", "เรา", "ลูก"], note: "เงินก้อนส่งต่อ" },
];
/** every input FULL draws, as a brief would state them: the tax bracket (20) too, an input as the others */
const ALL = new Set([2_000_000, 300_000, 10, 1_000_000, 50, 40_000, 6, 50_000, 20, 3_000_000, 1_500_000]);

describe("life, CI, tax and legacy devices: registry", () => {
  it("lists the eight layouts after the health ones", () => {
    expect([...LIFE_LAYOUTS]).toEqual(["lifeneed", "beneficiary", "cilump", "incomestop", "taxback", "taxcap", "moneysplit", "threegen"]);
    expect(DEVICES.map((d) => d.key)).toEqual([...HEALTH_LAYOUTS, ...LIFE_LAYOUTS]);
  });
  it("gives each its family, product, name and fields", () => {
    const product = { lifeneed: "life", beneficiary: "life", moneysplit: "life", threegen: "life", cilump: "health", incomestop: "health", taxback: "saving", taxcap: "saving" };
    for (const key of LIFE_LAYOUTS) {
      const d = deviceInfo(key)!;
      expect(d.family, key).toBe("ชีวิต ภาษี มรดก");
      expect(d.product, key).toBe(product[key]);
      expect(d.clips, key).toEqual(["story", "prompt"]);
      expect(d.when.length, key).toBeGreaterThan(10);
    }
    expect(deviceInfo("lifeneed")?.name).toBe("ทุนชีวิตที่ควรมี");
    expect(deviceInfo("beneficiary")?.name).toBe("ผู้รับประโยชน์");
    expect(deviceInfo("cilump")?.name).toBe("เงินก้อนตอนวินิจฉัย");
    expect(deviceInfo("incomestop")?.name).toBe("รายได้หยุดระหว่างรักษา");
    expect(deviceInfo("taxback")?.name).toBe("ภาษีที่ได้คืนตามฐาน");
    expect(deviceInfo("taxcap")?.name).toBe("เพดานลดหย่อนรวม");
    expect(deviceInfo("moneysplit")?.name).toBe("แบ่งเงินให้คนในบ้าน");
    expect(deviceInfo("threegen")?.name).toBe("ส่งต่อสามรุ่น");
    expect(deviceInfo("lifeneed")?.numberFields).toEqual(["debts", "expenses", "years", "education", "have"]);
    expect(deviceInfo("taxback")?.numberFields).toEqual(["premium", "bracket"]);
    expect(deviceInfo("taxcap")?.numberFields).toEqual([]);
    expect(deviceInfo("threegen")?.numberFields).toEqual([]);
    expect(deviceInfo("threegen")?.wordFields).toEqual(["title", "rows", "note"]);
    // the health devices keep theirs
    expect(deviceInfo("room")?.family).toBe("สุขภาพ");
    expect(deviceInfo("room")?.product).toBe("health");
  });
  it("is a device, as the health ones are; a knowledge scene is not", () => {
    for (const s of FULL) expect(isDevice(s), s.layout).toBe(true);
    expect(isDevice({ layout: "room", title: T, plan: 1, planName: "" })).toBe(true);
    expect(isDevice({ layout: "ask", title: T })).toBe(false);
  });
});

describe("kspec and the tail", () => {
  it("times every device, the title first, words-only forms too", () => {
    const bare: KnowShow[] = [
      { layout: "lifeneed", title: T },
      { layout: "beneficiary", title: T, rows: [{ name: "ลูก" }] },
      { layout: "cilump", title: T },
      { layout: "incomestop", title: T },
      { layout: "taxback", title: T },
      { layout: "moneysplit", title: T, parts: [{ label: "ก" }, { label: "ข" }] },
    ];
    for (const s of [...FULL, ...bare]) {
      const spec = kspec(s);
      expect(Object.keys(spec).length, s.layout).toBeGreaterThan(1);
      expect(spec.title?.at, s.layout).toBe(0.2);
      for (const x of Object.values(spec)) expect(x.at, s.layout).toBeGreaterThanOrEqual(0);
      // a device stands whole before the next scene, however short its voice
      expect(deviceTail(s, 0), s.layout).toBeGreaterThan(0);
    }
    // a counted figure only where there is a figure
    expect(kspec(FULL[0]).count).toBeDefined();
    expect(kspec(bare[0]).count).toBeUndefined();
    expect(Object.keys(kspec(FULL[5])).filter((k) => k.startsWith("row"))).toHaveLength(TAX_CAPS.length);
    expect(Object.keys(kspec(FULL[4])).filter((k) => k.startsWith("rung"))).toHaveLength(TAX_RATES.length);
  });
});

describe("words for the hand fonts", () => {
  it("knowText and showText carry every word a device draws", () => {
    const e: KnowEpisode = { scenes: FULL.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "ติดต่อ", contactVoice: "" };
    const all = knowText(e);
    const each = FULL.map(showText).join("");
    const words = [
      ...FULL.flatMap((s) => ("title" in s ? s.title : [])), "ลูกสาว", "ลูกชาย", "ใช้ได้ตามใจ", "ภรรยา", "พ่อแม่", "เงินก้อนส่งต่อ",
      "ระบุชื่อและสัดส่วนในใบคำขอ", "จ่ายเป็นเงินก้อน", "เมื่อแพทย์วินิจฉัยตามเงื่อนไขกรมธรรม์", TAX_FOOT, TAX_YEAR,
      "ทุนชีวิตควรครอบคลุมหนี้และค่าใช้จ่ายของครอบครัว", "ควรมีทุนรวม", "มีอยู่แล้ว", "ขาดอีก", "หยุดรักษา", "รายได้หาย", "ฐานภาษี", "ได้คืน",
      ...TAX_CAPS.flatMap((r) => [r.label, ...(r.note ? [r.note] : [])]),
      "0123456789", "บาท", "%", "×", "=",
    ];
    for (const w of words) {
      expect(all, w).toContain(w);
      expect(each, w).toContain(w);
    }
    for (const w of Object.values(LIFE_WORDS)) expect(all, w).toContain(w);
  });
  it("a knowledge episode without a device does not take the device words", () => {
    const e: KnowEpisode = { scenes: [{ key: "knowAsk", show: { layout: "ask", title: T }, voice: "" }], cta: "ติดต่อ", contactVoice: "" };
    expect(knowText(e)).not.toContain(TAX_FOOT);
  });
});

describe("derived figures: computed from the inputs, never read", () => {
  it("lifeneed: blocks, the sum, what is had, the gap", () => {
    expect(lifeneedTotals(FULL[0] as Show<"lifeneed">)).toEqual({
      blocks: [{ key: "debts", amount: 2_000_000 }, { key: "living", amount: 3_000_000 }, { key: "education", amount: 1_000_000 }],
      need: 6_000_000, have: 1_000_000, gap: 5_000_000,
    });
    // expenses without years make no block; a partial sum (fewer than the three blocks) is not the need: no gap
    expect(lifeneedTotals({ layout: "lifeneed", title: T, debts: 500_000, expenses: 300_000, have: 1_000_000 }))
      .toEqual({ blocks: [{ key: "debts", amount: 500_000 }], need: 500_000, have: 1_000_000 });
    expect(lifeneedTotals({ layout: "lifeneed", title: T, debts: 5_000_000, have: 1_000_000 }).gap).toBeUndefined();
    // all three blocks and have above the need: a gap of nought
    expect(lifeneedTotals({ ...(FULL[0] as Show<"lifeneed">), have: 9_000_000 }).gap).toBe(0);
    expect(lifeneedTotals({ layout: "lifeneed", title: T })).toEqual({ blocks: [] });
    // a forged total on the show is not read
    expect(lifeneedTotals({ ...(FULL[0] as Show<"lifeneed">), need: 1, gap: 2 } as Show<"lifeneed">).need).toBe(6_000_000);
  });
  it("incomestop: monthly × months, only with both", () => {
    expect(incomestopLost(FULL[3] as Show<"incomestop">)).toBe(240_000);
    expect(incomestopLost({ layout: "incomestop", title: T, monthly: 40_000 })).toBeUndefined();
    expect(incomestopLost({ ...(FULL[3] as Show<"incomestop">), lost: 5 } as Show<"incomestop">)).toBe(240_000);
  });
  it("taxback: each rate's refund on the capped premium, the agent's rate marked", () => {
    const ladder = taxbackLadder(FULL[4] as Show<"taxback">);
    expect(ladder.map((r) => r.rate)).toEqual(TAX_RATES);
    expect(ladder.map((r) => r.refund)).toEqual([2_500, 5_000, 7_500, 10_000, 12_500, 15_000, 17_500]);
    expect(ladder.filter((r) => r.on).map((r) => r.rate)).toEqual([20]);
    expect(taxbackRefund(FULL[4] as Show<"taxback">)).toBe(10_000);
    expect(taxbackRefund({ layout: "taxback", title: T, premium: 250_000, bracket: 35 })).toBe(35_000);
    expect(taxbackRefund({ layout: "taxback", title: T, premium: 50_000 })).toBeUndefined();
    expect(taxbackLadder({ layout: "taxback", title: T }).every((r) => r.refund === undefined && !r.on)).toBe(true);
  });
  it("moneysplit: what is left of the total, if any", () => {
    expect(moneysplitRemainder(FULL[6] as Show<"moneysplit">)).toBe(500_000);
    expect(moneysplitRemainder({ layout: "moneysplit", title: T, total: 100, parts: [{ label: "ก", amount: 60 }, { label: "ข", amount: 40 }] })).toBeUndefined();
    expect(moneysplitRemainder({ layout: "moneysplit", title: T, total: 100, parts: [{ label: "ก", amount: 60 }, { label: "ข" }] })).toBeUndefined();
  });
});

describe("checkDevice: number sourcing for the new devices", () => {
  it("passes each device whose figures the brief or the plan gave", () => {
    for (const d of FULL) expect(checkDevice(d, ALL), d.layout).toEqual(d);
  });
  it("drops the device when a figure is not in the brief or the plan (Review Focus 1)", () => {
    const forged: [KnowShow, string][] = [
      [{ ...(FULL[0] as Show<"lifeneed">), debts: 2_500_000 }, "debts"],
      [{ ...(FULL[0] as Show<"lifeneed">), have: 7 }, "have"],
      [{ layout: "beneficiary", title: T, rows: [{ name: "ลูก", share: 100 }] }, "rows"],
      [{ ...(FULL[2] as Show<"cilump">), sum: 4_000_000 }, "sum"],
      [{ ...(FULL[3] as Show<"incomestop">), months: 12 }, "months"],
      [{ ...(FULL[4] as Show<"taxback">), premium: 80_000 }, "premium"],
      [{ ...(FULL[6] as Show<"moneysplit">), total: 9_000_000 }, "total"],
      [{ ...(FULL[6] as Show<"moneysplit">), parts: [{ label: "ภรรยา", amount: 1_500_000 }, { label: "ลูก", amount: 999 }] }, "parts"],
    ];
    for (const [d, field] of forged) {
      const got = checkDevice(d, ALL);
      expect(typeof got, `${d.layout} ${field}`).toBe("string");
      expect(got as string, d.layout).toContain(field);
    }
  });
  it("takes a figure from the plan: CI sum and the split total from the sum assured", () => {
    const allowed = deviceAllowed("คุยเรื่องโรคร้าย ลูกค้าฐานภาษี 10%", { age: 35, sumAssured: 1_000_000, annual: 20_000, monthly: 1_800 });
    expect(checkDevice({ layout: "cilump", title: T, sum: 1_000_000 }, allowed)).toEqual({ layout: "cilump", title: T, sum: 1_000_000 });
    expect(checkDevice({ layout: "moneysplit", title: T, total: 1_000_000, parts: [{ label: "ก" }, { label: "ข" }] }, allowed)).toMatchObject({ total: 1_000_000 });
    expect(checkDevice({ layout: "taxback", title: T, premium: 20_000, bracket: 10 }, allowed)).toMatchObject({ premium: 20_000, bracket: 10 });
  });
  it("beneficiary: shares all or none, totalling 100, else drawn without them (Review Focus 2)", () => {
    const allowed = new Set([50, 30, 20, 60, 40]);
    const ok = { layout: "beneficiary", title: T, rows: [{ name: "ก", share: 60 }, { name: "ข", share: 40 }] };
    expect(checkDevice(ok, allowed)).toEqual(ok);
    const names = (rows: string[]) => ({ layout: "beneficiary", title: T, rows: rows.map((name) => ({ name })) });
    expect(checkDevice({ ...ok, rows: [{ name: "ก", share: 50 }, { name: "ข", share: 30 }] }, allowed)).toEqual(names(["ก", "ข"]));
    expect(checkDevice({ ...ok, rows: [{ name: "ก", share: 60 }, { name: "ข" }] }, allowed)).toEqual(names(["ก", "ข"]));
    expect(checkDevice({ ...ok, rows: [{ name: "ก", share: 60 }, { name: "ข", share: 40 }, { name: "ค", share: 20 }] }, allowed)).toEqual(names(["ก", "ข", "ค"]));
    expect(checkDevice(names(["ก", "ข", "ค", "ง"]), new Set())).toEqual(names(["ก", "ข", "ค", "ง"]));
    expect(typeof checkDevice(names(["ก", "ข", "ค", "ง", "จ"]), new Set())).toBe("string");
    expect(typeof checkDevice(names([]), new Set())).toBe("string");
    expect(typeof checkDevice(names([""]), new Set())).toBe("string");
  });
  it("moneysplit: amounts all or none and within the total, else drawn without them (Review Focus 2)", () => {
    const allowed = new Set([1_000_000, 600_000, 500_000, 400_000]);
    const ok = { layout: "moneysplit", title: T, total: 1_000_000, parts: [{ label: "ก", amount: 600_000 }, { label: "ข", amount: 400_000 }] };
    expect(checkDevice(ok, allowed)).toEqual(ok);
    const bare = (total?: number) => ({ layout: "moneysplit", title: T, ...(total ? { total } : {}), parts: [{ label: "ก" }, { label: "ข" }] });
    expect(checkDevice({ ...ok, parts: [{ label: "ก", amount: 600_000 }, { label: "ข", amount: 500_000 }] }, allowed)).toEqual(bare(1_000_000));
    expect(checkDevice({ ...ok, parts: [{ label: "ก", amount: 600_000 }, { label: "ข" }] }, allowed)).toEqual(bare(1_000_000));
    // with no total there is nothing to hold the amounts to
    const { total: _t, ...noTotal } = ok;
    void _t;
    expect(checkDevice(noTotal, allowed)).toEqual(bare());
    expect(typeof checkDevice({ ...bare(), parts: [{ label: "ก" }] }, allowed)).toBe("string");
    expect(typeof checkDevice({ ...bare(), parts: [{ label: "ก" }, { label: "ข" }, { label: "ค" }, { label: "ง" }] }, allowed)).toBe("string");
  });
  it("taxback: the bracket is a table rate the brief states, else drawn without it (Review Focus 2)", () => {
    // the client's bracket is an input: one of the table's rates, and stated in the brief (or the story form's chip)
    const allowed = new Set([50_000, 25, 12, 40]);
    expect(checkDevice({ layout: "taxback", title: T, premium: 50_000, bracket: 25 }, allowed)).toEqual({ layout: "taxback", title: T, premium: 50_000, bracket: 25 });
    for (const bracket of [12, 40, 0, 5.5, "25", null]) {
      expect(checkDevice({ layout: "taxback", title: T, premium: 50_000, bracket }, allowed), String(bracket)).toEqual({ layout: "taxback", title: T, premium: 50_000 });
    }
    // a table rate the AI picked, no brief saying so: left off, the ladder drawn with no rate marked
    expect(checkDevice({ layout: "taxback", title: T, premium: 50_000, bracket: 20 }, allowed)).toEqual({ layout: "taxback", title: T, premium: 50_000 });
    expect(checkDevice({ layout: "taxback", title: T }, new Set())).toEqual({ layout: "taxback", title: T });
  });
  it("taxback: a bracket the brief states as a percent, through deviceAllowed and checkScript", () => {
    const device = { layout: "taxback" as const, title: T, premium: 50_000, bracket: 20 };
    const scene: PromptScene = { voice: "ลดหย่อนภาษีได้", screen: "ภาษีที่ได้คืน", picture: "เอกสารภาษี", device };
    expect(checkDevice(device, deviceAllowed("ค่าประกัน 50,000 ต่อปี ฐานภาษี 20%"))).toEqual(device);
    expect(checkDevice(device, deviceAllowed("ค่าประกัน 50,000 ต่อปี"))).toEqual({ layout: "taxback", title: T, premium: 50_000 });
    // the story form's chip: its rate added to the allowed figures
    expect(checkDevice(device, new Set([...deviceAllowed("ค่าประกัน 50,000 ต่อปี"), 20]))).toEqual(device);
    expect(checkScript([scene], "ค่าประกัน 50,000 ต่อปี ฐานภาษี 20%")).toEqual([]);
  });
  it("briefRates: the table's rates the brief writes as a percent, nothing else", () => {
    expect([...briefRates("ฐานภาษี 30%")]).toEqual([30]);
    expect([...briefRates("ฐานภาษี 30 %")]).toEqual([30]);
    expect([...briefRates("ฐานภาษี 30 เปอร์เซ็นต์")]).toEqual([30]);
    expect([...briefRates("ส่งมา 30 ปี อายุ 25")]).toEqual([]);
    // not a table rate, or a percent inside a bigger number
    expect([...briefRates("ฐานภาษี 12% โต 1,030%")]).toEqual([]);
  });
  it("taxback in a คลิปตามโจทย์ (briefTax): bracket and premium from the brief's own words, never the plan's", () => {
    const brief = "จ่ายค่าประกันชีวิตปีละ 60,000 บาท อยากรู้ว่าลดหย่อนภาษีได้เท่าไร";
    const plan = { age: 30, sumAssured: 1_000_000, annual: 20_000, monthly: 1_800 };
    const device = { layout: "taxback" as const, title: T, premium: 60_000, bracket: 30 };
    // the verified case: the plan's age 30 is in deviceAllowed, so without briefTax the AI's 30 would stay
    expect(checkDevice(device, deviceAllowed(brief, plan))).toEqual(device);
    expect(checkDevice(device, deviceAllowed(brief, plan), briefTax(brief))).toEqual({ layout: "taxback", title: T, premium: 60_000 });
    expect(checkDevice(device, deviceAllowed(`${brief} ฐานภาษี 30%`, plan), briefTax(`${brief} ฐานภาษี 30%`))).toEqual(device);
    expect(checkDevice(device, deviceAllowed(`${brief} ฐานภาษี 30 เปอร์เซ็นต์`, plan), briefTax(`${brief} ฐานภาษี 30 เปอร์เซ็นต์`))).toEqual(device);
    expect(checkDevice(device, deviceAllowed(`${brief} 30 ปี`, plan), briefTax(`${brief} 30 ปี`))).toEqual({ layout: "taxback", title: T, premium: 60_000 });
    // the plan's annual premium is no life premium the brief gives: a reason, the device dropped
    expect(checkDevice({ ...device, premium: 20_000 }, deviceAllowed(brief, plan), briefTax(brief))).toBe("premium: ตัวเลข 20000 ไม่อยู่ในโจทย์");
    // checkScript (the server's and make's check) uses briefTax
    const scene: PromptScene = { voice: "ลดหย่อนภาษีได้", screen: "ภาษีที่ได้คืน", picture: "เอกสารภาษี", device: { ...device, premium: 20_000 } };
    expect(checkScript([scene], brief, { plan: "ISHIELD", variant: "x", sex: "F", ...plan } as never)[0]?.reasons.join(" ")).toContain("premium");
    // the story path (no briefTax) is unchanged: its chip rate and typed premium in allowed
    expect(checkDevice({ ...device, premium: 20_000 }, new Set([20_000, 30]))).toEqual({ ...device, premium: 20_000 });
  });
  it("taxback's words never carry a refund the AI worked out", () => {
    const allowed = deviceAllowed("ค่าประกัน 50,000 ต่อปี");
    for (const refund of ["15,000", "25,000", "7,500", "10,000"]) {
      const got = checkDevice({ layout: "taxback", title: ["จ่าย 50,000", `ได้คืน ${refund}`], premium: 50_000 }, allowed);
      expect(typeof got, refund).toBe("string");
      expect(got as string, refund).toContain("title");
    }
    const scene: PromptScene = { voice: "ลดหย่อนภาษีได้", screen: "ภาษีที่ได้คืน", picture: "เอกสารภาษี", device: { layout: "taxback", title: ["จ่าย 50,000", "ได้คืน 15,000"], premium: 50_000 } };
    expect(checkScript([scene], "ค่าประกัน 50,000 ต่อปี")[0]?.reasons.join(" ")).toContain("device");
    // the year alone may be named: no cap, threshold or rate, even one the brief gives
    expect(checkDevice({ layout: "taxback", title: [TAX_YEAR, ""] }, new Set())).toEqual({ layout: "taxback", title: [TAX_YEAR, ""] });
    for (const title of [["ลดหย่อนได้", "ไม่เกิน 100,000"], ["เงินได้สุทธิ", "เกิน 1,000,000"], ["ได้คืนสูงสุด 100,000", ""], ["ฐานภาษี 20", ""]]) {
      expect(checkDevice({ layout: "taxback", title }, new Set([100_000, 1_000_000, 20])), title.join(" ")).toContain("title");
    }
  });
  it("taxcap: no figure of its own; its words carry the year alone", () => {
    expect(checkDevice({ layout: "taxcap", title: ["เพดานลดหย่อน", TAX_YEAR], cap: 5 }, new Set())).toEqual({ layout: "taxcap", title: ["เพดานลดหย่อน", TAX_YEAR] });
    for (const title of [["ลดหย่อนได้", "สูงสุด 100,000"], ["ได้คืน 15,000", ""], ["สุขภาพ 25,000", ""]]) {
      expect(checkDevice({ layout: "taxcap", title }, new Set([100_000, 15_000, 25_000])), title.join(" ")).toContain("title");
    }
    expect(checkDevice({ layout: "taxback", title: [TAX_YEAR, ""] }, new Set())).toEqual({ layout: "taxback", title: [TAX_YEAR, ""] });
    // the table's figures are a tax device's only: elsewhere 100,000 must be in the brief
    expect(typeof checkDevice({ layout: "threegen", title: ["ส่งต่อ", "100,000"], rows: ["ก", "ข", "ค"] }, new Set())).toBe("string");
  });
  it("ignores derived figures and stray fields the writer adds", () => {
    expect(checkDevice({ ...FULL[0], need: 6_000_000, gap: 5_000_000, sum: 1 }, ALL)).toEqual(FULL[0]);
    expect(checkDevice({ ...FULL[3], lost: 240_000 }, ALL)).toEqual(FULL[3]);
    expect(checkDevice({ ...FULL[4], refund: 10_000, deductible: 50_000 }, ALL)).toEqual(FULL[4]);
    expect(checkDevice({ ...FULL[6], remainder: 500_000 }, ALL)).toEqual(FULL[6]);
  });
  it("threegen: three generations; cilump and threegen notes optional", () => {
    expect(checkDevice({ layout: "threegen", title: T, rows: ["ก", "ข", "ค"] }, new Set())).toEqual({ layout: "threegen", title: T, rows: ["ก", "ข", "ค"] });
    expect(typeof checkDevice({ layout: "threegen", title: T, rows: ["ก", "ข"] }, new Set())).toBe("string");
    expect(checkDevice({ layout: "cilump", title: T }, new Set())).toEqual({ layout: "cilump", title: T });
    // a null note is no note, not a broken device
    expect(checkDevice({ layout: "cilump", title: T, note: null }, new Set())).toEqual({ layout: "cilump", title: T });
    expect(checkDevice({ layout: "threegen", title: T, rows: ["ก", "ข", "ค"], note: null }, new Set())).toEqual({ layout: "threegen", title: T, rows: ["ก", "ข", "ค"] });
    expect(typeof checkDevice({ layout: "cilump", title: T, note: 5 }, new Set())).toBe("string");
  });
  it("holds every new word to the script's rules and length", () => {
    expect(checkDevice({ layout: "beneficiary", title: T, rows: [{ name: "ลูก การันตี" }] }, new Set())).toContain("rows");
    expect(checkDevice({ layout: "cilump", title: T, note: "จ่ายทันที" }, new Set())).toContain("note");
    expect(checkDevice({ layout: "moneysplit", title: T, parts: [{ label: "ก".repeat(41) }, { label: "ข" }] }, new Set())).toContain("parts");
    expect(checkDevice({ layout: "threegen", title: T, rows: ["ก", "ข", "ค"], note: "ดีกว่า AIA" }, new Set())).toContain("note");
  });
  it("a prompt scene with a forged figure fails its check, so the scene is painted", () => {
    const scene: PromptScene = { voice: "ครอบครัวต้องมีทุนเท่าไร", screen: "ทุนชีวิตที่ควรมี", picture: "ครอบครัวในบ้าน", device: { layout: "lifeneed", title: T, debts: 2_000_000 } };
    expect(checkScript([scene], "หนี้บ้าน 2,000,000 บาท")).toEqual([]);
    const bad = checkScript([{ ...scene, device: { layout: "lifeneed", title: T, debts: 3_000_000 } }], "หนี้บ้าน 2,000,000 บาท");
    expect(bad[0]?.reasons.join(" ")).toContain("debts");
  });
});
