"use client";
import { useState } from "react";
import type { PosterSpec } from "@/lib/content/poster";
import { aiTextState } from "@/lib/content/poster-text";
import type { ContentItem } from "@/lib/content/store";
import { markPosterText } from "./ticks";
import { AlertIcon, CheckIcon } from "./ui/editor-icons";

/**
 * The words the image model drew into a poster from the owner's brief (poster-text.ts): what was
 * read back, what looked wrong, and one tick once the agent has read the picture themselves.
 * `poster` is the editor's own copy, so an edit to the words shows at once that the picture no
 * longer says them. Until ticked — and while it is out of date — the piece may not go up.
 */
export function AiTextCheck({ item, poster, onChecked }: { item: ContentItem; poster: PosterSpec; onChecked: (item: ContentItem) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = aiTextState(poster);
  if (state === "none" || !poster.aiText) return null;

  if (state === "checked") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--ct-mute)]">
        <CheckIcon className="size-4" />ตรวจตัวหนังสือบนภาพแล้ว
      </p>
    );
  }

  if (state === "stale") {
    return (
      <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>แก้ข้อความบนภาพหลังวาดแล้ว ตัวหนังสือบนภาพไม่ตรงกับที่แก้ — กดวาดใหม่ (ใส่บรีฟเดิม) ก่อนโพสต์</span>
      </p>
    );
  }

  async function tick() {
    setSaving(true);
    setError(null);
    const res = await markPosterText(item.id).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setError(res && !res.ok ? res.error : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
      return;
    }
    onChecked(res.item);
  }

  const { issues, read } = poster.aiText;
  return (
    <section aria-label="ตรวจตัวหนังสือบนภาพ" className="mt-3 space-y-2 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
      <p className="flex items-start gap-2 font-medium">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>AI วาดตัวหนังสือบนภาพเอง — อ่านตัวสะกดและตัวเลขบนภาพก่อนโพสต์</span>
      </p>
      {issues.length > 0 ? (
        <ul className="ml-6 list-disc space-y-1">
          {issues.map((i) => <li key={i}>{i}</li>)}
        </ul>
      ) : (
        <p className="ml-6">ตัวตรวจไม่พบจุดผิด แต่ยังต้องดูภาพเองอีกครั้ง</p>
      )}
      {read && (
        <details className="ml-6">
          <summary className="min-h-tap cursor-pointer py-2 text-xs font-medium">ข้อความที่ AI อ่านได้จากภาพ</summary>
          <p className="whitespace-pre-line text-xs">{read}</p>
        </details>
      )}
      <button
        type="button" onClick={() => void tick()} disabled={saving}
        className="min-h-tap rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก…" : "ตรวจแล้ว ตัวหนังสือบนภาพถูกต้อง"}
      </button>
      {error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{error}</p>}
    </section>
  );
}
