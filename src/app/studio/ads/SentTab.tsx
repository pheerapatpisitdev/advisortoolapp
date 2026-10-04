"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { brokenStep, pageNameOf } from "@/lib/ads/ad-card";
import { activateQuestion, badStatus, legacyButtons, pauseQuestion, statusText } from "@/lib/ads/sent-view";
import { ask } from "../ask";
import { errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { activateAd, pauseAd } from "./actions";
import type { Room, RoomPiece } from "./AdEditor";
import { baht, SentSend, when } from "./SentSend";
import { plain, solid } from "./styles";

/**
 * The room's ส่งแล้ว tab: each batch send, newest first, as its own panel (SentSend), and under
 * them the ads launched one by one before batch sends (ins_ad_launch), each with เปิดใช้ — asked
 * first, like a send — and หยุด while its ad exists.
 */

type Legacy = Room["legacy"][number];

function LegacyAd({ launch, piece, account, pageName, productName, onOpen }: {
  launch: Legacy;
  piece: RoomPiece | undefined;
  account: string;
  pageName: string;
  productName: string;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"activate" | "pause" | null>(null);
  const [note, setNote] = useState<NoteState>(null);
  const buttons = legacyButtons(launch);
  const broke = brokenStep(launch);
  const status = statusText(launch.effectiveStatus);

  async function press(kind: "activate" | "pause") {
    const facts = { account, page: pageName, dailyBudgetBaht: launch.dailyBudgetBaht };
    const ok = kind === "activate"
      ? await ask(activateQuestion({ what: "เปิดใช้แอดนี้", ...facts }), "เปิดใช้เลย")
      : await ask(pauseQuestion({ what: "หยุดแอดนี้", ...facts }), "หยุดแอด");
    if (!ok) return;
    setBusy(kind);
    setNote(null);
    try {
      const res = kind === "activate" ? await activateAd(launch.id) : await pauseAd(launch.id);
      setNote(res.ok ? okNote(kind === "activate" ? "เปิดใช้แล้ว" : "หยุดแล้ว") : errorNote(res.error));
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่รู้ว่าสำเร็จหรือไม่ — เปิดหน้านี้ใหม่เพื่อดูสถานะ"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="space-y-2 p-3">
      <button type="button" disabled={!piece} onClick={onOpen} className="flex w-full items-start gap-3 text-left enabled:hover:opacity-80">
        {piece ? (
          // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
          <img src={posterUrl(piece.poster ?? defaultPoster(piece.headline, productName))} alt="" loading="lazy" className="size-14 shrink-0 rounded-md bg-[var(--ct-ground)] object-cover" />
        ) : <span className="size-14 shrink-0 rounded-md bg-[var(--ct-ground)]" />}
        <span className="min-w-0 space-y-0.5 text-sm">
          <span className="block truncate font-medium">{piece?.headline || "(ไม่มีหัวข้อ)"}</span>
          <span className="block break-words text-xs text-[var(--ct-mute)]">{account} · เพจ {pageName} · งบ {baht(launch.dailyBudgetBaht)} ต่อวัน</span>
          {broke ? (
            <span className="block break-words text-xs text-[var(--ct-alert)]">ขั้น{broke}ไม่สำเร็จ — {launch.error}</span>
          ) : (
            <span className="block text-xs">{launch.activatedAt ? `เปิดใช้แล้ว ${when(launch.activatedAt)}` : "หยุดไว้"}</span>
          )}
          {status && <span className={`block text-xs ${badStatus(launch.effectiveStatus) ? "font-medium text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>Meta: {status}</span>}
        </span>
      </button>
      {(buttons.activate || buttons.pause) && (
        <div className="flex flex-wrap gap-2">
          {buttons.activate && (
            <button type="button" disabled={busy !== null} onClick={() => press("activate")} className={solid}>
              {busy === "activate" ? "กำลังเปิดใช้…" : "เปิดใช้"}
            </button>
          )}
          {buttons.pause && (
            <button type="button" disabled={busy !== null} onClick={() => press("pause")} className={plain}>
              {busy === "pause" ? "กำลังหยุด…" : "หยุด"}
            </button>
          )}
        </div>
      )}
      <Note note={note} />
    </li>
  );
}

export function SentTab({ room, productName, onOpen }: {
  room: Room;
  productName: string;
  onOpen: (pieceId: string) => void;
}) {
  const { sends, legacy, pieces, connection, pages, campaign } = room;
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const accountOf = (actId: string) => {
    const a = connection.accounts.find((x) => x.id === actId);
    return a ? `${a.name} (${a.id})` : actId;
  };
  const pageOf = (pageId: string) => (pageId === campaign.pageId && campaign.pageName ? campaign.pageName : pageNameOf(pageId, pages));

  if (sends.length === 0 && legacy.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">
        ยังไม่มีแอดที่ส่งไป Facebook — อนุมัติแอดแล้วกด “ส่งขึ้น Facebook” ที่หัวห้อง
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sends.map((s) => (
        <SentSend
          key={s.id} send={s} pieces={byId} account={accountOf(s.actId)} pageName={pageOf(s.pageId)}
          productName={productName} onOpen={onOpen}
        />
      ))}
      {legacy.length > 0 && (
        <section aria-labelledby="legacy-title" className="space-y-2 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          <div>
            <h3 id="legacy-title" className="text-sm font-semibold">แอดที่ยิงทีละชิ้น (ระบบเดิม)</h3>
            <p className="text-xs text-[var(--ct-mute)]">แต่ละแอดมีแคมเปญและชุดโฆษณาของตัวเองบน Facebook</p>
          </div>
          <ul className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)]">
            {legacy.map((l) => (
              <LegacyAd
                key={l.id} launch={l} piece={byId.get(l.pieceId)} account={accountOf(l.actId)} pageName={pageOf(l.pageId)}
                productName={productName} onOpen={() => onOpen(l.pieceId)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
