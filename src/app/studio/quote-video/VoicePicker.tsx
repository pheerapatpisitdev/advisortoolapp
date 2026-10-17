"use client";
import { useEffect, useRef, useState } from "react";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";

/** Gemini's two narrators and their samples (owner, 2026-10-11) */
export const GEMINI = [
  { n: "F" as const, name: "ผู้หญิง", tag: "Kore", sample: "/voice-samples/gemini-F.mp3" },
  { n: "M" as const, name: "ผู้ชาย", tag: "Orus", sample: "/voice-samples/gemini-M.mp3" },
];
export type GeminiVoice = (typeof GEMINI)[number];

const field = "min-w-0 flex-1 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const small = "min-h-9 shrink-0 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const label = "mb-1 block text-sm font-medium";
const GEMINI_PREFIX = "gemini:";

/**
 * เสียงพากย์ as one dropdown (owner, 2026-10-17, mockup ก AvXHpJU4BDizDq6USMKKwt): Google's two
 * narrators, then the ElevenLabs men and women in their own groups, and one ▶ ฟัง for the voice picked.
 * `eleven` empty (or `foreign`) leaves Google's two alone.
 */
export function VoicePicker({ id, narrator, voice, eleven, extraBaht, onPick, sampleOf = (g) => g.sample, foreign = false, note }: {
  id: string;
  narrator: "F" | "M";
  /** an ElevenLabs voice's id, or "" for Gemini */
  voice: string;
  eleven: ElevenChoice[];
  /** what an ElevenLabs voice adds to the clip, in baht as shown */
  extraBaht: string;
  /** voice "" = Gemini's narrator; otherwise the ElevenLabs voice and its sex */
  onPick: (narrator: "F" | "M", voice: string) => void;
  /** Gemini's sample in the clip's language */
  sampleOf?: (g: GeminiVoice) => string;
  /** a clip in another language: ElevenLabs' Thai voices are left out */
  foreign?: boolean;
  /** the line under the dropdown, when the page has its own words for it */
  note?: string;
}) {
  const choices = foreign ? [] : eleven;
  const picked = choices.find((v) => v.id === voice);
  const value = picked ? picked.id : `${GEMINI_PREFIX}${narrator}`;
  const sample = picked ? picked.sample : sampleOf(GEMINI.find((g) => g.n === narrator) ?? GEMINI[0]);

  // one sample plays at a time; picking another voice stops it
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  function stop() {
    player.current?.pause();
    setPlaying(null);
  }
  function play() {
    if (playing === sample) { stop(); return; }
    player.current?.pause();
    const a = new Audio(sample);
    a.onended = () => setPlaying(null);
    player.current = a;
    setPlaying(sample);
    a.play().catch(() => setPlaying(null));
  }
  useEffect(() => () => player.current?.pause(), []);

  function pick(next: string) {
    stop();
    if (next.startsWith(GEMINI_PREFIX)) onPick(next.slice(GEMINI_PREFIX.length) === "M" ? "M" : "F", "");
    else {
      const v = choices.find((c) => c.id === next);
      if (v) onPick(v.sex, v.id);
    }
  }

  return (
    <div>
      <label className={label} htmlFor={id}>เสียงพากย์</label>
      <div className="flex items-center gap-2">
        <select id={id} className={field} value={value} onChange={(e) => pick(e.target.value)}>
          <optgroup label={choices.length ? "Google · ราคาเดิม" : "Google"}>
            {GEMINI.map((g) => <option key={g.n} value={`${GEMINI_PREFIX}${g.n}`}>{`${g.name} · ${g.tag}`}</option>)}
          </optgroup>
          {(["M", "F"] as const).map((sex) => {
            const group = choices.filter((v) => v.sex === sex);
            return group.length > 0 && (
              <optgroup key={sex} label={`ElevenLabs ${sex === "M" ? "ผู้ชาย" : "ผู้หญิง"} · +${extraBaht} บาท`}>
                {group.map((v) => <option key={v.id} value={v.id}>{`${v.name} · ${v.tag}`}</option>)}
              </optgroup>
            );
          })}
        </select>
        <button type="button" className={small} onClick={play} aria-label={`ฟังตัวอย่างเสียง${picked ? ` ${picked.name}` : GEMINI.find((g) => g.n === narrator)?.name ?? ""}`}>
          {playing === sample ? "■ หยุด" : "▶ ฟัง"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--ct-mute)]">
        {note ?? (picked ? `เสียงเหมือนคนพูด ใช้เสียงในบัญชี ElevenLabs · +${extraBaht} บาท` : "เสียง AI ของ Google ราคาเดิม")}
      </p>
    </div>
  );
}
