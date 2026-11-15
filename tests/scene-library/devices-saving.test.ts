import { describe, expect, it } from "vitest";
import { checkDevice, checkScene, checkScript } from "@/lib/prompt-story/check";
import { DEVICES, deviceInfo } from "@/lib/scene-library/devices";
import {
  HEALTH_LAYOUTS, isDevice, isMeta, isSave, knowText, LIFE_LAYOUTS, META_LAYOUTS, SAVE_DEFAULTS, SAVE_LAYOUTS, SAVE_LIMITS, saveWords, showText,
  type KnowEpisode, type KnowShow,
} from "@/lib/quote-video/story-knowledge";
import { deviceTail, kspec } from "@/lib/quote-video/story-knowledge-motion";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import type { PromptScene } from "@/lib/prompt-story/types";

const T: [string, string] = ["หัวบน", "หัวล่าง"];
const ROWS = [
  { from: 60, to: 75, annual: 118_110 },
  { from: 76, to: 80, annual: 157_480 },
  { from: 81, to: 85, annual: 196_851 },
  { from: 86, to: 95, annual: 236_221 },
];

/** one of each, every optional field given */
const FULL: KnowShow[] = [
  { layout: "savejar", title: ["ส่งทีละปี", "ก้อนโตขึ้น"], note: "ส่งเท่าเดิมทุกปี", years: 20, paid: 2_724_411 },
  { layout: "paidgot", title: ["ส่งเท่าไร", "ได้คืนเท่าไร"], note: "ดูตามตาราง", paid: 2_724_411, got: 6_023_625, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95 },
  { layout: "pricerise", title: ["เงินเท่าเดิม", "ซื้อได้น้อยลง"], note: "ของแพงขึ้นทุกปี" },
  { layout: "pensionsteps", title: ["บำนาญ", "ขั้นบันได"], note: "วางแผนเผื่อไว้", rows: ROWS },
];
/** the same four with only what is required */
const BARE: KnowShow[] = [
  { layout: "savejar", title: ["ส่งทีละปี", ""] },
  { layout: "paidgot", title: ["ส่ง", ""], paid: 100_000, got: 200_000 },
  { layout: "pricerise", title: ["ราคา", ""] },
  { layout: "pensionsteps", title: ["ขั้น", ""], rows: [{ from: 60, to: 95, annual: 120_000 }] },
];
/** every figure FULL draws, as a brief would state them */
const ALL = new Set([20, 2_724_411, 6_023_625, 40, 59, 60, 95, 75, 76, 80, 81, 85, 86, 118_110, 157_480, 196_851, 236_221, 120_000, 100_000, 200_000]);
const NONE = new Set<number>();

/** every word field of one device, to put a digit or a long word in */
const FIELDS: { name: string; max: number; patch: (v: string) => unknown }[] = [
  { name: "title", max: SAVE_LIMITS.titleLine, patch: (v) => ({ ...FULL[0], title: [v, "ก"] }) },
  { name: "title", max: SAVE_LIMITS.titleLine, patch: (v) => ({ ...FULL[0], title: ["ก", v] }) },
  { name: "note", max: SAVE_LIMITS.note, patch: (v) => ({ ...FULL[0], note: v }) },
  { name: "note", max: SAVE_LIMITS.note, patch: (v) => ({ ...FULL[1], note: v }) },
  { name: "note", max: SAVE_LIMITS.note, patch: (v) => ({ ...FULL[2], note: v }) },
  { name: "note", max: SAVE_LIMITS.note, patch: (v) => ({ ...FULL[3], note: v }) },
  { name: "title", max: SAVE_LIMITS.titleLine, patch: (v) => ({ ...FULL[2], title: [v, "ก"] }) },
  { name: "title", max: SAVE_LIMITS.titleLine, patch: (v) => ({ ...FULL[3], title: ["ก", v] }) },
];

describe("saving devices: registry", () => {
  it("lists the four layouts after the earlier rounds", () => {
    expect([...SAVE_LAYOUTS]).toEqual(["savejar", "paidgot", "pricerise", "pensionsteps"]);
    expect(DEVICES.map((d) => d.key)).toEqual([...HEALTH_LAYOUTS, ...LIFE_LAYOUTS, ...META_LAYOUTS, ...SAVE_LAYOUTS]);
    expect(DEVICES).toHaveLength(28);
  });
  it("gives each the family ออมเงิน, the product saving, both clips, its fields and a when line", () => {
    for (const key of SAVE_LAYOUTS) {
      const d = deviceInfo(key)!;
      expect(d.family, key).toBe("ออมเงิน");
      expect(d.product, key).toBe("saving");
      expect(d.clips, key).toEqual(["story", "prompt"]);
      expect(d.when.length, key).toBeGreaterThan(10);
      expect(d.wordFields, key).toEqual(["title", "note"]);
    }
    expect(deviceInfo("savejar")?.name).toBe("กระปุกโตทุกปี");
    expect(deviceInfo("paidgot")?.name).toBe("ส่งเท่าไร ได้คืนเท่าไร");
    expect(deviceInfo("pricerise")?.name).toBe("เงินเท่าเดิม ซื้อได้น้อยลง");
    expect(deviceInfo("pensionsteps")?.name).toBe("บำนาญขั้นบันได");
    expect(deviceInfo("savejar")?.numberFields).toEqual(["years", "paid"]);
    expect(deviceInfo("paidgot")?.numberFields).toEqual(["paid", "got", "payFrom", "payTo", "getFrom", "getTo"]);
    expect(deviceInfo("pricerise")?.numberFields).toEqual([]);
    expect(deviceInfo("pensionsteps")?.numberFields).toEqual(["rows"]);
    expect(deviceInfo("room")?.family).toBe("สุขภาพ");
    expect(deviceInfo("umbrella")?.family).toBe("อุปมา");
  });
  it("no when line says a word no script may (FORBIDDEN, or a return word), and none holds a digit or a percent", () => {
    for (const key of SAVE_LAYOUTS) {
      const when = deviceInfo(key)!.when;
      for (const x of FORBIDDEN) expect(x.re.test(when), `${key}: ${x.why}`).toBe(false);
      expect(/[\d๐-๙%]/.test(when), key).toBe(false);
      for (const w of ["ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "IRR"]) expect(when, `${key} ${w}`).not.toContain(w);
    }
  });
  it("is a device and a saving device; the others are not", () => {
    for (const s of [...FULL, ...BARE]) {
      expect(isDevice(s), s.layout).toBe(true);
      expect(isSave(s), s.layout).toBe(true);
      expect(isMeta(s), s.layout).toBe(false);
    }
    expect(isSave({ layout: "umbrella", title: T })).toBe(false);
    expect(isSave({ layout: "room", title: T, plan: 1, planName: "" })).toBe(false);
    expect(isSave({ layout: "ask", title: T })).toBe(false);
  });
});

describe("kspec and the tail", () => {
  it("times every saving device, the title first, the note last", () => {
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
  it("savejar: four fill steps; paidgot: the two bars in turn; pensionsteps: one step for each row", () => {
    expect(Object.keys(kspec(FULL[0])).filter((k) => k.startsWith("fill"))).toHaveLength(4);
    const pg = kspec(FULL[1]);
    expect(pg.paid.at).toBeLessThan(pg.got.at);
    expect(Object.keys(kspec(FULL[3])).filter((k) => k.startsWith("step"))).toHaveLength(4);
    expect(Object.keys(kspec(BARE[3])).filter((k) => k.startsWith("step"))).toHaveLength(1);
    const pr = kspec(FULL[2]);
    expect(pr.today.at).toBeLessThan(pr.later.at);
  });
});

describe("words for the hand fonts", () => {
  it("knowText and showText carry the words and digits a saving device draws", () => {
    const e: KnowEpisode = { scenes: [...FULL, ...BARE].map((show) => ({ key: "knowOne", show, voice: "" })), cta: "ติดต่อ", contactVoice: "" };
    const all = knowText(e);
    for (const w of ["ส่งทีละปี", "ก้อนโตขึ้น", "ส่งเท่าเดิมทุกปี", "ดูตามตาราง", "ของแพงขึ้นทุกปี", "วางแผนเผื่อไว้", "0123456789", "บาท"]) expect(all, w).toContain(w);
    for (const w of [SAVE_DEFAULTS.pricerise, SAVE_DEFAULTS.pensionsteps]) expect(all, w).toContain(w);
    expect(showText(FULL[0])).toContain("ส่งเท่าเดิมทุกปี");
    expect(showText(FULL[0])).toContain("0123456789");
    expect(showText(BARE[2])).toContain(SAVE_DEFAULTS.pricerise);
    expect(showText(BARE[3])).toContain(SAVE_DEFAULTS.pensionsteps);
  });
  it("saveWords gives the note, the default for pricerise and pensionsteps when left out", () => {
    expect(saveWords(FULL[0] as never)).toContain("ส่งเท่าเดิมทุกปี");
    expect(saveWords(BARE[0] as never)).toEqual([]);
    expect(saveWords(BARE[2] as never)).toEqual([SAVE_DEFAULTS.pricerise]);
    expect(saveWords(BARE[3] as never)).toEqual([SAVE_DEFAULTS.pensionsteps]);
    for (const w of Object.values(SAVE_DEFAULTS)) expect([...w].length).toBeLessThanOrEqual(SAVE_LIMITS.note);
  });
  it("no word a saving device draws by itself says %, IRR or a return word", () => {
    for (const s of [...FULL, ...BARE]) {
      const t = showText(s).replace("0123456789,", "");
      expect(t, s.layout).not.toContain("%");
      for (const w of ["ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "IRR"]) expect(t, `${s.layout} ${w}`).not.toContain(w);
    }
  });
});

describe("checkDevice: saving devices", () => {
  it("passes each device as written when every figure is in the brief", () => {
    for (const d of [...FULL, ...BARE]) expect(checkDevice(d, ALL), d.layout).toEqual(d);
  });
  it("keeps only the device's own fields", () => {
    expect(checkDevice({ ...FULL[2], bogus: 1, paid: 5 }, NONE)).toEqual(FULL[2]);
    expect(checkDevice({ ...FULL[0], got: 9, rows: [] }, ALL)).toEqual(FULL[0]);
  });
  it("pricerise has no number field: it passes with no figure in the brief, and carries none", () => {
    expect(checkDevice(FULL[2], NONE)).toEqual(FULL[2]);
    expect(checkDevice({ ...FULL[2], years: 20, paid: 1000 }, ALL)).toEqual(FULL[2]);
  });
  it("a figure not in the brief is refused (Review Focus 1): savejar, paidgot, pensionsteps", () => {
    const got = checkDevice(FULL[0], new Set([20]));
    expect(typeof got).toBe("string");
    expect(got as string).toContain("paid");
    expect(typeof checkDevice(FULL[0], new Set([2_724_411]))).toBe("string");
    expect(typeof checkDevice(FULL[1], new Set([2_724_411, 6_023_625]))).toBe("string");
    expect(typeof checkDevice(FULL[3], new Set([60, 75]))).toBe("string");
    const none = checkDevice(BARE[1], NONE);
    expect(typeof none).toBe("string");
  });
  it("savejar: years and paid are each optional, never zero, a fraction or past their limit", () => {
    expect(checkDevice({ layout: "savejar", title: T, years: 20 }, ALL)).toEqual({ layout: "savejar", title: T, years: 20 });
    expect(checkDevice({ layout: "savejar", title: T, paid: 2_724_411 }, ALL)).toEqual({ layout: "savejar", title: T, paid: 2_724_411 });
    for (const years of [0, -1, 1.5, 61, "20"]) expect(typeof checkDevice({ ...BARE[0], years }, new Set([0, -1, 1.5, 61, 20]))).toBe("string");
    for (const years of [1, 60]) expect(checkDevice({ ...BARE[0], years }, new Set([years]))).toMatchObject({ years });
    expect(checkDevice({ ...BARE[0], paid: SAVE_LIMITS.baht }, new Set([SAVE_LIMITS.baht]))).toMatchObject({ paid: 1_000_000_000 });
    expect(typeof checkDevice({ ...BARE[0], paid: SAVE_LIMITS.baht + 1 }, new Set([SAVE_LIMITS.baht + 1]))).toBe("string");
    expect(checkDevice({ ...BARE[0], years: null, paid: null }, NONE)).toEqual(BARE[0]);
  });
  it("paidgot: refused unless both paid and got are there (Review Focus 1)", () => {
    for (const bad of [{ paid: undefined }, { got: undefined }, { paid: null }, { got: null }, { paid: 0 }, { got: 0 }, { paid: "100000" }, { got: 2.5 }]) {
      expect(typeof checkDevice({ ...BARE[1], ...bad }, ALL), JSON.stringify(bad)).toBe("string");
    }
    expect(typeof checkDevice({ layout: "paidgot", title: T }, ALL)).toBe("string");
    expect(typeof checkDevice({ ...BARE[1], paid: SAVE_LIMITS.baht + 1 }, new Set([SAVE_LIMITS.baht + 1, 200_000]))).toBe("string");
    expect(checkDevice({ ...BARE[1], paid: 123_456_789, got: 987_654_321 }, new Set([123_456_789, 987_654_321]))).toMatchObject({ paid: 123_456_789, got: 987_654_321 });
  });
  it("paidgot: an age is 1 to 99, a pair runs from at most to; the ages are optional", () => {
    expect(checkDevice({ ...BARE[1], payFrom: 40, payTo: 59 }, new Set([100_000, 200_000, 40, 59]))).toMatchObject({ payFrom: 40, payTo: 59 });
    expect(checkDevice({ ...BARE[1], getFrom: 60 }, new Set([100_000, 200_000, 60]))).toMatchObject({ getFrom: 60 });
    for (const [k, v] of [["payFrom", 0], ["payTo", 100], ["getFrom", -5], ["getTo", 1.5]] as const) {
      expect(typeof checkDevice({ ...BARE[1], [k]: v }, new Set([100_000, 200_000, v])), k).toBe("string");
    }
    expect(typeof checkDevice({ ...BARE[1], payFrom: 59, payTo: 40 }, new Set([100_000, 200_000, 59, 40]))).toBe("string");
    expect(checkDevice({ ...BARE[1], payFrom: 50, payTo: 50 }, new Set([100_000, 200_000, 50]))).toMatchObject({ payFrom: 50, payTo: 50 });
  });
  it("pensionsteps: one to five rows, each from at most to, ascending by age, all three numbers (Review Focus 1)", () => {
    const some = (n: number) => Array.from({ length: n }, (_, i) => ({ from: 50 + i * 10, to: 59 + i * 10, annual: 100_000 + i }));
    const ok = (rows: unknown) => checkDevice({ ...BARE[3], rows }, new Set([...some(5).flatMap((r) => [r.from, r.to, r.annual]), 55, 70, 65, 99, 0, 100, 60, 75, 79]));
    for (const n of [1, 2, 3, 4, 5]) expect(ok(some(n)), String(n)).toMatchObject({ rows: some(n) });
    for (const bad of [undefined, null, [], some(6), "x", [1], [{}], [{ from: 60, to: 70 }], [{ from: 60, annual: 100_000 }], [{ to: 70, annual: 100_000 }]]) {
      expect(typeof ok(bad), JSON.stringify(bad)).toBe("string");
    }
    // from after to
    expect(typeof ok([{ from: 70, to: 65, annual: 100_000 }])).toBe("string");
    // one age row: from = to is allowed
    expect(ok([{ from: 70, to: 70, annual: 100_000 }])).toMatchObject({ rows: [{ from: 70, to: 70, annual: 100_000 }] });
    // not ascending: the second row starts before or where the first starts, or ends before it
    expect(typeof ok([{ from: 70, to: 75, annual: 100_000 }, { from: 60, to: 69, annual: 100_001 }])).toBe("string");
    expect(typeof ok([{ from: 60, to: 75, annual: 100_000 }, { from: 60, to: 80, annual: 100_001 }])).toBe("string");
    expect(typeof ok([{ from: 60, to: 99, annual: 100_000 }, { from: 65, to: 70, annual: 100_001 }])).toBe("string");
    // ages 1 to 99
    expect(typeof ok([{ from: 0, to: 70, annual: 100_000 }])).toBe("string");
    expect(typeof ok([{ from: 60, to: 100, annual: 100_000 }])).toBe("string");
    // a baht a year over the limit or not whole
    expect(typeof checkDevice({ ...BARE[3], rows: [{ from: 60, to: 95, annual: SAVE_LIMITS.baht + 1 }] }, new Set([60, 95, SAVE_LIMITS.baht + 1]))).toBe("string");
    expect(typeof checkDevice({ ...BARE[3], rows: [{ from: 60, to: 95, annual: 1.5 }] }, new Set([60, 95, 1.5]))).toBe("string");
  });
  it("pensionsteps keeps only from, to and annual of each row, and holds each to the brief", () => {
    expect(checkDevice({ ...BARE[3], rows: [{ from: 60, to: 95, annual: 120_000, bogus: 1 }] }, ALL)).toEqual(BARE[3]);
    const got = checkDevice(FULL[3], new Set([...ALL].filter((n) => n !== 236_221)));
    expect(typeof got).toBe("string");
    expect(got as string).toContain("rows");
  });
  it("refuses an Arabic or a Thai digit in every word field", () => {
    for (const f of FIELDS) {
      for (const bad of ["ก5ข", "ก๕ข", "ก５ข"]) {
        const got = checkDevice(f.patch(bad), ALL);
        expect(typeof got, `${f.name} ${bad}`).toBe("string");
        expect(got as string, f.name).toContain(f.name);
        expect(got as string, f.name).toContain("ตัวเลข");
      }
    }
  });
  it("a digit in a word is refused even when the brief gave that number", () => {
    expect(typeof checkDevice({ ...FULL[0], note: "ส่ง 20 ปี" }, ALL)).toBe("string");
  });
  it("refuses a word over its limit, and passes one exactly at it", () => {
    for (const f of FIELDS) {
      const at = "ก".repeat(f.max);
      expect(checkDevice(f.patch(at), ALL), `${f.name} at ${f.max}`).toEqual(f.patch(at));
      const got = checkDevice(f.patch("ก".repeat(f.max + 1)), ALL);
      expect(typeof got, `${f.name} over ${f.max}`).toBe("string");
      expect(got as string, f.name).toContain(f.name);
    }
  });
  it("needs a first title line; the second may be empty; at most two lines", () => {
    expect(typeof checkDevice({ layout: "pricerise", title: ["", "ก"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "pricerise", title: [] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "pricerise", title: ["ก", "ข", "ค"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "pricerise" }, NONE)).toBe("string");
    expect(checkDevice({ layout: "pricerise", title: ["ก"], note: null }, NONE)).toEqual({ layout: "pricerise", title: ["ก", ""] });
    expect(typeof checkDevice({ ...FULL[2], note: 7 }, NONE)).toBe("string");
  });
  it("refuses every return word, %, IRR and irr in every word field of every saving device", () => {
    const fields = [
      ...FULL.flatMap((d, i) => [0, 1].map((line) => ({ i, name: "title", patch: (v: string) => ({ ...d, title: line ? ["ก", v] : [v, "ก"] }) }))),
      ...FULL.map((d, i) => ({ i, name: "note", patch: (v: string) => ({ ...d, note: v }) })),
    ];
    for (const f of fields) {
      for (const w of ["ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "%", "IRR", "irr"]) {
        const got = checkDevice(f.patch(`ก${w}ข`), ALL);
        expect(typeof got, `${FULL[f.i].layout} ${f.name} ${w}`).toBe("string");
        expect(got as string, `${FULL[f.i].layout} ${f.name} ${w}`).toContain(f.name);
      }
    }
  });
  it("holds a word to the script's forbidden words, and refuses a return word on the device", () => {
    expect(typeof checkDevice({ ...FULL[0], note: "ไม่ต้องตรวจสุขภาพ" }, ALL)).toBe("string");
    expect(typeof checkDevice({ ...FULL[2], note: "เอไอเอ" }, ALL)).toBe("string");
  });
  it("is refused the way a forged-figure device is: checkScene names the device, checkScript the scene", () => {
    const scene: PromptScene = { voice: "ส่งทีละปี", screen: "ส่งทีละปี", picture: "กระปุก", device: { ...FULL[0], paid: 999_999 } as never };
    expect(checkScene(scene, ALL, ALL).some((r) => r.startsWith("device:") && r.includes("paid"))).toBe(true);
    const brief = "ส่งปีละ 136,220 บาท ส่ง 20 ปี รวม 2,724,411 บาท";
    const ok: PromptScene = { ...scene, voice: "ส่งยี่สิบปี", screen: "ส่งยี่สิบปี", device: { layout: "savejar", title: T, years: 20, paid: 2_724_411 } };
    expect(checkScript([ok], brief)).toEqual([]);
    const forged: PromptScene = { ...ok, device: { layout: "savejar", title: T, years: 20, paid: 9_999_999 } };
    expect(checkScript([forged], brief)).toEqual([{ scene: 0, reasons: [expect.stringContaining("device: paid")] }]);
    const lone: PromptScene = { ...ok, device: { layout: "paidgot", title: T, paid: 2_724_411 } as never };
    expect(checkScript([lone], brief)).toEqual([{ scene: 0, reasons: [expect.stringContaining("device: got")] }]);
  });
});
