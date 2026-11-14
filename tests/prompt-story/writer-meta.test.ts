import { describe, expect, it, vi } from "vitest";
import { writeStory } from "@/lib/prompt-story/writer";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { checkDevice, deviceAllowed } from "@/lib/prompt-story/check";
import { deviceFields, deviceReason, pictureCount, sceneKind, setDeviceWord } from "@/lib/prompt-story/editor-state";
import { pictureScenes, promptPicturesPrice, type DeviceScene } from "@/lib/prompt-story/types";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { META_LAYOUTS, type MetaLayout } from "@/lib/quote-video/story-knowledge";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

/**
 * The eight อุปมา devices in คลิปตามโจทย์ (device round 3, Task 6): the writer offers them, keeps one whose words
 * are digit-free and within the limits, and paints the scene of one that is not (Review Focus 1).
 */

const BRIEF = "ลูกค้าเป็นฟรีแลนซ์ ไม่มีสวัสดิการ กลัวว่าซื้อประกันเหมือนแช่งตัวเอง อยากรู้ว่าออมกับประกันต่างกันอย่างไร";
const T: [string, string] = ["ประกันเหมือนร่ม", "กางไว้ก่อนฝนตก"];

const GOOD: Record<MetaLayout, DeviceScene> = {
  umbrella: { layout: "umbrella", title: T, note: "กางไว้ก่อน ไม่ได้แช่งฝน" },
  housepillar: { layout: "housepillar", title: ["เสาหลักของบ้าน", "ถ้าเสาล้ม"], note: "ทั้งบ้านรับไม่ไหว", label: "รายได้", spare: "ประกัน" },
  lifering: { layout: "lifering", title: ["ห่วงชูชีพ", "มาทันเวลา"] },
  safetynet: { layout: "safetynet", title: ["ตาข่ายนิรภัย", "รับตอนพลาด"], note: "ฟรีแลนซ์ไม่มีสวัสดิการ" },
  seedtree: { layout: "seedtree", title: ["เริ่มทีละน้อย", "โตเป็นต้นไม้"], from: "วันนี้", to: "วันข้างหน้า" },
  balance: { layout: "balance", title: ["ออมกับประกัน", "ต่างหน้าที่"], sides: ["ออม", "ประกัน"], tilt: "even" },
  bridge: { layout: "bridge", title: ["สะพาน", "ข้ามช่วงยาก"], note: "ตอนป่วยแล้วรายได้หาย" },
  shield: { layout: "shield", title: ["โล่กันลูกศร", "เรื่องร้ายที่มา"], arrows: ["ป่วยหนัก", "อุบัติเหตุ", "รายได้หาย"] },
};

const sc = (o: Record<string, unknown> = {}) => ({ voice: "เตรียมไว้ก่อนดีกว่าค่ะ", screen: "เตรียมไว้ก่อน", picture: "ผู้หญิงกางร่มกลางสายฝน", showFigure: false, ...o });
const reply = (scenes: unknown[]) => JSON.stringify({ onTopic: true, refusal: "", title: "เตรียมไว้ก่อน", caption: "ลองเช็กกันค่ะ", scenes });
const write = async (scenes: unknown[]) => {
  const r = await writeStory({ brief: BRIEF, scenes: 3, ask: vi.fn().mockResolvedValue(reply(scenes)) });
  if (!r.ok) throw new Error("not ok");
  return r;
};

describe("writeStory with the eight อุปมา devices", () => {
  for (const key of META_LAYOUTS) {
    it(`keeps a ${key}, drawn in place of the picture`, async () => {
      const r = await write([sc(), sc({ picture: "", device: GOOD[key] }), sc()]);
      expect(r.scenes[1].device).toEqual(GOOD[key]);
      expect(r.scenes[1].picture).toBe("");
      expect(r.notes).toEqual([]);
    });
  }

  it("a null or missing second title line is a blank one, not a refusal", async () => {
    for (const title of [["ก", null], ["ก"]]) {
      const d = { ...GOOD.umbrella, title };
      expect(checkDevice(d, deviceAllowed(BRIEF))).toEqual({ ...GOOD.umbrella, title: ["ก", ""] });
      const r = await write([sc({ device: d }), sc(), sc()]);
      expect(r.scenes[0].device).toEqual({ ...GOOD.umbrella, title: ["ก", ""] });
    }
  });

  // Review Focus 1: a digit or an over-long word is never drawn; the scene is painted
  const BAD: [string, Record<string, unknown>][] = [
    ["a digit in umbrella's title", { ...GOOD.umbrella, title: ["ร่ม 2 คัน", ""] }],
    ["a Thai digit in umbrella's note", { ...GOOD.umbrella, note: "กางไว้ ๓ ครั้ง" }],
    ["a digit in housepillar's label", { ...GOOD.housepillar, label: "รายได้ 1" }],
    ["a digit in housepillar's spare", { ...GOOD.housepillar, spare: "ประกัน5" }],
    ["a digit in seedtree's from", { ...GOOD.seedtree, from: "ปี 2569" }],
    ["a digit in seedtree's to", { ...GOOD.seedtree, to: "อีก 20 ปี" }],
    ["a digit in a balance side", { ...GOOD.balance, sides: ["ออม", "ประกัน 1"] }],
    ["a digit in a shield arrow", { ...GOOD.shield, arrows: ["ป่วยหนัก", "ค่ารักษา 1 ล้าน"] }],
    ["an over-long shield arrow", { ...GOOD.shield, arrows: ["ป่วยหนักจนต้องหยุดงานนาน"] }],
    ["six shield arrows", { ...GOOD.shield, arrows: ["ก", "ข", "ค", "ง", "จ", "ฉ"] }],
    ["no shield arrow", { ...GOOD.shield, arrows: [] }],
    ["an unknown balance tilt", { ...GOOD.balance, tilt: "up" }],
    ["one balance side", { ...GOOD.balance, sides: ["ออม"] }],
    ["an over-long title line", { ...GOOD.lifering, title: ["ห่วงชูชีพที่โยนให้คนจมน้ำทันที", ""] }],
    ["an over-long note", { ...GOOD.bridge, note: "ก".repeat(35) }],
    ["a forbidden word in a note", { ...GOOD.bridge, note: "การันตีว่าข้ามได้" }],
  ];
  for (const [what, device] of BAD) {
    it(`${what}: the device is dropped and the scene painted`, async () => {
      const r = await write([sc({ picture: "", screen: "ร่มกันฝนค่ะ", device }), sc({ picture: "ผู้หญิงยิ้ม", device }), sc()]);
      expect(r.scenes[0].device).toBeUndefined();
      expect(r.scenes[0].picture).toBeTruthy();
      expect(r.scenes[0].picture).not.toMatch(/\d/);
      expect(r.scenes[1].device).toBeUndefined();
      expect(r.scenes[1].picture).toBe("ผู้หญิงยิ้ม");
      expect(r.notes).toEqual([]);
    });
  }

  it("keeps a 14-letter arrow and five arrows, a 3-state tilt", async () => {
    const d = { ...GOOD.shield, arrows: ["ก".repeat(14), "ข", "ค", "ง", "จ"] };
    expect((await write([sc({ device: d }), sc(), sc()])).scenes[0].device).toEqual(d);
    for (const tilt of ["left", "right", "even"]) {
      const b = { ...GOOD.balance, tilt };
      expect((await write([sc({ device: b }), sc(), sc()])).scenes[0].device).toEqual(b);
    }
  });
});

describe("the system prompt for the อุปมา devices", () => {
  const systemOf = async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
    await writeStory({ brief: BRIEF, scenes: 3, ask });
    return ask.mock.calls[0][0] as string;
  };

  it("lists the eight with their JSON shapes, free of the words no script may say", async () => {
    const system = await systemOf();
    const lines = system.split("\n").filter((l) => META_LAYOUTS.some((k) => l.startsWith(`- ${k} (`)));
    expect(lines).toHaveLength(8);
    for (const l of lines) for (const x of FORBIDDEN) expect(x.re.test(l), `${x.why}: ${l}`).toBe(false);
    expect(lines.find((l) => l.startsWith("- balance"))).toContain('"sides"');
    expect(lines.find((l) => l.startsWith("- shield"))).toContain('"arrows"');
  });
});

describe("the script editor with the อุปมา devices", () => {
  const labels = (d: DeviceScene) => deviceFields(d).words.map((w) => w.label);
  const T2 = ["หัวข้อ บรรทัด 1", "หัวข้อ บรรทัด 2"];

  it("names each word field in Thai, no figures", () => {
    expect(labels(GOOD.umbrella)).toEqual([...T2, "บรรทัดใต้ภาพ"]);
    expect(labels(GOOD.housepillar)).toEqual([...T2, "บรรทัดใต้ภาพ", "คำบนเสา", "เสาสำรอง"]);
    expect(labels(GOOD.seedtree)).toEqual([...T2, "บรรทัดใต้ภาพ", "คำใต้ภาพซ้าย", "คำใต้ภาพขวา"]);
    expect(labels(GOOD.balance)).toEqual([...T2, "บรรทัดใต้ภาพ", "สองข้างตาชั่ง 1", "สองข้างตาชั่ง 2", "ตาชั่งเอียง"]);
    expect(labels(GOOD.shield)).toEqual([...T2, "บรรทัดใต้ภาพ", "ลูกศร 1", "ลูกศร 2", "ลูกศร 3"]);
    for (const k of META_LAYOUTS) expect(deviceFields(GOOD[k]).numbers).toEqual([]);
  });

  it("shows the tilt in Thai and takes it back in Thai", () => {
    const tilt = (d: DeviceScene) => deviceFields(d).words.find((w) => w.path[0] === "tilt");
    expect(tilt({ ...GOOD.balance, tilt: "left" } as DeviceScene)?.value).toBe("ซ้าย");
    expect(tilt({ ...GOOD.balance, tilt: "right" } as DeviceScene)?.value).toBe("ขวา");
    expect(tilt(GOOD.balance)?.value).toBe("เท่ากัน");
    expect(setDeviceWord(GOOD.balance, ["tilt"], "ซ้าย")).toEqual({ ...GOOD.balance, tilt: "left" });
    expect(setDeviceWord(GOOD.balance, ["tilt"], "ขวา")).toEqual({ ...GOOD.balance, tilt: "right" });
    expect(setDeviceWord(GOOD.balance, ["tilt"], "เท่ากัน")).toEqual({ ...GOOD.balance, tilt: "even" });
    // anything else typed stays, and the check refuses it
    const typed = setDeviceWord(GOOD.balance, ["tilt"], "เอียงมาก");
    expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: typed }, deviceAllowed(BRIEF)).kind).toBe("broken");
  });

  it("edits a word and re-checks it with the same rules: a digit breaks the scene in Thai", () => {
    const edited = setDeviceWord(GOOD.shield, ["arrows", 1], "ป่วย 1 ครั้ง");
    const k = sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: edited }, deviceAllowed(BRIEF));
    expect(k).toEqual({ kind: "broken", reason: "ลูกศร มีตัวเลข", name: "โล่กันลูกศร" });
    expect(sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: setDeviceWord(GOOD.shield, ["arrows", 1], "ตกงาน") }, deviceAllowed(BRIEF)).kind).toBe("device");
  });

  it("says the metaphor fields in Thai in a reason", () => {
    const r = (d: DeviceScene) => {
      const k = sceneKind({ voice: "ก", screen: "ก", picture: "ก", device: d }, deviceAllowed(BRIEF));
      return k.kind === "broken" ? k.reason : "";
    };
    expect(r({ ...GOOD.umbrella, note: "ก".repeat(35) } as DeviceScene)).toMatch(/^บรรทัดใต้ภาพ /);
    expect(r({ ...GOOD.housepillar, spare: "ก".repeat(13) } as DeviceScene)).toMatch(/^เสาสำรอง /);
    expect(r({ ...GOOD.housepillar, label: "ก".repeat(13) } as DeviceScene)).toMatch(/^คำบนเสา /);
    expect(r({ ...GOOD.seedtree, from: "ก".repeat(13) } as DeviceScene)).toMatch(/^คำใต้ภาพซ้าย /);
    expect(r({ ...GOOD.seedtree, to: "ก".repeat(13) } as DeviceScene)).toMatch(/^คำใต้ภาพขวา /);
    expect(r({ ...GOOD.balance, sides: ["ก"] } as unknown as DeviceScene)).toMatch(/^สองข้างตาชั่ง /);
    expect(r({ ...GOOD.balance, tilt: "up" } as unknown as DeviceScene)).toBe("ตาชั่งเอียง ต้องเป็น ซ้าย ขวา หรือ เท่ากัน");
    expect(deviceReason("title: ว่างอยู่")).toBe("หัวข้อ ว่างอยู่");
  });
});

describe("checkedPromptStory and the price with the อุปมา devices", () => {
  const base = { draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "t", caption: "c", style: "paper", painter: "standard" };

  it("keeps the eight as devices, never charged as pictures", () => {
    const keys = [...META_LAYOUTS];
    for (let i = 0; i < keys.length; i += 3) {
      const scenes = keys.slice(i, i + 3).map((k) => sc({ picture: "", device: GOOD[k] }));
      while (scenes.length < 3) scenes.push(sc());
      const form = checkedPromptStory({ ...base, scenes }, "F");
      if (typeof form === "string") throw new Error(form);
      keys.slice(i, i + 3).forEach((k, j) => expect(form.scenes[j].device).toEqual(GOOD[k]));
      expect(pictureScenes(form)).toBe(3 - keys.slice(i, i + 3).length);
    }
  });

  it("drops a device with a digit: the scene is painted and priced as a picture, as the editor counts it", () => {
    const scenes = [sc({ device: { ...GOOD.shield, arrows: ["ป่วย 1 ครั้ง"] } }), sc({ picture: "", device: GOOD.balance }), sc()];
    const form = checkedPromptStory({ ...base, scenes }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes[0].device).toBeUndefined();
    expect(form.scenes[1].device).toEqual(GOOD.balance);
    expect(pictureScenes(form)).toBe(2);
    expect(pictureCount(scenes as never, deviceAllowed(BRIEF))).toBe(2);
    const one = promptPicturesPrice({ ...form, scenes: [form.scenes[2]] }, DEFAULT_PRICES);
    expect(promptPicturesPrice(form, DEFAULT_PRICES)).toBe(2 * one);
  });
});
