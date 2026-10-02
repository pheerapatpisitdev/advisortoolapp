"use client";
import { useRef } from "react";
import { clockOf } from "@/lib/content/clip";
import { onPage, publishLabel } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { CLIP_ACCEPT, uploadLabel } from "./ClipTools";
import { useClipUpload } from "./useClipUpload";

/** A clip piece on the workbench: the clip's facts, its caption, what to check, and แนบใหม่ (owner, 2026-10-02). */
export function ClipCard({ item, index, busy, onEdit, onStatus, onDelete, onItem }: {
  item: ContentItem;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onDelete: () => void;
  /** the piece as a new take arrives (useClipUpload) */
  onItem: (item: ContentItem) => void;
}) {
  const v = item.output.video;
  const input = useRef<HTMLInputElement>(null);
  const upload = useClipUpload(onItem);
  // a Reel goes up with its caption, so the caption's checks are the ones on the badge, with what was said
  const warnings = v ? (v.spokenFlags?.length ?? 0) + v.flags.words.length + v.flags.numbers.length + (v.flags.policy?.length ?? 0) : 0;
  const blocking = (v?.flags.policy ?? []).some((f) => f.severity === "block");
  const label = publishLabel(item.publish);
  // held or posted: Facebook has the clip, so there is nothing to attach again (the server refuses it)
  const held = onPage(item.publish);
  const cell = "flex min-h-11 items-center justify-center gap-1.5 px-1 text-center text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] ${item.status === "trashed" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ct-hair)] px-3 py-2.5">
        <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">▶ คลิป {index + 1}</span>
        {v && (
          <span className="text-xs text-[var(--ct-mute)]">
            {[clockOf(v.durationSec), `${Math.max(1, Math.round(v.sizeBytes / 1_048_576))}MB`, label].filter(Boolean).join(" · ")}
          </span>
        )}
        {warnings > 0 && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
            {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${warnings}`}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 px-3 py-3 text-sm">
        {!v ? <p className="text-[var(--ct-mute)]">ยังไม่มีไฟล์คลิป — แนบคลิปได้เลย</p>
          : v.expired ? (held
            ? <p className="text-[var(--ct-mute)]">ไฟล์ต้นฉบับถูกลบจากระบบแล้ว — Reel ยังอยู่บนเพจ</p>
            : <p className="text-[var(--ct-warn-ink)]">ไฟล์คลิปหมดอายุ — แนบใหม่ได้</p>)
            : !v.transcript ? <p className="text-[var(--ct-mute)]">{v.transcribeFailed ? "ถอดเสียงไม่สำเร็จ — เปิดแก้ไขเพื่อลองอีกครั้ง" : "ยังไม่ได้ถอดเสียง"}</p>
              : null}
        {v?.caption ? <p className="line-clamp-4 whitespace-pre-line leading-relaxed">{v.caption}</p>
          : v?.brief ? <p className="line-clamp-2 text-xs text-[var(--ct-mute)]">เรื่อง: {v.brief}</p> : null}
        {upload.note && <p role="status" className="text-xs text-[var(--ct-mute)]">{upload.note}</p>}
      </div>

      <input
        ref={input} type="file" accept={CLIP_ACCEPT} hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload.send(f, { pieceId: item.id });
          e.target.value = "";
        }}
      />
      {item.status === "trashed" ? (
        <div className="grid grid-cols-2 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
          <button type="button" disabled={busy} onClick={() => onStatus("draft")} className={`${cell} font-medium text-[var(--ct-accent)]`}>↩ กู้คืน</button>
          <button type="button" disabled={busy} onClick={onDelete} className={`${cell} text-[var(--ct-alert)]`}>ลบถาวร</button>
        </div>
      ) : (
        <div className={`grid ${held ? "grid-cols-2" : "grid-cols-3"} divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]`}>
          <button type="button" onClick={onEdit} disabled={!v} className={`${cell} font-medium text-[var(--ct-accent)]`}>แก้ไข / ลงเพจ</button>
          {!held && (
            <button type="button" onClick={() => input.current?.click()} disabled={busy || upload.busy} className={cell}>
              {upload.busy ? uploadLabel(upload.progress, true) : v ? "แนบใหม่" : "แนบคลิป"}
            </button>
          )}
          <button type="button" disabled={busy || upload.busy} onClick={() => onStatus("trashed")} className={`${cell} text-[var(--ct-alert)]`}>ทิ้ง</button>
        </div>
      )}
    </article>
  );
}
