"use client";
import { useEffect, useRef, useState } from "react";

/**
 * กันกดซ้ำ (owner chose 2ก, 2026-11-28, mockup https://claude.ai/artifact/8cHRwStETT11itXLMhTy8h) for a Studio
 * board's สร้าง button:
 * - one press at a time: a second tap while the first is on its way does nothing (a ref, not state, so two taps in
 *   one frame are caught too);
 * - every press has its own id, which the server makes one clip of at most (createVideo). It is kept when no answer
 *   came back (offline), so pressing again finds the clip if the first press got through after all;
 * - the server's "the same clip is still being made" answer is held as a question (`dup`) for DuplicateAsk;
 * - `started` for five seconds after a clip starts: the button says so and stays locked.
 */
export const STARTED_MS = 5000;

export function usePress() {
  const lock = useRef(false);
  const press = useRef<string | null>(null);
  const [started, setStarted] = useState(false);
  const [dup, setDup] = useState<string | null>(null);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setStarted(false), STARTED_MS);
    return () => clearTimeout(t);
  }, [started]);

  /** one press: `send` gets the press's id and whether the maker already said สร้างอีกคลิป; null when one is on its way */
  async function run<R extends { ok: boolean }>(send: (press: string, dupOk: boolean) => Promise<R>, dupOk = false): Promise<R | null> {
    if (lock.current) return null;
    lock.current = true;
    setDup(null);
    press.current ??= newPressId();
    try {
      const r = await send(press.current, dupOk);
      // an answer came: the next press is a new one
      press.current = null;
      if (r.ok) setStarted(true);
      else if (isDuplicate(r)) setDup(r.error);
      return r;
    } finally {
      lock.current = false;
    }
  }
  /** no press on its way: a make() checks this before it shows itself busy, so a second tap leaves the first alone */
  const free = () => !lock.current;
  return { run, free, started, dup, clearDup: () => setDup(null) };
}

const isDuplicate = (r: object): r is { duplicate: true; error: string } =>
  "duplicate" in r && r.duplicate === true && "error" in r && typeof r.error === "string";

/** a uuid, as the server reads a press (make.ts pressId) */
export function newPressId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** the สร้าง button's words: on its way, just started, or its own */
export const pressWords = (busy: boolean, started: boolean, idle: string) =>
  busy ? "กำลังเริ่ม…" : started ? "✓ เริ่มสร้างแล้ว · ดูความคืบหน้าในรายการคลิป" : idle;

/** the สร้าง button's colour once a clip has started: green, as a step done (ClipProgress) */
export const STARTED_TONE = "!bg-[var(--bot-ok)] !text-[var(--bot-ok-soft)] !opacity-100";

/** the same clip is still being made: make another, or not (owner chose 2ก) */
export function DuplicateAsk({ words, onAgain, onNo }: { words: string; onAgain: () => void; onNo: () => void }) {
  return (
    <div role="alertdialog" aria-label="คลิปนี้กำลังสร้างอยู่" className="space-y-2 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
      <p>{words}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onNo} className="min-h-9 rounded-lg bg-[var(--ct-solid)] px-3 text-sm font-medium text-[var(--ct-solid-ink)]">ไม่สร้างซ้ำ</button>
        <button type="button" onClick={onAgain} className="min-h-9 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm text-[var(--ct-ink)]">สร้างอีกคลิป</button>
      </div>
    </div>
  );
}
