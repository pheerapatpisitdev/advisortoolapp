import { describe, expect, it } from "vitest";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { deviceAllowed } from "@/lib/prompt-story/check";
import {
  deviceFields, deviceReason, missingPicture, needPictureWords, pictureCount, pictureFromScreen, rewritesLeft, sceneKind, setDeviceWord, toPicture,
} from "@/lib/prompt-story/editor-state";
import { pictureScenes, REWRITES_DONE, type DeviceScene, type PromptScene } from "@/lib/prompt-story/types";

/** the script editor's sums and moves (health devices, Task 10) */

const BRIEF = "ลูกค้าอายุ 35 ค่าห้องจริงคืนละ 6,000 แผนจ่ายคืนละ 5,500 วงเงินปีละ 1 ล้าน";
const allowed = deviceAllowed(BRIEF);
const room: DeviceScene = { layout: "room", title: ["ค่าห้อง", "ต่อคืน"], plan: 5500, real: 6000, planName: "Silver" };
const pic = (over: Partial<PromptScene> = {}): PromptScene => ({ voice: "ฉากนี้ค่ะ", screen: "ค่าห้องแพงขึ้น", picture: "ผู้หญิงนั่งคิด", ...over });

describe("sceneKind and pictureCount", () => {
  it("a scene with no device is a picture; a passing device is the device, by its Thai name", () => {
    expect(sceneKind(pic(), allowed)).toEqual({ kind: "picture" });
    expect(sceneKind(pic({ device: room }), allowed)).toEqual({ kind: "device", device: room, name: "ค่าห้องต่อคืน" });
  });

  it("a device with a figure the brief does not give is broken, its reason in Thai", () => {
    const k = sceneKind(pic({ device: { ...room, real: 7000 } }), allowed);
    expect(k.kind).toBe("broken");
    expect(k).toEqual({ kind: "broken", reason: "ค่าห้องจริง ตัวเลข 7,000 ไม่อยู่ในโจทย์หรือแผน", name: "ค่าห้องต่อคืน" });
  });

  it("counts a broken device as a picture, exactly as the server charges", () => {
    const scenes = [pic({ device: room }), pic(), pic({ device: { ...room, plan: 4000 } }), pic({ device: room, picture: "" })];
    expect(pictureCount(scenes, allowed)).toBe(2);
    const checked = checkedPromptStory({
      draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "ค่าห้อง", caption: "", scenes: [...scenes, pic()],
      style: "paper", painter: "standard",
    }, "F");
    expect(typeof checked).toBe("object");
    expect(pictureScenes(checked as never)).toBe(pictureCount([...scenes, pic()], allowed));
  });

  it("counts a device with a forbidden word as a picture, as the server does", () => {
    const scenes = [pic({ device: { ...room, title: ["ค่าห้องจ่ายทันที", "ต่อคืน"] } }), pic(), pic()];
    expect(sceneKind(scenes[0], allowed).kind).toBe("broken");
    expect(pictureCount(scenes, allowed)).toBe(3);
    const held = checkedPromptStory({
      draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "ค่าห้อง", caption: "", scenes,
      style: "paper", painter: "standard",
    }, "F");
    expect(typeof held).toBe("object");
    expect(pictureScenes(held as never)).toBe(3);
  });

  it("reads the plan's figures too", () => {
    const limit: DeviceScene = { layout: "limit", title: ["วงเงิน", "ต่อปี"], limit: 45200, planName: "" };
    expect(sceneKind(pic({ device: limit }), deviceAllowed("แผนสุขภาพ")).kind).toBe("broken");
    expect(sceneKind(pic({ device: limit }), deviceAllowed("แผนสุขภาพ", { age: 40, sumAssured: 1_000_000, annual: 45200, monthly: 3900 })).kind).toBe("device");
  });
});

describe("missingPicture", () => {
  it("finds the first picture scene without picture words, as the server refuses it", () => {
    expect(missingPicture([pic({ device: room, picture: "" }), pic()], allowed)).toBeNull();
    expect(missingPicture([pic(), pic({ picture: "  " })], allowed)).toBe(1);
    // a broken device is a picture scene, and needs its words
    expect(missingPicture([pic({ device: { ...room, real: 1 }, picture: "" })], allowed)).toBe(0);
    expect(needPictureWords(2)).toBe("ใส่คำบรรยายภาพของฉากที่ 2");
    const refused = checkedPromptStory({
      draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief: BRIEF, title: "ค่าห้อง", caption: "",
      scenes: [pic(), pic({ picture: "" }), pic()], style: "paper", painter: "standard",
    }, "F");
    expect(refused).toBe(needPictureWords(2));
  });
});

describe("toPicture", () => {
  it("drops the device, keeps voice and screen, begins the picture words from the screen without figures", () => {
    const s = toPicture(pic({ device: room, screen: "ค่าห้อง 6,000 ต่อคืน", picture: "" }));
    expect(s).toEqual({ voice: "ฉากนี้ค่ะ", screen: "ค่าห้อง 6,000 ต่อคืน", picture: "ค่าห้อง ต่อคืน" });
    expect("device" in s).toBe(false);
  });

  it("keeps picture words the writer already gave", () => {
    expect(toPicture(pic({ device: room })).picture).toBe("ผู้หญิงนั่งคิด");
  });

  it("strips Thai digits too", () => {
    expect(pictureFromScreen("อายุ ๓๕ ปี 1.5 ล้าน")).toBe("อายุ ปี ล้าน");
  });
});

describe("deviceFields and setDeviceWord", () => {
  it("gives a room's words to edit and its figures to show", () => {
    const f = deviceFields(room);
    expect(f.words.map((w) => [w.label, w.value])).toEqual([["หัวข้อ บรรทัด 1", "ค่าห้อง"], ["หัวข้อ บรรทัด 2", "ต่อคืน"], ["ชื่อแผน", "Silver"]]);
    expect(f.numbers).toEqual([{ label: "แผนจ่าย", value: "5,500" }, { label: "ค่าห้องจริง", value: "6,000" }]);
  });

  it("lists a split's parts and a waiting card's rows", () => {
    const split: DeviceScene = { layout: "split", title: ["แยกจ่าย", ""], parts: ["ค่าห้อง", "ค่าผ่าตัด"], whole: "จ่ายตามจริง" };
    expect(deviceFields(split).words.map((w) => w.label)).toEqual(["หัวข้อ บรรทัด 1", "หัวข้อ บรรทัด 2", "หมวด 1", "หมวด 2", "เหมาจ่าย"]);
    const waiting: DeviceScene = { layout: "waiting", title: ["ระยะรอคอย", ""], rows: [{ at: "วันนี้", label: "กรมธรรม์มีผล" }] };
    expect(deviceFields(waiting).words.slice(2)).toEqual([
      { path: ["rows", 0, "at"], label: "แถว 1 · เมื่อ", value: "วันนี้" },
      { path: ["rows", 0, "label"], label: "แถว 1 · รายการ", value: "กรมธรรม์มีผล" },
    ]);
  });

  it("shows an agecost's rows as figures", () => {
    const age: DeviceScene = { layout: "agecost", title: ["ค่าประกัน", "ตามอายุ"], rows: [{ age: 30, annual: 12000 }], source: "" };
    expect(deviceFields(age).numbers).toEqual([{ label: "อายุ 30", value: "ปีละ 12,000" }]);
  });

  it("changes one word in a copy", () => {
    const next = setDeviceWord(room, ["title", 1], "คืนละเท่าไร");
    expect(next).toEqual({ ...room, title: ["ค่าห้อง", "คืนละเท่าไร"] });
    expect(room.title[1]).toBe("ต่อคืน");
    const one = setDeviceWord({ ...room, title: ["ค่าห้อง"] as unknown as [string, string] }, ["title", 1], "ต่อคืน");
    expect(one.title).toEqual(["ค่าห้อง", "ต่อคืน"]);
    const w = setDeviceWord({ layout: "waiting", title: ["a", ""], rows: [{ at: "x", label: "y" }] }, ["rows", 0, "label"], "z");
    expect(w).toEqual({ layout: "waiting", title: ["a", ""], rows: [{ at: "x", label: "z" }] });
  });
});

describe("deviceReason and rewritesLeft", () => {
  it("says the field in Thai", () => {
    expect(deviceReason("title: ว่างอยู่")).toBe("หัวข้อ ว่างอยู่");
    expect(deviceReason("plain")).toBe("plain");
  });

  it("takes the server's count, none after ครบ, else keeps it", () => {
    expect(rewritesLeft(3, { ok: true, left: 2 }, REWRITES_DONE)).toBe(2);
    expect(rewritesLeft(2, { ok: false, error: "AI เขียนฉากนี้ใหม่ไม่สำเร็จ", left: 1 }, REWRITES_DONE)).toBe(1);
    expect(rewritesLeft(2, { ok: false, error: REWRITES_DONE }, REWRITES_DONE)).toBe(0);
    expect(rewritesLeft(2, { ok: false, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }, REWRITES_DONE)).toBe(2);
  });
});
