import { describe, expect, it } from "vitest";
import { checkDevice, checkScene, checkScript } from "@/lib/prompt-story/check";
import { DEVICES, deviceInfo } from "@/lib/scene-library/devices";
import {
  HEALTH_LAYOUTS, isDevice, isMeta, knowText, LIFE_LAYOUTS, META_LAYOUTS, META_LIMITS, showText, type KnowEpisode, type KnowShow,
} from "@/lib/quote-video/story-knowledge";
import { deviceTail, kspec } from "@/lib/quote-video/story-knowledge-motion";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import type { PromptScene } from "@/lib/prompt-story/types";

const T: [string, string] = ["หัวบน", "หัวล่าง"];
const NONE = new Set<number>();

/** one of each, every optional word given */
const FULL: KnowShow[] = [
  { layout: "umbrella", title: ["ซื้อประกัน", "เหมือนแช่งตัวเอง"], note: "พกร่ม ไม่ได้ทำให้ฝนตก" },
  { layout: "housepillar", title: T, note: "รายได้หลักของบ้าน", label: "รายได้", spare: "ประกัน" },
  { layout: "lifering", title: T, note: "เงินก้อนมาตอนที่ต้องการที่สุด" },
  { layout: "safetynet", title: T, note: "ตาข่ายนี้ เราขึงเองได้" },
  { layout: "seedtree", title: T, note: "เริ่มเล็ก ดีกว่าไม่เริ่ม", from: "วันนี้", to: "ปีหน้า" },
  { layout: "balance", title: T, note: "ออมไว้ใช้ ประกันกันเรื่องใหญ่", sides: ["เงินออม", "ประกัน"], tilt: "even" },
  { layout: "bridge", title: T, note: "ช่วงป่วย รายได้หายต้องมีสะพาน" },
  { layout: "shield", title: T, note: "ประกันรับแทนเรา", arrows: ["จากไปเร็ว", "อยู่นานเกิน", "ป่วยหนัก", "อุบัติเหตุ", "ทุพพลภาพ"] },
];

/** the same eight, as the model might leave them: only the required words */
const BARE: KnowShow[] = [
  { layout: "umbrella", title: ["ร่ม", ""] },
  { layout: "housepillar", title: ["เสา", ""] },
  { layout: "lifering", title: ["ห่วง", ""] },
  { layout: "safetynet", title: ["ตาข่าย", ""] },
  { layout: "seedtree", title: ["เมล็ด", ""] },
  { layout: "balance", title: ["ตาชั่ง", ""], sides: ["ก", "ข"] },
  { layout: "bridge", title: ["สะพาน", ""] },
  { layout: "shield", title: ["โล่", ""], arrows: ["ก"] },
];

/** every word field of one device, to put a digit or a long word in */
const FIELDS: { show: KnowShow; patch: (v: string) => unknown; name: string; max: number }[] = [
  { show: FULL[0], name: "title", max: META_LIMITS.titleLine, patch: (v) => ({ ...FULL[0], title: [v, "ก"] }) },
  { show: FULL[0], name: "title", max: META_LIMITS.titleLine, patch: (v) => ({ ...FULL[0], title: ["ก", v] }) },
  { show: FULL[0], name: "note", max: META_LIMITS.note, patch: (v) => ({ ...FULL[0], note: v }) },
  { show: FULL[1], name: "label", max: META_LIMITS.word, patch: (v) => ({ ...FULL[1], label: v }) },
  { show: FULL[1], name: "spare", max: META_LIMITS.word, patch: (v) => ({ ...FULL[1], spare: v }) },
  { show: FULL[4], name: "from", max: META_LIMITS.word, patch: (v) => ({ ...FULL[4], from: v }) },
  { show: FULL[4], name: "to", max: META_LIMITS.word, patch: (v) => ({ ...FULL[4], to: v }) },
  { show: FULL[5], name: "sides", max: META_LIMITS.word, patch: (v) => ({ ...FULL[5], sides: [v, "ข"] }) },
  { show: FULL[5], name: "sides", max: META_LIMITS.word, patch: (v) => ({ ...FULL[5], sides: ["ก", v] }) },
  { show: FULL[7], name: "arrows", max: META_LIMITS.arrow, patch: (v) => ({ ...FULL[7], arrows: ["ก", v] }) },
];

describe("metaphor devices: registry", () => {
  it("lists the eight layouts after the round-1 and round-2 ones", () => {
    expect([...META_LAYOUTS]).toEqual(["umbrella", "housepillar", "lifering", "safetynet", "seedtree", "balance", "bridge", "shield"]);
    expect(DEVICES.map((d) => d.key)).toEqual([...HEALTH_LAYOUTS, ...LIFE_LAYOUTS, ...META_LAYOUTS]);
    expect(DEVICES).toHaveLength(24);
  });
  it("gives each the family อุปมา, the product all, both clips, no number field and a when line", () => {
    for (const key of META_LAYOUTS) {
      const d = deviceInfo(key)!;
      expect(d.family, key).toBe("อุปมา");
      expect(d.product, key).toBe("all");
      expect(d.clips, key).toEqual(["story", "prompt"]);
      expect(d.numberFields, key).toEqual([]);
      expect(d.when.length, key).toBeGreaterThan(10);
      expect(d.wordFields, key).toContain("title");
      expect(d.wordFields, key).toContain("note");
    }
    expect(deviceInfo("umbrella")?.name).toBe("ร่มกันฝน");
    expect(deviceInfo("housepillar")?.name).toBe("เสาหลักของบ้าน");
    expect(deviceInfo("lifering")?.name).toBe("ห่วงชูชีพ");
    expect(deviceInfo("safetynet")?.name).toBe("ตาข่ายนิรภัย");
    expect(deviceInfo("seedtree")?.name).toBe("เมล็ดโตเป็นต้นไม้");
    expect(deviceInfo("balance")?.name).toBe("ตาชั่ง");
    expect(deviceInfo("bridge")?.name).toBe("สะพานข้ามช่วงยาก");
    expect(deviceInfo("shield")?.name).toBe("โล่กันลูกศร");
    expect(deviceInfo("housepillar")?.wordFields).toEqual(["title", "note", "label", "spare"]);
    expect(deviceInfo("seedtree")?.wordFields).toEqual(["title", "note", "from", "to"]);
    expect(deviceInfo("balance")?.wordFields).toEqual(["title", "note", "sides", "tilt"]);
    expect(deviceInfo("shield")?.wordFields).toEqual(["title", "note", "arrows"]);
    // the earlier rounds keep theirs
    expect(deviceInfo("room")?.family).toBe("สุขภาพ");
    expect(deviceInfo("taxback")?.family).toBe("ชีวิต ภาษี มรดก");
  });
  it("no when line says a word no script may (FORBIDDEN), and none holds a digit", () => {
    for (const key of META_LAYOUTS) {
      const when = deviceInfo(key)!.when;
      for (const x of FORBIDDEN) expect(x.re.test(when), `${key}: ${x.why}`).toBe(false);
      expect(/[\d๐-๙]/.test(when), key).toBe(false);
    }
  });
  it("is a device and a metaphor; the others are not metaphors", () => {
    for (const s of [...FULL, ...BARE]) {
      expect(isDevice(s), s.layout).toBe(true);
      expect(isMeta(s), s.layout).toBe(true);
    }
    expect(isMeta({ layout: "room", title: T, plan: 1, planName: "" })).toBe(false);
    expect(isMeta({ layout: "taxcap", title: T })).toBe(false);
    expect(isMeta({ layout: "ask", title: T })).toBe(false);
  });
});

describe("kspec and the tail", () => {
  it("times every metaphor, the title first, the note last, never a count", () => {
    for (const s of [...FULL, ...BARE]) {
      const spec = kspec(s);
      expect(spec.title?.at, s.layout).toBe(0.2);
      expect(Object.keys(spec).length, s.layout).toBeGreaterThan(2);
      expect(spec.count, s.layout).toBeUndefined();
      for (const x of Object.values(spec)) expect(x.at, s.layout).toBeGreaterThanOrEqual(0);
      expect(deviceTail(s, 0), s.layout).toBeGreaterThan(0);
    }
    for (const s of FULL) {
      const spec = kspec(s);
      const latest = Math.max(...Object.entries(spec).filter(([k]) => k !== "note").map(([, x]) => x.at));
      expect(spec.note.at, s.layout).toBeGreaterThan(latest);
    }
  });
  it("housepillar: the second pillar only when a spare is given (Review Focus 5)", () => {
    expect(kspec(FULL[1]).protect).toBeDefined();
    expect(kspec(BARE[1]).protect).toBeUndefined();
    expect(kspec(BARE[1]).trouble).toBeDefined();
  });
  it("shield: one arrow beat for each word", () => {
    expect(Object.keys(kspec(FULL[7])).filter((k) => k.startsWith("arrow"))).toHaveLength(5);
    expect(Object.keys(kspec(BARE[7])).filter((k) => k.startsWith("arrow"))).toHaveLength(1);
  });
});

describe("words for the hand fonts", () => {
  it("knowText and showText carry every word a metaphor draws, the defaults too", () => {
    const e: KnowEpisode = { scenes: [...FULL, ...BARE].map((show) => ({ key: "knowOne", show, voice: "" })), cta: "ติดต่อ", contactVoice: "" };
    const all = knowText(e);
    const words = [
      ...FULL.flatMap((s) => (s.layout === "umbrella" || s.layout === "housepillar" ? s.title : [])), "ซื้อประกัน", "เหมือนแช่งตัวเอง",
      "พกร่ม ไม่ได้ทำให้ฝนตก", "รายได้หลักของบ้าน", "รายได้", "ประกัน", "ปีหน้า", "เงินออม", "ออมไว้ใช้ ประกันกันเรื่องใหญ่",
      "จากไปเร็ว", "อยู่นานเกิน", "ป่วยหนัก", "อุบัติเหตุ", "ทุพพลภาพ", "ประกันรับแทนเรา", "ช่วงป่วย รายได้หายต้องมีสะพาน",
      // seedtree's defaults, drawn when its words are left out
      "วันนี้", "วันข้างหน้า",
    ];
    for (const w of words) expect(all, w).toContain(w);
    for (const s of FULL) for (const w of (s.layout === "seedtree" ? ["วันนี้", "ปีหน้า"] : [])) expect(showText(s), w).toContain(w);
    expect(showText(BARE[4])).toContain("วันข้างหน้า");
    expect(showText(BARE[1])).toContain("รายได้");
    // a metaphor adds no digits or baht to the font
    expect(all).not.toContain("0123456789");
  });
  it("showText of each metaphor holds its own words", () => {
    expect(showText(FULL[5])).toContain("เงินออม");
    expect(showText(FULL[5])).toContain("ประกัน");
    expect(showText(FULL[7])).toContain("ทุพพลภาพ");
    expect(showText(FULL[0])).toContain("เหมือนแช่งตัวเอง");
  });
});

describe("checkDevice: metaphors", () => {
  it("passes each metaphor, as written, with no figure in the brief or the plan", () => {
    for (const d of [...FULL, ...BARE]) expect(checkDevice(d, NONE), d.layout).toEqual(d);
  });
  it("keeps only the device's own fields", () => {
    expect(checkDevice({ ...FULL[0], bogus: 1, sides: ["ก", "ข"], premium: 5 }, NONE)).toEqual(FULL[0]);
    expect(checkDevice({ ...BARE[5], note: undefined }, NONE)).toEqual(BARE[5]);
  });
  it("trims and collapses spaces in a word; an optional word left null is absent", () => {
    expect(checkDevice({ layout: "umbrella", title: ["  ร่ม   กัน ฝน ", ""], note: null }, NONE)).toEqual({ layout: "umbrella", title: ["ร่ม กัน ฝน", ""] });
  });
  it("refuses an Arabic digit in every word field (Review Focus 1)", () => {
    for (const f of FIELDS) {
      const got = checkDevice(f.patch("ก5ข"), NONE);
      expect(typeof got, `${f.show.layout} ${f.name}`).toBe("string");
      expect(got as string, f.name).toContain(f.name);
      expect(got as string, f.name).toContain("ตัวเลข");
    }
  });
  it("refuses a Thai digit in every word field", () => {
    for (const f of FIELDS) {
      const got = checkDevice(f.patch("ก๕ข"), NONE);
      expect(typeof got, `${f.show.layout} ${f.name}`).toBe("string");
      expect(got as string, f.name).toContain("ตัวเลข");
    }
  });
  it("a digit is refused even when the brief or the plan gave that number: a metaphor carries no figure", () => {
    const allowed = new Set([5, 30, 100]);
    expect(typeof checkDevice({ ...FULL[0], note: "ปีละ 5 พัน" }, allowed)).toBe("string");
    expect(typeof checkDevice({ ...FULL[7], arrows: ["30 วัน"] }, allowed)).toBe("string");
    expect(typeof checkDevice({ ...FULL[4], to: "100 ปี" }, allowed)).toBe("string");
  });
  it("refuses a word over its limit, and passes one exactly at it (Review Focus 1)", () => {
    for (const f of FIELDS) {
      const at = "ก".repeat(f.max);
      const over = "ก".repeat(f.max + 1);
      expect(checkDevice(f.patch(at), NONE), `${f.name} at ${f.max}`).toEqual(f.patch(at));
      const got = checkDevice(f.patch(over), NONE);
      expect(typeof got, `${f.name} over ${f.max}`).toBe("string");
      expect(got as string, f.name).toContain(f.name);
    }
  });
  it("counts Thai marks as characters, as the other word fields do", () => {
    // marks count as code points, as [...str].length does in the other word fields: 14 here, over 12
    const over = "กิ่งก้านสาขาคุ";
    expect([...over].length).toBeGreaterThan(12);
    expect(typeof checkDevice({ ...FULL[1], label: over }, NONE)).toBe("string");
    expect(checkDevice({ ...FULL[1], label: "รายได้หลัก" }, NONE)).toMatchObject({ label: "รายได้หลัก" });
  });
  it("needs a first title line; the second may be empty; no more than two lines", () => {
    expect(typeof checkDevice({ layout: "umbrella", title: ["", "ก"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "umbrella", title: [] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "umbrella", title: ["ก", "ข", "ค"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ layout: "umbrella" }, NONE)).toBe("string");
    expect(checkDevice({ layout: "umbrella", title: ["ก"] }, NONE)).toEqual({ layout: "umbrella", title: ["ก", ""] });
    expect(typeof checkDevice({ layout: "umbrella", title: [5, "ก"] }, NONE)).toBe("string");
    expect(typeof checkDevice({ ...FULL[0], note: 7 }, NONE)).toBe("string");
  });
  it("balance: exactly two sides, each a word; tilt left, right, even or absent (Review Focus 5)", () => {
    for (const sides of [undefined, [], ["ก"], ["ก", "ข", "ค"], "กข", [1, 2], ["ก", ""], ["", "ข"]]) {
      expect(typeof checkDevice({ ...BARE[5], sides }, NONE), JSON.stringify(sides)).toBe("string");
    }
    for (const tilt of ["left", "right", "even"] as const) expect(checkDevice({ ...BARE[5], tilt }, NONE)).toEqual({ ...BARE[5], tilt });
    expect(checkDevice({ ...BARE[5], tilt: undefined }, NONE)).toEqual(BARE[5]);
    expect(checkDevice({ ...BARE[5], tilt: null }, NONE)).toEqual(BARE[5]);
    for (const tilt of ["up", "LEFT", "", 1, true]) {
      const got = checkDevice({ ...BARE[5], tilt }, NONE);
      expect(typeof got, String(tilt)).toBe("string");
      expect(got as string).toContain("tilt");
    }
  });
  it("shield: one to five arrows, each a word (Review Focus 5)", () => {
    const arrows = (n: number) => Array.from({ length: n }, (_, i) => `เรื่อง${"กขคงจ"[i]}`);
    for (const n of [1, 2, 3, 4, 5]) expect(checkDevice({ ...BARE[7], arrows: arrows(n) }, NONE), String(n)).toEqual({ ...BARE[7], arrows: arrows(n) });
    // every arrow blank is no arrow (final review #5): refused
    for (const bad of [undefined, [], arrows(6), "ก", [1], [""], ["", " ", null], [["ก"]]]) {
      expect(typeof checkDevice({ ...BARE[7], arrows: bad }, NONE), JSON.stringify(bad)).toBe("string");
    }
    // a blank arrow (cleared in the editor) is dropped before the count
    expect(checkDevice({ ...BARE[7], arrows: ["ก", ""] }, NONE)).toEqual({ ...BARE[7], arrows: ["ก"] });
    expect(checkDevice({ ...BARE[7], arrows: [...arrows(5), " "] }, NONE)).toEqual({ ...BARE[7], arrows: arrows(5) });
  });
  it("housepillar and seedtree: label, spare, from and to are optional, never carried empty", () => {
    expect(checkDevice({ ...BARE[1], label: "", spare: "  " }, NONE)).toEqual(BARE[1]);
    expect(checkDevice({ ...BARE[4], from: null, to: null }, NONE)).toEqual(BARE[4]);
    expect(typeof checkDevice({ ...BARE[1], label: 3 }, NONE)).toBe("string");
  });
  it("holds a metaphor word to the script's forbidden words too", () => {
    const sample = "ไม่ต้องตรวจสุขภาพ";
    expect(typeof checkDevice({ ...FULL[0], note: sample }, NONE)).toBe("string");
    expect(typeof checkDevice({ ...FULL[7], arrows: ["เอไอเอ"] }, NONE)).toBe("string");
  });
  it("is refused the way a forged-figure device is: checkScene names the device, checkScript the scene", () => {
    const scene: PromptScene = { voice: "ซื้อประกันเหมือนพกร่ม", screen: "พกร่มไว้ก่อน", picture: "ร่ม", device: { ...FULL[0], note: "ปีละ 500" } as never };
    expect(checkScene(scene, NONE).some((r) => r.startsWith("device:") && r.includes("ตัวเลข"))).toBe(true);
    expect(checkScript([scene], "")).toEqual([{ scene: 0, reasons: [expect.stringContaining("device: note")] }]);
    const ok: PromptScene = { ...scene, device: FULL[0] as never };
    expect(checkScript([ok], "")).toEqual([]);
  });
  it("an unknown metaphor layout is still unknown", () => {
    expect(typeof checkDevice({ layout: "kite", title: T }, NONE)).toBe("string");
  });
});
