import { checkDevice, type TaxSources } from "./check";
import { deviceInfo } from "@/lib/scene-library/devices";
import { isUploadId } from "@/lib/scene-library/upload-rules";
import { BAND_WORDS, HEALTH2_LAYOUTS, HEALTH2_WORDS, META_LAYOUTS, SAVE_LAYOUTS, type GroupBand } from "@/lib/quote-video/story-knowledge";
import { paints, type DeviceScene, type PromptDesign, type PromptScene } from "./types";

/**
 * The script editor's sums and moves (health devices, Task 10), kept apart from the page so they are
 * tested alone. Browser-safe. A scene is a picture scene unless its device passes checkDevice with the
 * figures the brief and the plan give (deviceAllowed), a taxback's inputs the brief's alone (briefTax): the very
 * test checkedPromptStory charges by. A
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
  // ชีวิต ภาษี มรดก (round 2)
  debts: "ภาระหนี้", expenses: "ค่าใช้จ่ายต่อปี", years: "จำนวนปี", education: "ค่าการศึกษา", have: "ทุนที่มี", name: "ชื่อ", share: "สัดส่วน",
  // อุปมา (round 3)
  spare: "เสาสำรอง", from: "คำใต้ภาพซ้าย", to: "คำใต้ภาพขวา", sides: "สองข้างตาชั่ง", tilt: "ตาชั่งเอียง", arrows: "ลูกศร",
  sum: "ทุนโรคร้าย", monthly: "รายได้ต่อเดือน", months: "จำนวนเดือน", premium: "เบี้ยต่อปี", bracket: "ฐานภาษี", total: "เงินก้อน", amount: "จำนวนเงิน",
};
/** a word the อุปมา devices name apart from the rest: the line under the picture, the word on housepillar's pillar */
const META_FIELD: Record<string, string> = { note: "บรรทัดใต้ภาพ", label: "คำบนเสา" };
/** the ออมเงิน devices' figures by what they are on that device (round 4): ปีที่ส่ง, ยอดส่งรวม, บำนาญรวม, อายุเริ่มส่ง/ส่งถึง, อายุเริ่มรับ/รับถึง, ช่วงอายุ */
const SAVE_FIELD: Record<string, Record<string, string>> = {
  savejar: { years: "ปีที่ส่ง", paid: "ยอดส่งรวม" },
  paidgot: { paid: "ยอดส่งรวม", got: "บำนาญรวม", payFrom: "อายุเริ่มส่ง", payTo: "อายุส่งถึง", getFrom: "อายุเริ่มรับ", getTo: "อายุรับถึง" },
  pensionsteps: { rows: "ช่วงอายุ", annual: "บำนาญต่อปี" },
};
/** the สุขภาพเพิ่มเติม devices' figures by what they are on that device (round 5): ค่าห้องต่อวัน, ส่วนรับผิดชอบแรก, ยอดบิล, ร่วมจ่าย, ต่ออายุถึงอายุ, อายุวันนี้, … */
const HEALTH2_FIELD: Record<string, Record<string, string>> = {
  ipdopd: { room: "ค่าห้องต่อวัน", opd: "ผู้ป่วยนอกต่อปี" },
  deductible: { deductible: "ส่วนรับผิดชอบแรก", bill: "ยอดบิล" },
  copay: { percent: "ร่วมจ่าย", bill: "ยอดบิล" },
  renew98: { to: "ต่ออายุถึงอายุ", age: "อายุวันนี้" },
  parentshealth: { cap: "เพดานลดหย่อน" },
  groupcost: { perYear: "เบี้ยต่อคนต่อปี", band: "กลุ่มพนักงาน" },
  hospitals: { total: "จำนวนโรงพยาบาล", province: "จังหวัด", count: "จำนวนโรงพยาบาล" },
  paclaim: { medical: "ค่ารักษาต่ออุบัติเหตุ", weekly: "ชดเชยต่อสัปดาห์", weeks: "จำนวนสัปดาห์" },
};
export const fieldName = (f: string, layout?: string): string =>
  HEALTH2_FIELD[layout ?? ""]?.[f] ?? SAVE_FIELD[layout ?? ""]?.[f] ?? (isMetaLayout(layout) || isSaveLayout(layout) || isHealth2Layout(layout) ? META_FIELD[f] : undefined) ?? FIELD[f] ?? f;
const isMetaLayout = (layout?: string): boolean => (META_LAYOUTS as readonly string[]).includes(layout ?? "");
const isSaveLayout = (layout?: string): boolean => (SAVE_LAYOUTS as readonly string[]).includes(layout ?? "");
const isHealth2Layout = (layout?: string): boolean => (HEALTH2_LAYOUTS as readonly string[]).includes(layout ?? "");

/** the balance's tilt as the owner reads and types it */
const TILT_THAI: Record<string, string> = { left: "ซ้าย", right: "ขวา", even: "เท่ากัน" };
const TILT_KEY: Record<string, string> = Object.fromEntries(Object.entries(TILT_THAI).map(([k, v]) => [v, k]));

/** a list's item by what it holds on this device: a beneficiary's row is a person, a moneysplit part a share of the sum */
const ITEM: Partial<Record<DeviceScene["layout"], Record<string, string>>> = {
  beneficiary: { rows: "ผู้รับ" }, moneysplit: { parts: "ส่วน" }, threegen: { rows: "รุ่น" },
};
const itemName = (layout: DeviceScene["layout"], f: string): string => ITEM[layout]?.[f] ?? fieldName(f, layout);

/** a figure as the editor shows it: a share or a tax rate as a percentage, anything else 1,234,567 */
const PERCENT = new Set(["share", "bracket"]);
const shownAs = (f: string, n: unknown) => (typeof n === "number" ? (PERCENT.has(f) ? `${n}%` : n.toLocaleString("en-US")) : "");
/** a figure of one device as shown: the co-payment's percent, ipdopd's two OPD words, groupcost's head-count band in its own words */
function shownOn(layout: string, f: string, v: unknown): string {
  if (layout === "copay" && f === "percent") return shownAs("share", v);
  if (layout === "ipdopd" && f === "opd" && (v === "none" || v === "actual")) return v === "none" ? HEALTH2_WORDS.noOpd : HEALTH2_WORDS.actual;
  if (layout === "groupcost" && f === "band") return BAND_WORDS[v as GroupBand] ?? "";
  return shownAs(f, v);
}

/** checkDevice's reason ("real: ตัวเลข 7000 …") with its field said in Thai and its figure as 7,000 */
export function deviceReason(reason: string, layout?: string): string {
  const m = /^(\w+):\s*(.*)$/.exec(reason);
  if (m?.[1] === "tilt") return `${fieldName("tilt")} ต้องเป็น ซ้าย ขวา หรือ เท่ากัน`;
  const said = m ? `${fieldName(m[1], layout)} ${m[2]}` : reason;
  return said.replace(/\d{4,}/g, (n) => Number(n).toLocaleString("en-US"));
}

/** a passing device first; else a part (as checkedPromptStory keeps one only on a scene with no device it keeps) */
export function sceneKind(s: PromptScene, forDevice: Set<number>, tax?: TaxSources): SceneKind {
  const asset = isUploadId(s.asset) ? s.asset : null;
  if (!s.device) return asset ? { kind: "asset", id: asset } : { kind: "picture" };
  const d = checkDevice(s.device, forDevice, tax);
  const name = deviceInfo(String(s.device.layout))?.name ?? "อุปกรณ์";
  if (typeof d !== "string") return { kind: "device", device: d, name };
  return asset ? { kind: "asset", id: asset } : { kind: "broken", reason: deviceReason(d, String(s.device.layout)), name };
}

/** neither a passing device nor a part: the painter draws it, and in โมชันกราฟิก only where its layout shows a picture (paints; a broken device is stripped as the server drops it) */
const painted = (s: PromptScene, k: SceneKind, design?: PromptDesign) => {
  if (k.kind !== "picture" && k.kind !== "broken") return false;
  const { device: _d, asset: _a, ...rest } = s;
  void _d;
  void _a;
  return paints(rest, design);
};

/** the scenes the painter draws and the clip charges for: no device or part, or a device the server will drop */
export const pictureCount = (scenes: PromptScene[], forDevice: Set<number>, tax?: TaxSources, design?: PromptDesign): number =>
  scenes.filter((s) => painted(s, sceneKind(s, forDevice, tax), design)).length;

/** the server's words for a picture scene left without its picture words (checkedPromptStory) */
export const needPictureWords = (n: number): string => `ใส่คำบรรยายภาพของฉากที่ ${n}`;

/** the first picture scene (from 0) with no picture words, as the server would refuse it; null when none */
export function missingPicture(scenes: PromptScene[], forDevice: Set<number>, tax?: TaxSources, design?: PromptDesign): number | null {
  const i = scenes.findIndex((s) => painted(s, sceneKind(s, forDevice, tax), design) && !s.picture.replace(/\s+/g, " ").trim());
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

/** the library part this scene shows (its own `asset` looked up in the list), for its name; none when it has no part or the part is not listed */
export function scenePart<P extends { id: string }>(s: PromptScene, parts: readonly P[]): P | undefined {
  return s.asset ? parts.find((p) => p.id === s.asset) : undefined;
}

/**
 * A scene the writer wrote again (เขียนฉากนี้ใหม่), put in place of `was`: the writer never sets a part, so
 * the agent's ภาพจากคลัง stays, unless the rewrite brings a device (the device wins).
 */
export function keptRewrite(was: PromptScene, written: PromptScene): PromptScene {
  return was.asset && !written.device ? { ...written, asset: was.asset } : written;
}

/** one box of a device's words: where it sits in the device, its label, its text */
export interface DeviceWord { path: (string | number)[]; label: string; value: string }
/** one of a device's figures, shown and never typed (the writer took it from the brief or the plan) */
export interface DeviceNumber { label: string; value: string }

const baht = (n: unknown) => shownAs("", n);

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
        if (typeof item === "string") words.push({ path: [f, i], label: `${itemName(d.layout, f)} ${i + 1}`, value: item });
        else if (item && typeof item === "object") {
          for (const [k, x] of Object.entries(item as Record<string, unknown>)) {
            if (typeof x === "string") words.push({ path: [f, i, k], label: `${itemName(d.layout, f)} ${i + 1} · ${fieldName(k, d.layout)}`, value: x });
          }
        }
      });
    } else words.push({ path: [f], label: fieldName(f, d.layout), value: f === "tilt" ? TILT_THAI[String(v ?? "even")] ?? String(v) : typeof v === "string" ? v : "" });
  }
  for (const f of info?.numberFields ?? []) {
    const v = o[f];
    if (typeof v === "number" || (d.layout === "ipdopd" && (v === "none" || v === "actual"))) numbers.push({ label: fieldName(f, d.layout), value: shownOn(d.layout, f, v) });
    else if (Array.isArray(v)) {
      v.forEach((r, i) => {
        if (d.layout === "pensionsteps" && r && typeof r === "object") {
          // a step: ช่วงอายุ 1 · 60–75, then บำนาญต่อปี 1 · 118,110 (the editor never types them)
          const x = r as Record<string, unknown>;
          numbers.push({ label: `${fieldName("rows", d.layout)} ${i + 1}`, value: `${x.from}–${x.to}` });
          numbers.push({ label: `${fieldName("annual", d.layout)} ${i + 1}`, value: baht(x.annual) });
        } else if (r && typeof r === "object") {
          const parts = Object.entries(r as Record<string, unknown>).filter(([, x]) => typeof x === "number");
          // one figure an item (a beneficiary's share, a moneysplit part's amount): ผู้รับ 1 · สัดส่วน 60%
          if (parts.length === 1) numbers.push({ label: `${itemName(d.layout, f)} ${i + 1} · ${fieldName(parts[0][0], d.layout)}`, value: shownAs(parts[0][0], parts[0][1]) });
          // agecost's rows: อายุ 30 · ปีละ 12,000
          else if (parts.length) numbers.push({ label: `${fieldName(parts[0][0])} ${baht(parts[0][1])}`, value: parts.slice(1).map(([k, x]) => `${fieldName(k)} ${baht(x)}`).join(" · ") });
        }
      });
    }
  }
  // groupcost's head-count band is a key, shown as the words the drawer puts to it
  if (d.layout === "groupcost" && typeof o.band === "string") numbers.push({ label: fieldName("band", d.layout), value: shownOn(d.layout, "band", o.band) });
  return { words, numbers };
}

/** the device with one of its words changed (a copy; the title stays two lines) */
export function setDeviceWord(d: DeviceScene, path: (string | number)[], value: string): DeviceScene {
  // the balance's tilt is typed in Thai; what is not one of the three stays as typed, for the check to refuse
  const v = path.length === 1 && path[0] === "tilt" ? TILT_KEY[value.trim()] ?? value : value;
  const put = (at: unknown, rest: (string | number)[]): unknown => {
    if (!rest.length) return v;
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
