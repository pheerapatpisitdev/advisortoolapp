"use client";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import type { SentRow } from "@/lib/ads/sent-view";
import type { RoomPiece } from "./AdEditor";
import { baht, when } from "./SentSend";

/**
 * The rail beside the ads, as Organic Studio's ใช้จริง: how many of the campaign's ads went to
 * Facebook, and each with its poster, what Meta says it is doing and what it spends a day.
 * Switching them on and off is the ส่งแล้ว tab's, which any row opens (`onShow`).
 */

const TONE: Record<SentRow["tone"], string> = {
  on: "text-[var(--ct-accent)]",
  off: "text-[var(--ct-mute)]",
  bad: "text-[var(--ct-alert)]",
};

export function SentRail({ rows, pieces, productName, onShow }: {
  rows: SentRow[];
  pieces: RoomPiece[];
  productName: string;
  /** null while there is no campaign to show the sends of */
  onShow: (() => void) | null;
}) {
  return (
    <>
      <div className="border-b border-[var(--ct-hair)] p-4 pb-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">ส่งแล้ว</h2>
            <p className="mt-0.5 text-xs text-[var(--ct-mute)]">แอดของแคมเปญนี้บน Facebook</p>
          </div>
          <span className="text-2xl tabular-nums text-[var(--ct-accent)]">{rows.length}</span>
        </div>
        {onShow && rows.length > 0 && (
          <button type="button" onClick={onShow} className="inline-flex min-h-11 items-center text-xs font-medium text-[var(--ct-accent)] underline underline-offset-2">
            เปิด/หยุดแอด ที่แท็บ “ส่งแล้ว” →
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="m-4 rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-6 text-center text-xs text-[var(--ct-mute)]">
          อนุมัติแอดแล้วกด “ส่งขึ้น Facebook” — แอดที่ส่งจะมาอยู่ตรงนี้
        </p>
      ) : (
        <ul className="divide-y divide-[var(--ct-hair)] xl:max-h-[60dvh] xl:overflow-y-auto">
          {rows.map((r) => {
            const piece = pieces.find((p) => p.id === r.pieceId);
            return (
              <li key={r.key}>
                <button type="button" onClick={onShow ?? undefined} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--ct-ground)]">
                  {piece ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
                    <img
                      src={posterUrl(piece.poster ?? defaultPoster(piece.headline, productName))} alt="" loading="lazy"
                      className="size-14 shrink-0 rounded-md border border-[var(--ct-hair)] bg-[var(--ct-ground)] object-cover"
                    />
                  ) : (
                    <span className="size-14 shrink-0 rounded-md border border-[var(--ct-hair)] bg-[var(--ct-ground)]" />
                  )}
                  <span className="min-w-0">
                    <span className={`block text-xs font-medium ${TONE[r.tone]}`}>● {r.status}</span>
                    <span className="line-clamp-2 text-sm">{piece?.headline || "(ชิ้นนี้ถูกลบแล้ว)"}</span>
                    <span className="block text-xs text-[var(--ct-mute)]">
                      {r.sentAt ? `${when(r.sentAt)} · ` : ""}{baht(r.budgetBaht)}/วัน
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
