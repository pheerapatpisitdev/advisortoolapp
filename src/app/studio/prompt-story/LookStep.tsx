"use client";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { DESIGN_LOOKS, DESIGN_THUMBS, type DesignLook } from "@/lib/shotstack/looks";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { FacePicker } from "../story-clip/StoryClipBoard";
import { SizePicker } from "../quote-video/QuoteVideoBoard";
import { VoicePicker } from "../quote-video/VoicePicker";

/** หน้าตาคลิป: the size, the narrator's face and the voice, as คลิปเล่าเรื่อง asks them */

/**
 * `gemini`: one of Gemini's 30 voices by name, or "" for the narrator's own (owner, 2026-10-17).
 * `design`: ดีไซน์พิเศษ's look, Shotstack's (owner, 2026-10-21), or "" for แบบเดิม.
 */
export interface Look { size: VideoSize; narrator: "F" | "M"; voice: string; gemini: string; design: DesignLook | "" }

/** ทำคลิปแบบ: แบบเดิม, or ดีไซน์พิเศษ in one of its three looks (mockup FqkpbJne v2, step 4) */
function DesignPicker({ design, pick, extra }: { design: DesignLook | ""; pick: (d: DesignLook | "") => void; extra: string }) {
  return (
    <div>
      <span className={label}>ทำคลิปแบบ</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ทำคลิปแบบ">
        <button type="button" role="radio" aria-checked={!design} className={chip(!design)} onClick={() => pick("")}>แบบเดิม</button>
        <button type="button" role="radio" aria-checked={Boolean(design)} className={chip(Boolean(design))} onClick={() => pick(design || "blue")}>ดีไซน์พิเศษ +฿{extra}</button>
      </div>
      {design && (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="เทมเพลต">
            {DESIGN_LOOKS.map((l) => {
              const t = DESIGN_THUMBS[l.id];
              const on = design === l.id;
              return (
                <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => pick(l.id)} className="grid gap-1 text-center text-xs">
                  <span
                    aria-hidden
                    className={`relative block aspect-[9/16] overflow-hidden rounded-md border-2 ${on ? "border-[var(--ct-solid)]" : "border-transparent"}`}
                    style={{ background: `linear-gradient(180deg, ${t.sky} 0 55%, ${t.ground} 55%)` }}
                  >
                    {t.top && <span className="absolute inset-x-0 top-0 h-[13%]" style={{ background: t.band }} />}
                    <span className={`absolute inset-x-0 ${t.top ? "bottom-0 h-[17%]" : "bottom-[12%] h-[18%]"}`} style={{ background: t.band }} />
                  </span>
                  <span className={on ? "font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}>{l.name}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-[var(--ct-mute)]">รูปเต็มจอ ซูมช้าๆ ข้อความไทยบนแถบ เปิดด้วยชื่อคลิป และมีเพลงตามเทมเพลต ไม่มีหน้าผู้เล่า</p>
        </>
      )}
    </div>
  );
}

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;

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
      <DesignPicker design={look.design} pick={(design) => pick({ design })} extra={priceBaht(Math.max(0, prices.videoPromptDesign - prices.videoPrompt))} />
      <SizePicker size={look.size} pick={(size) => pick({ size })} />
      {!look.design && (
        <div>
          <span className={label}>หน้าผู้เล่า</span>
          <FacePicker id="ps-face" value={face} onPick={pickFace} />
        </div>
      )}
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
