"use client";
import Link from "next/link";
import { useState } from "react";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { ClipProgress } from "./ClipProgress";
import { SaveVideoButton } from "./SaveVideoButton";
import { addToCalendar, calendarCaption, removeVideo, type VideoItem } from "./actions";

/**
 * The clips an agent has made, with what can be done with each: watch, save, copy the link,
 * put on a Page's calendar (the owner's), delete. วิดีโอนำเสนอ and คลิปเล่าเรื่อง list theirs
 * the same way; each board owns the list and keeps asking about clips still being made.
 */

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const card = "rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const STATUS: Record<VideoItem["status"], string> = { drawing: "กำลังทำเสียงและภาพ…", rendering: "กำลังรวมเป็นวิดีโอ…", done: "เสร็จ", failed: "ไม่สำเร็จ" };
const ASPECT: Record<VideoSize, string> = { portrait: "9 / 16", square: "1 / 1", landscape: "16 / 9" };

export function ClipList({ items, setItems, pages }: {
  items: VideoItem[] | null;
  setItems: React.Dispatch<React.SetStateAction<VideoItem[] | null>>;
  pages: { id: string; name: string }[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; text: string } | null>(null);

  // the owner's calendar panel, one clip at a time
  const [cal, setCal] = useState<{ id: string; page: string; caption: string; busy: boolean; error?: string; done?: string } | null>(null);
  async function openCalendar(id: string) {
    setCal({ id, page: pages[0]?.id ?? "", caption: "", busy: true });
    const r = await calendarCaption(id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setCal((c) => (c?.id === id ? (r.ok ? { ...c, caption: r.caption, busy: false } : { ...c, busy: false, error: r.error }) : c));
  }
  async function sendCalendar() {
    if (!cal) return;
    setCal({ ...cal, busy: true, error: undefined });
    const r = await addToCalendar(cal.id, cal.page, cal.caption).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setCal((c) => (c ? (r.ok ? { ...c, busy: false, done: r.pageId } : { ...c, busy: false, error: r.error }) : c));
  }

  async function remove(id: string) {
    setDeleteError(null);
    const r = await removeVideo(id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setConfirming(null);
    if (!r.ok) { setDeleteError({ id, text: r.error }); return; }
    setItems((was) => was?.filter((v) => v.id !== id) ?? was);
  }

  async function copy(v: VideoItem) {
    if (!v.share) return;
    try {
      await navigator.clipboard.writeText(v.share);
      setCopied(v.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("คัดลอกลิงก์นี้", v.share);
    }
  }

  return (
    <div className={`${card} space-y-3`}>
      <h2 className="font-semibold">วิดีโอที่สร้างแล้ว</h2>
      {items === null && <p className="text-sm text-[var(--ct-mute)]">อ่านรายการไม่ได้ตอนนี้</p>}
      {items?.length === 0 && <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีวิดีโอ</p>}
      {items?.map((v) => (
        <div key={v.id} className="space-y-2 rounded-lg border border-[var(--ct-line)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{v.title}</p>
              <p className="text-xs text-[var(--ct-mute)]">{when(v.createdAt)}{v.paid ? ` · ${v.paid}` : ""}</p>
            </div>
            {!v.progress && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${v.status === "done" ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : v.status === "failed" ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}>
                {STATUS[v.status]}
              </span>
            )}
          </div>
          {v.progress && <ClipProgress state={v.progress} />}
          {v.status === "failed" && v.error && <p className="text-xs text-[var(--ct-alert)]">{v.error}</p>}
          {v.voiceFull && <p className="text-xs text-[var(--ct-mute)]">ไม่เสียเงิน และไม่นับเป็นคลิปฟรี</p>}
          {v.watch && <video src={v.watch} controls playsInline preload="metadata" className={`w-full rounded-lg ${v.size === "landscape" ? "max-w-[300px]" : v.size === "square" ? "max-w-[260px]" : "max-w-[220px]"}`} style={{ aspectRatio: ASPECT[v.size] }} />}
          <div className="flex flex-wrap gap-2">
            {v.status === "done" && v.save && v.watch && <SaveVideoButton href={v.save} watch={v.watch} filename={v.fileName} className={small} />}
            {v.status === "done" && <button type="button" className={small} onClick={() => copy(v)}>{copied === v.id ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>}
            {v.status === "done" && pages.length > 0 && !v.named && !v.personal && v.size === "portrait" && !v.overReel && (
              <button type="button" className={small} onClick={() => openCalendar(v.id)}>เพิ่มลงปฏิทินเพจ</button>
            )}
            {(v.status === "done" || v.status === "failed") && (
              <button type="button" className={`${small} text-[var(--ct-alert)]`} onClick={() => setConfirming(v.id)}>ลบ</button>
            )}
          </div>
          {confirming === v.id && (
            <div role="alertdialog" aria-label="ยืนยันการลบ" className="space-y-2 rounded-lg bg-[var(--ct-alert-bg)] p-2 text-xs text-[var(--ct-alert)]">
              <p>ลบวิดีโอนี้? ลิงก์ที่ส่งให้ลูกค้าไปแล้วจะเปิดไม่ได้</p>
              <div className="flex gap-2">
                <button type="button" className="min-h-9 rounded-lg bg-[var(--ct-alert)] px-3 text-sm text-[var(--ct-panel)]" onClick={() => remove(v.id)}>ลบเลย</button>
                <button type="button" className={small} onClick={() => setConfirming(null)}>ไม่ลบ</button>
              </div>
            </div>
          )}
          {deleteError?.id === v.id && <p role="alert" className="text-xs text-[var(--ct-alert)]">{deleteError.text}</p>}
          {v.status === "done" && pages.length > 0 && (v.named || v.personal || v.size !== "portrait" || v.overReel) && (
            <p className="text-xs text-[var(--ct-mute)]">{v.personal ? "วิดีโอสรุป FHC เป็นข้อมูลส่วนตัวของลูกค้า ไม่มีปุ่มลงเพจ" : v.named ? "คลิปที่มีชื่อลูกค้าไม่มีปุ่มลงเพจ" : v.overReel ? "คลิปยาวเกิน 90 วินาที ลงเพจเป็น Reels ไม่ได้ ส่งให้ลูกค้าโดยตรง" : "ลงปฏิทินเพจ (Reels) ได้เฉพาะคลิปแนวตั้ง"}</p>
          )}
          {cal?.id === v.id && (
            <div className="space-y-2 rounded-lg border border-[var(--ct-line)] p-2 text-sm">
              {cal.done ? (
                <p>เพิ่มลงปฏิทินแล้ว · <Link href={`/studio/calendar?page=${encodeURIComponent(cal.done)}`} className="underline">ไปที่ปฏิทินโพสต์</Link> (อยู่ในแถบรอตั้งเวลา)</p>
              ) : (
                <>
                  <label htmlFor={`cal-page-${v.id}`} className="block text-xs font-medium">ลงเพจ</label>
                  <select id={`cal-page-${v.id}`} className={field} value={cal.page} onChange={(e) => setCal({ ...cal, page: e.target.value })}>
                    {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <label htmlFor={`cal-cap-${v.id}`} className="block text-xs font-medium">แคปชัน (แก้ได้)</label>
                  <textarea id={`cal-cap-${v.id}`} rows={6} className={field} value={cal.caption} onChange={(e) => setCal({ ...cal, caption: e.target.value })} />
                  <p className="text-xs text-[var(--ct-mute)]">ท้ายคลิปมีชื่อ เบอร์ และ LINE ของคุณ ลูกค้าที่เห็นโพสต์จะทักคุณโดยตรง</p>
                  {cal.error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{cal.error}</p>}
                  <div className="flex gap-2">
                    <button type="button" disabled={cal.busy || !cal.page} onClick={sendCalendar} className="min-h-9 rounded-lg bg-[var(--ct-solid)] px-3 text-sm text-[var(--ct-solid-ink)] disabled:opacity-50">{cal.busy ? "กำลังเพิ่ม…" : "เพิ่มลงปฏิทิน"}</button>
                    <button type="button" className={small} onClick={() => setCal(null)}>ปิด</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
