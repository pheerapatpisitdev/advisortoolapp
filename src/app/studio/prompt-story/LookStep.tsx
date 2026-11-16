"use client";
import type { VideoSize } from "@/lib/quote-video/timeline";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { SizePicker } from "../quote-video/QuoteVideoBoard";
import { VoicePicker } from "../quote-video/VoicePicker";

/** หน้าตาคลิป: the size and the voice, as คลิปเล่าเรื่อง asks them (the narrator's face left the form, owner chose ก, 2026-11-17) */

/**
 * `gemini`: one of Gemini's 30 voices by name, or "" for the narrator's own (owner, 2026-10-17).
 * (ดีไซน์พิเศษ, Shotstack's looks, removed 2026-11-11, owner.)
 */
export interface Look { size: VideoSize; narrator: "F" | "M"; voice: string; gemini: string }

const label = "mb-1 block text-sm font-medium";

export function LookStep({ look, pick, customer, setCustomer, eleven, prices }: {
  look: Look;
  pick: (next: Partial<Look>) => void;
  customer: string;
  setCustomer: (v: string) => void;
  eleven: ElevenChoice[];
  prices: Prices;
}) {

  return (
    <div className="space-y-3">
      <SizePicker size={look.size} pick={(size) => pick({ size })} />
      <VoicePicker
        id="ps-voice" pick={look} eleven={eleven} extraBaht={priceBaht(prices.elevenExtra)}
        onPick={(p) => pick(p)}
      />
      <label className="block">
        <span className={label}>ชื่อลูกค้า (ไม่ใส่ก็ได้)</span>
        <input className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm" value={customer} maxLength={40} onChange={(e) => setCustomer(e.target.value)} placeholder="ชื่อเล่นหรือชื่อ" />
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">คลิปที่มีชื่อลูกค้าไม่มีปุ่มลงเพจ</span>
      </label>
    </div>
  );
}
