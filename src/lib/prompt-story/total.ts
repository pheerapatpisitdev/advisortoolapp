import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { promptDesignExtra, promptFreePrice, promptPicturePrice, promptStoryPrice, type PromptStoryInput } from "./types";

/**
 * The line above สร้างคลิป (owner's mockup, 2026-10-16): what pressing it takes, before anything is
 * held. Prices are the wallet list's; the sum is promptStoryPrice, never worked out again here.
 */
export function totalLine(v: {
  scenes: number;
  painter: PromptStoryInput["painter"];
  voice?: string;
  /** ดีไซน์พิเศษ chosen: its own clip price, and its extra on a free clip */
  design?: PromptStoryInput["design"];
  prices: Prices;
  /** how the next clip is paid for (CostView.kind) */
  kind: "staff" | "free" | "wallet" | "closed";
  /** a free clip while the wallet is off (CostView's walletOff): the pictures cannot be paid */
  walletOff?: boolean;
}): { text: string; baht: string; blocked?: true } {
  // only scenes.length, painter, voice and design are read by the price functions
  const shell = { scenes: Array.from({ length: v.scenes }), painter: v.painter, ...(v.voice ? { voice: v.voice } : {}), ...(v.design ? { design: v.design } : {}) } as unknown as PromptStoryInput;
  const each = priceBaht(promptPicturePrice(shell, v.prices));
  const pictures = `รูป ${v.scenes} × ฿${each}`;
  if (v.kind === "staff") return { text: "เจ้าของใช้ฟรี", baht: "0" };
  // owner, 2026-10-16: the button is shut and says why, rather than refusing after the press
  if (v.kind === "free" && v.walletOff) return { text: "ค่าภาพประกอบจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้ จึงยังสร้างคลิปตามโจทย์ไม่ได้", baht: "0", blocked: true };
  if (v.kind === "free") {
    const sum = priceBaht(promptFreePrice(shell, v.prices));
    const extra = promptDesignExtra(shell, v.prices);
    return { text: `ใช้สิทธิ์ฟรี 1 ครั้งกับค่าคลิป · ${pictures}${extra ? ` + ดีไซน์พิเศษ ฿${priceBaht(extra)}` : ""} = ฿${sum} หักจากกระเป๋า`, baht: sum };
  }
  const total = priceBaht(promptStoryPrice(shell, v.prices));
  const clip = priceBaht(v.design ? v.prices.videoPromptDesign : v.prices.videoPrompt);
  const named = v.design ? "ค่าคลิปดีไซน์พิเศษ" : "ค่าคลิป";
  if (v.voice) return { text: `${named} ฿${clip} + ${pictures} + เสียง ElevenLabs ฿${priceBaht(v.prices.elevenExtra)} = ฿${total}`, baht: total };
  return { text: `${named} ฿${clip} + ${pictures} = ฿${total} · เสียง ElevenLabs +฿${priceBaht(v.prices.elevenExtra)} (ถ้าเลือก)`, baht: total };
}
