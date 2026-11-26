import { checkDevice, type TaxSources } from "./check";
import { deviceInfo } from "@/lib/scene-library/devices";
import { isUploadId } from "@/lib/scene-library/upload-rules";
import { numbersIn } from "@/lib/quote-video/brief";
import { BAND_WORDS, HEALTH2_LAYOUTS, HEALTH2_WORDS, META_LAYOUTS, SAVE_LAYOUTS, type GroupBand } from "@/lib/quote-video/story-knowledge";
import { MOTION_LIMITS, paints, type DeviceScene, type MotionKind, type MotionLayout, type PromptDesign, type PromptScene } from "./types";

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

/* ---------- โมชันกราฟิก (owner, 2026-11-26, mockup ข round 2's หน้าแก้บท): a layout per scene, switched in the editor ---------- */

/** why ตัวเลขใหญ่ cannot be chosen: the brief and the plan give no figure it may show */
export const NUMBER_NEEDS = "ตัวเลขใหญ่ต้องมีตัวเลขในโจทย์หรือแผน";

/** Thai vowel and tone marks: a line is never cut just before one */
const MARK = /[ัิ-ฺ็-๎]/;

/** text cut to at most `max` characters (MOTION_LIMITS counts characters), never just before a mark */
function cutTo(text: string, max: number): string {
  const c = [...text.trim()];
  if (c.length <= max) return c.join("");
  let n = max;
  while (n > 1 && MARK.test(c[n])) n--;
  return c.slice(0, n).join("").trim();
}

/** the screen words broken on spaces into at most `count` lines of at most `max` characters (writer.ts plainMotion's rule) */
function linesOf(text: string, count: number, max = MOTION_LIMITS.line): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (cur && [...cur].length + 1 + [...word].length <= max) {
      cur += ` ${word}`;
      continue;
    }
    if (cur) lines.push(cur);
    let rest = word;
    // a piece longer than a line is cut at the limit
    while ([...rest].length > max) {
      const head = cutTo(rest, max);
      lines.push(head);
      rest = rest.slice(head.length);
    }
    cur = rest;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, count);
}

/** the words a figure is counted in, when the scene says one right after it */
const UNITS = ["บาท", "ปี", "เดือน", "วัน", "คืน", "ครั้ง", "คน", "แห่ง", "โรค"];
function unitAfter(texts: string[], n: number): string {
  for (const text of texts) {
    for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(ล้าน)?/g)) {
      if (Number(m[1].replace(/,/g, "")) * (m[2] ? 1_000_000 : 1) !== n) continue;
      const rest = text.slice((m.index ?? 0) + m[0].length).trimStart();
      const unit = UNITS.find((u) => rest.startsWith(u));
      if (unit) return unit;
    }
  }
  return "";
}

/**
 * A layout to start scene `scene` in when the agent picks `kind`, built from its screen words for the agent to edit:
 * hook and full its lines, a card's tag the words and its chips their first two words, compare's title and check's
 * first line the words with the rest left empty. ตัวเลขใหญ่ shows the first of `numbers` (deviceAllowed, the very
 * figures checkMotion takes) the scene says, else the first of them, else it cannot be chosen (NUMBER_NEEDS).
 */
export function motionDefault(kind: MotionKind, scene: PromptScene, numbers: number[]): MotionLayout | string {
  const L = MOTION_LIMITS;
  const screen = scene.screen.replace(/\s+/g, " ").trim();
  switch (kind) {
    case "hook": {
      const lines = linesOf(screen, 3);
      return { kind: "hook", lines: lines.length ? lines : [""], key: -1, icon: "heart" };
    }
    case "full": {
      const lines = linesOf(screen, 2);
      return { kind: "full", lines: lines.length ? lines : [""], key: -1 };
    }
    case "card": {
      const words = screen.split(" ").filter(Boolean);
      return { kind: "card", tag: cutTo(screen, L.tag), chips: words.length >= 2 ? [cutTo(words[0], L.chip), cutTo(words[1], L.chip)] : ["", ""] };
    }
    case "compare":
      return { kind: "compare", title: cutTo(screen, L.title), bad: { head: "", lines: ["", ""] }, good: { head: "", lines: ["", ""] } };
    case "check": {
      const lines = linesOf(screen, 2);
      return { kind: "check", lines: [lines[0] ?? "", lines[1] ?? ""], ticks: ["", "", ""], photo: false };
    }
    case "number": {
      // checkMotion takes a whole number above nought, and only one of these
      const ok = numbers.filter((n) => Number.isInteger(n) && n > 0);
      if (!ok.length) return NUMBER_NEEDS;
      const said = new Set([...numbersIn(scene.voice), ...numbersIn(scene.screen)]);
      const value = ok.find((n) => said.has(n)) ?? ok[0];
      return { kind: "number", value, unit: unitAfter([scene.voice, scene.screen], value), tag: cutTo(screen, L.tag), bill: "" };
    }
  }
}

/** the scene drawn in `layout`: a device or a library part gives way (the editor parks a device), every word kept */
export function toMotion(scene: PromptScene, layout: MotionLayout): PromptScene {
  const { device: _gone, asset: _part, ...rest } = scene;
  void _gone;
  void _part;
  return { ...rest, motion: layout };
}

/** the layouts a scene was switched away from, by scene (from 0) and kind: switching back brings each as it was left */
export type ParkedMotion = Record<number, Partial<Record<MotionKind, MotionLayout>>>;
/** what the editor's layout moves touch of its draft */
export interface MotionDraft { scenes: PromptScene[]; parked?: Record<number, DeviceScene>; parkedMotion?: ParkedMotion }

const swap = (scenes: PromptScene[], i: number, s: PromptScene) => scenes.map((x, j) => (j === i ? s : x));
/** a layout that starts to paint begins its picture words from the screen words, as toPicture does */
const withPictureWords = (was: PromptScene, next: PromptScene): PromptScene =>
  paints(next, "motion") && !paints(was, "motion") && !next.picture.trim() ? { ...next, picture: pictureFromScreen(next.screen) } : next;

/**
 * แบบฉาก `kind` pressed on scene `i`: the layout it had is parked, the one parked for `kind` comes back, else one is
 * begun (motionDefault); a device on the scene is parked for อุปกรณ์, a part let go. The same kind again is no move;
 * the reason when it cannot be chosen (ตัวเลขใหญ่ with no figure), the draft left as it was.
 */
export function toKindAt<D extends MotionDraft>(d: D, i: number, kind: MotionKind, numbers: number[]): D | string {
  const s = d.scenes[i];
  if (!s || (s.motion?.kind === kind && !s.device && !s.asset)) return d;
  const shelf: Partial<Record<MotionKind, MotionLayout>> = { ...d.parkedMotion?.[i] };
  if (s.motion) shelf[s.motion.kind] = s.motion;
  const layout = shelf[kind] ?? motionDefault(kind, s, numbers);
  if (typeof layout === "string") return layout;
  delete shelf[kind];
  return {
    ...d,
    scenes: swap(d.scenes, i, withPictureWords(s, toMotion(s, layout))),
    ...(s.device ? { parked: { ...d.parked, [i]: s.device } } : {}),
    parkedMotion: { ...d.parkedMotion, [i]: shelf },
  };
}

/** scene `i`'s layout parked and taken off, for a device or a library part in its place (the server checks any layout a scene carries) */
export function motionAside<D extends MotionDraft>(d: D, i: number): D {
  const s = d.scenes[i];
  if (!s?.motion) return d;
  const { motion, ...rest } = s;
  return { ...d, scenes: swap(d.scenes, i, rest), parkedMotion: { ...d.parkedMotion, [i]: { ...d.parkedMotion?.[i], [motion.kind]: motion } } };
}

/** one of the layout's fields typed: written through toMotion, a (failing) device still on the scene parked for อุปกรณ์ */
export function editMotionAt<D extends MotionDraft>(d: D, i: number, layout: MotionLayout): D {
  const s = d.scenes[i];
  if (!s) return d;
  return { ...d, scenes: swap(d.scenes, i, withPictureWords(s, toMotion(s, layout))), ...(s.device ? { parked: { ...d.parked, [i]: s.device } } : {}) };
}

/** how many of the layout's words are still empty: the server refuses the clip until each is written (checkMotion) */
export function motionGaps(m: MotionLayout): number {
  const words = m.kind === "hook" || m.kind === "full" ? m.lines
    : m.kind === "card" ? [m.tag, ...m.chips]
    : m.kind === "number" ? [m.unit, m.tag, m.bill]
    : m.kind === "compare" ? [m.title, m.bad.head, ...m.bad.lines, m.good.head, ...m.good.lines]
    : [...m.lines, ...m.ticks];
  return words.filter((w) => !w.trim()).length;
}

/** what a layout with an empty box says, in its scene (MotionFields) and by สร้างคลิป, which it shuts */
export const MOTION_GAP = "ยังมีช่องว่าง ใส่ให้ครบก่อนกดสร้างคลิป";
export const needLayoutWords = (n: number): string => `ฉากที่ ${n} ${MOTION_GAP}`;

/**
 * the first scene (from 0) whose layout still has an empty box, as the server would refuse it (checkMotion); null when
 * none. Only in โมชันกราฟิก, and never the premium card's scene: it draws the figure, its layout dropped (checkedPromptStory).
 */
export function motionGapAt(scenes: PromptScene[], design?: PromptDesign): number | null {
  if (design !== "motion") return null;
  const i = scenes.findIndex((s) => s.motion && !s.showFigure && motionGaps(s.motion) > 0);
  return i < 0 ? null : i;
}

/** a headline's layouts, and how many lines each holds (checkMotion) */
type Lined = Extract<MotionLayout, { kind: "hook" | "full" }>;
export const LINES_MAX: Record<Lined["kind"], number> = { hook: 3, full: 2 };

/** ★ คำเน้น on line `j`: that line swept with gold, or none when it already was */
export const starLine = <M extends Lined>(m: M, j: number): M => ({ ...m, key: m.key === j ? -1 : j });
/** one more (empty) line, up to the layout's count */
export const addLine = <M extends Lined>(m: M): M => (m.lines.length >= LINES_MAX[m.kind] ? m : { ...m, lines: [...m.lines, ""] });
/** line `j` taken away (never the last one), the gold staying on the line it was on */
export function dropLine<M extends Lined>(m: M, j: number): M {
  if (m.lines.length <= 1) return m;
  return { ...m, lines: m.lines.filter((_, k) => k !== j), key: m.key === j ? -1 : m.key > j ? m.key - 1 : m.key };
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
