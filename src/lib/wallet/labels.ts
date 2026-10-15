import type { WalletEntry } from "./store";

/** what each paid round is called, by the `round` a charge carries; shared by the wallet page and /home's history */
export const ROUND_NAMES: Record<string, string> = {
  "ai-write": "เขียนโพสต์", "ai-recruit": "หาทีม", "ai-knowledge": "ความรู้", "ai-draft": "เขียนเอง", "ai-thanks": "ขอบคุณลูกค้า", "ai-showcase": "โชว์ผลงาน", "ai-saying": "คำคม",
  "ai-claim": "รีวิวเคลม", "ai-draw": "วาดภาพ", "ai-clip": "ถอดเสียงคลิป", "ai-edit": "ตัดต่อคลิป", "ai-describe": "ถอดรูปเป็น prompt", "quote-video": "วิดีโอนำเสนอ", "voice-clone": "เปิดใช้เสียงของฉัน",
};

export const entryLabel = (e: Pick<WalletEntry, "kind" | "round" | "note">) =>
  e.kind === "topup" ? "เติมเงิน"
    : e.kind === "charge" ? ROUND_NAMES[e.round ?? ""] ?? "ใช้ AI"
    : e.kind === "clawback" ? `หักคืน${e.note ? ` (${e.note})` : ""}`
    : e.kind === "referral" ? `ชวนเพื่อน${e.note ? ` · ${e.note}` : ""}`
    : `ปรับโดยเจ้าของ${e.note ? ` (${e.note})` : ""}`;
