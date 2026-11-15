import { describe, expect, it, vi } from "vitest";
import { writeStory } from "@/lib/prompt-story/writer";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { checkDevice, deviceAllowed } from "@/lib/prompt-story/check";
import { deviceFields, deviceReason, pictureCount, sceneKind, setDeviceWord } from "@/lib/prompt-story/editor-state";
import { pictureScenes, type DeviceScene } from "@/lib/prompt-story/types";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { SAVE_LAYOUTS, SAVE_LIMITS, type SaveLayout } from "@/lib/quote-video/story-knowledge";

/**
 * The four ออมเงิน devices in คลิปตามโจทย์ (device round 4, Task 6): the writer offers them, keeps one whose words
 * are digit-free and whose figures the brief writes, and paints the scene of one that is not.
 */

const BRIEF = "ลูกค้าชาย อายุ 40 ปี ส่งเบี้ยปีละ 136,220 บาท 20 ปี ตั้งแต่อายุ 40 ถึง 59 รวมส่ง 2,724,410 บาท เริ่มรับบำนาญตอนอายุ 60 ถึง 95 รวม 6,023,625 บาท ช่วง 60 ถึง 75 ได้ปีละ 118,110 บาท ช่วง 76 ถึง 80 ได้ปีละ 157,480 บาท ช่วง 81 ถึง 95 ได้ปีละ 196,851 บาท";
const T: [string, string] = ["ส่งทีละปี", "ก้อนโตขึ้นเรื่อยๆ"];

const GOOD: Record<SaveLayout, DeviceScene> = {
  savejar: { layout: "savejar", title: T, note: "ส่งสม่ำเสมอทุกปี", years: 20, paid: 2_724_410 },
  paidgot: { layout: "paidgot", title: ["ส่งเท่าไร", "ได้คืนเท่าไร"], paid: 2_724_410, got: 6_023_625, payFrom: 40, payTo: 59, getFrom: 60, getTo: 95 },
  pricerise: { layout: "pricerise", title: ["เงินเท่าเดิม", "ซื้อได้น้อยลง"], note: "ราคาของสูงขึ้นทุกปี" },
  pensionsteps: { layout: "pensionsteps", title: ["บำนาญขั้นบันได", ""], rows: [{ from: 60, to: 75, annual: 118_110 }, { from: 76, to: 80, annual: 157_480 }, { from: 81, to: 95, annual: 196_851 }] },
};

const sc = (o: Record<string, unknown> = {}) => ({ voice: "เตรียมไว้ก่อนดีกว่าค่ะ", screen: "เตรียมไว้ก่อน", picture: "ผู้หญิงนั่งวางแผนที่โต๊ะ", showFigure: false, ...o });
const reply = (scenes: unknown[]) => JSON.stringify({ onTopic: true, refusal: "", title: "เตรียมไว้ก่อน", caption: "ลองเช็กกันค่ะ", scenes });
const write = async (scenes: unknown[], brief = BRIEF) => {
  const r = await writeStory({ brief, scenes: 5, ask: vi.fn().mockResolvedValue(reply(scenes)) });
  if (!r.ok) throw new Error("not ok");
  return r;
};

describe("writeStory with the four ออมเงิน devices", () => {
  for (const key of SAVE_LAYOUTS) {
    it(`keeps a ${key}, drawn in place of the picture`, async () => {
      const r = await write([sc(), sc({ picture: "", device: GOOD[key] }), sc(), sc(), sc()]);
      expect(r.scenes[1].device).toEqual(GOOD[key]);
      expect(r.scenes[1].picture).toBe("");
      expect(r.notes).toEqual([]);
    });
  }

  const BAD: [string, Record<string, unknown>][] = [
    ["a savejar years not in the brief", { ...GOOD.savejar, years: 25 }],
    ["a savejar paid not in the brief", { ...GOOD.savejar, paid: 3_000_000 }],
    ["a paidgot got not in the brief", { ...GOOD.paidgot, got: 7_000_000 }],
    ["a paidgot with only paid", { layout: "paidgot", title: T, paid: 2_724_410 }],
    ["a paidgot with only got", { layout: "paidgot", title: T, got: 6_023_625 }],
    ["a paidgot age not in the brief", { ...GOOD.paidgot, payFrom: 33 }],
    ["a pensionsteps annual not in the brief", { layout: "pensionsteps", title: T, rows: [{ from: 60, to: 75, annual: 120_000 }] }],
    ["pensionsteps without rows", { layout: "pensionsteps", title: T, rows: [] }],
    ["six pensionsteps rows", { layout: "pensionsteps", title: T, rows: Array.from({ length: 6 }, () => ({ from: 60, to: 75, annual: 118_110 })) }],
    ["pensionsteps rows not ascending", { layout: "pensionsteps", title: T, rows: [{ from: 76, to: 80, annual: 157_480 }, { from: 60, to: 75, annual: 118_110 }] }],
    ["pensionsteps rows starting together", { layout: "pensionsteps", title: T, rows: [{ from: 60, to: 75, annual: 118_110 }, { from: 60, to: 80, annual: 157_480 }] }],
    ["pensionsteps row with from above to", { layout: "pensionsteps", title: T, rows: [{ from: 75, to: 60, annual: 118_110 }] }],
    ["a digit in savejar's title", { ...GOOD.savejar, title: ["ส่ง 20 ปี", ""] }],
    ["a Thai digit in pricerise's note", { ...GOOD.pricerise, note: "ราคาขึ้น ๕ เท่า" }],
    ["a digit in pensionsteps' note", { ...GOOD.pensionsteps, note: "ปีละ 118110" }],
    ["a return word in paidgot's note", { ...GOOD.paidgot, note: "ผลตอบแทนดี" }],
    ["IRR in savejar's note", { ...GOOD.savejar, note: "IRR สูง" }],
    ["a percent in pricerise's title", { ...GOOD.pricerise, title: ["ราคาขึ้น", "ปีละ %"] }],
    ["an over-long title line", { ...GOOD.savejar, title: ["ก".repeat(SAVE_LIMITS.titleLine + 1), ""] }],
    ["an over-long note", { ...GOOD.pricerise, note: "ก".repeat(SAVE_LIMITS.note + 1) }],
  ];
  for (const [what, device] of BAD) {
    it(`${what}: the device is dropped and the scene painted`, async () => {
      const r = await write([sc({ picture: "", screen: "เก็บเงินไว้ใช้ค่ะ", device }), sc({ picture: "ผู้หญิงยิ้ม", device }), sc(), sc(), sc()]);
      expect(r.scenes[0].device).toBeUndefined();
      expect(r.scenes[0].picture).toBeTruthy();
      expect(r.scenes[0].picture).not.toMatch(/\d/);
      expect(r.scenes[1].device).toBeUndefined();
      expect(r.scenes[1].picture).toBe("ผู้หญิงยิ้ม");
    });
  }

  it("a savejar without figures, and a pricerise, need no number in the brief", async () => {
    const plain = "ลูกค้าอยากเก็บเงินไว้ใช้ตอนเกษียณ";
    const bare = { layout: "savejar", title: T };
    expect((await write([sc({ device: bare }), sc({ device: GOOD.pricerise }), sc(), sc(), sc()], plain)).scenes.slice(0, 2).map((s) => s.device)).toEqual([bare, GOOD.pricerise]);
  });
});

describe("the system prompt for the ออมเงิน devices", () => {
  it("lists the four with their JSON shapes, free of the words no script may say, and tells the limits", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
    await writeStory({ brief: BRIEF, scenes: 3, ask });
    const system = ask.mock.calls[0][0] as string;
    const lines = system.split("\n").filter((l) => SAVE_LAYOUTS.some((k) => l.startsWith(`- ${k} (`)));
    expect(lines).toHaveLength(4);
    for (const l of lines) for (const x of FORBIDDEN) expect(x.re.test(l), `${x.why}: ${l}`).toBe(false);
    expect(lines.find((l) => l.startsWith("- paidgot"))).toContain('"got"');
    expect(lines.find((l) => l.startsWith("- pensionsteps"))).toContain('"annual"');
    expect(system).toContain(`ไม่เกิน ${SAVE_LIMITS.titleLine} ตัวอักษร note ไม่เกิน ${SAVE_LIMITS.note}`);
    expect(system).toContain("1,000,000,000");
  });
});

describe("the script editor with the ออมเงิน devices", () => {
  const T2 = ["หัวข้อ บรรทัด 1", "หัวข้อ บรรทัด 2"];
  const labels = (d: DeviceScene) => deviceFields(d).words.map((w) => w.label);

  it("names the words and shows the figures in Thai, never typed", () => {
    expect(labels(GOOD.savejar)).toEqual([...T2, "บรรทัดใต้ภาพ"]);
    expect(deviceFields(GOOD.savejar).numbers).toEqual([{ label: "ปีที่ส่ง", value: "20" }, { label: "ยอดส่งรวม", value: "2,724,410" }]);
    expect(deviceFields(GOOD.paidgot).numbers).toEqual([
      { label: "ยอดส่งรวม", value: "2,724,410" }, { label: "บำนาญรวม", value: "6,023,625" },
      { label: "อายุเริ่มส่ง", value: "40" }, { label: "อายุส่งถึง", value: "59" }, { label: "อายุเริ่มรับ", value: "60" }, { label: "อายุรับถึง", value: "95" },
    ]);
    expect(labels(GOOD.pricerise)).toEqual([...T2, "บรรทัดใต้ภาพ"]);
    expect(deviceFields(GOOD.pricerise).numbers).toEqual([]);
    expect(deviceFields(GOOD.pensionsteps).numbers).toEqual([
      { label: "ช่วงอายุ 1", value: "60–75" }, { label: "บำนาญต่อปี 1", value: "118,110" },
      { label: "ช่วงอายุ 2", value: "76–80" }, { label: "บำนาญต่อปี 2", value: "157,480" },
      { label: "ช่วงอายุ 3", value: "81–95" }, { label: "บำนาญต่อปี 3", value: "196,851" },
    ]);
  });

  it("another device's fields keep their names (years is จำนวนปี elsewhere)", () => {
    expect(deviceFields({ layout: "lifeneed", title: ["ก", ""], years: 15 }).numbers).toEqual([{ label: "จำนวนปี", value: "15" }]);
    expect(deviceFields({ layout: "umbrella", title: ["ก", ""], note: "ข" }).words.map((w) => w.label)).toEqual([...T2, "บรรทัดใต้ภาพ"]);
  });

  it("a word edited is re-checked: a digit breaks the scene, said in Thai", () => {
    const bad = setDeviceWord(GOOD.savejar, ["note"], "ส่ง 20 ปี");
    expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: bad }, deviceAllowed(BRIEF))).toEqual({ kind: "broken", reason: "บรรทัดใต้ภาพ มีตัวเลข", name: "กระปุกโตทุกปี" });
    expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: setDeviceWord(GOOD.savejar, ["note"], "ส่งทุกปี") }, deviceAllowed(BRIEF)).kind).toBe("device");
  });

  it("a figure not in the brief breaks the scene, the field said in Thai with its figure as 7,000,000", () => {
    const k = sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: { ...GOOD.paidgot, got: 7_000_000 } as DeviceScene }, deviceAllowed(BRIEF));
    expect(k).toMatchObject({ kind: "broken", name: "ส่งเท่าไร ได้คืนเท่าไร" });
    expect(k.kind === "broken" && k.reason).toMatch(/^บำนาญรวม .*7,000,000/);
    expect(deviceReason("payFrom: ต้องอยู่ระหว่าง 1 ถึง 99", "paidgot")).toBe("อายุเริ่มส่ง ต้องอยู่ระหว่าง 1 ถึง 99");
    expect(deviceReason("years: ต้องอยู่ระหว่าง 1 ถึง 60", "savejar")).toBe("ปีที่ส่ง ต้องอยู่ระหว่าง 1 ถึง 60");
    expect(deviceReason("rows: ต้องเรียงตามอายุจากน้อยไปมาก", "pensionsteps")).toBe("ช่วงอายุ ต้องเรียงตามอายุจากน้อยไปมาก");
  });

  // the editor accepts exactly what check.ts accepts: the rows rule, every pair of rows
  it("pensionsteps rows: the editor's verdict is checkDevice's, for every pair", () => {
    const allowed = deviceAllowed(BRIEF);
    const sets = [60, 75, 76, 80, 81, 95];
    const kinds: string[] = [];
    for (const f1 of sets) for (const t1 of sets) for (const f2 of sets) for (const t2 of sets) {
      const d: DeviceScene = { layout: "pensionsteps", title: T, rows: [{ from: f1, to: t1, annual: 118_110 }, { from: f2, to: t2, annual: 157_480 }] };
      const checked = typeof checkDevice(d, allowed) !== "string";
      const expected = f1 <= t1 && f2 <= t2 && f2 > f1 && t2 >= t1;
      expect(checked, `${f1}-${t1} ${f2}-${t2}`).toBe(expected);
      expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: d }, allowed).kind).toBe(expected ? "device" : "broken");
      kinds.push(String(checked));
    }
    expect(kinds).toContain("true");
  });
});

describe("checkedPromptStory and the price with the ออมเงิน devices", () => {
  const base = { draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "t", caption: "c", style: "paper", painter: "standard" };

  it("keeps each as a device, never charged as a picture", () => {
    const scenes = [GOOD.savejar, GOOD.paidgot, GOOD.pensionsteps].map((d) => sc({ picture: "", device: d }));
    const form = checkedPromptStory({ ...base, scenes }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes.map((s) => s.device)).toEqual([GOOD.savejar, GOOD.paidgot, GOOD.pensionsteps]);
    expect(pictureScenes(form)).toBe(0);
    expect(pictureCount(form.scenes, deviceAllowed(BRIEF))).toBe(0);
  });

  it("a device with a figure not in the brief is a picture scene again, charged and needing its picture words", () => {
    const scenes = [sc({ picture: "ผู้หญิงยิ้ม", device: { ...GOOD.paidgot, got: 7_000_000 } }), sc(), sc()];
    const form = checkedPromptStory({ ...base, scenes }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes[0].device).toBeUndefined();
    expect(pictureScenes(form)).toBe(3);
  });
});
