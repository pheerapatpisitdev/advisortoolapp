/**
 * คลังแอนิเมชัน's uploads (spec 2026-11-14-library-uploads-design.md): the kinds, the limits and the words.
 * Browser-safe: no server imports, so the page and the store read the same rules.
 */

export type UploadKind = "part" | "style" | "ask";
/** gone: an ok part or style the owner took back out of the library (spec 2026-11-14-library-withdraw-design.md) */
export type UploadState = "wait" | "ok" | "no" | "queue" | "closed" | "gone";

export const KIND_NAME: Record<UploadKind, string> = {
  part: "ชิ้นส่วนภาพ",
  style: "ภาพสไตล์",
  ask: "คำขอชิ้นใหม่",
};

export const KIND_TELLS: Record<UploadKind, string> = {
  part: "ตัวละคร ไอคอน ฉากหลัง ใช้เป็นภาพของฉากแทนภาพ AI",
  style: "ภาพที่ชอบโทนสีหรือลายเส้น ใช้เป็นแนวให้ AI วาดภาพ",
  ask: "อยากได้อุปกรณ์หรือรูปแบบที่ยังไม่มี ส่งเป็นข้อความ ลิงก์ หรือภาพหน้าจอ",
};

export const KIND_HINT: Record<UploadKind, string> = {
  part: "PNG ไม่เกิน 5 MB",
  style: "JPG หรือ PNG ไม่เกิน 5 MB",
  ask: "ภาพหน้าจอไม่เกิน 3 ภาพ (ไม่บังคับ)",
};

export const REASONS: readonly string[] = [
  "อาจติดลิขสิทธิ์",
  "มีข้อมูลหรือหน้าลูกค้า",
  "ภาพไม่ชัดหรือเล็กเกินไป",
  "ไม่เกี่ยวกับงานประกัน",
];

export const NAME_MAX = 60;
export const NOTE_MAX = 300;
export const FILE_MAX = 5 * 1024 * 1024;
export const PER_PERSON = 20;
export const SHOTS_MAX = 3;
/** the page re-encodes a picked picture to at most this many pixels on its longest side */
export const SIDE_MAX = 1600;

export const isUploadKind = (v: unknown): v is UploadKind => v === "part" || v === "style" || v === "ask";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUploadId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** a state in words ("States in words", spec); a waiting picture and a waiting ask differ */
export function stateWord(kind: UploadKind, state: UploadState): string {
  switch (state) {
    case "wait": return kind === "ask" ? "รอเจ้าของดู" : "รออนุมัติ";
    // the owner's page: a file in the library (controller ruling, 2026-11-14)
    case "ok": return "อยู่ในคลัง";
    case "no": return "ไม่ผ่าน";
    case "queue": return "อยู่ในคิวทำ";
    case "closed": return "ปิดคำขอ";
    case "gone": return "ถอนออกแล้ว";
  }
}

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEAD = [0xff, 0xd8, 0xff];
const starts = (b: Uint8Array, head: number[]) => b.length >= head.length && head.every((x, i) => b[i] === x);

/** the file's real type from its first bytes, never from what it says it is */
export function sniff(bytes: Uint8Array): "png" | "jpeg" | null {
  if (starts(bytes, PNG_HEAD)) return "png";
  if (starts(bytes, JPEG_HEAD)) return "jpeg";
  return null;
}

export interface UploadRow {
  id: string;
  agentId: string;
  kind: UploadKind;
  name: string;
  note: string;
  paths: string[];
  state: UploadState;
  reason: string | null;
  createdAt: string;
}

/** what the page may hold: never an agentId */
export interface UploadView {
  id: string;
  kind: UploadKind;
  name: string;
  note: string;
  files: number;
  state: UploadState;
  reason: string | null;
  mine: boolean;
}
