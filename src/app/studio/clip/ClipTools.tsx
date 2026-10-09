"use client";
import { useId, useRef, useState } from "react";
import { CLIP_MIMES, MAX_CLIP_BRIEF } from "@/lib/content/clip";
import type { ContentItem } from "@/lib/content/store";
import { FormSection } from "../ui/form-parts";
import { useClipUpload } from "./useClipUpload";

/** what the file pickers offer: the types, and the names an iPhone's .mov may come with no type */
export const CLIP_ACCEPT = [...CLIP_MIMES, ".mp4", ".mov"].join(",");

/** what the upload button says while a clip is on its way; `short` for a card's narrow button */
export function uploadLabel(progress: number | null, short = false): string {
  if (progress === null || progress >= 1) return "กำลังถอดเสียง…";
  const pct = `${Math.round(progress * 100)}%`;
  return short ? pct : `กำลังอัปโหลด ${pct}`;
}

/** คลิป (owner, 2026-10-02): a clip the agent filmed, uploaded to become a Reel on the Page. */
export function ClipTools({ page, onItem, folded, formId }: {
  /** the project's Page the new piece belongs to */
  page?: string;
  onItem: (item: ContentItem) => void;
  /** a phone with the form shut shows only the press */
  folded?: boolean;
  formId?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [brief, setBrief] = useState("");
  const { busy, progress, note, send } = useClipUpload(onItem);
  const field = "min-h-tap w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

  async function go() {
    if (!file) { input.current?.click(); return; }
    const done = await send(file, { page, brief: brief.trim() });
    if (done) {
      setFile(null);
      setBrief("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div id={formId} className={folded ? "hidden lg:block" : ""}>
        <FormSection title="คลิปที่ถ่ายแล้ว">
          <p className="text-xs text-[var(--ct-mute)]">แนวตั้ง · 3–90 วินาที · .mp4 หรือ .mov · ไม่เกิน 300MB — ระบบถอดเสียง ร่างแคปชัน และตรวจคำให้</p>
          <div>
            <label htmlFor={`${id}-file`} className="mb-1.5 block text-sm font-medium">ไฟล์คลิป</label>
            <input
              ref={input} id={`${id}-file`} type="file" accept={CLIP_ACCEPT} disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full min-w-0 text-sm file:mr-3 file:min-h-tap file:rounded-lg file:border file:border-solid file:border-[var(--ct-line)] file:bg-[var(--ct-panel)] file:px-3 file:text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${id}-brief`} className="mb-1.5 block text-sm font-medium">
              คลิปนี้พูดเรื่องอะไร <span className="font-normal text-[var(--ct-mute)]">(ไม่บังคับ)</span>
            </label>
            <textarea
              id={`${id}-brief`} value={brief} maxLength={MAX_CLIP_BRIEF} rows={2} disabled={busy}
              onChange={(e) => setBrief(e.target.value)} placeholder="เช่น ลดหย่อนภาษีด้วยประกันบำนาญ" className={field}
            />
          </div>
        </FormSection>
      </div>
      {progress !== null && (
        <div
          role="progressbar" aria-label="อัปโหลดคลิป" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}
          className="h-2 overflow-hidden rounded-full bg-[var(--ct-hair)]"
        >
          <div className="h-full rounded-full bg-[var(--ct-accent)] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {note && <p role="status" className="text-sm text-[var(--ct-mute)]">{note}</p>}
      <button
        type="button" onClick={go} disabled={busy}
        className="min-h-tap w-full rounded-lg bg-[var(--ct-solid)] px-4 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
      >
        {busy ? uploadLabel(progress) : file ? "อัปโหลดคลิป" : "เลือกไฟล์คลิป"}
      </button>
    </div>
  );
}
