import { describe, expect, it, vi } from "vitest";
import { writeStory } from "@/lib/prompt-story/writer";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { checkDevice, deviceAllowed } from "@/lib/prompt-story/check";
import { deviceFields, deviceReason, pictureCount, sceneKind, setDeviceWord } from "@/lib/prompt-story/editor-state";
import { pictureScenes, type DeviceScene } from "@/lib/prompt-story/types";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { HEALTH2_LAYOUTS, HEALTH2_LIMITS, HEALTH2_WORDS, type Health2Layout } from "@/lib/quote-video/story-knowledge";
import { DEVICES } from "@/lib/scene-library/devices";

/**
 * The eight สุขภาพเพิ่มเติม devices in คลิปตามโจทย์ (device round 5, Task 6): the writer offers them; a number must be in the
 * brief or one of the device's fixed-source values (health2-fixed.ts); a required number that is neither refuses the device
 * (the scene is painted), an optional one is left off; words are digit-free and say nothing the spec forbids.
 */

/** no number at all: only the fixed-source values can be used */
const PLAIN = "ลูกค้าอยากเข้าใจประกันสุขภาพ";
/** every optional figure written in the brief */
const BRIEF = "ลูกค้าอายุ 35 ปี แผนสุขภาพค่าห้องวันละ 9,000 บาท ผู้ป่วยนอก 12,000 บาทต่อปี ส่วนรับผิดชอบแรก 45,000 บาท บิลโรงพยาบาล 100,000 บาท ร่วมจ่าย 20 ต่ออายุถึง 98";
const T: [string, string] = ["สองประตู", "คนละวงเงิน"];

const GOOD: Record<Health2Layout, DeviceScene> = {
  ipdopd: { layout: "ipdopd", title: T, note: "นอนโรงพยาบาลกับไปหาหมอ", room: 9_000, opd: 12_000, planName: "Gold" },
  deductible: { layout: "deductible", title: ["ส่วนรับผิดชอบแรก", "จ่ายเองก่อน"], deductible: 50_000, bill: 100_000 },
  copay: { layout: "copay", title: ["ร่วมจ่าย", "ส่วนที่เราจ่าย"], percent: 20, bill: 100_000 },
  renew98: { layout: "renew98", title: ["ต่ออายุได้ถึง", "อายุที่แผนกำหนด"], to: 98, age: 35 },
  parentshealth: { layout: "parentshealth", title: ["ประกันให้พ่อแม่", "ลดหย่อนภาษีได้"], cap: 15_000 },
  groupcost: { layout: "groupcost", title: ["ต้นทุนต่อหัว", "ประกันกลุ่ม"], perYear: 2_552, band: "10-25" },
  hospitals: { layout: "hospitals", title: ["โรงพยาบาลในเครือ", "ทั่วประเทศ"], total: 548, rows: [{ province: "กรุงเทพมหานคร", count: 136 }, { province: "ชลบุรี", count: 49 }] },
  paclaim: { layout: "paclaim", title: ["อุบัติเหตุหนึ่งครั้ง", "ประกันจ่ายเท่าไร"], medical: 150_000, weekly: 3_000, weeks: 52 },
};

const sc = (o: Record<string, unknown> = {}) => ({ voice: "เตรียมไว้ก่อนดีกว่าค่ะ", screen: "เตรียมไว้ก่อน", picture: "ผู้หญิงนั่งวางแผนที่โต๊ะ", showFigure: false, ...o });
const reply = (scenes: unknown[]) => JSON.stringify({ onTopic: true, refusal: "", title: "เตรียมไว้ก่อน", caption: "ลองเช็กกันค่ะ", scenes });
const write = async (scenes: unknown[], brief = PLAIN) => {
  const r = await writeStory({ brief, scenes: 5, ask: vi.fn().mockResolvedValue(reply(scenes)) });
  if (!r.ok) throw new Error("not ok");
  return r;
};
const without = (d: DeviceScene, ...keys: string[]) => {
  const o = { ...(d as unknown as Record<string, unknown>) };
  for (const k of keys) delete o[k];
  return o;
};

describe("writeStory with the eight สุขภาพเพิ่มเติม devices", () => {
  // each device's figures that need no brief (fixed sources); the optional bill / age are not in a number-free brief, so they go
  const ALONE: Record<Health2Layout, Record<string, unknown>> = {
    ipdopd: GOOD.ipdopd as unknown as Record<string, unknown>,
    deductible: without(GOOD.deductible, "bill"),
    copay: without(GOOD.copay, "bill"),
    renew98: without(GOOD.renew98, "age"),
    parentshealth: GOOD.parentshealth as unknown as Record<string, unknown>,
    groupcost: without(GOOD.groupcost, "band"),
    hospitals: GOOD.hospitals as unknown as Record<string, unknown>,
    paclaim: GOOD.paclaim as unknown as Record<string, unknown>,
  };
  for (const key of HEALTH2_LAYOUTS) {
    it(`keeps a ${key} on its fixed-source values alone, drawn in place of the picture`, async () => {
      const r = await write([sc(), sc({ picture: "", device: ALONE[key] }), sc(), sc(), sc()]);
      expect(r.scenes[1].device).toEqual(JSON.parse(JSON.stringify(ALONE[key])));
      expect(r.scenes[1].picture).toBe("");
      expect(r.notes).toEqual([]);
    });
    it(`keeps a ${key} with the brief's own optional figures`, async () => {
      const r = await write([sc({ picture: "", device: GOOD[key] }), sc(), sc(), sc(), sc()], BRIEF);
      // a prompt clip never keeps groupcost's head-count band (final re-review 2)
      expect(r.scenes[0].device).toEqual(key === "groupcost" ? JSON.parse(JSON.stringify(without(GOOD.groupcost, "band"))) : GOOD[key]);
    });
  }

  it("a brief's number joins the fixed ones: a deductible the brief writes (45,000), ipdopd's OPD 'none' and 'actual'", async () => {
    const own = { ...GOOD.deductible, deductible: 45_000 };
    const none = { ...GOOD.ipdopd, room: 3_000, opd: "none", planName: "Bronze" };
    const actual = { ...GOOD.ipdopd, room: 21_000, opd: "actual", planName: "Platinum" };
    // at most two devices in five scenes
    const r = await write([sc({ device: own }), sc({ device: none }), sc(), sc(), sc()], BRIEF);
    expect(r.scenes.slice(0, 2).map((s) => s.device)).toEqual([own, none]);
    expect((await write([sc({ device: actual }), sc(), sc(), sc(), sc()], BRIEF)).scenes[0].device).toEqual(actual);
  });

  // spec: a required number neither in the brief nor fixed refuses the device; the scene is painted
  const REFUSED: [string, Record<string, unknown>][] = [
    ["an ipdopd room not on the sheet", { ...GOOD.ipdopd, room: 7_000 }],
    ["an ipdopd opd not on the sheet", { ...GOOD.ipdopd, opd: 13_000 }],
    ["an ipdopd opd of another word", { ...GOOD.ipdopd, opd: "unlimited" }],
    ["a deductible no plan has", { ...GOOD.deductible, deductible: 40_000 }],
    ["a copay percent other than the sheet's", { ...GOOD.copay, percent: 30 }],
    ["a renew98 age other than the sheet's", { ...GOOD.renew98, to: 90 }],
    ["a parentshealth cap other than the tax table's", { ...GOOD.parentshealth, cap: 20_000 }],
    ["a groupcost perYear no group quote has", { ...GOOD.groupcost, perYear: 2_000 }],
    ["a hospitals total other than the list's", { ...GOOD.hospitals, total: 500 }],
    ["a hospitals count other than the province's", { ...GOOD.hospitals, rows: [{ province: "กรุงเทพมหานคร", count: 49 }] }],
    ["a hospitals province not in the list", { ...GOOD.hospitals, rows: [{ province: "เมืองสมมติ", count: 5 }] }],
    ["a hospitals province twice", { ...GOOD.hospitals, rows: [{ province: "ชลบุรี", count: 49 }, { province: "ชลบุรี", count: 49 }] }],
    ["six hospitals rows", { ...GOOD.hospitals, rows: Array.from({ length: HEALTH2_LIMITS.rows + 1 }, () => ({ province: "ชลบุรี", count: 49 })) }],
    ["a paclaim medical no plan has", { ...GOOD.paclaim, medical: 123_456 }],
    ["an ipdopd room and OPD of two different plans (final review 1)", { ...GOOD.ipdopd, room: 1_500, opd: 60_000, planName: "Smart" }],
    ["an ipdopd without its room", { layout: "ipdopd", title: T, opd: 12_000 }],
    ["a digit in ipdopd's title", { ...GOOD.ipdopd, title: ["แผน 9000", ""] }],
    ["a Thai digit in a note", { ...GOOD.deductible, note: "จ่ายเอง ๕ หมื่น" }],
    ["a percent in copay's note", { ...GOOD.copay, note: "จ่ายเอง 20%" }],
    ["a percent sign in a title", { ...GOOD.copay, title: ["ร่วมจ่าย", "ส่วน %"] }],
    ["IRR in groupcost's note", { ...GOOD.groupcost, note: "IRR สูง" }],
    ["a return word in renew98's note", { ...GOOD.renew98, note: "ผลตอบแทนดี" }],
    ["รายวัน in paclaim's note", { ...GOOD.paclaim, note: "ชดเชยรายวัน" }],
    ["รายวัน in paclaim's title", { ...GOOD.paclaim, title: ["ชดเชยรายวัน", ""] }],
    ["an over-long title line", { ...GOOD.parentshealth, title: ["ก".repeat(HEALTH2_LIMITS.titleLine + 1), ""] }],
    ["an over-long note", { ...GOOD.parentshealth, note: "ก".repeat(HEALTH2_LIMITS.note + 1) }],
  ];
  for (const [what, device] of REFUSED) {
    it(`${what}: the device is dropped and the scene painted`, async () => {
      const r = await write([sc({ picture: "", screen: "เตรียมไว้ก่อนค่ะ", device }), sc({ picture: "ผู้หญิงยิ้ม", device }), sc(), sc(), sc()]);
      expect(r.scenes[0].device).toBeUndefined();
      expect(r.scenes[0].picture).toBeTruthy();
      expect(r.scenes[0].picture).not.toMatch(/\d/);
      expect(r.scenes[1].device).toBeUndefined();
      expect(r.scenes[1].picture).toBe("ผู้หญิงยิ้ม");
    });
  }

  // spec: an optional number that cannot be sourced is left off; the device is drawn without it
  const KEPT: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ["a deductible bill not in the brief", { ...GOOD.deductible, bill: 123_456 }, without(GOOD.deductible, "bill")],
    ["a copay bill not in the brief", { ...GOOD.copay, bill: 77_000 }, without(GOOD.copay, "bill")],
    ["a renew98 age not in the brief", GOOD.renew98 as unknown as Record<string, unknown>, without(GOOD.renew98, "age")],
    ["a paclaim weekly no plan has (weeks go with it)", { ...GOOD.paclaim, weekly: 1_234 }, without(GOOD.paclaim, "weekly", "weeks")],
    ["paclaim weeks without a weekly", { ...GOOD.paclaim, weekly: undefined }, without(GOOD.paclaim, "weekly", "weeks")],
    ["paclaim weeks other than the plans' own", { ...GOOD.paclaim, weeks: 30 }, without(GOOD.paclaim, "weeks")],
    ["a groupcost band, whatever the brief says (final re-review 2: a prompt clip never keeps one)", GOOD.groupcost as unknown as Record<string, unknown>, without(GOOD.groupcost, "band")],
    ["a paclaim weekly of another plan than its medical (final review 3)", { ...GOOD.paclaim, medical: 80_000, weekly: 10_000 }, { ...without(GOOD.paclaim, "weekly", "weeks"), medical: 80_000 }],
    ["an ipdopd plan name that is not the matched plan's (final review 1)", { ...GOOD.ipdopd, planName: "Silver" }, without(GOOD.ipdopd, "planName")],
    ["a groupcost band that is not one of the three", { ...GOOD.groupcost, band: "5-9" }, without(GOOD.groupcost, "band")],
  ];
  for (const [what, device, want] of KEPT) {
    it(`${what}: the device is kept without it`, async () => {
      const r = await write([sc({ picture: "", device }), sc(), sc(), sc(), sc()]);
      expect(r.scenes[0].device).toEqual(JSON.parse(JSON.stringify(want)));
      expect(r.scenes[0].picture).toBe("");
    });
  }

  it("a renew98 age at or past the renewal age is left off even when the brief writes it", async () => {
    const r = await write([sc({ device: { ...GOOD.renew98, age: 98 } }), sc(), sc(), sc(), sc()], "ลูกค้าอายุ 98 ปี");
    expect(r.scenes[0].device).toEqual(without(GOOD.renew98, "age"));
  });

  it("the writer's own total for a hospitals list is checked against the list, never trusted", async () => {
    const r = await write([sc({ device: { ...GOOD.hospitals, total: 536 } }), sc(), sc(), sc(), sc()], "ในเครือมี 536 แห่ง");
    expect(r.scenes[0].device).toBeUndefined();
  });
});

describe("the system prompt for the eight สุขภาพเพิ่มเติม devices", () => {
  const ASKED = async (brief = PLAIN) => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
    await writeStory({ brief, scenes: 3, ask });
    return ask.mock.calls[0][0] as string;
  };

  it("lists the eight with their JSON shapes and Thai conditions, free of the words no script may say", async () => {
    const system = await ASKED();
    const lines = system.split("\n").filter((l) => HEALTH2_LAYOUTS.some((k) => l.startsWith(`- ${k} (`)));
    expect(lines).toHaveLength(8);
    for (const l of lines) for (const x of FORBIDDEN) expect(x.re.test(l), `${x.why}: ${l}`).toBe(false);
    for (const k of HEALTH2_LAYOUTS) {
      const info = DEVICES.find((d) => d.key === k)!;
      const line = lines.find((l) => l.startsWith(`- ${k} (`))!;
      expect(line).toContain(info.when);
      expect(line).toContain(`"layout":"${k}"`);
      for (const f of [...info.numberFields, ...info.wordFields]) expect(line, `${k}: ${f}`).toContain(`"${f}"`);
      expect(line).not.toBe("");
    }
    expect(lines.find((l) => l.startsWith("- ipdopd"))).toContain('"none"');
    expect(lines.find((l) => l.startsWith("- ipdopd"))).toContain('"actual"');
    expect(lines.find((l) => l.startsWith("- groupcost"))).not.toContain('"band"');
    expect(lines.find((l) => l.startsWith("- hospitals"))).toContain('"province"');
    expect(lines.find((l) => l.startsWith("- paclaim"))).toContain('"weeks"');
    // the copay's percent is a number field, not a word with a percent sign
    expect(lines.find((l) => l.startsWith("- copay"))).toContain('"percent"');
  });

  it("tells each device's fixed values, the limits, and what the drawer works out itself", async () => {
    const system = await ASKED();
    const rule = system.split("\n").filter((l) => /^- (สุขภาพเพิ่มเติม|ipdopd|deductible|copay|renew98|parentshealth|groupcost|hospitals|paclaim):/.test(l)).join("\n");
    // fixed sources, as the owner's spec words them
    for (const s of ["1,500", "21,000", "6,000", "60,000", "30,000", "50,000", "100,000", "20", "98", "15,000", "2,552", "548", "136", "150,000", "3,000", "52"]) expect(rule, s).toContain(s);
    expect(rule).toContain("ห้ามคิดยอดเอง");
    expect(rule).toContain("รายวัน");
    expect(rule).toContain("ต่อสัปดาห์");
    expect(rule).toContain("ต่อคนต่อปี");
    // the example provinces are the biggest by count, most first (not the file's key order): the five the spec's stills use
    const hosp = rule.split("\n").find((l) => l.startsWith("- hospitals"))!;
    const at = ["กรุงเทพมหานคร 136", "ชลบุรี 49", "ระยอง 38", "ปทุมธานี 30", "สมุทรปราการ 25", "นนทบุรี 22", "สุราษฎร์ธานี 16", "เชียงใหม่ 14"].map((x) => hosp.indexOf(x));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    // the one-plan rules are told (final review 1 to 3)
    expect(rule).toContain("ของแผนเดียวกัน");
    expect(rule).toContain("Gold 9,000 / 12,000");
    expect(system).toContain(`ไม่เกิน ${HEALTH2_LIMITS.titleLine} ตัวอักษร note ไม่เกิน ${HEALTH2_LIMITS.note}`);
    expect(system).toContain(`ไม่เกิน ${HEALTH2_LIMITS.label} ตัวอักษร`);
  });
});

describe("the script editor with the eight สุขภาพเพิ่มเติม devices", () => {
  const T2 = ["หัวข้อ บรรทัด 1", "หัวข้อ บรรทัด 2"];
  const labels = (d: DeviceScene) => deviceFields(d).words.map((w) => w.label);

  it("names each device's figures in the owner's Thai words, never typed", () => {
    expect(deviceFields(GOOD.ipdopd).numbers).toEqual([{ label: "ค่าห้องต่อวัน", value: "9,000" }, { label: "ผู้ป่วยนอกต่อปี", value: "12,000" }]);
    expect(labels(GOOD.ipdopd)).toEqual([...T2, "บรรทัดใต้ภาพ", "ชื่อแผน"]);
    expect(deviceFields(GOOD.deductible).numbers).toEqual([{ label: "ส่วนรับผิดชอบแรก", value: "50,000" }, { label: "ยอดบิล", value: "100,000" }]);
    expect(deviceFields(GOOD.copay).numbers).toEqual([{ label: "ร่วมจ่าย", value: "20%" }, { label: "ยอดบิล", value: "100,000" }]);
    expect(deviceFields(GOOD.renew98).numbers).toEqual([{ label: "ต่ออายุถึงอายุ", value: "98" }, { label: "อายุวันนี้", value: "35" }]);
    expect(deviceFields(GOOD.parentshealth).numbers).toEqual([{ label: "เพดานลดหย่อน", value: "15,000" }]);
    expect(deviceFields(GOOD.groupcost).numbers).toEqual([{ label: "เบี้ยต่อคนต่อปี", value: "2,552" }, { label: "กลุ่มพนักงาน", value: "พนักงาน 10–25 คน" }]);
    expect(deviceFields(GOOD.hospitals).numbers).toEqual([
      { label: "จำนวนโรงพยาบาล", value: "548" },
      { label: "แถว 1 · จำนวนโรงพยาบาล", value: "136" }, { label: "แถว 2 · จำนวนโรงพยาบาล", value: "49" },
    ]);
    expect(labels(GOOD.hospitals)).toEqual([...T2, "บรรทัดใต้ภาพ", "แถว 1 · จังหวัด", "แถว 2 · จังหวัด"]);
    expect(deviceFields(GOOD.paclaim).numbers).toEqual([{ label: "ค่ารักษาต่ออุบัติเหตุ", value: "150,000" }, { label: "ชดเชยต่อสัปดาห์", value: "3,000" }, { label: "จำนวนสัปดาห์", value: "52" }]);
  });

  it("shows ipdopd's two words for the OPD as words", () => {
    expect(deviceFields({ ...GOOD.ipdopd, opd: "none" } as DeviceScene).numbers[1]).toEqual({ label: "ผู้ป่วยนอกต่อปี", value: "แผนนี้ไม่มีวงเงินผู้ป่วยนอกทั่วไป" });
    // the editor says the OPD as the card draws it
    expect(deviceFields({ ...GOOD.ipdopd, opd: "none" } as DeviceScene).numbers[1].value).toBe(HEALTH2_WORDS.noOpd);
    expect(deviceFields({ ...GOOD.ipdopd, opd: "actual" } as DeviceScene).numbers[1]).toEqual({ label: "ผู้ป่วยนอกต่อปี", value: "ตามที่จ่ายจริง" });
  });

  it("another device's fields keep their names (bill, age, to, total, rows elsewhere)", () => {
    expect(deviceFields({ layout: "limit", title: ["ก", ""], limit: 1_000_000, used: 5_000, planName: "ก" }).numbers[0].label).toBe("วงเงิน");
    expect(deviceFields({ layout: "lifeneed", title: ["ก", ""], years: 15 }).numbers).toEqual([{ label: "จำนวนปี", value: "15" }]);
    expect(deviceFields({ layout: "moneysplit", title: ["ก", ""], total: 1_000_000, parts: [{ label: "ลูก", amount: 500_000 }] }).numbers[0]).toEqual({ label: "เงินก้อน", value: "1,000,000" });
  });

  it("a word edited is re-checked: a digit, a percent or รายวัน breaks the scene, said in Thai", () => {
    const allowed = deviceAllowed(PLAIN);
    const scene = (device: DeviceScene) => ({ voice: "ก", screen: "ก", picture: "ก", device });
    expect(sceneKind(scene(setDeviceWord(GOOD.parentshealth, ["note"], "ลดหย่อน 15000")), allowed)).toEqual({ kind: "broken", reason: "บรรทัดใต้ภาพ มีตัวเลข", name: "ประกันสุขภาพให้พ่อแม่" });
    expect(sceneKind(scene(setDeviceWord(GOOD.copay, ["note"], "จ่ายเอง 20%")), allowed).kind).toBe("broken");
    expect(sceneKind(scene(setDeviceWord(GOOD.paclaim, ["note"], "ชดเชยรายวัน")), allowed).kind).toBe("broken");
    expect(sceneKind(scene(setDeviceWord(GOOD.parentshealth, ["note"], "ลดหย่อนตามเกณฑ์")), allowed).kind).toBe("device");
  });

  it("a figure that fails says its field in Thai, with the figure as 123,456", () => {
    const k = sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: { ...GOOD.paclaim, medical: 123_456 } as DeviceScene }, deviceAllowed(PLAIN));
    expect(k).toMatchObject({ kind: "broken", name: "อุบัติเหตุหนึ่งครั้ง" });
    expect(k.kind === "broken" && k.reason).toMatch(/^ค่ารักษาต่ออุบัติเหตุ .*123,456/);
    expect(deviceReason("percent: ต้องเท่ากับ 20", "copay")).toMatch(/^ร่วมจ่าย /);
    expect(deviceReason("to: ต้องอยู่ระหว่าง 1 ถึง 99", "renew98")).toBe("ต่ออายุถึงอายุ ต้องอยู่ระหว่าง 1 ถึง 99");
    expect(deviceReason("perYear: ตัวเลข 2000 ไม่อยู่ในโจทย์", "groupcost")).toMatch(/^เบี้ยต่อคนต่อปี /);
    expect(deviceReason("rows: จังหวัดซ้ำ", "hospitals")).toBe("แถว จังหวัดซ้ำ");
    expect(deviceReason("room: x", "ipdopd")).toBe("ค่าห้องต่อวัน x");
    expect(deviceReason("age: x", "renew98")).toBe("อายุวันนี้ x");
    expect(deviceReason("bill: x", "deductible")).toBe("ยอดบิล x");
    expect(deviceReason("age: x", "paidgot")).toBe("อายุ x");
  });

  // the editor accepts exactly what check.ts accepts
  it("the editor's verdict is checkDevice's, for every good and every refused device", () => {
    const allowed = deviceAllowed(BRIEF);
    for (const key of HEALTH2_LAYOUTS) {
      const d = GOOD[key];
      expect(typeof checkDevice(d, allowed)).not.toBe("string");
      expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: d }, allowed).kind, key).toBe("device");
    }
    for (const bad of [{ ...GOOD.copay, percent: 30 }, { ...GOOD.hospitals, total: 100 }, { ...GOOD.parentshealth, cap: 1 }] as DeviceScene[]) {
      expect(typeof checkDevice(bad, allowed)).toBe("string");
      expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: bad }, allowed).kind).toBe("broken");
    }
  });

  // final review / re-review: the cross-field rules read the same in the editor as in check.ts
  it("the editor agrees on the one-plan rules: ipdopd mixes are broken, a paclaim mix and a groupcost band are kept as drawn without", () => {
    const none = new Set<number>();
    const brief9 = new Set([9_000]);
    const kind = (d: unknown, allowed: Set<number>) => sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: d as DeviceScene }, allowed).kind;
    // ipdopd: two sheet figures of two plans; and a brief figure beside a sheet figure of another plan
    for (const [d, allowed] of [
      [{ ...GOOD.ipdopd, room: 1_500, opd: 60_000, planName: "Smart" }, none],
      [{ ...GOOD.ipdopd, room: 21_000, opd: 6_000 }, none],
      [{ ...GOOD.ipdopd, room: 9_000, opd: 60_000, planName: "Diamond" }, brief9],
    ] as [DeviceScene, Set<number>][]) {
      expect(typeof checkDevice(d, allowed)).toBe("string");
      expect(kind(d, allowed)).toBe("broken");
    }
    // the legitimate one: the brief says the room, the sheet's OPD completes Gold's pair
    const gold = { ...GOOD.ipdopd, room: 9_000, opd: 12_000, planName: "GOLD" };
    expect(checkDevice(gold, brief9)).toMatchObject({ planName: "Gold" });
    expect(kind(gold, brief9)).toBe("device");
    // paclaim: Classic A's medical with Platinum 05's weekly: the device stays, its weekly is dropped (never refused)
    const mix = { ...GOOD.paclaim, medical: 80_000, weekly: 10_000, weeks: 52 };
    expect(checkDevice(mix, none)).toEqual({ ...without(GOOD.paclaim, "weekly", "weeks"), medical: 80_000 });
    expect(kind(mix, none)).toBe("device");
    // groupcost: a band is dropped in a prompt clip, the device stays
    expect(checkDevice(GOOD.groupcost, deviceAllowed("พนักงาน 20 คน"))).toEqual(without(GOOD.groupcost, "band"));
    expect(kind(GOOD.groupcost, deviceAllowed("พนักงาน 20 คน"))).toBe("device");
  });
});

describe("checkedPromptStory and the price with the eight สุขภาพเพิ่มเติม devices", () => {
  const base = { draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "t", caption: "c", style: "paper", painter: "standard" };

  it("keeps each as a device, never charged as a picture", () => {
    const scenes = HEALTH2_LAYOUTS.map((k) => sc({ picture: "", device: GOOD[k] }));
    const form = checkedPromptStory({ ...base, scenes }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes.map((s) => s.device)).toEqual(HEALTH2_LAYOUTS.map((k) => (k === "groupcost" ? without(GOOD.groupcost, "band") : GOOD[k])));
    expect(pictureScenes(form)).toBe(0);
    expect(pictureCount(form.scenes, deviceAllowed(BRIEF))).toBe(0);
  });

  it("a device with a figure not in the brief or the sources is a picture scene again, charged", () => {
    const scenes = [sc({ picture: "ผู้หญิงยิ้ม", device: { ...GOOD.paclaim, medical: 123_456 } }), sc(), sc()];
    const form = checkedPromptStory({ ...base, scenes }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes[0].device).toBeUndefined();
    expect(pictureScenes(form)).toBe(3);
  });
});
