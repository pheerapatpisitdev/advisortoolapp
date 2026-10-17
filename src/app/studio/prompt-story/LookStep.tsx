"use client";
import { useEffect, useRef, useState } from "react";
import type { VideoSize } from "@/lib/quote-video/timeline";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { FacePicker } from "../story-clip/StoryClipBoard";
import { GEMINI, SizePicker } from "../quote-video/QuoteVideoBoard";

/** หน้าตาคลิป: the size, the narrator's face and the voice, as คลิปเล่าเรื่อง asks them */

export interface Look { size: VideoSize; narrator: "F" | "M"; voice: string }

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
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
  // one voice sample plays at a time
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  function playSample(src: string) {
    player.current?.pause();
    if (playing === src) { setPlaying(null); return; }
    const a = new Audio(src);
    a.onended = () => setPlaying(null);
    player.current = a;
    setPlaying(src);
    a.play().catch(() => setPlaying(null));
  }
  useEffect(() => () => player.current?.pause(), []);
  const extra = priceBaht(prices.elevenExtra);

  return (
    <div className="space-y-3">
      <SizePicker size={look.size} pick={(size) => pick({ size })} />
      <div>
        <span className={label}>หน้าผู้เล่า</span>
        <FacePicker id="ps-face" value={face} onPick={pickFace} />
      </div>
      <div>
        <span className={label}>เสียงพากย์</span>
        <div className="flex flex-wrap items-center gap-2">
          {GEMINI.map((g) => (
            <span key={g.n} className="inline-flex items-center gap-2">
              <button type="button" className={chip(!look.voice && look.narrator === g.n)} onClick={() => pick({ voice: "", narrator: g.n })}>{g.name} <span className="font-normal opacity-80">· {g.tag}</span></button>
              <button type="button" className={small} onClick={() => playSample(g.sample)} aria-label={`ฟังตัวอย่างเสียง${g.name}`}>{playing === g.sample ? "■ หยุด" : "▶ ฟัง"}</button>
            </span>
          ))}
        </div>
        {eleven.length > 0 && (["M", "F"] as const).map((sex) => (
          <div key={sex} className="mt-3">
            <span className="mb-1 block text-xs font-medium text-[var(--ct-mute)]">ElevenLabs {sex === "M" ? "ผู้ชาย" : "ผู้หญิง"} · เหมือนคนพูด +{extra} บาท</span>
            <div className="flex flex-wrap items-center gap-2">
              {eleven.filter((v) => v.sex === sex).map((v) => (
                <span key={v.id} className="inline-flex items-center gap-1.5">
                  <button type="button" className={chip(look.voice === v.id)} onClick={() => pick({ voice: v.id, narrator: v.sex })}>{v.name} <span className="font-normal opacity-80">· {v.tag}</span></button>
                  <button type="button" className={small} onClick={() => playSample(v.sample)} aria-label={`ฟังตัวอย่างเสียง ${v.name}`}>{playing === v.sample ? "■" : "▶"}</button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <label className="block">
        <span className={label}>ชื่อลูกค้า (ไม่ใส่ก็ได้)</span>
        <input className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm" value={customer} maxLength={40} onChange={(e) => setCustomer(e.target.value)} placeholder="ชื่อเล่นหรือชื่อ" />
        <span className="mt-1 block text-xs text-[var(--ct-mute)]">คลิปที่มีชื่อลูกค้าไม่มีปุ่มลงเพจ</span>
      </label>
    </div>
  );
}
