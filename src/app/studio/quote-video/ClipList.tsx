"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Board } from "@/lib/quote-video/board";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { RedrawScenes } from "../prompt-story/RedrawScenes";
import { ClipProgress } from "./ClipProgress";
import { useFreshLinks } from "./fresh-links";
import { PostPanel } from "./PostPanel";
import { SaveVideoButton } from "./SaveVideoButton";
import { addToCalendar, calendarCaption, myClipDays, myVideos, removeVideo, type ClipDay, type ClipPost, type VideoItem } from "./actions";
import { DAYS, daysFrom, firstTab, growShelf, keepView, matches, readView, shelfRows, shelfSize, TABS, tabOf, type Days, type Tab, type View } from "./shelf";

/**
 * The clips an agent has made, with what can be done with each: watch, save, copy the link,
 * put on a Page's calendar (the owner's), delete. Every Studio clip board lists its own this way;
 * each board owns the list and keeps asking about clips still being made.
 *
 * Laid on the desk as Organic Studio's pieces are (owner, 2026-10-15, mockup
 * https://claude.ai/artifact/8B39tj4VDgrd9RsdCC23RL): a tab for each state, the clips as cards
 * several to a row, and a card opened full width while its words, its calendar or its delete is.
 *
 * For agents with many clips (owner, 2026-11-27, chose 1ก ข, mockup
 * https://claude.ai/artifact/FAb63v7iQ89tcGQpMiztcW): ทั้งหมด taken out, the shelf opens on
 * กำลังสร้าง while a clip is being made and on เสร็จ otherwise, a search box, day buttons, การ์ด or
 * รายการ, and แสดงเพิ่ม for clips older than the newest 30.
 */

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const STATUS: Record<VideoItem["status"], string> = { drawing: "กำลังทำเสียงและภาพ…", rendering: "กำลังรวมเป็นวิดีโอ…", done: "เสร็จ", failed: "ไม่สำเร็จ" };
const ASPECT: Record<VideoSize, string> = { portrait: "9 / 16", square: "1 / 1", landscape: "16 / 9" };
const NO_LINE = "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";

export function ClipList({ board, items, setItems, pages }: {
  board: Board;
  items: VideoItem[] | null;
  setItems: React.Dispatch<React.SetStateAction<VideoItem[] | null>>;
  pages: { id: string; name: string }[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>(() => firstTab(items));
  const [days, setDays] = useState<Days>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("cards");
  // รายการ: the one row opened into its card
  const [expanded, setExpanded] = useState<string | null>(null);
  // the one clip whose words are open
  const [writing, setWriting] = useState<string | null>(null);
  const gotPost = (id: string, post: ClipPost) => setItems((was) => was?.map((v) => (v.id === id ? { ...v, post } : v)) ?? was);

  // every clip the board holds, state and day only: what the tabs and day buttons count
  const [dayRows, setDayRows] = useState<ClipDay[] | null>(null);
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const readDays = () => { myClipDays(board).then(setDayRows).catch(() => undefined); };
  useEffect(readDays, [board]);
  useFreshLinks(readDays);
  useEffect(() => { setView(readView()); }, []);
  const pickView = (v: View) => { setView(v); keepView(v); setExpanded(null); };

  // a clip just started turns to กำลังสร้าง; one that finishes while the page is open says so
  const [notice, setNotice] = useState<{ title: string } | null>(null);
  const makingBefore = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!items) return;
    const now = new Set(items.filter((v) => tabOf(v.status) === "making").map((v) => v.id));
    const before = makingBefore.current;
    makingBefore.current = now;
    if (!before) return;
    if ([...now].some((id) => !before.has(id))) {
      setTab("making");
      setQuery("");
      setDays("all");
    }
    const finished = items.find((v) => before.has(v.id) && v.status === "done");
    if (finished) setNotice({ title: finished.title });
  }, [items]);

  // the owner's calendar panel, one clip at a time
  const [cal, setCal] = useState<{ id: string; page: string; caption: string; busy: boolean; error?: string; done?: string } | null>(null);
  async function openCalendar(id: string) {
    setCal({ id, page: pages[0]?.id ?? "", caption: "", busy: true });
    const r = await calendarCaption(id).catch(() => ({ ok: false as const, error: NO_LINE }));
    setCal((c) => (c?.id === id ? (r.ok ? { ...c, caption: r.caption, busy: false } : { ...c, busy: false, error: r.error }) : c));
  }
  async function sendCalendar() {
    if (!cal) return;
    setCal({ ...cal, busy: true, error: undefined });
    const r = await addToCalendar(cal.id, cal.page, cal.caption).catch(() => ({ ok: false as const, error: NO_LINE }));
    setCal((c) => (c ? (r.ok ? { ...c, busy: false, done: r.pageId } : { ...c, busy: false, error: r.error }) : c));
  }

  // a picture drawn again puts its clip back to being made: ask the list again
  const refreshPrompt = () => { myVideos("prompt", shelfSize("prompt")).then(setItems).catch(() => undefined); };

  async function remove(id: string) {
    setDeleteError(null);
    const r = await removeVideo(id).catch(() => ({ ok: false as const, error: NO_LINE }));
    setConfirming(null);
    if (!r.ok) { setDeleteError({ id, text: r.error }); return; }
    setItems((was) => was?.filter((v) => v.id !== id) ?? was);
    setGone((g) => new Set(g).add(id));
    if (expanded === id) setExpanded(null);
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

  // แสดงเพิ่ม: 30 more each time, kept for every later read of the list
  const [more, setMore] = useState<{ busy: boolean; error?: string }>({ busy: false });
  async function showMore() {
    setMore({ busy: true });
    try {
      setItems(await myVideos(board, growShelf(board)));
      setMore({ busy: false });
    } catch {
      setMore({ busy: false, error: NO_LINE });
    }
  }

  const all = shelfRows(dayRows, items, gone);
  const from = daysFrom(days, Date.now());
  const inDays = (v: { createdAt: string }) => new Date(v.createdAt).getTime() >= from;
  const inTab = (v: { status: VideoItem["status"] }) => tabOf(v.status) === tab;
  const wanted = all.filter((v) => inTab(v) && inDays(v)).length;
  const loaded = (items ?? []).filter((v) => !gone.has(v.id) && inTab(v) && inDays(v));
  const shown = items === null ? null : loaded.filter((v) => matches(v.title, query));
  const olderLeft = wanted > loaded.length;

  function card(v: VideoItem, boxed: boolean) {
    const open = writing === v.id || confirming === v.id || cal?.id === v.id || expanded === v.id;
    const video = v.watch && <video src={v.watch} controls playsInline preload="metadata" className={`w-full rounded-lg bg-[var(--ct-ground)] ${open ? (v.size === "landscape" ? "max-w-[300px]" : v.size === "square" ? "max-w-[260px]" : "max-w-[220px]") : ""}`} style={{ aspectRatio: ASPECT[v.size] }} />;
    return (
      <div key={v.id} className={`@container min-w-0 ${boxed ? `rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3 ${open ? "col-span-full" : ""}` : "p-3"}`}>
        {!boxed && (
          <button type="button" onClick={() => { setExpanded(null); setWriting(null); setConfirming(null); setCal(null); }} className={`${small} mb-2`}>
            ย่อกลับเป็นแถว
          </button>
        )}
        <div className={open ? "grid items-start gap-3 @2xl:grid-cols-[auto_minmax(0,1fr)]" : "space-y-2"}>
        {video}
        <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{v.title}</p>
            <p className="text-xs text-[var(--ct-mute)]">{when(v.createdAt)}{v.paid ? ` · ${v.paid}` : ""}</p>
          </div>
          {!v.progress && <StatusPill status={v.status} />}
        </div>
        {v.progress && <ClipProgress state={v.progress} />}
        {v.status === "done" && v.error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{v.error}</p>}
        {v.status === "failed" && v.error && <p className="text-xs text-[var(--ct-alert)]">{v.error}</p>}
        {v.voiceFull && <p className="text-xs text-[var(--ct-mute)]">ไม่เสียเงิน และไม่นับเป็นคลิปฟรี</p>}
        {v.voiceSwap && <p className="text-xs text-[var(--ct-accent)]">{v.voiceSwap}</p>}
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
        {v.status === "done" && writing !== v.id && (
          <button
            type="button" onClick={() => setWriting(v.id)}
            className="inline-flex min-h-9 items-center rounded-lg border border-[var(--ct-accent)] px-3 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]"
          >
            {v.post ? (v.post.kind === "customer" ? "ดูข้อความส่งลูกค้า" : "ดูข้อความโพสต์") : v.named || v.personal ? "✎ เขียนข้อความส่งลูกค้าด้วย AI" : "✎ เขียนข้อความโพสต์ด้วย AI"}
          </button>
        )}
        {v.status === "done" && v.redraw && (
          <RedrawScenes id={v.id} scenes={v.redraw.scenes} devices={v.redraw.devices} price={v.redraw.price} onStarted={refreshPrompt} />
        )}
        {writing === v.id && (
          <PostPanel id={v.id} post={v.post} customer={v.named || v.personal} onPost={(p) => gotPost(v.id, p)} onClose={() => setWriting(null)} />
        )}
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
        </div>
      </div>
    );
  }

  function row(v: VideoItem) {
    if (expanded === v.id || writing === v.id || confirming === v.id || cal?.id === v.id) {
      return <li key={v.id} className="bg-[var(--ct-panel)]">{card(v, false)}</li>;
    }
    return (
      <li key={v.id} className="flex items-center gap-3 bg-[var(--ct-panel)] px-3 py-2">
        <button type="button" onClick={() => setExpanded(v.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`เปิดคลิป ${v.title}`}>
          <span
            aria-hidden
            className={`grid w-9 shrink-0 place-items-center rounded-md text-xs ${v.status === "done" ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : v.status === "failed" ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}
            style={{ aspectRatio: ASPECT[v.size] === "16 / 9" ? "1 / 1" : ASPECT[v.size] }}
          >
            {v.status === "done" ? "▶" : v.status === "failed" ? "!" : "…"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{v.title}</span>
            <span className="block text-xs text-[var(--ct-mute)]">{when(v.createdAt)}{v.paid ? ` · ${v.paid}` : ""}</span>
          </span>
        </button>
        {v.progress ? (
          <div className="w-40 shrink-0 max-sm:w-28"><ClipProgress state={v.progress} /></div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {v.status !== "done" && <StatusPill status={v.status} />}
            {v.status === "done" && v.save && v.watch && <span className="max-sm:hidden"><SaveVideoButton href={v.save} watch={v.watch} filename={v.fileName} className={small} /></span>}
            {v.status === "done" && <button type="button" className={`${small} max-sm:hidden`} onClick={() => copy(v)}>{copied === v.id ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>}
            <button type="button" className={small} aria-label={`ดูคลิปและเมนูอื่นของ ${v.title}`} onClick={() => setExpanded(v.id)}>⋯</button>
          </div>
        )}
      </li>
    );
  }

  const chip = (on: boolean) => `inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs ${on ? "border-[var(--ct-accent)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-hair)] bg-[var(--ct-panel)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
  const nothingYet = items !== null && all.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="สถานะวิดีโอ" className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
          {TABS.map((t) => {
            const n = all.filter((v) => tabOf(v.status) === t.id).length;
            return (
              <button
                key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setExpanded(null); }}
                className={`inline-flex min-h-tap items-center gap-1.5 rounded-full px-4 text-sm ${tab === t.id ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
              >
                {t.id === "making" && n > 0 && <span aria-hidden className="size-2 rounded-full bg-[var(--ct-solid)] motion-safe:animate-pulse" />}
                {t.label} <span className="tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`clip-search-${board}`} className="sr-only">ค้นคลิป</label>
          <input
            id={`clip-search-${board}`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นชื่อลูกค้า หรือแผน"
            className="min-h-9 w-52 max-w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm"
          />
          <div role="group" aria-label="แบบที่แสดง" className="inline-flex overflow-hidden rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)]">
            {([["cards", "การ์ด"], ["rows", "รายการ"]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => pickView(id)}
                className={`min-h-9 px-3 text-xs ${view === id ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <h2 className="sr-only">วิดีโอที่สร้างแล้ว</h2>
      </div>

      <div role="group" aria-label="ช่วงวัน" className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const since = daysFrom(d.id, Date.now());
          const n = all.filter((v) => inTab(v) && new Date(v.createdAt).getTime() >= since).length;
          return (
            <button key={d.id} type="button" aria-pressed={days === d.id} onClick={() => setDays(d.id)} className={chip(days === d.id)}>
              {d.label}{d.id !== "all" && <span className="tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>

      {notice && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--ct-solid)] px-3 py-2 text-sm text-[var(--ct-solid-ink)]">
          <span className="min-w-0 flex-1">✓ คลิป “{notice.title}” เสร็จแล้ว</span>
          {tab !== "done" && <button type="button" className="underline" onClick={() => { setTab("done"); setDays("all"); setNotice(null); }}>ดูในแถบเสร็จ</button>}
          <button type="button" aria-label="ปิดข้อความ" className="px-1" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {items === null && <p className="rounded-lg bg-[var(--ct-panel)] px-3 py-2 text-sm text-[var(--ct-mute)]">อ่านรายการไม่ได้ตอนนี้</p>}
      {shown?.length === 0 && (
        <p className="rounded-lg border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-8 text-center text-sm text-[var(--ct-mute)]">
          {nothingYet ? "ยังไม่มีวิดีโอ — เลือกในเครื่องมือแล้วกด “สร้างวิดีโอ” คลิปจะขึ้นตรงนี้"
            : query.trim() && loaded.length > 0 ? `ไม่พบคลิปที่ตรงกับ “${query.trim()}”`
            : olderLeft ? "คลิปในช่วงนี้เก่ากว่าที่แสดงอยู่ กดแสดงเพิ่มด้านล่าง"
            : tab === "making" ? "ไม่มีคลิปกำลังสร้าง" : "ไม่มีวิดีโอในแถบนี้"}
        </p>
      )}

      {shown && shown.length > 0 && (view === "cards" ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
          {shown.map((v) => card(v, true))}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--ct-hair)] overflow-hidden rounded-xl border border-[var(--ct-hair)]">
          {shown.map(row)}
        </ul>
      ))}

      {shown && (olderLeft || query.trim()) && !nothingYet && (
        <div className="flex flex-col items-center gap-1 pt-1">
          {olderLeft && (
            <button type="button" disabled={more.busy} onClick={showMore} className={`${small} bg-[var(--ct-panel)] disabled:opacity-50`}>
              {more.busy ? "กำลังโหลด…" : "แสดงเพิ่มอีก 30 คลิป"}
            </button>
          )}
          <p className="text-xs tabular-nums text-[var(--ct-mute)]">
            {query.trim()
              ? `ค้นจาก ${loaded.length} คลิปที่แสดงอยู่${olderLeft ? " กดแสดงเพิ่มเพื่อค้นคลิปที่เก่ากว่า" : ""}`
              : `แสดง ${loaded.length} จาก ${wanted} คลิป`}
          </p>
          {more.error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{more.error}</p>}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: VideoItem["status"] }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${status === "done" ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : status === "failed" ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}>
      {STATUS[status]}
    </span>
  );
}
