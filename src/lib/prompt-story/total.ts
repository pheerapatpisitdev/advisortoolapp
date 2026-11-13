import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { promptFreePrice, promptPicturePrice, promptStoryPrice, type PromptStoryInput } from "./types";

/**
 * The line above สร้างคลิป (owner's mockup, 2026-10-16): what pressing it takes, before anything is
 * held. Prices are the wallet list's; the sum is promptStoryPrice, never worked out again here.
 */
export function totalLine(v: {
  scenes: number;
  /** the scenes drawn by the painter (pictureScenes); a device scene is not charged. None given: every scene */
  pictures?: number;
  painter: PromptStoryInput["painter"];
  voice?: string;
  prices: Prices;
  /** how the next clip is paid for (CostView.kind) */
  kind: "staff" | "free" | "wallet" | "closed";
  /** a free clip while the wallet is off (CostView's walletOff): the pictures cannot be paid */
  walletOff?: boolean;
  /** the บัญชีสาธิต (CostView's demo, 2026-11-11) */
  demo?: boolean;
}): { text: string; baht: string; blocked?: true } {
  // only the scenes (which carry a device), painter and voice are read by the price functions
  const drawn = Math.min(v.scenes, Math.max(0, v.pictures ?? v.scenes));
  const scenes = Array.from({ length: v.scenes }, (_, i) => (i < drawn ? {} : { device: true }));
  const shell = { scenes, painter: v.painter, ...(v.voice ? { voice: v.voice } : {}) } as unknown as PromptStoryInput;
  const each = priceBaht(promptPicturePrice(shell, v.prices));
  const pictures = `รูป ${drawn} × ฿${each}`;
  if (v.kind === "staff") return { text: v.demo ? "บัญชีทดลอง ใช้ฟรี" : "เจ้าของใช้ฟรี", baht: "0" };
  // owner, 2026-10-16: the button is shut and says why, rather than refusing after the press
  if (v.kind === "free" && v.walletOff) return { text: "ค่าภาพประกอบจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้ จึงยังสร้างคลิปตามโจทย์ไม่ได้", baht: "0", blocked: true };
  if (v.kind === "free") {
    const sum = priceBaht(promptFreePrice(shell, v.prices));
    return { text: `ใช้สิทธิ์ฟรี 1 ครั้งกับค่าคลิป · ${pictures} = ฿${sum} หักจากกระเป๋า`, baht: sum };
  }
  const total = priceBaht(promptStoryPrice(shell, v.prices));
  const clip = priceBaht(v.prices.videoPrompt);
  const named = "ค่าคลิป";
  if (v.voice) return { text: `${named} ฿${clip} + ${pictures} + เสียง ElevenLabs ฿${priceBaht(v.prices.elevenExtra)} = ฿${total}`, baht: total };
  return { text: `${named} ฿${clip} + ${pictures} = ฿${total} · เสียง ElevenLabs +฿${priceBaht(v.prices.elevenExtra)} (ถ้าเลือก)`, baht: total };
}
