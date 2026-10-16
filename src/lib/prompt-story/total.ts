import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { promptPicturePrice, promptPicturesPrice, promptStoryPrice, type PromptStoryInput } from "./types";

/**
 * The line above สร้างคลิป (owner's mockup, 2026-10-16): what pressing it takes, before anything is
 * held. Prices are the wallet list's; the sum is promptStoryPrice, never worked out again here.
 */
export function totalLine(v: {
  scenes: number;
  painter: PromptStoryInput["painter"];
  voice?: string;
  prices: Prices;
  /** how the next clip is paid for (CostView.kind) */
  kind: "staff" | "free" | "wallet" | "closed";
}): { text: string; baht: string } {
  // only scenes.length, painter and voice are read by the price functions
  const shell = { scenes: Array.from({ length: v.scenes }), painter: v.painter, ...(v.voice ? { voice: v.voice } : {}) } as unknown as PromptStoryInput;
  const each = priceBaht(promptPicturePrice(shell, v.prices));
  const pictures = `รูป ${v.scenes} × ฿${each}`;
  if (v.kind === "staff") return { text: "เจ้าของใช้ฟรี", baht: "0" };
  if (v.kind === "free") {
    const sum = priceBaht(promptPicturesPrice(shell, v.prices));
    return { text: `ใช้สิทธิ์ฟรี 1 ครั้งกับค่าคลิป · ${pictures} = ฿${sum} หักจากกระเป๋า`, baht: sum };
  }
  const total = priceBaht(promptStoryPrice(shell, v.prices));
  const clip = priceBaht(v.prices.videoStory);
  if (v.voice) return { text: `ค่าคลิป ฿${clip} + ${pictures} + เสียง ElevenLabs ฿${priceBaht(v.prices.elevenExtra)} = ฿${total}`, baht: total };
  return { text: `ค่าคลิป ฿${clip} + ${pictures} = ฿${total} · เสียง ElevenLabs +฿${priceBaht(v.prices.elevenExtra)} (ถ้าเลือก)`, baht: total };
}
