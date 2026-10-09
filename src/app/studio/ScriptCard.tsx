"use client";
import { useRef } from "react";
import { formulaBadge } from "@/lib/content/finish-check";
import { shortModel } from "@/lib/content/models";
import { LENGTHS } from "@/lib/content/prompt";
import { scenes } from "@/lib/content/script";
import { onPage } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { ask } from "./ask";
import { CheckIcon } from "./ui/editor-icons";
import { CLIP_ACCEPT, uploadLabel } from "./clip/ClipTools";
import { useClipUpload } from "./clip/useClipUpload";

/**
 * A video script on the workbench: a shot list, not a poster.
 *
 * A script is read aloud in front of a camera, so its card is the words laid out the way
 * they will be filmed — one row per stretch of time, the words to say, what to do, and
 * what goes on screen. There is no picture, so no บันทึกรูป. Once filmed, the clip is attached
 * here and the script's editor becomes the Reel's (owner, 2026-10-02).
 */

interface Props {
  item: ContentItem;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onDelete: () => void;
  onCopy: () => void;
  /** a clip arrived on this script (clip/useClipUpload.ts) */
  onItem: (item: ContentItem) => void;
}

export function ScriptCard({ item, index, busy, onEdit, onStatus, onDelete, onCopy, onItem }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useClipUpload(onItem);
  // held or posted, the Reel is Facebook's: its clip counts as filmed after the sweep lets the file go, and none is attached again
  const held = onPage(item.publish);
  const filmed = Boolean(item.output.video && (!item.output.video.expired || held));
  const blocking = (item.flags.policy ?? []).some((f) => f.severity === "block");
  const toCheck = item.flags.numbers.length + item.flags.words.length + (item.flags.policy?.length ?? 0);
  const list = scenes(item.output.hooks[0] ?? "", item.output.body, item.output.closing);
  const length = LENGTHS.find((l) => l.id === item.length)?.label;
  const cell = "flex min-h-tap items-center justify-center gap-1.5 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] ${item.status === "trashed" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ct-hair)] px-3 py-2.5">
        <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">สคริปต์ {index + 1}</span>
        <span className="text-xs text-[var(--ct-mute)]">
          {["วิดีโอ", length, `${list.length} ช่วง`, item.output.loop && "วนลูป ↻", formulaBadge(item.output, "script"), item.model && `เขียนโดย ${shortModel(item.model)}`, filmed && "มีคลิปแล้ว ▶"].filter(Boolean).join(" · ")}
        </span>
        {toCheck > 0 && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
            {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${toCheck}`}
          </span>
        )}
      </div>

      {/* a list may not sit inside a button; แก้ไข below opens the script */}
      <div className="flex-1">
        <ol className="divide-y divide-[var(--ct-hair)]">
          {list.map((s, i) => (
            <li key={i} className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 px-3 py-2.5">
              <span className="pt-0.5 text-xs font-medium tabular-nums text-[var(--ct-accent)]">{s.time ?? "—"}</span>
              <div className="min-w-0 space-y-1">
                {s.say && <p className={`line-clamp-3 text-sm leading-relaxed ${i === 0 ? "font-semibold" : ""}`}>{s.say}</p>}
                {s.acts.length > 0 && <p className="line-clamp-1 text-xs text-[var(--ct-mute)]">ท่าทาง: {s.acts.join(" · ")}</p>}
                {s.screen.map((t, j) => (
                  <p key={j} className="w-fit max-w-full truncate rounded border border-[var(--ct-line)] bg-[var(--ct-ground)] px-1.5 py-0.5 text-xs">
                    ขึ้นจอ: {t}
                  </p>
                ))}
              </div>
            </li>
          ))}
          {/* a คลิปวนลูป: the last words run on into the first, as the replay will play them */}
          {item.output.loop && list.length > 0 && (
            <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 bg-[var(--ct-ground)] px-3 py-2.5">
              <span className="pt-0.5 text-xs font-medium text-[var(--ct-accent)]">↻ วนกลับ</span>
              <p className="line-clamp-2 text-xs text-[var(--ct-mute)]">ต่อด้วยประโยคเปิด: “{list[0].say}”</p>
            </li>
          )}
        </ol>
        {upload.note && <p role="status" className="px-3 pb-2.5 text-xs text-[var(--ct-mute)]">{upload.note}</p>}
      </div>

      {item.status === "trashed" ? (
        <div className="grid grid-cols-2 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
          <button type="button" disabled={busy} onClick={() => onStatus("draft")} className={`${cell} font-medium text-[var(--ct-accent)]`}>↩ กู้คืน</button>
          <button type="button" disabled={busy} onClick={onDelete} className={`${cell} text-[var(--ct-alert)]`}>ลบถาวร</button>
        </div>
      ) : (
        <>
        <input
          ref={input} type="file" accept={CLIP_ACCEPT} hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload.send(f, { pieceId: item.id });
            e.target.value = "";
          }}
        />
        {!held && (
          <button
            type="button" disabled={busy || upload.busy} onClick={() => input.current?.click()}
            className={`${cell} w-full border-t border-[var(--ct-hair)] text-[var(--ct-accent)]`}
          >
            {upload.busy ? uploadLabel(upload.progress) : filmed ? "แนบคลิปใหม่" : "▶ แนบคลิปที่ถ่ายแล้ว"}
          </button>
        )}
        <div className="grid grid-cols-3 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
          {item.status === "used" ? (
            <button type="button" onClick={onCopy} className={cell}>คัดลอก</button>
          ) : (
            <button type="button" disabled={busy} onClick={async () => {
              // a piece that breaks Facebook's rules is marked used only when the owner says so:
              // one tap put it in ใช้จริง, and its hook into the formula library
              if (blocking && !(await ask("ชิ้นนี้ผิดกฎโฆษณาของ Facebook — ถ้าโพสต์ไปอาจโดนลดการมองเห็นหรือปิดโฆษณา ยังจะใช้จริงไหม?", "ใช้จริง"))) return;
              onStatus("used");
            }} className={`${cell} font-medium text-[var(--ct-accent)]`}>
              <CheckIcon className="size-4" />
              ใช้จริง
            </button>
          )}
          <button type="button" onClick={onEdit} className={cell}>{filmed ? "แก้ไข / ลงเพจ" : "แก้ไข"}</button>
          <button type="button" disabled={busy || upload.busy} onClick={() => onStatus("trashed")} className={`${cell} text-[var(--ct-alert)]`}>ทิ้ง</button>
        </div>
        </>
      )}
    </article>
  );
}
