"use client";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { brokenStep, cardLaunch, cardText } from "@/lib/ads/ad-card";
import type { RoomPiece } from "./AdEditor";

/**
 * One ad in a campaign's room: the square poster, the headline, the primary text as far as the
 * feed shows it before ดูเพิ่มเติม, and small labels — the angle and tone it was written in, a
 * warning when it trips Facebook's advertising rules, and a red one naming the step its launch
 * broke at. Pressing it opens the editor.
 */
export function AdCard({ piece, productName, fold, onOpen }: {
  piece: RoomPiece;
  productName: string;
  fold: number;
  onOpen: () => void;
}) {
  const picture = posterUrl(piece.poster ?? defaultPoster(piece.headline, productName));
  const text = cardText(piece.primaryText, fold);
  const launch = cardLaunch(piece.launches);
  const broke = launch ? brokenStep(launch) : null;
  const blocking = piece.flags.policy.some((f) => f.severity === "block");

  return (
    <article className={`overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] ${piece.tab === "trash" ? "opacity-70" : ""}`}>
      <button type="button" onClick={onOpen} className="block w-full text-left hover:bg-[var(--ct-soft)] focus-visible:bg-[var(--ct-soft)]">
        <span className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route */}
          <img src={picture} alt="" loading="lazy" className="aspect-square w-full bg-[var(--ct-ground)] object-cover" />
          {piece.flags.policy.length > 0 && (
            <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
              {blocking ? "ผิดกฎ Facebook" : "เสี่ยงผิดกฎ Facebook"}
            </span>
          )}
        </span>
        <span className="block space-y-2 p-3">
          <span className="block break-words font-semibold">{piece.headline || <span className="font-normal text-[var(--ct-mute)]">(ไม่มีหัวข้อ)</span>}</span>
          <span className="block whitespace-pre-wrap break-words text-sm leading-relaxed">
            {text.shown}
            {text.more && <span className="text-[var(--ct-mute)]">… ดูเพิ่มเติม</span>}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {piece.ad && (
              <span className="rounded-full bg-[var(--ct-ground)] px-2.5 py-0.5 text-xs text-[var(--ct-mute)]">{piece.ad.angle} · {piece.ad.tone}</span>
            )}
            {broke && (
              <span className="rounded-full bg-[var(--ct-alert-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-alert)]">ขั้น{broke}ไม่สำเร็จ</span>
            )}
            {launch?.activatedAt && (
              <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">เปิดใช้แล้ว</span>
            )}
          </span>
        </span>
      </button>
    </article>
  );
}
