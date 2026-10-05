"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPoster } from "@/lib/content/poster";
import { adLabel } from "@/lib/ads/ad-card";
import { drawOffer, picturePending, type PictureState } from "@/lib/ads/room-view";
import { setAdStatus } from "./actions";
import type { RoomPiece } from "./AdEditor";
import { FeedPreview } from "./FeedPreview";
import { plain, TONES } from "./styles";

/**
 * The โฆษณา tab's right pane (Ads Studio desktop, 2026-10-05): the ad picked in the list as a
 * Facebook feed post — the whole primary text with the fold marked, the poster, the headline,
 * description and the send's button (FeedPreview, full). Above it what the owner can do — แก้ไข
 * (the full-screen editor), ทิ้ง in ร่าง or กู้คืน in the bin (a sent ad is Facebook's now, so
 * neither), and วาดรูป / วาดรูปใหม่ only where the card used to offer it (room-view drawOffer:
 * never while it waits, draws, or was just drawn) — and the checks it trips, in a warning tone.
 */

export type { PictureState };

export function AdPreview({ piece, productName, pageName, fold, cta, picture, onEdit, onDraw }: {
  piece: RoomPiece;
  productName: string;
  pageName: string;
  fold: number;
  /** the button under the post (ads-list ctaLabel) */
  cta: string;
  picture: PictureState | undefined;
  onEdit: () => void;
  onDraw: () => void;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawing = picture === "wait" || picture === "drawing";
  const failed = typeof picture === "object" ? picture.error : null;
  const offer = drawOffer(picture, picturePending(piece), piece.tab);
  const angle = piece.ad ? adLabel(piece.ad) : "";
  const { policy, numbers } = piece.flags;

  async function move(status: "draft" | "trashed") {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onEdit} className={plain}>แก้ไข</button>
        {piece.tab === "draft" && (
          <button type="button" disabled={moving} onClick={() => move("trashed")} aria-label="ทิ้งแอดนี้ลงถังขยะ" className={`${plain} text-[var(--ct-alert)]`}>
            ✕ ทิ้ง
          </button>
        )}
        {piece.tab === "trash" && (
          <button type="button" disabled={moving} onClick={() => move("draft")} className={plain}>กู้คืน</button>
        )}
        {offer && (
          <button type="button" onClick={onDraw} className={plain}>{offer === "redraw" ? "วาดรูปใหม่" : "วาดรูป"}</button>
        )}
        {angle && <span className="ml-auto max-w-full break-words text-xs text-[var(--ct-mute)]">{angle}</span>}
      </div>
      {error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{error}</p>}

      {drawing && (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
          <span className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
          {picture === "drawing" ? "กำลังวาดรูป…" : "รอวาดรูป…"}
        </p>
      )}
      {offer && (
        <p className={`text-xs ${failed ? "text-[var(--ct-alert)]" : "text-[var(--ct-warn-ink)]"}`}>
          {failed ? `วาดรูปไม่สำเร็จ — ${failed}` : "ยังไม่มีรูป ชิ้นนี้ยังส่งขึ้น Facebook ไม่ได้"}
        </p>
      )}

      {(policy.length > 0 || numbers.length > 0) && (
        <ul className="space-y-1.5">
          {policy.map((f, i) => (
            <li key={`p${i}`} className={`rounded-lg border px-3 py-2 text-sm ${f.severity === "block" ? TONES.bad : TONES.warn}`}>
              <span className="font-medium">{f.severity === "block" ? "ผิดกฎ Facebook" : "เสี่ยงผิดกฎ Facebook"}</span> — {f.message}
              {f.match && <span className="block text-xs">คำที่เจอ: “{f.match}”</span>}
              {f.fix && <span className="block text-xs">{f.fix}</span>}
            </li>
          ))}
          {numbers.length > 0 && (
            <li className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
              <span className="font-medium">ตัวเลขที่ไม่ได้มาจากข้อมูลแบบประกัน</span> — {numbers.join(", ")} ตรวจก่อนส่ง
            </li>
          )}
        </ul>
      )}

      <FeedPreview
        full pageName={pageName} cta={cta} fold={fold}
        primaryText={piece.primaryText} headline={piece.headline} description={piece.description}
        poster={piece.poster ?? defaultPoster(piece.headline, productName)}
      />
    </div>
  );
}
