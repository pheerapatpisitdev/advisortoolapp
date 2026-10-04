"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { brokenStep, cardLaunch, cardText } from "@/lib/ads/ad-card";
import { drawOffer, picturePending, type PictureState } from "@/lib/ads/room-view";
import { setAdStatus } from "./actions";
import type { RoomPiece } from "./AdEditor";

/**
 * One ad in a campaign's room: the square poster, the headline, the primary text as far as the
 * feed shows it before ดูเพิ่มเติม, and small labels — the four dimensions it was written to (or
 * the angle and tone of an older piece), a warning when it trips Facebook's advertising rules,
 * and a red one naming the step an older one-by-one launch broke at. Pressing it opens the editor.
 *
 * Under it, ✓ อนุมัติ and ✕ ทิ้ง (or ยกเลิกอนุมัติ, or กู้คืน from the bin); a piece already
 * sent to Facebook has none. While its picture is being drawn the poster says so; a picture that
 * failed, or never came, has a button to draw it — but not one just drawn whose refreshed piece
 * is not in yet (room-view.ts drawOffer).
 */

export type { PictureState };

const label = "rounded-full bg-[var(--ct-ground)] px-2.5 py-0.5 text-xs text-[var(--ct-mute)]";
const small = "min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium disabled:opacity-50";

export function AdCard({ piece, productName, fold, picture, onOpen, onDraw }: {
  piece: RoomPiece;
  productName: string;
  fold: number;
  picture: PictureState | undefined;
  onOpen: () => void;
  /** draw (again) this piece's picture from its style */
  onDraw: () => void;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = posterUrl(piece.poster ?? defaultPoster(piece.headline, productName));
  const text = cardText(piece.primaryText, fold);
  const launch = cardLaunch(piece.launches);
  const broke = launch ? brokenStep(launch) : null;
  const blocking = piece.flags.policy.some((f) => f.severity === "block");
  const pending = picturePending(piece);
  const drawing = picture === "wait" || picture === "drawing";
  const failed = typeof picture === "object" ? picture.error : null;
  const offer = drawOffer(picture, pending, piece.tab);

  async function move(status: "draft" | "used" | "trashed") {
    setMoving(true);
    setError(null);
    try {
      const res = await setAdStatus(piece.id, status);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch {
      setError("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง");
    } finally {
      setMoving(false);
    }
  }

  return (
    <article className={`overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] ${piece.tab === "trash" ? "opacity-70" : ""}`}>
      <button type="button" onClick={onOpen} className="block w-full text-left hover:bg-[var(--ct-soft)] focus-visible:bg-[var(--ct-soft)]">
        <span className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route */}
          <img src={shown} alt="" loading="lazy" className="aspect-square w-full bg-[var(--ct-ground)] object-cover" />
          {drawing && (
            <span role="status" className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-[var(--ct-scrim)] px-3 py-2 text-sm font-medium text-[var(--ct-on-scrim)]">
              <span className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
              {picture === "drawing" ? "กำลังวาดรูป…" : "รอวาดรูป…"}
            </span>
          )}
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
            {piece.variant ? (
              <>
                <span className={`${label} max-w-full break-words`}>ฮุก: {piece.variant.hook}</span>
                <span className={`${label} max-w-full break-words`}>{piece.variant.persona}</span>
                <span className={`${label} max-w-full break-words`}>{piece.variant.angle}</span>
                <span className={`${label} max-w-full break-words`}>ภาพ: {piece.variant.style}</span>
              </>
            ) : piece.ad && (
              <span className={label}>{piece.ad.angle} · {piece.ad.tone}</span>
            )}
            {broke && <span className="rounded-full bg-[var(--ct-alert-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-alert)]">ขั้น{broke}ไม่สำเร็จ</span>}
            {launch?.activatedAt && <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">เปิดใช้แล้ว</span>}
          </span>
        </span>
      </button>

      {offer && (
        <div className="space-y-1 border-t border-[var(--ct-hair)] px-3 py-2">
          <p className={`text-xs ${failed ? "text-[var(--ct-alert)]" : "text-[var(--ct-warn-ink)]"}`}>
            {failed ? `วาดรูปไม่สำเร็จ — ${failed}` : "ยังไม่มีรูปตามสไตล์ภาพ ชิ้นนี้ยังส่งขึ้น Facebook ไม่ได้"}
          </p>
          <button type="button" onClick={onDraw} className={`${small} w-full border-[var(--ct-line)] hover:bg-[var(--ct-soft)]`}>
            {offer === "redraw" ? "วาดรูปใหม่" : "วาดรูป"}
          </button>
        </div>
      )}

      {piece.tab !== "sent" && (
        <div className="space-y-1 border-t border-[var(--ct-hair)] p-2">
          <div className="flex gap-2">
            {piece.tab === "draft" && (
              <button type="button" disabled={moving} onClick={() => move("used")} className={`${small} border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]`}>
                ✓ อนุมัติ
              </button>
            )}
            {piece.tab === "approved" && (
              <button type="button" disabled={moving} onClick={() => move("draft")} className={`${small} border-[var(--ct-line)] hover:bg-[var(--ct-soft)]`}>
                ยกเลิกอนุมัติ
              </button>
            )}
            {piece.tab === "trash" ? (
              <button type="button" disabled={moving} onClick={() => move("draft")} className={`${small} border-[var(--ct-line)] hover:bg-[var(--ct-soft)]`}>
                กู้คืน
              </button>
            ) : (
              <button type="button" disabled={moving} onClick={() => move("trashed")} aria-label="ทิ้งแอดนี้ลงถังขยะ" className={`${small} border-[var(--ct-line)] text-[var(--ct-alert)] hover:bg-[var(--ct-soft)]`}>
                ✕ ทิ้ง
              </button>
            )}
          </div>
          {piece.tab === "approved" && <p className="px-1 text-xs font-medium text-[var(--ct-accent)]">อนุมัติแล้ว · รอส่งขึ้น Facebook</p>}
          {error && <p role="alert" className="px-1 text-xs text-[var(--ct-alert)]">{error}</p>}
        </div>
      )}
    </article>
  );
}
