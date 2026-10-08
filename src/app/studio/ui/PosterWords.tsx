"use client";
import { BLOCK_KINDS, BLOCK_LABEL, MAX_CHARS, type BlockKind } from "@/lib/content/poster";

/**
 * ข้อความบนโปสเตอร์ (owner, 2026-10-08): the agent's own words for the poster, typed before the
 * round. With a headline they stand in place of what the writer would put on every poster of
 * the round; without one the writer's own are used (poster-words.ts). Not remembered — the
 * words belong to one round's story, so they stay in the field where they can be seen, and go.
 */
export type PosterWordsValue = Partial<Record<BlockKind, string>>;

export function PosterWords({ value, onChange }: { value: PosterWordsValue; onChange: (next: PosterWordsValue) => void }) {
  const typed = BLOCK_KINDS.some((k) => value[k]?.trim());
  const used = Boolean(value.headline?.trim());
  return (
    <details className="group rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)]" open={typed || undefined}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="font-medium">ข้อความบนโปสเตอร์ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
        <span className="shrink-0 whitespace-nowrap text-xs text-[var(--ct-mute)]">{used ? "ใช้ข้อความของคุณ" : typed ? "ยังไม่มีพาดหัว" : "AI คิดให้"}</span>
      </summary>
      <div className="space-y-3 border-t border-[var(--ct-hair)] p-3">
        {BLOCK_KINDS.map((kind) => (
          <label key={kind} className="block">
            <span className="mb-1 flex justify-between text-sm font-medium">
              <span>{BLOCK_LABEL[kind]}{kind === "headline" ? "" : " (ไม่ใส่ก็ได้)"}</span>
              <span className="text-xs font-normal text-[var(--ct-mute)]">{[...(value[kind] ?? "")].length}/{MAX_CHARS[kind]}</span>
            </span>
            <input
              value={value[kind] ?? ""} maxLength={MAX_CHARS[kind]}
              onChange={(e) => onChange({ ...value, [kind]: e.target.value })}
              className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]"
            />
          </label>
        ))}
        <p className="text-xs text-[var(--ct-mute)]">
          ใส่พาดหัวแล้วโปสเตอร์ทุกชิ้นในรอบนี้ใช้ข้อความที่พิมพ์ตามนั้น ช่องที่เว้นว่างคือไม่มีบรรทัดนั้น ไม่ใส่พาดหัว AI คิดข้อความให้เหมือนเดิม
        </p>
      </div>
    </details>
  );
}
