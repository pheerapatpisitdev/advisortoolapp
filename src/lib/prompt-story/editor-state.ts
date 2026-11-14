import { checkDevice } from "./check";
import { deviceInfo } from "@/lib/scene-library/devices";
import { isUploadId } from "@/lib/scene-library/upload-rules";
import type { DeviceScene, PromptScene } from "./types";

/**
 * The script editor's sums and moves (health devices, Task 10), kept apart from the page so they are
 * tested alone. Browser-safe. A scene is a picture scene unless its device passes checkDevice with the
 * figures the brief and the plan give (deviceAllowed): the very test checkedPromptStory charges by. A
 * library part (ภาพจากคลัง, คลังแอนิเมชัน phase 3) is laid in, not painted, unless a passing device is on the scene.
 */

export type SceneKind =
  | { kind: "picture" }
  | { kind: "device"; device: DeviceScene; name: string }
  /** a library part, laid on the look's ground: not painted, not charged */
  | { kind: "asset"; id: string }
  /** a device the server will drop: the scene is charged and painted as a picture */
  | { kind: "broken"; reason: string; name: string };

/** Thai words for a device's fields, for its boxes and for the reason it fails */
const FIELD: Record<string, string> = {
  layout: "อุปกรณ์", title: "หัวข้อ", parts: "หมวด", whole: "เหมาจ่าย", planName: "ชื่อแผน", rows: "แถว", note: "ข้อความ",
  source: "ที่มา", limit: "วงเงิน", used: "ใช้ไป", plan: "แผนจ่าย", real: "ค่าห้องจริง", bill: "ค่ารักษา", group: "ประกันกลุ่ม",
  at: "เมื่อ", label: "รายการ", age: "อายุ", annual: "ปีละ",
};
export const fieldName = (f: string): string => FIELD[f] ?? f;

/** checkDevice's reason ("real: ตัวเลข 7000 …") with its field said in Thai and its figure as 7,000 */
export function deviceReason(reason: string): string {
  const m = /^(\w+):\s*(.*)$/.exec(reason);
  const said = m ? `${fieldName(m[1])} ${m[2]}` : reason;
  return said.replace(/\d{4,}/g, (n) => Number(n).toLocaleString("en-US"));
}

/** a passing device first; else a part (as checkedPromptStory keeps one only on a scene with no device it keeps) */
export function sceneKind(s: PromptScene, forDevice: Set<number>): SceneKind {
  const asset = isUploadId(s.asset) ? s.asset : null;
  if (!s.device) return asset ? { kind: "asset", id: asset } : { kind: "picture" };
  const d = checkDevice(s.device, forDevice);
  const name = deviceInfo(String(s.device.layout))?.name ?? "อุปกรณ์";
  if (typeof d !== "string") return { kind: "device", device: s.device, name };
  return asset ? { kind: "asset", id: asset } : { kind: "broken", reason: deviceReason(d), name };
}

/** neither a passing device nor a part: the painter draws it */
const painted = (k: SceneKind) => k.kind === "picture" || k.kind === "broken";

/** the scenes the painter draws and the clip charges for: no device or part, or a device the server will drop */
export const pictureCount = (scenes: PromptScene[], forDevice: Set<number>): number =>
  scenes.filter((s) => painted(sceneKind(s, forDevice))).length;

/** the server's words for a picture scene left without its picture words (checkedPromptStory) */
export const needPictureWords = (n: number): string => `ใส่คำบรรยายภาพของฉากที่ ${n}`;

/** the first picture scene (from 0) with no picture words, as the server would refuse it; null when none */
export function missingPicture(scenes: PromptScene[], forDevice: Set<number>): number | null {
  const i = scenes.findIndex((s) => painted(sceneKind(s, forDevice)) && !s.picture.replace(/\s+/g, " ").trim());
  return i < 0 ? null : i;
}

/**
 * Picture words to start from when a device scene turns into a picture: the screen words without
 * their figures (a picture note with a digit is refused by checkScene), for the agent to edit.
 */
export const pictureFromScreen = (screen: string): string =>
  screen.replace(/[\d๐-๙][\d๐-๙,.]*/g, " ").replace(/\s+/g, " ").trim();

/** ภาพ AI: the device or the part goes, voice and screen stay; picture words kept, or begun from the screen words */
export function toPicture(s: PromptScene): PromptScene {
  const { device: _gone, asset: _part, ...rest } = s;
  void _gone;
  void _part;
  return { ...rest, picture: s.picture.trim() ? s.picture : pictureFromScreen(s.screen) };
}

/** ภาพจากคลัง: the part `id` in place of the device, every word kept (toPicture brings the picture words back) */
export function toAsset(s: PromptScene, id: string): PromptScene {
  const { device: _gone, ...rest } = s;
  void _gone;
  return { ...rest, asset: id };
}

/** one box of a device's words: where it sits in the device, its label, its text */
export interface DeviceWord { path: (string | number)[]; label: string; value: string }
/** one of a device's figures, shown and never typed (the writer took it from the brief or the plan) */
export interface DeviceNumber { label: string; value: string }

const baht = (n: unknown) => (typeof n === "number" ? n.toLocaleString("en-US") : "");

/** a device's words to edit and its figures to show, in its fields' order (devices.ts) */
export function deviceFields(d: DeviceScene): { words: DeviceWord[]; numbers: DeviceNumber[] } {
  const info = deviceInfo(d.layout);
  const o = d as unknown as Record<string, unknown>;
  const words: DeviceWord[] = [];
  const numbers: DeviceNumber[] = [];
  for (const f of info?.wordFields ?? []) {
    const v = o[f];
    if (f === "title") {
      const t = Array.isArray(v) ? v : [];
      words.push({ path: ["title", 0], label: "หัวข้อ บรรทัด 1", value: typeof t[0] === "string" ? t[0] : "" });
      words.push({ path: ["title", 1], label: "หัวข้อ บรรทัด 2", value: typeof t[1] === "string" ? t[1] : "" });
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "string") words.push({ path: [f, i], label: `${fieldName(f)} ${i + 1}`, value: item });
        else if (item && typeof item === "object") {
          for (const [k, x] of Object.entries(item as Record<string, unknown>)) {
            if (typeof x === "string") words.push({ path: [f, i, k], label: `${fieldName(f)} ${i + 1} · ${fieldName(k)}`, value: x });
          }
        }
      });
    } else words.push({ path: [f], label: fieldName(f), value: typeof v === "string" ? v : "" });
  }
  for (const f of info?.numberFields ?? []) {
    const v = o[f];
    if (typeof v === "number") numbers.push({ label: fieldName(f), value: baht(v) });
    else if (Array.isArray(v)) {
      // agecost's rows: อายุ 30 · ปีละ 12,000
      v.forEach((r) => {
        if (r && typeof r === "object") {
          const parts = Object.entries(r as Record<string, unknown>).filter(([, x]) => typeof x === "number");
          if (parts.length) numbers.push({ label: `${fieldName(parts[0][0])} ${baht(parts[0][1])}`, value: parts.slice(1).map(([k, x]) => `${fieldName(k)} ${baht(x)}`).join(" · ") });
        }
      });
    }
  }
  return { words, numbers };
}

/** the device with one of its words changed (a copy; the title stays two lines) */
export function setDeviceWord(d: DeviceScene, path: (string | number)[], value: string): DeviceScene {
  const put = (at: unknown, rest: (string | number)[]): unknown => {
    if (!rest.length) return value;
    const [k, ...more] = rest;
    if (typeof k === "number") {
      const arr = Array.isArray(at) ? [...at] : [];
      while (arr.length < k) arr.push("");
      arr[k] = put(arr[k], more);
      return arr;
    }
    const obj = at && typeof at === "object" && !Array.isArray(at) ? { ...(at as Record<string, unknown>) } : {};
    obj[k] = put(obj[k], more);
    return obj;
  };
  return put(d, path) as DeviceScene;
}

/** the rewrites left once a press has answered: the server's count, else none after "ครบ", else as it was */
export function rewritesLeft(was: number, r: { ok: boolean; left?: number; error?: string }, done: string): number {
  if (typeof r.left === "number") return Math.max(0, r.left);
  if (!r.ok && r.error === done) return 0;
  return was;
}
