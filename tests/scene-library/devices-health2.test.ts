import { describe, expect, it } from "vitest";
import { allowedFor, checkDevice, checkScene, checkScript, deviceAllowed, OTHER_INSURERS } from "@/lib/prompt-story/check";
import { DEVICES, deviceInfo, isHealth2Device, isHealthDevice } from "@/lib/scene-library/devices";
import {
  GROUP_BANDS, HEALTH_LAYOUTS, HEALTH2_LAYOUTS, HEALTH2_LIMITS, HEALTH2_WORDS, isDevice, isHealth, isHealth2, isMeta, isSave, knowText,
  LIFE_LAYOUTS, META_LAYOUTS, SAVE_LAYOUTS, showText, type KnowEpisode, type KnowShow,
} from "@/lib/quote-video/story-knowledge";
import { deviceTail, kspec } from "@/lib/quote-video/story-knowledge-motion";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { HEALTH2_FIXED } from "@/lib/scene-library/health2-fixed";
import { hospitalCounts } from "@/lib/scene-library/health2-sources";
import type { PromptScene } from "@/lib/prompt-story/types";

const T: [string, string] = ["หัวบน", "หัวล่าง"];
const H = hospitalCounts();
const BKK = H.ranked[0];
const LONG = H.ranked.find((r) => [...r.province].length > HEALTH2_LIMITS.label)!;

/** one of each, every optional field given */
const FULL: KnowShow[] = [
  { layout: "ipdopd", title: ["สองประตู", "คนละวงเงิน"], note: "ตามตารางของแผน", room: 9_000, opd: 12_000, planName: "Gold" },
  { layout: "deductible", title: ["ส่วนแรก", "เราจ่ายเอง"], note: "ตามเงื่อนไขของแผน", deductible: 50_000, bill: 80_000 },
  { layout: "copay", title: ["ร่วมจ่าย", "ตามเงื่อนไข"], note: "แบ่งตามส่วน", percent: 20, bill: 100_000 },
  { layout: "renew98", title: ["ต่ออายุ", "ได้ถึง"], note: "ตามเงื่อนไข", to: 98, age: 35 },
  { layout: "parentshealth", title: ["ให้พ่อแม่", "ลดหย่อนภาษี"], note: "ตามเกณฑ์", cap: 15_000 },
  { layout: "groupcost", title: ["ประกันกลุ่ม", "ต่อหัว"], note: "ตามกลุ่มพนักงาน", perYear: 2_552 },
  { layout: "hospitals", title: ["โรงพยาบาล", "ในเครือ"], note: "ดูรายชื่อเต็มที่เว็บ", total: 537, rows: H.ranked.slice(0, 5).map((r) => ({ province: r.province, count: r.count })) },
  { layout: "paclaim", title: ["อุบัติเหตุ", "หนึ่งครั้ง"], note: "ตามแผน PA", medical: 150_000, weekly: 3_000, weeks: 52 },
];
/** the same eight with only what is required */
const BARE: KnowShow[] = [
  { layout: "ipdopd", title: ["สองประตู", ""], room: 3_000, opd: "none" },
  { layout: "deductible", title: ["ส่วนแรก", ""], deductible: 30_000 },
  { layout: "copay", title: ["ร่วมจ่าย", ""], percent: 20 },
  { layout: "renew98", title: ["ต่ออายุ", ""], to: 98 },
  { layout: "parentshealth", title: ["พ่อแม่", ""], cap: 15_000 },
  { layout: "groupcost", title: ["ต่อหัว", ""], perYear: 3_942 },
  { layout: "hospitals", title: ["ในเครือ", ""], total: 537, rows: [{ province: BKK.province, count: BKK.count }] },
  { layout: "paclaim", title: ["อุบัติเหตุ", ""], medical: 100_000 },
];
/** the brief's own numbers for the optional fields FULL uses */
const BRIEF = new Set([80_000, 100_000, 35, 18]);
const NONE = new Set<number>();
const ok = (d: unknown, allowed: Set<number> = BRIEF) => checkDevice(d, allowed);

/** every word field of every device, to put a digit or a long word in */
const wordFields = (v: (s: string) => string): { name: string; max: number; patch: (x: string) => unknown }[] => [
  ...FULL.flatMap((d) => [0, 1].map((line) => ({ name: `${d.layout}.title${line}`, max: HEALTH2_LIMITS.titleLine, patch: (x: string) => ({ ...d, title: line ? ["ก", x] : [x, "ก"] }) }))),
  ...FULL.map((d) => ({ name: `${d.layout}.note`, max: HEALTH2_LIMITS.note, patch: (x: string) => ({ ...d, note: x }) })),
  // room from the brief: the name is then the brief's to give (from the sheet it would be the matched plan's label alone)
  { name: "ipdopd.planName", max: HEALTH2_LIMITS.label, patch: (x: string) => ({ ...FULL[0], room: 80_000, opd: 100_000, planName: x }) },
].map((f) => ({ ...f, patch: (x: string) => f.patch(v(x)) }));

describe("health round-2 devices: registry", () => {
  it("lists the eight layouts after the earlier four rounds", () => {
    expect([...HEALTH2_LAYOUTS]).toEqual(["ipdopd", "deductible", "copay", "renew98", "parentshealth", "groupcost", "hospitals", "paclaim"]);
    expect(DEVICES.map((d) => d.key)).toEqual([...HEALTH_LAYOUTS, ...LIFE_LAYOUTS, ...META_LAYOUTS, ...SAVE_LAYOUTS, ...HEALTH2_LAYOUTS]);
    expect(DEVICES).toHaveLength(36);
  });
  it("gives each the existing family สุขภาพ, the product health, both clips, its fields and a when line", () => {
    for (const key of HEALTH2_LAYOUTS) {
      const d = deviceInfo(key)!;
      expect(d.family, key).toBe("สุขภาพ");
      expect(d.product, key).toBe("health");
      expect(d.clips, key).toEqual(["story", "prompt"]);
      expect(d.when.length, key).toBeGreaterThan(10);
      expect(d.wordFields.slice(0, 2), key).toEqual(["title", "note"]);
      expect(isHealth2Device(d), key).toBe(true);
      expect(isHealthDevice(d), key).toBe(false);
    }
    expect(DEVICES.filter(isHealthDevice).map((d) => d.key)).toEqual([...HEALTH_LAYOUTS]);
    expect(deviceInfo("ipdopd")?.name).toBe("สองประตู ผู้ป่วยใน ผู้ป่วยนอก");
    expect(deviceInfo("deductible")?.name).toBe("ส่วนรับผิดชอบแรก");
    expect(deviceInfo("copay")?.name).toBe("ร่วมจ่าย");
    expect(deviceInfo("renew98")?.name).toBe("ต่ออายุได้ถึง");
    expect(deviceInfo("parentshealth")?.name).toBe("ประกันสุขภาพให้พ่อแม่");
    expect(deviceInfo("groupcost")?.name).toBe("ต้นทุนต่อหัว ประกันกลุ่ม");
    expect(deviceInfo("hospitals")?.name).toBe("โรงพยาบาลในเครือ");
    expect(deviceInfo("paclaim")?.name).toBe("อุบัติเหตุหนึ่งครั้ง");
    expect(deviceInfo("ipdopd")?.numberFields).toEqual(["room", "opd"]);
    expect(deviceInfo("deductible")?.numberFields).toEqual(["deductible", "bill"]);
    expect(deviceInfo("copay")?.numberFields).toEqual(["percent", "bill"]);
    expect(deviceInfo("renew98")?.numberFields).toEqual(["to", "age"]);
    expect(deviceInfo("parentshealth")?.numberFields).toEqual(["cap"]);
    expect(deviceInfo("groupcost")?.numberFields).toEqual(["perYear"]);
    expect(deviceInfo("hospitals")?.numberFields).toEqual(["total", "rows"]);
    expect(deviceInfo("paclaim")?.numberFields).toEqual(["medical", "weekly", "weeks"]);
    expect(deviceInfo("room")?.family).toBe("สุขภาพ");
    expect(deviceInfo("savejar")?.family).toBe("ออมเงิน");
  });
  it("no when line says a word no script may (FORBIDDEN, FREE_FORBIDDEN, a return word, วันละ), and none holds a digit or a percent", () => {
    for (const key of HEALTH2_LAYOUTS) {
      const when = deviceInfo(key)!.when;
      for (const x of FORBIDDEN) expect(x.re.test(when), `${key}: ${x.why}`).toBe(false);
      for (const name of OTHER_INSURERS) expect(when, `${key} ${name}`).not.toContain(name);
      expect(/ไม่\s*(ต้อง\s*)?ตรวจ\s*สุขภาพ/.test(when), key).toBe(false);
      expect(/[\d๐-๙%]/.test(when), key).toBe(false);
      for (const w of ["ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "IRR", "รายวัน", "แน่นอน"]) expect(when, `${key} ${w}`).not.toContain(w);
    }
    // the PA weekly sum is never a daily one
    for (const w of ["ต่อวัน", "วันละ", "รายวัน"]) expect(deviceInfo("paclaim")!.when, w).not.toContain(w);
  });
  it("is a device and a round-5 health device; no other kind", () => {
    for (const s of [...FULL, ...BARE]) {
      expect(isDevice(s), s.layout).toBe(true);
      expect(isHealth2(s), s.layout).toBe(true);
      expect(isHealth(s), s.layout).toBe(false);
      expect(isSave(s), s.layout).toBe(false);
      expect(isMeta(s), s.layout).toBe(false);
    }
    expect(isHealth2({ layout: "room", title: T, plan: 1, planName: "" })).toBe(false);
    expect(isHealth2({ layout: "savejar", title: T })).toBe(false);
    expect(isHealth2({ layout: "ask", title: T })).toBe(false);
  });
});

describe("kspec and the tail", () => {
  it("times every device, the title first, the note last", () => {
    for (const s of [...FULL, ...BARE]) {
      const spec = kspec(s);
      expect(spec.title?.at, s.layout).toBe(0.2);
      expect(Object.keys(spec).length, s.layout).toBeGreaterThan(2);
      for (const x of Object.values(spec)) expect(x.at, s.layout).toBeGreaterThanOrEqual(0);
      expect(deviceTail(s, 0), s.layout).toBeGreaterThan(0);
    }
    for (const s of FULL) {
      const spec = kspec(s);
      const latest = Math.max(...Object.entries(spec).filter(([k]) => k !== "note").map(([, x]) => x.at));
      expect(spec.note.at, s.layout).toBeGreaterThan(latest);
    }
  });
  it("ipdopd opens its two doors in turn; hospitals draws one bar for each row", () => {
    const d = kspec(FULL[0]);
    expect(d.door0.at).toBeLessThan(d.door1.at);
    expect(Object.keys(kspec(FULL[6])).filter((k) => k.startsWith("bar"))).toHaveLength(5);
    expect(Object.keys(kspec(BARE[6])).filter((k) => k.startsWith("bar"))).toHaveLength(1);
  });
});

describe("words for the hand fonts", () => {
  it("knowText and showText carry the words and digits a device draws, a plan's name and the provinces", () => {
    const e: KnowEpisode = { scenes: [...FULL, ...BARE].map((show) => ({ key: "knowOne", show, voice: "" })), cta: "ติดต่อ", contactVoice: "" };
    const all = knowText(e);
    for (const w of ["สองประตู", "คนละวงเงิน", "ตามตารางของแผน", "Gold", "ดูรายชื่อเต็มที่เว็บ", "0123456789", "บาท", "%", BKK.province, "ปีภาษี"]) expect(all, w).toContain(w);
    for (const w of Object.values(HEALTH2_WORDS)) expect(all, w).toContain(w);
    expect(showText(FULL[0])).toContain("Gold");
    expect(showText(FULL[6])).toContain(BKK.province);
    expect(showText(FULL[2])).toContain("%");
  });
  it("no word a device draws by itself says IRR, a return word, a daily benefit or a promise to renew", () => {
    for (const s of [...FULL, ...BARE]) {
      const t = showText(s);
      for (const w of ["ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "IRR", "รายวัน", "เบี้ยเท่าเดิม", "ต่อได้แน่นอน"]) expect(t, `${s.layout} ${w}`).not.toContain(w);
    }
    // the spec's own sentences, verbatim
    for (const w of ["แผนนี้ไม่มีวงเงินผู้ป่วยนอกทั่วไป", "เมื่อเลือกแบบร่วมจ่าย", "เมื่อเลือกแบบมีส่วนรับผิดชอบแรก", "ประกันผู้ป่วยใน ต่อคนต่อปี", "ตามที่จ่ายจริง", "ผู้ป่วยนอกรวมค่าแพทย์ ยา และกายภาพ", "ยังไม่ถึงส่วนที่ประกันจ่าย", "ไม่เกินระยะเวลาของสัญญาหลัก", "ลูกนำเบี้ยไปลดหย่อนภาษีได้", "ดูรายชื่อเต็มได้ที่เว็บบริษัท"]) {
      expect(Object.values(HEALTH2_WORDS)).toContain(w);
    }
  });
});

describe("checkDevice: round-5 health devices", () => {
  it("passes each device as written when every optional figure is in the brief", () => {
    for (const d of FULL) {
      const brief = new Set<number>([...BRIEF]);
      expect(checkDevice(d, brief), d.layout).toEqual(d);
    }
  });
  it("passes each bare device with no figure in the brief: its required figures are the source's own", () => {
    for (const d of BARE) expect(checkDevice(d, NONE), d.layout).toEqual(d);
  });
  it("keeps only the device's own fields", () => {
    expect(checkDevice({ ...BARE[1], bogus: 1, percent: 20, fromPlan: true }, NONE)).toEqual(BARE[1]);
    expect(checkDevice({ ...BARE[4], rows: [], bill: 5 }, new Set([5]))).toEqual(BARE[4]);
  });
  it("ipdopd: room and opd are the sheet's, the brief's or refused; opd takes none and actual", () => {
    // from the sheet, the two figures are one plan's pair: each of the six plans passes as its own pair
    for (const p of HEALTH2_FIXED.ipdopd.plans) expect(ok({ ...BARE[0], room: p.room, opd: p.opd }, NONE), p.code).toMatchObject({ room: p.room, opd: p.opd });
    // one from the sheet beside one the brief wrote must still be one plan's pair (final re-review 1): the brief's 7,000 pairs with none
    for (const room of [1_500, 3_000, 5_500, 9_000, 15_000, 21_000]) expect(typeof ok({ ...BARE[0], room, opd: 7_000 }, new Set([7_000])), String(room)).toBe("string");
    for (const opd of [6_000, 12_000, 60_000, "none", "actual"]) expect(typeof ok({ ...BARE[0], room: 7_000, opd }, new Set([7_000])), String(opd)).toBe("string");
    // a figure neither the sheet's nor the brief's refuses the device; the brief's own is taken
    expect(typeof ok({ ...BARE[0], room: 9_001 }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[0], opd: 7_000 }, NONE)).toBe("string");
    expect(ok({ ...BARE[0], room: 9_001, opd: 7_000 }, new Set([9_001, 7_000]))).toMatchObject({ room: 9_001, opd: 7_000 });
    // needed, whole, above nought, within the limit; any other word than none / actual refuses
    for (const bad of [undefined, null, 0, -1, 1.5, "6000", "ไม่มี", "NONE", "", true, [], {}]) {
      expect(typeof ok({ ...BARE[0], opd: bad }, new Set([0, -1, 1.5])), `opd ${JSON.stringify(bad)}`).toBe("string");
    }
    for (const bad of [undefined, null, 0, "none", 2.5]) expect(typeof ok({ ...BARE[0], room: bad }, new Set([0, 2.5])), `room ${JSON.stringify(bad)}`).toBe("string");
    expect(ok({ ...BARE[0], room: HEALTH2_LIMITS.baht, opd: HEALTH2_LIMITS.baht }, new Set([HEALTH2_LIMITS.baht]))).toMatchObject({ room: 1_000_000_000, opd: 1_000_000_000 });
    expect(typeof ok({ ...BARE[0], room: HEALTH2_LIMITS.baht + 1 }, new Set([HEALTH2_LIMITS.baht + 1]))).toBe("string");
    expect(typeof ok({ layout: "ipdopd", title: T }, NONE)).toBe("string");
  });
  it("ipdopd (final review 1): a pair of the sheet's figures that no one plan has is refused, never drawn as a plan that does not exist", () => {
    // an empty brief: Smart has no OPD, Platinum pays as paid; both of these were passing, each figure on its own
    expect(typeof ok({ ...BARE[0], room: 1_500, opd: 60_000, planName: "Smart" }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[0], room: 21_000, opd: 6_000, planName: "แผนทองคำ" }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[0], room: 21_000, opd: "none" }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[0], room: 3_000, opd: "actual" }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[0], room: 9_000, opd: 6_000 }, NONE)).toBe("string");
    // the reason names the opd field
    expect(ok({ ...BARE[0], room: 9_000, opd: 6_000 }, NONE) as string).toMatch(/^opd:/);
    // the re-reviewer's two attacks: a figure the brief wrote does not free the other from the sheet's pairs
    expect(typeof ok({ ...BARE[0], room: 1_500, opd: 60_000, planName: "Smart" }, new Set([1_500]))).toBe("string");
    expect(typeof ok({ ...BARE[0], room: 9_000, opd: 60_000, planName: "Diamond" }, new Set([9_000]))).toBe("string");
    // a legitimate one: the brief says the room, the sheet's OPD completes Gold's pair; the name is the plan's label, never the AI's casing
    expect(ok({ ...BARE[0], room: 9_000, opd: 12_000, planName: "GOLD" }, new Set([9_000]))).toMatchObject({ room: 9_000, opd: 12_000, planName: "Gold" });
    expect(ok({ ...BARE[0], room: 9_000, opd: 12_000, planName: "gold" }, new Set([12_000]))).toMatchObject({ planName: "Gold" });
    // both figures the brief's own (no plan): kept as written, the name free
    expect(ok({ ...BARE[0], room: 9_001, opd: 7_000, planName: "แผนของลูกค้า" }, new Set([9_001, 7_000]))).toMatchObject({ planName: "แผนของลูกค้า" });
  });
  it("ipdopd (final review 1): the plan's name is drawn only as the matched plan's own label, else dropped", () => {
    const gold = { ...BARE[0], room: 9_000, opd: 12_000 };
    expect(ok({ ...gold, planName: "Gold" }, NONE)).toMatchObject({ planName: "Gold" });
    expect(ok({ ...gold, planName: " gold " }, NONE)).toMatchObject({ planName: "Gold" });
    for (const other of ["Silver", "Platinum", "Smart", "ทอง", "แผนทองคำ"]) expect(ok({ ...gold, planName: other }, NONE), other).toEqual(gold);
    // the name still holds its word rules (a digit refuses), whichever plan it names
    expect(typeof ok({ ...gold, planName: "Gold5" }, NONE)).toBe("string");
    // a pair completed by a brief figure still names only its own plan
    expect(ok({ ...gold, planName: "ซิลเวอร์" }, new Set([12_000]))).toEqual(gold);
    // an optional word: null or empty is none; over 14 letters or with a digit refuses (the length and digit rules hold for any figures)
    expect(ok({ ...BARE[0], planName: null }, NONE)).toEqual(BARE[0]);
    expect(ok({ ...BARE[0], planName: "" }, NONE)).toEqual(BARE[0]);
    expect(typeof ok({ ...BARE[0], planName: "ก".repeat(15) }, NONE)).toBe("string");
  });
  it("deductible: the sheet's three figures or the brief's; a bill only when the brief gives it, else it is left off", () => {
    for (const deductible of [30_000, 50_000, 100_000]) expect(ok({ ...BARE[1], deductible }, NONE)).toMatchObject({ deductible });
    expect(typeof ok({ ...BARE[1], deductible: 40_000 }, NONE)).toBe("string");
    expect(ok({ ...BARE[1], deductible: 40_000 }, new Set([40_000]))).toMatchObject({ deductible: 40_000 });
    expect(typeof ok({ layout: "deductible", title: T }, NONE)).toBe("string");
    // a bill is the agent's own figure: the brief's, never a fixed value (50,000 is a deductible, not a bill)
    expect(ok({ ...BARE[1], bill: 80_000 }, new Set([80_000]))).toEqual({ ...BARE[1], bill: 80_000 });
    expect(ok({ ...BARE[1], bill: 80_000 }, NONE)).toEqual(BARE[1]);
    expect(ok({ ...BARE[1], bill: 50_000 }, NONE)).toEqual(BARE[1]);
    for (const bill of [0, -3, 1.5, "80000", null, HEALTH2_LIMITS.baht + 1]) expect(ok({ ...BARE[1], bill }, new Set([0, -3, 1.5, HEALTH2_LIMITS.baht + 1])), String(bill)).toEqual(BARE[1]);
  });
  it("copay: the percent must equal the sheet's even when the brief says another; a bill is the brief's", () => {
    expect(ok({ ...BARE[2], percent: 20 }, NONE)).toMatchObject({ percent: 20 });
    expect(typeof ok({ ...BARE[2], percent: 30 }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[2], percent: 30 }, new Set([30]))).toBe("string");
    expect(typeof ok({ ...BARE[2], percent: 0 }, new Set([0]))).toBe("string");
    expect(typeof ok({ ...BARE[2], percent: 19.5 }, new Set([19.5]))).toBe("string");
    expect(typeof ok({ layout: "copay", title: T }, NONE)).toBe("string");
    expect(ok({ ...BARE[2], bill: 100_000 }, new Set([100_000]))).toEqual({ ...BARE[2], bill: 100_000 });
    expect(ok({ ...BARE[2], bill: 100_000 }, NONE)).toEqual(BARE[2]);
  });
  it("renew98: to must equal the sheet's renewal age; age is the brief's, 1 to 99, and below it, else it is dropped", () => {
    expect(ok({ ...BARE[3], to: 98 }, NONE)).toMatchObject({ to: 98 });
    expect(typeof ok({ ...BARE[3], to: 90 }, new Set([90]))).toBe("string");
    expect(typeof ok({ layout: "renew98", title: T }, NONE)).toBe("string");
    expect(ok({ ...BARE[3], age: 35 }, new Set([35]))).toEqual({ ...BARE[3], age: 35 });
    expect(ok({ ...BARE[3], age: 97 }, new Set([97]))).toEqual({ ...BARE[3], age: 97 });
    // age at or past `to`: dropped, the device stays
    for (const age of [98, 99]) expect(ok({ ...BARE[3], age }, new Set([age])), String(age)).toEqual(BARE[3]);
    // not in the brief, not whole, out of range: dropped
    expect(ok({ ...BARE[3], age: 35 }, NONE)).toEqual(BARE[3]);
    for (const age of [0, -1, 1.5, 100, "35", null]) expect(ok({ ...BARE[3], age }, new Set([0, -1, 1.5, 100])), String(age)).toEqual(BARE[3]);
  });
  it("parentshealth: the cap must equal the tax table's", () => {
    expect(ok({ ...BARE[4], cap: 15_000 }, NONE)).toMatchObject({ cap: 15_000 });
    expect(typeof ok({ ...BARE[4], cap: 25_000 }, new Set([25_000]))).toBe("string");
    expect(typeof ok({ ...BARE[4], cap: 14_999 }, new Set([14_999]))).toBe("string");
    expect(typeof ok({ layout: "parentshealth", title: T }, NONE)).toBe("string");
  });
  it("groupcost: a premium from the group table or the brief; a คลิปตามโจทย์ never keeps a head-count band (final re-review 2)", () => {
    for (const perYear of [2_499, 2_552, 12_047]) expect(ok({ ...BARE[5], perYear }, NONE)).toMatchObject({ perYear });
    expect(typeof ok({ ...BARE[5], perYear: 2_553 }, NONE)).toBe("string");
    expect(ok({ ...BARE[5], perYear: 2_553 }, new Set([2_553]))).toMatchObject({ perYear: 2_553 });
    expect(typeof ok({ layout: "groupcost", title: T }, NONE)).toBe("string");
    // any band, with any brief number inside it (an age of 35, a rate of 20, "40 คน"): dropped, the device and its premium stay
    for (const band of GROUP_BANDS) for (const n of [18, 20, 35, 40, 60]) expect(ok({ ...BARE[5], perYear: 2_552, band }, new Set([n])), `${band} ${n}`).toEqual({ ...BARE[5], perYear: 2_552 });
    expect(ok({ ...BARE[5], band: null }, NONE)).toEqual(BARE[5]);
    expect(checkDevice({ ...BARE[5], perYear: 2_526, band: "26-50" }, new Set([40]), { rates: new Set<number>(), premiums: new Set([40]) })).toEqual({ ...BARE[5], perYear: 2_526 });
  });
  it("hospitals: the total and every count must equal the hospital list's (Review Focus 1)", () => {
    const row = (p: { province: string; count: number }) => ({ province: p.province, count: p.count });
    expect(ok({ ...BARE[6] }, NONE)).toEqual(BARE[6]);
    // a count the brief gives but the list does not: refused
    expect(typeof ok({ ...BARE[6], rows: [{ province: BKK.province, count: BKK.count - 1 }] }, new Set([BKK.count - 1]))).toBe("string");
    // another province's count under this name: refused
    expect(typeof ok({ ...BARE[6], rows: [{ province: BKK.province, count: H.ranked[1].count }] }, NONE)).toBe("string");
    // the total
    expect(typeof ok({ ...BARE[6], total: 536 }, new Set([536]))).toBe("string");
    expect(typeof ok({ ...BARE[6], total: undefined }, NONE)).toBe("string");
    // a name that is not in the list, as the list spells it
    for (const province of ["กรุงเทพ", "จ.ชลบุรี", "Chonburi", "ภูเก็ตตะวันตก", ""]) {
      expect(typeof ok({ ...BARE[6], rows: [{ province, count: 5 }] }, new Set([5])), province).toBe("string");
    }
    // one to five rows, no province twice
    expect(typeof ok({ ...BARE[6], rows: [] }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[6], rows: H.ranked.slice(0, 6).map(row) }, NONE)).toBe("string");
    expect(ok({ ...BARE[6], rows: H.ranked.slice(0, 5).map(row) }, NONE)).toMatchObject({ rows: H.ranked.slice(0, 5).map(row) });
    expect(typeof ok({ ...BARE[6], rows: [row(BKK), row(BKK)] }, NONE)).toBe("string");
    // each row needs both a province and a count
    expect(typeof ok({ ...BARE[6], rows: [{ province: BKK.province }] }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[6], rows: [{ count: BKK.count }] }, NONE)).toBe("string");
    expect(typeof ok({ ...BARE[6], rows: ["กรุงเทพมหานคร"] }, NONE)).toBe("string");
    // only a province and its count are kept
    expect(ok({ ...BARE[6], rows: [{ ...row(BKK), bogus: 1 }] }, NONE)).toEqual(BARE[6]);
  });
  it("hospitals: a province the list spells over 14 letters is accepted as the list spells it; any other word over 14 is refused", () => {
    expect([...LONG.province].length).toBeGreaterThan(HEALTH2_LIMITS.label);
    expect(ok({ ...BARE[6], rows: [{ province: LONG.province, count: LONG.count }] }, NONE)).toMatchObject({ rows: [{ province: LONG.province, count: LONG.count }] });
    expect(typeof ok({ ...BARE[6], rows: [{ province: "ก".repeat(15), count: LONG.count }] }, NONE)).toBe("string");
  });
  it("paclaim: medical from the PA plans or the brief; weekly is optional and dropped when unsourced; weeks only with weekly and only 52", () => {
    for (const medical of [80_000, 100_000, 120_000, 150_000, 200_000, 300_000]) expect(ok({ ...BARE[7], medical }, NONE)).toMatchObject({ medical });
    expect(typeof ok({ ...BARE[7], medical: 90_000 }, NONE)).toBe("string");
    expect(typeof ok({ layout: "paclaim", title: T }, NONE)).toBe("string");
    // from the plans, a weekly sum goes with its own medical sum (Platinum 01 to 05)
    for (const [medical, weekly] of HEALTH2_FIXED.pa.pairs) expect(ok({ ...BARE[7], medical, weekly }, NONE), `${medical}/${weekly}`).toEqual({ ...BARE[7], medical, weekly });
    expect(HEALTH2_FIXED.pa.pairs).toHaveLength(5);
    // an unsourced weekly is left off, not refused, and its weeks with it
    expect(ok({ ...BARE[7], weekly: 4_000, weeks: 52 }, NONE)).toEqual(BARE[7]);
    expect(ok({ ...BARE[7], weekly: 4_000, weeks: 52 }, new Set([4_000]))).toEqual({ ...BARE[7], weekly: 4_000, weeks: 52 });
    // weeks: only 52, only with a weekly sum
    expect(ok({ ...BARE[7], weeks: 52 }, NONE)).toEqual(BARE[7]);
    expect(ok({ ...BARE[7], medical: 150_000, weekly: 3_000, weeks: 51 }, new Set([51]))).toEqual({ ...BARE[7], medical: 150_000, weekly: 3_000 });
    expect(ok({ ...BARE[7], medical: 150_000, weekly: 3_000, weeks: 52 }, NONE)).toEqual({ ...BARE[7], medical: 150_000, weekly: 3_000, weeks: 52 });
    for (const weekly of [0, -1, 1.5, "3000", null, HEALTH2_LIMITS.baht + 1]) expect(ok({ ...BARE[7], weekly }, new Set([0, -1, 1.5, HEALTH2_LIMITS.baht + 1])), String(weekly)).toEqual(BARE[7]);
  });
  it("paclaim (final review 3): a medical sum and a weekly sum from the plans are one plan's; another plan's weekly is dropped with its weeks", () => {
    // Classic A (80,000) has no weekly benefit; Platinum 05's 10,000 is another plan's
    expect(ok({ ...BARE[7], medical: 80_000, weekly: 10_000, weeks: 52 }, NONE)).toEqual({ ...BARE[7], medical: 80_000 });
    // Platinum 03 is 150,000 with 3,000: mixing it with Platinum 05's weekly drops the weekly
    expect(ok({ ...BARE[7], medical: 150_000, weekly: 10_000, weeks: 52 }, NONE)).toEqual({ ...BARE[7], medical: 150_000 });
    expect(ok({ ...BARE[7], medical: 150_000, weekly: 3_000, weeks: 52 }, NONE)).toEqual({ ...BARE[7], medical: 150_000, weekly: 3_000, weeks: 52 });
    // one of the two from the brief: the brief's own pairing is kept
    expect(ok({ ...BARE[7], medical: 80_000, weekly: 10_000, weeks: 52 }, new Set([80_000]))).toEqual({ ...BARE[7], medical: 80_000, weekly: 10_000, weeks: 52 });
  });
  it("refuses an Arabic, a Thai or a full-width digit in every word field of every device", () => {
    for (const f of wordFields((x) => x)) {
      for (const bad of ["ก5ข", "ก๕ข", "ก５ข"]) {
        const got = checkDevice(f.patch(bad), BRIEF);
        expect(typeof got, `${f.name} ${bad}`).toBe("string");
        expect(got as string, f.name).toContain("ตัวเลข");
      }
    }
    // a province carries none either, even one the brief gave
    expect(typeof ok({ ...BARE[6], rows: [{ province: "ชลบุรี5", count: 49 }] }, new Set([5]))).toBe("string");
    expect(typeof ok({ ...FULL[0], note: "ค่าห้อง 9,000" }, new Set([9_000]))).toBe("string");
  });
  it("paclaim refuses \"รายวัน\" in its title and note; other devices are unchanged", () => {
    for (const patch of [{ title: ["รายวัน", "ก"] }, { title: ["ก", "ชดเชยรายวัน"] }, { note: "รายวัน" }]) {
      expect(typeof ok({ ...FULL[7], ...patch }), JSON.stringify(patch)).toBe("string");
    }
    expect(ok({ ...FULL[0], note: "รายวัน" })).toMatchObject({ note: "รายวัน" });
  });
  it("paclaim also refuses \"วันละ\" in its words, and in the voice and screen of a scene that carries it (final review 7)", () => {
    for (const patch of [{ title: ["วันละ", "ก"] }, { note: "จ่ายวันละหมื่น" }]) expect(typeof ok({ ...FULL[7], ...patch }), JSON.stringify(patch)).toBe("string");
    expect(ok({ ...FULL[0], note: "วันละนิด" })).toMatchObject({ note: "วันละนิด" });
    const all = new Set<number>([...BRIEF]);
    const scene = (over: Partial<PromptScene>, device: unknown = FULL[7]) => ({ voice: "ประกันอุบัติเหตุมีค่าชดเชยค่ะ", screen: "ชดเชยทุกสัปดาห์", picture: "", device, ...over }) as PromptScene;
    expect(checkScene(scene({}), all, all)).toEqual([]);
    for (const [field, text] of [["voice", "ชดเชยเป็นรายวันค่ะ"], ["voice", "ได้วันละพันบาทค่ะ"], ["screen", "รายวัน"], ["screen", "วันละพัน"]] as const) {
      const got = checkScene(scene({ [field]: text }), all, all);
      expect(got.some((r) => r.startsWith(`${field}:`) && r.includes("รายวัน")), `${field} ${text}`).toBe(true);
    }
    // another device, or no device, may say it (a daily room rate is "ต่อวัน"): the rule is paclaim's only
    expect(checkScene(scene({ voice: "ห้องวันละ" }, FULL[0]), all, all).some((r) => r.includes("รายวัน"))).toBe(false);
    expect(checkScene({ voice: "ห้องวันละ", screen: "", picture: "" } as PromptScene, all, all)).toEqual([]);
  });
  it("refuses a word over its limit and passes one exactly at it (title 20, note 34, label 14)", () => {
    for (const f of wordFields((x) => x)) {
      const at = "ก".repeat(f.max);
      expect(checkDevice(f.patch(at), BRIEF), `${f.name} at ${f.max}`).toEqual(f.patch(at));
      expect(typeof checkDevice(f.patch("ก".repeat(f.max + 1)), BRIEF), `${f.name} over ${f.max}`).toBe("string");
    }
  });
  it("needs a first title line; the second may be empty; at most two lines", () => {
    expect(typeof checkDevice({ ...BARE[4], title: ["", "ก"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ ...BARE[4], title: [] }, NONE)).toBe("string");
    expect(typeof checkDevice({ ...BARE[4], title: ["ก", "ข", "ค"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "parentshealth", cap: 15_000 }, NONE)).toBe("string");
    expect(checkDevice({ ...BARE[4], title: ["ก"], note: null }, NONE)).toEqual({ ...BARE[4], title: ["ก", ""] });
    expect(typeof checkDevice({ ...BARE[4], note: 7 }, NONE)).toBe("string");
  });
  it("refuses every return word, %, IRR, irr and a promise in every word field of every device", () => {
    for (const f of wordFields((x) => x)) {
      for (const w of ["ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "%", "IRR", "irr", "การันตี", "แน่นอน 100"]) {
        const got = checkDevice(f.patch(`ก${w}ข`), BRIEF);
        expect(typeof got, `${f.name} ${w}`).toBe("string");
      }
    }
  });
  it("IRR is whole-word: refused beside Thai text, but a word that holds the letters passes", () => {
    for (const w of ["IRR", "irr", "Irr"]) for (const t of [`ผู้ป่วย ${w} ใน`, `ผู้ป่วย${w}ใน`, `${w}`]) expect(typeof ok({ ...FULL[0], note: t }), t).toBe("string");
    for (const t of ["mirror ผู้ป่วย", "irregular ผู้ป่วย", "ผู้ป่วยstirring"]) expect(ok({ ...FULL[0], note: t }), t).toMatchObject({ note: t });
  });
  it("holds a word to the script's forbidden words and to other insurers", () => {
    expect(typeof ok({ ...FULL[0], note: "ไม่ต้องตรวจสุขภาพ" })).toBe("string");
    expect(typeof ok({ ...FULL[1], note: "เอไอเอ" })).toBe("string");
    expect(typeof ok({ ...FULL[4], note: "เบี้ยถูก" })).toBe("string");
  });
  it("is refused the way a forged-figure device is: checkScene names the device, checkScript the scene", () => {
    const scene: PromptScene = { voice: "ค่าห้อง", screen: "ค่าห้อง", picture: "ห้องพัก", device: { layout: "hospitals", title: T, total: 537, rows: [{ province: BKK.province, count: 136 }] } as never };
    const all = new Set([136, 537]);
    expect(checkScene(scene, all, all).some((r) => r.startsWith("device:") && r.includes("rows"))).toBe(true);
    const brief = "ค่าห้องวันละ 9,000 บาท ผู้ป่วยนอก 12,000 บาทต่อปี";
    const good: PromptScene = { ...scene, device: { layout: "ipdopd", title: T, room: 9_000, opd: 12_000 } };
    expect(checkScript([good], brief)).toEqual([]);
    // the same device from a brief that gives neither number: still the sheet's own, so still drawn
    expect(checkScript([good], "เล่าเรื่องประกันสุขภาพ")).toEqual([]);
    // an optional figure the brief does not give is left off the scene's device, the scene stays
    const dropped = checkDevice({ layout: "deductible", title: T, deductible: 50_000, bill: 77_777 }, deviceAllowed("เล่าเรื่อง"));
    expect(dropped).toEqual({ layout: "deductible", title: T, deductible: 50_000 });
    expect(allowedFor("x").size).toBe(0);
  });
});
