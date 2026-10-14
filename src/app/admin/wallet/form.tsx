"use client";
import type { Result } from "./actions";

/**
 * The same look as /admin/ai (its Card, tokens and input classes), so the two settings pages
 * read as one back office. Every control is at least 44px tall: the owner uses this on a phone.
 */
export const input = "min-h-11 rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-1 text-sm";
export const primary = "min-h-11 rounded bg-[var(--bot-navy)] px-4 text-sm text-[var(--bot-surface)] disabled:opacity-40";
export const quiet = "min-h-11 rounded border border-[var(--bot-line-strong)] px-3 text-sm font-medium text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

/** A save's answer, beside the button that asked: green with a tick, or red with the reason. */
export function Said({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span role="status" className={`text-xs ${ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
      {ok ? "✓ " : ""}{text}
    </span>
  );
}

/** A thrown action means the request never came back; a returned one carries its own Thai sentence. */
export async function ask(fn: () => Promise<Result>, ok: string): Promise<{ ok: boolean; text: string }> {
  try {
    const r = await fn();
    return r.ok ? { ok: true, text: ok } : { ok: false, text: r.error };
  } catch {
    return { ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" };
  }
}

