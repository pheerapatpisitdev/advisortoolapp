"use client";
import { useEffect, useState } from "react";
import { posterUrl, type PosterSpec } from "@/lib/content/poster";
import { cardText } from "@/lib/ads/ad-card";

/**
 * The ad as someone scrolling Facebook meets it, drawn from what the editor holds now, unsaved
 * edits included: the Page's line, the primary text cut where Facebook folds it with its
 * ดูเพิ่มเติม, the square poster, and the bar under it — the description, the headline, and
 * the ดูเพิ่มเติม button that goes to the link.
 */
export function FeedPreview({ pageName, primaryText, headline, description, poster, fold }: {
  pageName: string;
  primaryText: string;
  headline: string;
  description: string;
  poster: PosterSpec;
  /** where Facebook folds the primary text (AD_LIMITS.fold) */
  fold: number;
}) {
  const [open, setOpen] = useState(false);
  const cut = cardText(primaryText, fold);
  // a new picture once typing pauses, not on every keystroke (as PosterPanel's own preview)
  const [shown, setShown] = useState(poster);
  useEffect(() => {
    const t = setTimeout(() => setShown(poster), 600);
    return () => clearTimeout(t);
  }, [poster]);
  const drawable = shown.blocks.some((b) => b.kind === "headline");

  return (
    <figure aria-label="ตัวอย่างแอดในฟีด Facebook" className="m-0 overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
      <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ct-solid)] text-sm font-semibold text-[var(--ct-solid-ink)]">
          {[...pageName.trim()][0] ?? "เ"}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{pageName}</p>
          <p className="text-xs text-[var(--ct-mute)]">ได้รับการสนับสนุน · ตัวอย่าง</p>
        </div>
      </div>

      <p className="whitespace-pre-wrap break-words px-3 pb-3 text-[0.95rem] leading-relaxed">
        {open ? primaryText : cut.shown}
        {!open && cut.more && (
          <>… <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[var(--ct-mute)] hover:underline">ดูเพิ่มเติม</button></>
        )}
        {!primaryText.trim() && <span className="text-[var(--ct-mute)]">(ยังไม่มีข้อความหลัก)</span>}
      </p>

      {drawable ? (
        // eslint-disable-next-line @next/next/no-img-element -- the poster route draws it from the draft
        <img src={posterUrl(shown)} alt="โปสเตอร์ของแอดนี้" className="block aspect-square w-full bg-[var(--ct-ground)] object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-[var(--ct-ground)] p-4 text-center text-sm text-[var(--ct-mute)]">ใส่พาดหัวบนภาพก่อน แล้วรูปจะขึ้นตรงนี้</div>
      )}

      <div className="flex items-center gap-3 bg-[var(--ct-ground)] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {description && <p className="truncate text-xs text-[var(--ct-mute)]">{description}</p>}
          <p className="truncate text-sm font-semibold">{headline || <span className="font-normal text-[var(--ct-mute)]">(ยังไม่มีหัวข้อ)</span>}</p>
        </div>
        <span className="shrink-0 rounded-md border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-1.5 text-sm font-medium">ดูเพิ่มเติม</span>
      </div>

      <figcaption className="px-3 py-2 text-xs text-[var(--ct-mute)]">
        {cut.more
          ? `คนเห็น ${fold} ตัวอักษรแรกก่อนกด “ดูเพิ่มเติม” — ประโยคเปิดควรจบในช่วงนี้`
          : "ข้อความหลักสั้นพอ คนเห็นทั้งหมดโดยไม่ต้องกด “ดูเพิ่มเติม”"}
      </figcaption>
    </figure>
  );
}
