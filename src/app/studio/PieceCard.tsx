"use client";
import { publishLabel } from "@/lib/content/publish-label";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { FORMAT_SHORT } from "@/lib/content/prompt";
import type { ContentItem } from "@/lib/content/store";
import { shortModel } from "@/lib/content/models";
import { SAVE_LABEL, usePictureSaver } from "./savePicture";
import { ask } from "./ask";
import { CheckIcon } from "./ui/icons";

/**
 * One piece on the workbench, in the shape of Maryjane's piece-card: the picture on top, the
 * words under it, and a bar of four buttons — the decision, the picture, the tools, the bin.
 *
 * The picture is the piece's poster, drawn by /api/content-poster from the words the writer
 * chose; a piece from before posters gets one drawn from its hook.
 */

interface Props {
  item: ContentItem;
  index: number;
  productName: string;
  busy: boolean;
  /** its photograph is being drawn */
  drawing?: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onDelete: () => void;
  onCopy: () => void;
  /** ตั้งเวลาหลายชิ้น: the card is ticked rather than opened; `why` says why it cannot be */
  pick?: { on: boolean; toggle: () => void; why?: string };
}

export function PieceCard({ item, index, productName, busy, drawing, onEdit, onStatus, onDelete, onCopy, pick }: Props) {
  const blocking = (item.flags.policy ?? []).some((f) => f.severity === "block");
  const toCheck = item.flags.numbers.length + item.flags.words.length + (item.flags.policy?.length ?? 0);
  const cell = "flex min-h-11 items-center justify-center gap-1.5 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
  const picture = posterUrl(item.output.poster ?? defaultPoster(item.output.hooks[0], productName));
  const saver = usePictureSaver(picture, `poster-${item.id.slice(0, 8)}.png`);

  return (
    <article className={`overflow-hidden rounded-xl border bg-[var(--ct-panel)] ${pick?.on ? "border-[var(--ct-accent)] ring-2 ring-[var(--ct-accent)]" : "border-[var(--ct-hair)]"} ${item.status === "trashed" || pick?.why ? "opacity-70" : ""}`}>
      <button
        type="button" onClick={pick ? pick.toggle : onEdit} disabled={Boolean(pick?.why)}
        {...(pick ? { role: "checkbox", "aria-checked": pick.on, "aria-label": `เลือกชิ้น ${index + 1}${pick.why ? ` (${pick.why})` : ""}` } : {})}
        className="relative block w-full text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route, not an asset to optimise */}
        <img
          src={picture}
          alt={item.output.hooks[0]}
          loading="lazy"
          onLoad={drawing ? undefined : saver.ready}
          className="aspect-square w-full bg-[var(--ct-ground)] object-cover"
        />
        {drawing && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-[var(--ct-panel)] px-3 py-1 text-center text-xs text-[var(--ct-mute)]">
            กำลังวาดภาพ… ราว 20–40 วินาที
          </span>
        )}
        {pick ? (
          <span className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pick.on ? "bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]" : "bg-[var(--ct-panel)] text-[var(--ct-mute)]"}`}>
            <span className={`flex size-4 items-center justify-center rounded border ${pick.on ? "border-transparent" : "border-[var(--ct-line)]"}`}>{pick.on && <CheckIcon className="size-3.5" />}</span>
            {pick.why ?? (pick.on ? "เลือกแล้ว" : "เลือก")}
          </span>
        ) : (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--ct-panel)] px-2.5 py-0.5 text-xs text-[var(--ct-mute)]">
            {FORMAT_SHORT[item.format]} {index + 1}
          </span>
        )}
        {toCheck > 0 && (
          <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
            {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${toCheck}`}
          </span>
        )}
      </button>

      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.output.hooks[0]}</p>
        {item.output.angle && <p className="text-xs text-[var(--ct-mute)]">มุม: {item.output.angle}</p>}
        {item.model && (
          <p className="text-xs text-[var(--ct-mute)]">
            เขียนโดย {shortModel(item.model)}{item.output.pictureBy ? ` · ภาพ ${item.output.pictureBy}` : ""}
          </p>
        )}
        {publishLabel(item.publish) && (
          <p className={`text-xs font-medium ${item.publish?.state === "failed" ? "text-[var(--ct-alert)]" : "text-[var(--ct-accent)]"}`}>{publishLabel(item.publish)}</p>
        )}
        <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed">{item.output.body}</p>
        {item.output.hashtags.length > 0 && (
          <p className="line-clamp-1 text-xs text-[var(--ct-accent)]">{item.output.hashtags.join(" ")}</p>
        )}
      </div>

      {item.status === "trashed" ? (
        <div className="grid grid-cols-2 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
          <button type="button" disabled={busy} onClick={() => onStatus("draft")} className={`${cell} font-medium text-[var(--ct-accent)]`}>↩ กู้คืน</button>
          <button type="button" disabled={busy} onClick={onDelete} className={`${cell} text-[var(--ct-alert)]`}>ลบถาวร</button>
        </div>
      ) : (
        <div className="grid grid-cols-4 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
          {item.status === "used" ? (
            <button type="button" onClick={onCopy} className={cell}>คัดลอก</button>
          ) : (
            <button type="button" disabled={busy} onClick={async () => {
              // a piece that breaks Facebook's rules is marked used only when the owner says so:
              // one tap put it in ใช้จริง, and its hook into the formula library
              if (blocking && !(await ask("ชิ้นนี้ผิดกฎโฆษณาของ Facebook — ถ้าโพสต์ไปอาจโดนลดการมองเห็นหรือปิดโฆษณา ยังจะใช้จริงไหม?", "ใช้จริง"))) return;
              onStatus("used");
            }} className={`${cell} font-medium text-[var(--ct-accent)]`}>
              <CheckIcon className="size-4" />ใช้จริง
            </button>
          )}
          <button type="button" disabled={drawing || saver.state === "saving"} onClick={saver.save} className={cell} aria-live="polite">
            {drawing ? "รอภาพ…" : <>{saver.state === "saved" && <CheckIcon className="size-4" />}{SAVE_LABEL[saver.state]}</>}
          </button>
          <button type="button" onClick={onEdit} className={cell}>แก้ไข</button>
          <button type="button" disabled={busy} onClick={() => onStatus("trashed")} className={`${cell} text-[var(--ct-alert)]`}>
            ทิ้ง
          </button>
        </div>
      )}
    </article>
  );
}

/** A card-shaped placeholder while a round is being written: picture, lines, the button bar. */
export function PieceSkeleton() {
  const bar = "rounded-full bg-[var(--ct-soft)]";
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] motion-safe:animate-pulse">
      <div className="aspect-square w-full bg-[var(--ct-ground)]" />
      <div className="space-y-2.5 p-3">
        <div className={`h-4 w-4/5 ${bar}`} />
        <div className={`h-3 w-1/3 ${bar}`} />
        <div className={`h-3 w-full ${bar}`} />
        <div className={`h-3 w-11/12 ${bar}`} />
        <div className={`h-3 w-2/3 ${bar}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-[var(--ct-hair)] p-2.5">
        <div className={`h-6 ${bar}`} />
        <div className={`h-6 ${bar}`} />
        <div className={`h-6 ${bar}`} />
      </div>
    </div>
  );
}
