/**
 * ลำดับหลักและสำรอง: which model, picture model or voice service each kind of work tries first,
 * and what it falls back to (owner, 2026-10-21, mockup v3
 * https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey). Five groups — Autobot, เขียน, รูปภาพ, เสียง, and
 * วิดีโอ (owner, 2026-10-27, ก, https://claude.ai/artifact/N3J5kgXMb1XQEogq2Lou7M) — of ten lanes, each
 * set on ตั้งค่า AI and saved in ins_ai_settings.lanes.
 *
 * A lane is only what it lists, in that order: nothing is added behind it. What a member picked
 * (a writer, a painter, a voice) still goes first; the lane is what follows it.
 *
 * Browser-safe: nothing here reads the database or a key.
 */
import type { Tier } from "./types";

export type LaneKey =
  | "bot-small" | "bot-large"
  | "write-post" | "write-help" | "write-read"
  | "image-plain" | "image-face"
  | "voice"
  | "video-script" | "video-post";

export type LaneGroup = "bot" | "write" | "image" | "voice" | "video";

/** what a lane's ids name: a text model's model_name, an image model's model_configs id, a voice service */
export type LaneKind = "text" | "image" | "voice";

export interface LaneDef {
  key: LaneKey;
  group: LaneGroup;
  kind: LaneKind;
  title: string;
  /** the line under the title */
  sub: string;
  /** the order the system used before lanes could be set, plus DeepSeek ahead of OpenRouter */
  defaults: string[];
  /** a text lane whose work sends pictures: only models that read them may be added */
  readsPictures?: boolean;
  /**
   * a lane split off another (the วิดีโอ lanes off งานช่วย): until it is saved itself, it is that
   * lane as saved, so the work it takes over keeps the order it had
   */
  inherits?: LaneKey;
}

/** the voice services, in the owner's order of 2026-10-20 */
export const VOICE_SERVICES = ["gemini-api", "gemini-cloud", "elevenlabs"] as const;
export type VoiceService = (typeof VOICE_SERVICES)[number];

const SMALL = [
  "gemini-3.1-flash-lite", "gpt-5-mini", "glm-5.3-flash", "claude-haiku-4-5-20251001",
  "typhoon-v2.5-30b-a3b-instruct", "deepseek-flash", "google/gemini-3.1-flash-lite",
];

export const LANES: LaneDef[] = [
  {
    key: "bot-small", group: "bot", kind: "text", defaults: SMALL,
    title: "อ่านคำถาม · ตอบสั้น · ตอบเรื่องแบบประกัน", sub: "ราคาต่อ 1,000 คำตอบ",
  },
  {
    // the chat review's own list (gemini-3.7-flash first) and the large tier behind it
    key: "bot-large", group: "bot", kind: "text",
    defaults: ["gemini-3.7-flash", "claude-sonnet-5", "gpt-5", "glm-5.3", "deepseek-v4-pro", "anthropic/claude-sonnet-5"],
    title: "ตอบจากเอกสาร · ทบทวนแชท", sub: "ราคาต่อ 1,000 คำตอบ",
  },
  {
    key: "write-post", group: "write", kind: "text", defaults: ["claude-sonnet-5", "gpt-5", "gemini-3.7-flash"],
    title: "เขียนโพสต์",
    sub: "ตัวที่สมาชิกเลือก (ดีที่สุด / สมดุล / ประหยัด) มาก่อน ถ้าใช้ไม่ได้จะลองตามลำดับนี้ · ประหยัดไม่สำรองไปตัวที่แพงกว่า",
  },
  {
    key: "write-help", group: "write", kind: "text", defaults: SMALL,
    title: "งานช่วย: วางโครง ตรวจคำ พาดหัว บรีฟรูป แผนประกัน", sub: "ราคาต่อ 1,000 งาน",
  },
  {
    key: "write-read", group: "write", kind: "text", readsPictures: true,
    defaults: ["gemini-3.7-flash", "gpt-5", "claude-sonnet-5"],
    title: "อ่านรูปและเอกสาร: โปสเตอร์ เอกสารเคลม รูปผลงาน รูปเป็นพรอมต์", sub: "ต้องเป็นตัวที่อ่านรูปได้ · ราคาต่อ 1,000 งาน",
  },
  {
    key: "image-plain", group: "image", kind: "image", defaults: ["gpt-image-medium", "gemini-image-lite"],
    title: "รูปทั่วไป", sub: "แบบรูปที่สมาชิกเลือกมาก่อน ไม่สำรองไปตัวที่ไม่ได้อยู่ในรายการนี้",
  },
  {
    key: "image-face", group: "image", kind: "image", defaults: ["gemini-image", "gpt-image-medium", "gemini-image-lite"],
    title: "รูปที่มีคนจากคลังรูป", sub: "Gemini เก็บหน้าคนได้ดีที่สุด จึงอยู่บนสุด",
  },
  {
    key: "voice", group: "voice", kind: "voice", defaults: [...VOICE_SERVICES],
    title: "เสียงพากย์คลิป",
    sub: "เสียงที่สมาชิกเลือกมาก่อน · ElevenLabs ใช้เสียง อ้อม หรือ สมชาย ตามเพศผู้พากย์ และอ่านเฉพาะคลิปภาษาไทย",
  },
  {
    key: "video-script", group: "video", kind: "text", defaults: SMALL, inherits: "write-help",
    title: "สคริปต์วิดีโอ", sub: "ปุ่ม “ดูสคริปต์” ในวิดีโอนำเสนอ และบทของคลิปตามโจทย์ · เดิมใช้ลำดับ “งานช่วย” ของหมวดเขียน",
  },
  {
    key: "video-post", group: "video", kind: "text", defaults: SMALL, inherits: "write-help",
    title: "ข้อความโพสต์กับคลิป", sub: "ข้อความที่แนบไปกับคลิปตอนส่ง LINE / Messenger · เดิมใช้ลำดับ “งานช่วย” ของหมวดเขียน",
  },
];

export const laneDef = (key: LaneKey): LaneDef => LANES.find((l) => l.key === key)!;
export const isLaneKey = (k: unknown): k is LaneKey => LANES.some((l) => l.key === k);

export interface LaneEntry { id: string; on: boolean }
export type SavedLanes = Partial<Record<LaneKey, LaneEntry[]>>;

/** What the database held, kept only where it has the shape of a lane; anything else is as if never saved. */
export function parseLanes(raw: unknown): SavedLanes {
  if (!raw || typeof raw !== "object") return {};
  const out: SavedLanes = {};
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!isLaneKey(key) || !Array.isArray(list)) continue;
    const entries = list
      .filter((e): e is LaneEntry => Boolean(e) && typeof (e as LaneEntry).id === "string" && typeof (e as LaneEntry).on === "boolean")
      .map(({ id, on }) => ({ id, on }));
    if (entries.length) out[key] = entries;
  }
  return out;
}

/** a lane as the page shows it: as saved, else the lane it was split off as saved, else the defaults all switched on */
export function laneEntries(saved: SavedLanes, key: LaneKey): LaneEntry[] {
  const def = laneDef(key);
  return saved[key] ?? (def.inherits && saved[def.inherits]) ?? def.defaults.map((id) => ({ id, on: true }));
}

/** the ids a lane will try, in order */
export function laneIds(saved: SavedLanes, key: LaneKey): string[] {
  return laneEntries(saved, key).filter((e) => e.on).map((e) => e.id);
}

/** the chat bots' work: Messenger, LINE and the web chat, and the review of their real chats */
const BOT_TASK = /^(route|small_talk|smalltalk|plan_info)(_|$)|^chat-review$/;

/** the วิดีโอ group's text work: a clip's script (วิดีโอนำเสนอ's brief, คลิปตามโจทย์'s script) and its post text */
export const VIDEO_SCRIPT_TASKS = new Set(["quote-video-brief", "prompt-story-script"]);
export const VIDEO_POST_TASKS = new Set(["quote-video-post"]);

/** Studio's reading of a picture or a document: needs a model that reads pictures */
export const READ_TASKS = new Set(["content-poster-read", "content-showcase-read", "content-claim-read", "content-describe-picture"]);

/** Which lane a chat call belongs to, by the task it records itself under and the size it asked for. */
export function laneOf(task: string, tier: Tier): LaneKey {
  if (BOT_TASK.test(task)) return tier === "small" ? "bot-small" : "bot-large";
  if (VIDEO_SCRIPT_TASKS.has(task)) return "video-script";
  if (VIDEO_POST_TASKS.has(task)) return "video-post";
  if (READ_TASKS.has(task)) return "write-read";
  return tier === "small" ? "write-help" : "write-post";
}
