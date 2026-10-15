"use client";
import Link from "next/link";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";

/**
 * เสียงของฉัน in a clip form's voice picker (owner, 2026-10-15, mockup
 * https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m): the agent's own cloned voice, first; or, for
 * an agent invited to clone who has none yet, the way to make one.
 */
export function MyVoiceRow({ eleven, voice, pick, play, playing, chip, small, extra, canClone }: {
  eleven: ElevenChoice[];
  voice: string;
  pick: (id: string) => void;
  play: (src: string) => void;
  playing: string | null;
  chip: (on: boolean) => string;
  small: string;
  extra: string;
  canClone: boolean;
}) {
  const mine = eleven.find((v) => v.mine);
  if (!mine) {
    return canClone ? (
      <Link href="/studio/voice" className="mb-3 inline-flex min-h-11 items-center rounded-full border border-dashed border-[var(--ct-solid)] px-4 py-1.5 text-sm text-[var(--ct-accent)] no-underline hover:bg-[var(--ct-soft)]">
        โคลนเสียงของคุณ ใช้พากย์ทุกคลิป →
      </Link>
    ) : null;
  }
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs font-medium text-[var(--ct-mute)]">เสียงของฉัน · +{extra} บาท</span>
      <span className="inline-flex items-center gap-1.5">
        <button type="button" className={chip(voice === mine.id)} onClick={() => pick(mine.id)}>เสียงของฉัน <span className="font-normal opacity-80">· {mine.tag}</span></button>
        {mine.sample && <button type="button" className={small} onClick={() => play(mine.sample)} aria-label="ฟังตัวอย่างเสียงของฉัน">{playing === mine.sample ? "■" : "▶"}</button>}
      </span>
    </div>
  );
}
