"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { activateQuestion, badStatus, pauseQuestion, sendButtons, statusText, switchedOn } from "@/lib/ads/sent-view";
import { ask } from "../ask";
import { errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { activateSendAction, pauseSendAction, retrySend, type SendView } from "./actions";
import type { RoomPiece } from "./AdEditor";
import { plain, solid, TONES } from "./styles";

/**
 * One batch send in the sent tab: the account, the Page and the budget it went up with, where
 * it stands on Meta, and each of its ads — made (with Meta's word for it), failed with why, or
 * still to make. ลองใหม่ makes only what is missing; เปิดใช้ทั้งชุด asks first, naming the
 * account, the Page and the daily budget; หยุดทั้งชุด is there whenever the send has a campaign
 * on Meta. An ad made after the send was switched on is marked: it stays paused until the next
 * เปิดใช้ทั้งชุด.
 */

const STEP_TEXT: Record<string, string> = {
  none: "ยังไม่ได้สร้างแคมเปญบน Facebook",
  campaign: "สร้างแคมเปญแล้ว ยังไม่ได้สร้างชุดโฆษณา",
  adset: "สร้างชุดโฆษณาแล้ว ยังสร้างแอดไม่ครบ",
};

export const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
export const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

export function SentSend({ send, pieces, account, pageName, productName, onOpen }: {
  send: SendView;
  pieces: Map<string, RoomPiece>;
  /** the ad account as the owner reads it: name (act_…) */
  account: string;
  pageName: string;
  productName: string;
  onOpen: (pieceId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "activate" | "pause" | null>(null);
  const [note, setNote] = useState<NoteState>(null);
  const buttons = sendButtons(send);
  const on = switchedOn(send);
  const made = send.items.filter((i) => i.adId).length;

  async function press(kind: "retry" | "activate" | "pause") {
    const facts = { account, page: pageName, dailyBudgetBaht: send.dailyBudgetBaht };
    if (kind === "activate" && !(await ask(activateQuestion({ what: `เปิดใช้ทั้งชุด (${made} แอด)`, ...facts }), "เปิดใช้เลย"))) return;
    if (kind === "pause" && !(await ask(pauseQuestion({ what: "หยุดทั้งชุด", ...facts }), "หยุดทั้งชุด"))) return;
    setBusy(kind);
    setNote(null);
    try {
      if (kind === "retry") {
        const res = await retrySend(send.id);
        setNote(res.ok ? okNote("ทำต่อจนครบแล้ว แอดใหม่สร้างเป็นหยุดไว้") : errorNote(res.error));
      } else {
        const res = kind === "activate" ? await activateSendAction(send.id) : await pauseSendAction(send.id);
        setNote(res.ok ? okNote(kind === "activate" ? "เปิดใช้ทั้งชุดแล้ว" : "หยุดทั้งชุดแล้ว") : errorNote(res.error));
      }
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่รู้ว่าสำเร็จหรือไม่ — เปิดหน้านี้ใหม่เพื่อดูสถานะก่อนกดซ้ำ"));
    } finally {
      setBusy(null);
    }
  }

  const meta = statusText(send.metaStatus);
  return (
    <article className="space-y-3 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
      <header className="space-y-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-semibold">ส่ง {when(send.createdAt)}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}>
            {on ? `เปิดใช้แล้ว ${when(send.activatedAt!)}` : "หยุดไว้ — ยังไม่เสียเงิน"}
          </span>
        </p>
        <p className="break-words text-sm text-[var(--ct-mute)]">
          {account} · เพจ {pageName} · งบ {baht(send.dailyBudgetBaht)} ต่อวัน · {made}/{send.items.length} แอด
        </p>
        {meta && <p className={`text-sm ${badStatus(send.metaStatus) ? "font-medium text-[var(--ct-alert)]" : ""}`}>สถานะจาก Meta: {meta}</p>}
        {send.step !== "ads" && <p className="text-sm text-[var(--ct-warn-ink)]">{STEP_TEXT[send.step] ?? send.step}</p>}
        {send.error && <p className="break-words text-sm text-[var(--ct-alert)]">ครั้งล่าสุดหยุดเพราะ — {send.error}</p>}
        {send.madeAfterActivation > 0 && (
          <p className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
            มี {send.madeAfterActivation} แอดที่สร้างหลังเปิดใช้ ยังหยุดอยู่ — กด “เปิดใช้ทั้งชุด” อีกครั้งเพื่อเปิดด้วย
          </p>
        )}
      </header>

      <ul className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)]">
        {send.items.map((i) => {
          const p = i.pieceId ? pieces.get(i.pieceId) : undefined;
          const status = statusText(i.effectiveStatus);
          return (
            <li key={i.id}>
              <button type="button" disabled={!p} onClick={() => p && onOpen(p.id)} className="flex w-full items-start gap-3 p-2 text-left enabled:hover:bg-[var(--ct-soft)]">
                {p ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
                  <img src={posterUrl(p.poster ?? defaultPoster(p.headline, productName))} alt="" loading="lazy" className="size-14 shrink-0 rounded-md bg-[var(--ct-ground)] object-cover" />
                ) : <span className="size-14 shrink-0 rounded-md bg-[var(--ct-ground)]" />}
                <span className="min-w-0 space-y-0.5 text-sm">
                  <span className="block truncate font-medium">{p?.headline || (p ? "(ไม่มีหัวข้อ)" : "ชิ้นนี้ถูกลบไปแล้ว")}</span>
                  {i.adId ? (
                    <span className={`block text-xs ${badStatus(i.effectiveStatus) ? "font-medium text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>
                      {status ? `Meta: ${status}` : "สร้างแล้ว"}
                    </span>
                  ) : i.error ? (
                    <span className="block break-words text-xs text-[var(--ct-alert)]">ไม่สำเร็จ — {i.error}</span>
                  ) : (
                    <span className="block text-xs text-[var(--ct-warn-ink)]">ยังไม่ได้สร้าง</span>
                  )}
                  {i.madeAfterActivation === true && (
                    <span className="block text-xs font-medium text-[var(--ct-warn-ink)]">ยังหยุดอยู่ — สร้างหลังเปิดใช้</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {send.running ? (
        <p role="status" className="text-sm text-[var(--ct-mute)]">กำลังทำงานกับรอบส่งนี้อยู่ (ส่งหรือเปิด/หยุด) — รอสักครู่แล้วเปิดหน้านี้ใหม่</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {buttons.retry && (
            <button type="button" disabled={busy !== null} onClick={() => press("retry")} className={solid}>
              {busy === "retry" ? "กำลังทำต่อ…" : "ลองใหม่ (ทำเฉพาะที่ขาด)"}
            </button>
          )}
          {buttons.activate && (
            <button type="button" disabled={busy !== null} onClick={() => press("activate")} className={solid}>
              {busy === "activate" ? "กำลังเปิดใช้…" : "เปิดใช้ทั้งชุด"}
            </button>
          )}
          {buttons.pause && (
            <button type="button" disabled={busy !== null} onClick={() => press("pause")} className={plain}>
              {busy === "pause" ? "กำลังหยุด…" : "หยุดทั้งชุด"}
            </button>
          )}
        </div>
      )}
      <Note note={note} />
    </article>
  );
}
