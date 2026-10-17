"use client";
import type { VideoSize } from "@/lib/quote-video/timeline";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { FacePicker } from "../story-clip/StoryClipBoard";
import { SizePicker } from "../quote-video/QuoteVideoBoard";
import { VoicePicker } from "../quote-video/VoicePicker";

/** หน้าตาคลิป: the size, the narrator's face and the voice, as คลิปเล่าเรื่อง asks them */

export interface Look { size: VideoSize; narrator: "F" | "M"; voice: string }

const label = "mb-1 block text-sm font-medium";

export function LookStep({ look, pick, face, pickFace, customer, setCustomer, eleven, prices }: {
  look: Look;
  pick: (next: Partial<Look>) => void;
  face: string;
  pickFace: (f: string) => void;
  customer: string;
  setCustomer: (v: string) => void;
  eleven: ElevenChoice[];
  prices: Prices;
}) {

  return (
    <div className="space-y-3">
      <SizePicker size={look.size} pick={(size) => pick({ size })} />
      <div>
        <span className={label}>หน้าผู้เล่า</span>
        <FacePicker id="ps-face" value={face} onPick={pickFace} />
      </div>
      <VoicePicker
        id="ps-voice" narrator={look.narrator} voice={look.voice} eleven={eleven} extraBaht={priceBaht(prices.elevenExtra)}
        onPick={(narrator, voice) => pick({ voice, narrator })}
      />
      <label className="block">
        <span className={label}>ชื่อลูกค้า (ไม่ใส่ก็ได้)</span>
        <input className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm" value={customer} maxLength={40} onChange={(e) => setCustomer(e.target.value)} placeholder="ชื่อเล่นหรือชื่อ" />
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">คลิปที่มีชื่อลูกค้าไม่มีปุ่มลงเพจ</span>
      </label>
    </div>
  );
}
