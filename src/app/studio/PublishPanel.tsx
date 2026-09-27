"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { postLink } from "@/lib/facebook/publish";
import { bangkokAt, dayKey, thaiDayLabel, timeOfDay } from "@/lib/content/calendar";
import { publishView, quickTimes, thaiWhen } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { cancelScheduled, publishPiece, publishSetup, scheduleNextOpen, type PublishResult, type PublishSetup } from "./publish";
import { ask } from "./ask";
import { CheckIcon, ClockIcon } from "./ui/editor-icons";
import { errorNote, Note, okNote, PlainText, type NoteState } from "./ui/editor-fields";

/**
 * The editor's ลงเพจ box: pick the Page and the time, and send — or see where it went.
 *
 * Posting now asks once more, because it is public the moment it lands; a schedule does not,
 * because it can be taken back until its time. Unsaved edits are saved first, so what goes up
 * is what is on screen.
 *
 * The quick times are worked out when the panel opens and again whenever the owner comes back
 * to it; a time that has slipped past (a panel left open over the evening) is dropped and the
 * choice moves to the next one, and the time is checked once more right before sending.
 */

/** the Page last posted to, kept in this browser */
const PAGE_KEY = "content-page";
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

interface Props {
  item: ContentItem;
  /** which opening line goes up, for older pieces that carry three */
  hook: number;
  /** saves the editor's unsaved words; false when that failed */
  beforePublish: () => Promise<boolean>;
  onPublished: (item: ContentItem) => void;
  /** the photograph is still being drawn: what went up now would be the poster without it */
  drawing?: boolean;
  /** a day the calendar sent the owner to write for: its noon and evening come first, noon chosen */
  suggestDay?: string | null;
  /** told while a post or a cancel is on its way to Facebook, so the editor is not left mid-send */
  onBusy?: (busy: boolean) => void;
}

/**
 * The date-time box, in Thailand's time whatever the device's clock says: its value was read as
 * the device's local time, so a laptop on UTC held 19:30 for 02:30 in Bangkok.
 */
const bangkokInput = (d: Date) => `${dayKey(d)}T${timeOfDay(d)}`;
const fromBangkokInput = (v: string) => bangkokAt(v.slice(0, 10), v.slice(11, 16));

/** how far ahead Facebook will hold a post, and how far this form lets the owner pick */
const MIN_AHEAD_MS = 15 * 60_000;
const MAX_AHEAD_MS = 30 * 24 * 60 * 60_000;

type Quick = { label: string; iso: string };
const quickOptions = (day?: string | null): Quick[] => {
  const planned = day
    ? ["12:00", "19:30"]
      .map((t) => ({ label: `${thaiDayLabel(day)} ${t}`, iso: bangkokAt(day, t).toISOString() }))
      .filter((q) => new Date(q.iso).getTime() - Date.now() >= MIN_AHEAD_MS)
    : [];
  const quick = quickTimes().map((t) => ({ label: t.label, iso: t.at.toISOString() }));
  return [...planned, ...quick.filter((q) => !planned.some((p) => p.iso === q.iso))];
};

const button = "min-h-11 rounded-lg px-4 py-2 text-sm disabled:opacity-50";

/** the choice that lets the server find the day: the first its Page has nothing on (scheduleNextOpen) */
const OPEN = "open";

export function PublishPanel({ item, hook, beforePublish, onPublished, drawing, suggestDay, onBusy }: Props) {
  const [setup, setSetup] = useState<PublishSetup | null>(null);
  const [pageId, setPageId] = useState("");
  // "now", "custom", or the ISO time of one of the quick options — the calendar's day when it sent one
  const [times, setTimes] = useState<Quick[]>(() => quickOptions(suggestDay));
  const [when, setWhen] = useState(() => (suggestDay && times[0]?.label.startsWith(thaiDayLabel(suggestDay)) ? times[0].iso : "now"));
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<"send" | "cancel" | null>(null);
  const busyTo = useRef(onBusy);
  useEffect(() => { busyTo.current = onBusy; });
  useEffect(() => { busyTo.current?.(busy !== null); }, [busy]);
  useEffect(() => () => busyTo.current?.(false), []);
  const [note, setNote] = useState<NoteState>(null);

  /** the Pages, read again by ลองใหม่ when the first read failed */
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    publishSetup().then((s) => {
      if (!live) return;
      setSetup(s);
      let kept = "";
      try { kept = localStorage.getItem(PAGE_KEY) ?? ""; } catch { /* storage unavailable */ }
      const usable = s.pages.filter((p) => p.canPost);
      setPageId(usable.find((p) => p.pageId === kept)?.pageId ?? usable[0]?.pageId ?? s.pages[0]?.pageId ?? "");
    }).catch(() => { if (live) setSetup({ pages: [], failed: true }); });
    return () => { live = false; };
  }, [attempt]);

  /**
   * The quick times again, as of now. A chosen one that has gone moves to the next that is
   * still ahead (or to picking one's own), and says so; returns whether the choice stood.
   */
  const refreshTimes = useCallback((): boolean => {
    const fresh = quickOptions(suggestDay);
    setTimes(fresh);
    if (when === "now" || when === "custom" || when === OPEN || fresh.some((t) => t.iso === when)) return true;
    setWhen(fresh[0]?.iso ?? "custom");
    setNote(errorNote("เวลาที่เลือกไว้ผ่านไปแล้ว — เลือกเวลาใหม่อีกครั้ง"));
    return false;
  }, [when, suggestDay]);

  // back at the tab after a while: the evening slot may have gone — while there is a time to
  // choose. Once held or posted there is none, and asking said the held time had passed.
  const choosing = ["none", "failed"].includes(publishView(item.publish).kind);
  useEffect(() => {
    if (!choosing) return;
    const back = () => { if (document.visibilityState === "visible") refreshTimes(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [refreshTimes, choosing]);

  const view = publishView(item.publish);
  const pageName = (id: string | null | undefined) => setup?.pages.find((p) => p.pageId === id)?.pageName ?? "เพจ";
  const blocked = (item.flags.policy ?? []).filter((f) => f.severity === "block");
  const quickLabel = times.find((t) => t.iso === when)?.label;

  /** the ISO time to hold it for, null for now, or a reason it cannot go */
  function chosenTime(): { at: string | null } | { error: string } {
    if (when === "now" || when === OPEN) return { at: null };
    if (when === "custom" && !custom) return { error: "เลือกวันเวลาก่อนนะครับ" };
    const iso = when === "custom" ? fromBangkokInput(custom).toISOString() : when;
    const ahead = new Date(iso).getTime() - Date.now();
    if (ahead < MIN_AHEAD_MS) return { error: "เวลานั้นใกล้เกินไปหรือผ่านไปแล้ว — ตั้งเวลาได้ตั้งแต่ 15 นาทีข้างหน้า" };
    if (ahead > MAX_AHEAD_MS) return { error: "ตั้งเวลาได้ไม่เกิน 30 วันข้างหน้า" };
    return { at: iso };
  }

  async function send() {
    // the time is checked as of now, not as of when the list was drawn
    if (!refreshTimes()) return;
    const chosen = chosenTime();
    if ("error" in chosen) { setNote(errorNote(chosen.error)); return; }
    const { at } = chosen;
    if (at === null && when !== OPEN && !(await ask(`โพสต์ลงเพจ ${pageName(pageId)} ตอนนี้เลย?`, "โพสต์เลย"))) return;
    setBusy("send");
    setNote(null);
    try {
      if (!(await beforePublish())) { setNote(errorNote("บันทึกการแก้ไขไม่สำเร็จ เลยยังไม่ได้โพสต์")); return; }
      try { localStorage.setItem(PAGE_KEY, pageId); } catch { /* not kept */ }
      let confirmNumbers = false;
      let force = false;
      for (;;) {
        const res: PublishResult = when === OPEN
          ? await scheduleNextOpen({ id: item.id, pageId, confirmNumbers, force })
          : await publishPiece({ id: item.id, pageId, at, hook, confirmNumbers, force });
        if (res.ok) {
          const heldAt = res.item.publish?.at;
          setNote(okNote(when === OPEN && heldAt ? `ตั้งเวลาแล้ว · ${thaiWhen(new Date(heldAt))}` : at ? "ตั้งเวลาแล้ว" : "โพสต์ลงเพจแล้ว"));
          onPublished(res.item);
          return;
        }
        if (res.confirmNumbers && !confirmNumbers) {
          const go = await ask(`มีตัวเลขที่ไม่ตรงกับตารางเบี้ย: ${res.confirmNumbers.join(", ")}\n\nตรวจแล้วว่าถูกต้อง และยังจะโพสต์ไหม?`, "โพสต์ต่อ");
          if (!go) return;
          confirmNumbers = true;
          continue;
        }
        if (res.confirmRepost && !force) {
          // Facebook may already show it: the owner looks at the Page before it goes again
          setNote(errorNote(res.error));
          if (!(await ask("เช็กในเพจแล้ว ยังไม่ขึ้น — ส่งอีกครั้ง?", "ส่งอีกครั้ง"))) return;
          setNote(null);
          force = true;
          continue;
        }
        setNote(errorNote(res.error));
        return;
      }
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองเช็กในเพจก่อนกดใหม่นะครับ"));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!(await ask("ยกเลิกการตั้งเวลาโพสต์นี้?", "ยกเลิกการตั้งเวลา"))) return;
    setBusy("cancel");
    setNote(null);
    const res = await cancelScheduled(item.id).catch(() => null);
    setBusy(null);
    if (!res) { setNote(errorNote("ยกเลิกการตั้งเวลาไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); return; }
    if (res.ok) { onPublished(res.item); setNote(okNote("ยกเลิกการตั้งเวลาแล้ว ตั้งเวลาใหม่ได้")); return; }
    setNote(errorNote(res.error));
  }

  let body: React.ReactNode;
  if (!setup) {
    body = <p className="text-sm text-[var(--ct-mute)]">กำลังโหลด…</p>;
  } else if (setup.failed && view.kind !== "scheduled" && view.kind !== "published" && view.kind !== "posting") {
    body = (
      <p className="text-sm text-[var(--ct-alert)]">
        โหลดรายชื่อเพจไม่สำเร็จ —{" "}
        <button type="button" onClick={() => { setSetup(null); setAttempt((n) => n + 1); }} className="inline-flex min-h-11 items-center font-medium underline">ลองใหม่</button>
      </p>
    );
  } else if (view.kind === "posting") {
    body = <p className="text-sm text-[var(--ct-mute)]">กำลังส่งไปเพจ…</p>;
  } else if (view.kind === "scheduled") {
    body = (
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm">
          <ClockIcon className="size-4 text-[var(--ct-accent)]" />
          <span>ตั้งเวลาไว้ <b>{thaiWhen(view.at)}</b> ที่ {pageName(item.publish?.pageId)}</span>
        </p>
        <button type="button" disabled={busy !== null} onClick={cancel} className={`${button} border border-[var(--ct-line)] text-[var(--ct-alert)] hover:bg-[var(--ct-alert-bg)]`}>
          {busy === "cancel" ? "กำลังยกเลิก…" : "ยกเลิกการตั้งเวลา"}
        </button>
      </div>
    );
  } else if (view.kind === "published") {
    body = (
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        <CheckIcon className="size-4 text-[var(--ct-accent)]" />
        <span>ลง {pageName(item.publish?.pageId)} แล้ว{view.at ? ` ${thaiWhen(view.at)}` : ""}</span>
        {item.publish?.postId && <> · <a href={postLink(item.publish.postId)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--ct-accent)] underline">ดูโพสต์</a></>}
      </p>
    );
  } else if (!setup.pages.some((p) => p.canPost)) {
    body = (
      <p className="text-sm text-[var(--ct-mute)]">
        ยังไม่ได้อนุญาตให้ระบบโพสต์ลงเพจ — ไปเชื่อมเพจใหม่ที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a>
      </p>
    );
  } else {
    body = (
      <div className="space-y-2">
        {view.kind === "failed" && (
          <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
            ครั้งก่อนไม่สำเร็จ: <PlainText text={view.error} />
          </p>
        )}
        {drawing && <p className="text-sm text-[var(--ct-mute)]">กำลังวาดภาพอยู่ — รอภาพเสร็จก่อนจึงจะโพสต์ได้ (ราว 20–40 วินาที)</p>}
        {blocked.length > 0 && <p className="text-sm text-[var(--ct-alert)]">ยังผิดกฎโฆษณาของ Facebook ({blocked[0].message}) — แก้แล้วกดบันทึกก่อน จึงจะโพสต์ได้</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={pageId} onChange={(e) => setPageId(e.target.value)} aria-label="เพจที่จะโพสต์" className={field}>
            {setup.pages.map((p) => (
              <option key={p.pageId} value={p.pageId} disabled={!p.canPost}>{p.pageName}{p.canPost ? "" : " (ยังไม่ได้อนุญาตให้โพสต์)"}</option>
            ))}
          </select>
          <select
            value={when} onChange={(e) => { setWhen(e.target.value); setNote(null); }}
            onFocus={() => refreshTimes()} aria-label="เวลาโพสต์" className={field}
          >
            <option value="now">โพสต์ตอนนี้</option>
            {times.map((t) => <option key={t.iso} value={t.iso}>ตั้งเวลา · {t.label}</option>)}
            <option value={OPEN}>ตั้งเวลา · วันว่างถัดไปของเพจนี้</option>
            <option value="custom">ตั้งเวลา · เลือกวันเวลาเอง…</option>
          </select>
        </div>
        {when === "custom" && (
          <input
            type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)}
            min={bangkokInput(new Date(Date.now() + MIN_AHEAD_MS))} max={bangkokInput(new Date(Date.now() + MAX_AHEAD_MS))}
            aria-label="วันเวลาที่จะโพสต์ (เวลาไทย)" className={field}
          />
        )}
        <button
          type="button" disabled={busy !== null || blocked.length > 0 || !pageId || drawing} onClick={send}
          className={`${button} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`}
        >
          {busy === "send" ? "กำลังส่ง…" : when === "now" ? "โพสต์ลงเพจเลย" : when === OPEN ? "ตั้งเวลา · วันว่างถัดไป" : `ตั้งเวลาโพสต์${quickLabel ? ` · ${quickLabel}` : ""}`}
        </button>
        <p className="text-xs text-[var(--ct-mute)]">ส่งรูปโปสเตอร์ 1:1 พร้อมข้อความเต็ม (รวมข้อความเตือนและชื่อบริษัท) · ตั้งเวลาได้ 15 นาที–30 วันข้างหน้า</p>
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-[var(--ct-line)] p-3">
      <p className="mb-2 text-sm font-medium">ลงเพจ</p>
      {body}
      <Note note={note} className="mt-2" />
    </section>
  );
}
