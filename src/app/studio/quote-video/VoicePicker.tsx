"use client";
import { useEffect, useRef, useState } from "react";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { GEMINI_DEFAULT, GEMINI_VOICES, geminiVoice, type GeminiChoice } from "@/lib/voice/gemini";

const field = "min-w-0 flex-1 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const small = "min-h-9 shrink-0 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const label = "mb-1 block text-sm font-medium";
const GEMINI_PREFIX = "gemini:";

/** the voice a form has picked, as it is sent with the clip */
export interface VoicePick {
  narrator: "F" | "M";
  /** an ElevenLabs voice's id, or "" for Gemini */
  voice: string;
  /** one of Gemini's 30 by name, or "" for the narrator's own (Kore or Orus) */
  gemini: string;
}

/** the Gemini voice a form stands on: the one named, else the narrator's own */
export const geminiOf = (pick: Pick<VoicePick, "narrator" | "gemini">): GeminiChoice =>
  geminiVoice(pick.gemini) ?? geminiVoice(GEMINI_DEFAULT[pick.narrator])!;

/**
 * เสียงพากย์ as one dropdown (owner, 2026-10-17, mockup ก AvXHpJU4BDizDq6USMKKwt): Gemini's 30 voices,
 * women then men (listen page NdJnGXANrnZjxErZ4GZ4U8), then the ElevenLabs men and women, and one
 * ▶ ฟัง for the voice picked. `eleven` empty (or `foreign`) leaves Google's alone.
 */
export function VoicePicker({ id, pick: now, eleven, extraBaht, onPick, sampleOf = (g) => g.sample, foreign = false, note }: {
  id: string;
  pick: VoicePick;
  eleven: ElevenChoice[];
  /** what an ElevenLabs voice adds to the clip, in baht as shown */
  extraBaht: string;
  onPick: (next: VoicePick) => void;
  /** a Gemini voice's sample in the clip's language */
  sampleOf?: (g: GeminiChoice) => string;
  /** a clip in another language: ElevenLabs' Thai voices are left out */
  foreign?: boolean;
  /** the line under the dropdown, when the page has its own words for it */
  note?: string;
}) {
  const choices = foreign ? [] : eleven;
  const picked = choices.find((v) => v.id === now.voice);
  const gemini = geminiOf(now);
  const value = picked ? picked.id : `${GEMINI_PREFIX}${gemini.name}`;
  const sample = picked ? picked.sample : sampleOf(gemini);

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

  function choose(next: string) {
    stop();
    if (next.startsWith(GEMINI_PREFIX)) {
      const g = geminiVoice(next.slice(GEMINI_PREFIX.length));
      if (g) onPick({ narrator: g.sex, voice: "", gemini: g.name });
    } else {
      const v = choices.find((c) => c.id === next);
      if (v) onPick({ narrator: v.sex, voice: v.id, gemini: now.gemini });
    }
  }
  const price = choices.length ? " · ราคาเดิม" : "";

  return (
    <div>
      <label className={label} htmlFor={id}>เสียงพากย์</label>
      <div className="flex items-center gap-2">
        <select id={id} className={field} value={value} onChange={(e) => choose(e.target.value)}>
          {(["F", "M"] as const).map((sex) => (
            <optgroup key={`g${sex}`} label={`Google ${sex === "M" ? "ผู้ชาย" : "ผู้หญิง"}${price}`}>
              {GEMINI_VOICES.filter((g) => g.sex === sex).map((g) => <option key={g.name} value={`${GEMINI_PREFIX}${g.name}`}>{`${g.name} · ${g.tag}`}</option>)}
            </optgroup>
          ))}
          {(["M", "F"] as const).map((sex) => {
            const group = choices.filter((v) => v.sex === sex);
            return group.length > 0 && (
              <optgroup key={`e${sex}`} label={`ElevenLabs ${sex === "M" ? "ผู้ชาย" : "ผู้หญิง"} · +${extraBaht} บาท`}>
                {group.map((v) => <option key={v.id} value={v.id}>{`${v.name} · ${v.tag}`}</option>)}
              </optgroup>
            );
          })}
        </select>
        <button type="button" className={small} onClick={play} aria-label={`ฟังตัวอย่างเสียง ${picked ? picked.name : gemini.name}`}>
          {playing === sample ? "■ หยุด" : "▶ ฟัง"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--ct-mute)]">
        {note ?? (picked ? `เสียงเหมือนคนพูด ใช้เสียงในบัญชี ElevenLabs · +${extraBaht} บาท` : "เสียง AI ของ Google ราคาเดิม")}
      </p>
    </div>
  );
}
