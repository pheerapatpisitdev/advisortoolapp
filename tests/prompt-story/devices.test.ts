import { describe, expect, it } from "vitest";
import { checkDevice, checkScript } from "@/lib/prompt-story/check";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { totalLine } from "@/lib/prompt-story/total";
import {
  pictureScenes, PROMPT_FORMATS, promptFreePrice, promptPicturePrice, promptPicturesPrice, promptStoryPrice, SCREEN_MAX,
  type PromptScene, type PromptStoryInput,
} from "@/lib/prompt-story/types";
import { DEFAULT_PRICES, pictureSatang } from "@/lib/wallet/prices";

/**
 * Device scenes in คลิปตามโจทย์ (health devices, Task 8): a scene may carry a system-drawn device in
 * place of its AI picture. Its numbers are checked like the script's; it is never drawn as a
 * picture and never charged as one.
 */

const room = { layout: "room", title: ["ค่าห้อง", "ต่อคืน"], plan: 5500, real: 6000, planName: "Silver" };

describe("checkDevice", () => {
  it("returns a device whose numbers are all allowed", () => {
    expect(checkDevice(room, new Set([5500, 6000]))).toEqual(room);
  });

  it("refuses a number not in the brief or the plan, naming its field", () => {
    const bad = checkDevice({ ...room, real: 7000 }, new Set([5500, 6000]));
    expect(typeof bad).toBe("string");
    expect(bad).toContain("real");
  });

  it("refuses an unknown layout, or no object at all", () => {
    for (const d of [{ ...room, layout: "ask" }, { ...room, layout: "rocket" }, null, "room", 5, []]) {
      expect(typeof checkDevice(d, new Set([5500, 6000]))).toBe("string");
    }
  });

  it("drops keys the device does not have", () => {
    const got = checkDevice({ ...room, picture: "x", colour: "red", __proto__x: 1 }, new Set([5500, 6000]));
    expect(got).toEqual(room);
    expect(Object.keys(got as object).sort()).toEqual(["layout", "plan", "planName", "real", "title"]);
  });

  it("keeps an optional number out when it is not given", () => {
    expect(checkDevice({ layout: "room", title: ["ค่าห้อง", "ต่อคืน"], plan: 5500, planName: "Silver" }, new Set([5500])))
      .toStrictEqual({ layout: "room", title: ["ค่าห้อง", "ต่อคืน"], plan: 5500, planName: "Silver" });
    expect(checkDevice({ layout: "overflow", title: ["ส่วนต่าง", "ที่จ่ายเอง"] }, new Set()))
      .toStrictEqual({ layout: "overflow", title: ["ส่วนต่าง", "ที่จ่ายเอง"] });
  });

  it("refuses a missing required number", () => {
    expect(checkDevice({ layout: "room", title: ["ค่าห้อง", "ต่อคืน"], planName: "Silver" }, new Set([5500]))).toContain("plan");
    expect(checkDevice({ layout: "limit", title: ["วงเงิน", "ต่อปี"], planName: "Gold" }, new Set())).toContain("limit");
  });

  it("refuses a number that is not a whole number above nought, even when allowed", () => {
    const allowed = new Set([0, -5, 1.5, 5500]);
    for (const plan of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "5500"]) {
      const got = checkDevice({ ...room, plan }, allowed);
      expect(typeof got).toBe("string");
      expect(got).toContain("plan");
    }
    for (const age of [0, -30]) {
      expect(checkDevice({ layout: "agecost", title: ["ค่าประกัน", "ตามอายุ"], rows: [{ age, annual: 12000 }], source: "ตามตาราง" }, new Set([age, 12000])))
        .toContain("rows");
    }
  });

  it("checks every number device", () => {
    const allowed = new Set([30, 40, 12000, 18000, 5000, 3000, 100000, 60000, 1000000]);
    const ok = [
      { layout: "limit", title: ["วงเงิน", "ต่อปี"], limit: 1000000, used: 60000, planName: "Gold" },
      { layout: "overflow", title: ["ส่วนต่าง", "ที่จ่ายเอง"], bill: 100000, limit: 60000 },
      { layout: "groupgap", title: ["ประกันกลุ่ม", "ไม่พอ"], bill: 100000, group: 60000 },
      { layout: "agecost", title: ["ค่าประกัน", "ตามอายุ"], rows: [{ age: 30, annual: 12000 }, { age: 40, annual: 18000 }], source: "ตามตาราง" },
    ];
    for (const d of ok) expect(checkDevice(d, allowed)).toEqual(d);
    expect(checkDevice({ ...ok[0], used: 70000 }, allowed)).toContain("used");
    expect(checkDevice({ ...ok[1], bill: 1 }, allowed)).toContain("bill");
    expect(checkDevice({ ...ok[2], group: 2 }, allowed)).toContain("group");
    expect(checkDevice({ ...ok[3], rows: [{ age: 30, annual: 13000 }] }, allowed)).toContain("rows");
  });

  it("checks the word devices", () => {
    const none = new Set<number>();
    const split = { layout: "split", title: ["เหมาจ่าย", "แยกจ่าย"], parts: ["ค่าห้อง", "ค่าหมอ", "ค่ายา"], whole: "วงเงินเดียว" };
    const waiting = { layout: "waiting", title: ["ระยะ", "รอคอย"], rows: [{ at: "วันนี้", label: "กรมธรรม์มีผล" }, { at: "ภายหลัง", label: "โรคทั่วไป" }] };
    const cashless = { layout: "cashless", title: ["เคลม", "ไม่สำรองจ่าย"], note: "ใช้บัตรที่ รพ. ในเครือ" };
    for (const d of [split, waiting, cashless]) expect(checkDevice(d, none)).toEqual(d);
    expect(typeof checkDevice({ ...split, parts: ["1", "2", "3", "4", "5"].map((n) => `ส่วน ${"กขคงจ"[Number(n) - 1]}`) }, none)).toBe("string");
    expect(typeof checkDevice({ ...split, parts: [] }, none)).toBe("string");
    expect(typeof checkDevice({ ...waiting, rows: Array.from({ length: 5 }, () => ({ at: "ภายหลัง", label: "โรค" })) }, none)).toBe("string");
    expect(typeof checkDevice({ ...cashless, note: "" }, none)).toBe("string");
  });

  it("holds every word to the screen's length", () => {
    const long = "ก".repeat(SCREEN_MAX + 1);
    const just = "ก".repeat(SCREEN_MAX);
    expect(checkDevice({ ...room, planName: just }, new Set([5500, 6000]))).toEqual({ ...room, planName: just });
    expect(checkDevice({ ...room, planName: long }, new Set([5500, 6000]))).toContain("planName");
    expect(checkDevice({ ...room, title: [long, "ต่อคืน"] }, new Set([5500, 6000]))).toContain("title");
  });

  it("treats digits in a word field as numbers that must be allowed", () => {
    const waiting = { layout: "waiting", title: ["ระยะ", "รอคอย"], rows: [{ at: "30 วัน", label: "โรคทั่วไป" }] };
    expect(checkDevice(waiting, new Set([30]))).toEqual(waiting);
    const bad = checkDevice(waiting, new Set([120]));
    expect(typeof bad).toBe("string");
    expect(bad).toContain("rows");
    expect(checkDevice({ ...room, planName: "แผน 9" }, new Set([5500, 6000]))).toContain("planName");
  });

  it("holds the words to the script's rules", () => {
    expect(typeof checkDevice({ ...room, planName: "การันตี" }, new Set([5500, 6000]))).toBe("string");
    expect(typeof checkDevice({ layout: "cashless", title: ["เคลม", "ง่าย"], note: "ดีกว่า AIA" }, new Set())).toBe("string");
  });
});

const prices = DEFAULT_PRICES;
const pic = (n: number): PromptScene => ({ voice: `ฉาก${"กขคงจ"[n - 1]}`, screen: "คำบนจอ", picture: "a family" });
const withDevice = (n: number): PromptScene => ({ voice: `ฉาก${"กขคงจ"[n - 1]}`, screen: "คำบนจอ", picture: "", device: { layout: "cashless", title: ["เคลม", "ง่าย"], note: "ไม่ต้องสำรองจ่าย" } });
const clip = (scenes: PromptScene[], over: Partial<PromptStoryInput> = {}): PromptStoryInput => ({
  product: "FREESTORY", brief: "b", title: "t", caption: "c", scenes, style: "paper", painter: "standard", faces: { narrator: "w26" }, ...over,
});

describe("price of a clip with device scenes", () => {
  const five = clip([pic(1), withDevice(2), pic(3), withDevice(4), pic(5)]);
  const each = pictureSatang(prices, "standard")!;

  it("counts the picture scenes only", () => {
    expect(pictureScenes(five)).toBe(3);
    expect(pictureScenes(clip([pic(1), pic(2), pic(3)]))).toBe(3);
  });

  it("charges three pictures for five scenes with two devices", () => {
    expect(promptPicturePrice(five, prices)).toBe(each);
    expect(promptPicturesPrice(five, prices)).toBe(3 * each);
    expect(promptFreePrice(five, prices)).toBe(3 * each);
    expect(promptStoryPrice(five, prices)).toBe(prices.videoPrompt + 3 * each);
    expect(promptStoryPrice({ ...five, voice: "x" }, prices)).toBe(prices.videoPrompt + 3 * each + prices.elevenExtra);
  });

  it("totalLine agrees, and names the pictures it charges", () => {
    const wallet = totalLine({ scenes: 5, pictures: 3, painter: "standard", prices, kind: "wallet" });
    expect(wallet.baht).toBe(String(promptStoryPrice(five, prices) / 100));
    expect(wallet.text).toContain(`รูป 3 × ฿${each / 100}`);
    const free = totalLine({ scenes: 5, pictures: 3, painter: "standard", prices, kind: "free" });
    expect(free.baht).toBe(String(promptFreePrice(five, prices) / 100));
    expect(free.text).toContain("รูป 3 ×");
    // no pictures given: every scene is a picture scene, as before
    expect(totalLine({ scenes: 5, painter: "standard", prices, kind: "wallet" }).baht).toBe(String((prices.videoPrompt + 5 * each) / 100));
  });
});

describe("formats", () => {
  it("are ตามโจทย์, ละครสั้น 3 ฉาก and รีวิวเคสเคลม, in that order", () => {
    expect(PROMPT_FORMATS).toEqual([
      { id: "free", name: "ตามโจทย์" }, { id: "drama3", name: "ละครสั้น 3 ฉาก" }, { id: "claimreview", name: "รีวิวเคสเคลม" },
    ]);
  });
});

const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
const form = (over: Record<string, unknown> = {}) => ({
  draftId: DRAFT, brief: "ค่าห้องแผน 5500 บาท ห้องจริง 6000 บาท", title: "ค่าห้อง", caption: "ทักมาคุยกัน",
  scenes: [1, 2, 3].map((n) => ({ voice: `ประโยคที่ ${n}`, screen: "คำบนจอ", picture: "a family" })),
  style: "paper", painter: "standard", ...over,
});

describe("checkedPromptStory with devices", () => {
  it("keeps a valid device, its picture words not needed", () => {
    const scenes = form().scenes;
    scenes[1] = { voice: "ค่าห้องจริงเกินแผน", screen: "ค่าห้อง", picture: "", device: { ...room, extra: 1 } } as never;
    const v = checkedPromptStory(form({ scenes }), "F") as PromptStoryInput;
    expect(typeof v).toBe("object");
    expect(v.scenes[1]).toStrictEqual({ voice: "ค่าห้องจริงเกินแผน", screen: "ค่าห้อง", picture: "", device: room });
    expect(v.scenes[0].device).toBeUndefined();
    expect(pictureScenes(v)).toBe(2);
  });

  it("drops a device whose number is not in the brief, and keeps the scene as a picture scene", () => {
    const scenes = form().scenes;
    scenes[1] = { ...scenes[1], device: { ...room, real: 7000 } } as never;
    const v = checkedPromptStory(form({ scenes }), "F") as PromptStoryInput;
    expect(typeof v).toBe("object");
    expect("device" in v.scenes[1]).toBe(false);
    expect(v.scenes[1].picture).toBe("a family");
    expect(pictureScenes(v)).toBe(3);
  });

  it("refuses a picture scene with no picture words, by number, before any charge", () => {
    const scenes = form().scenes;
    scenes[2] = { ...scenes[2], picture: " " };
    expect(checkedPromptStory(form({ scenes }), "F")).toBe("ใส่คำบรรยายภาพของฉากที่ 3");
    // a device dropped for its number leaves a picture scene that needs its words
    const dropped = form().scenes;
    dropped[1] = { ...dropped[1], picture: "", device: { ...room, real: 7000 } } as never;
    expect(checkedPromptStory(form({ scenes: dropped }), "F")).toBe("ใส่คำบรรยายภาพของฉากที่ 2");
  });

  it("keeps a format the form chose, and ignores one it does not know", () => {
    for (const f of PROMPT_FORMATS) expect((checkedPromptStory(form({ format: f.id }), "F") as PromptStoryInput).format).toBe(f.id);
    expect("format" in (checkedPromptStory(form({ format: "musical" }), "F") as object)).toBe(false);
  });

  it("a form with no device and no format makes exactly the input it made before", () => {
    const v = checkedPromptStory(form(), "F");
    expect(v).toStrictEqual({
      product: "FREESTORY", draftId: DRAFT, brief: "ค่าห้องแผน 5500 บาท ห้องจริง 6000 บาท", title: "ค่าห้อง", caption: "ทักมาคุยกัน",
      scenes: [1, 2, 3].map((n) => ({ voice: `ประโยคที่ ${n}`, screen: "คำบนจอ", picture: "a family" })),
      style: "paper", painter: "standard", size: "portrait", narrator: "F", faces: { narrator: "w26" },
    });
    expect(promptStoryPrice(v as PromptStoryInput, prices)).toBe(prices.videoPrompt + 3 * pictureSatang(prices, "standard")!);
  });
});

describe("checkScript with devices", () => {
  it("refuses a device scene whose numbers are not in the brief, by scene", () => {
    const scenes: PromptScene[] = [pic(1), { ...pic(2), picture: "", device: { ...room, real: 7000 } as never }, pic(3)];
    const bad = checkScript(scenes, "ค่าห้องแผน 5500 บาท ห้องจริง 6000 บาท");
    expect(bad).toHaveLength(1);
    expect(bad[0].scene).toBe(1);
    expect(bad[0].reasons.join(" ")).toContain("real");
    expect(checkScript([pic(1), { ...pic(2), picture: "", device: room as never }, pic(3)], "ค่าห้องแผน 5500 บาท ห้องจริง 6000 บาท")).toEqual([]);
  });
});
