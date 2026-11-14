import { describe, expect, it } from "vitest";
import { DEVICES, deviceInfo, isHealthDevice } from "@/lib/scene-library/devices";
import { HEALTH_LAYOUTS, knowText, type KnowEpisode, type KnowShow } from "@/lib/quote-video/story-knowledge";

describe("health devices", () => {
  it("registers the eight layouts", () => {
    expect(DEVICES.filter(isHealthDevice).map((d) => d.key)).toEqual([...HEALTH_LAYOUTS]);
    // and round 2's eight after them (devices-life.test.ts)
    expect(DEVICES).toHaveLength(16);
  });
  it("looks a device up by key", () => {
    expect(deviceInfo("room")?.name).toBe("ค่าห้องต่อคืน");
    expect(deviceInfo("limit")?.numberFields).toEqual(["limit", "used"]);
    expect(deviceInfo("split")?.numberFields).toEqual([]);
  });
  it("knowText collects every health word and the digit set", () => {
    const t: [string, string] = ["หัวบน", "หัวล่าง"];
    const shows: KnowShow[] = [
      { layout: "split", title: t, parts: ["ส่วนหนึ่ง", "ส่วนสอง"], whole: "ก้อนเดียว" },
      { layout: "limit", title: ["ลิมิตA", "ลิมิตB"], limit: 1000000, planName: "แผนX" },
      { layout: "room", title: ["ห้องA", "ห้องB"], plan: 3000, planName: "แผนY" },
      { layout: "overflow", title: ["เกินA", "เกินB"] },
      { layout: "waiting", title: ["รอA", "รอB"], rows: [{ at: "30 วัน", label: "ป่วยทั่วไป" }] },
      { layout: "cashless", title: ["เคลมA", "เคลมB"], note: "ไม่ต้องสำรองจ่าย" },
      { layout: "groupgap", title: ["กลุ่มA", "กลุ่มB"] },
      { layout: "agecost", title: ["อายุA", "อายุB"], rows: [{ age: 30, annual: 9000 }], source: "ตารางเบี้ย" },
    ];
    const e: KnowEpisode = { scenes: shows.map((show) => ({ key: "knowOne", show, voice: "" })), cta: "ติดต่อ", contactVoice: "" };
    const text = knowText(e);
    for (const w of ["หัวบน", "หัวล่าง", "ส่วนหนึ่ง", "ส่วนสอง", "ก้อนเดียว", "ไม่ต้องสำรองจ่าย", "30 วัน", "ป่วยทั่วไป", "ตารางเบี้ย", "แผนX", "แผนY", "บาท", "0123456789,"]) {
      expect(text).toContain(w);
    }
  });
});
