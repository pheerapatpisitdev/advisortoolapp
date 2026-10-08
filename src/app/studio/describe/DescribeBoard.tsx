"use client";
import Link from "next/link";
import { useState } from "react";
import { splitPrompt } from "@/lib/content/describe";
import type { Reading } from "@/lib/content/describe-history";
import { DescribePicker, type DescribeOk } from "../ui/DescribePicker";
import { clearReadingsAction, deleteReadingAction } from "./actions";

/** what the result area shows: a read just made, or one opened from the history */
interface Shown { prompt: string; summaryTh: string; costThb?: number }

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/**
 * The result as one card per heading, each with its own copy button, and one to copy the lot —
 * and under it the member's own history (describe-history.ts): the latest 200 reads, each
 * opened into the same cards, each deletable. `initial` is null when the history could not be read.
 */
export function DescribeBoard({ initial }: { initial: Reading[] | null }) {
  const [items, setItems] = useState<Reading[] | null>(initial);
  const [shown, setShown] = useState<Shown | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  function done(r: DescribeOk) {
    setShown({ prompt: r.prompt, summaryTh: r.summaryTh, costThb: r.costThb });
    setCopied(null);
    setCopyFailed(false);
    if (r.saved && r.id) {
      const added: Reading = {
        id: r.id, createdAt: new Date().toISOString(), prompt: r.prompt, summaryTh: r.summaryTh, palette: r.palette ?? [], thumbUrl: r.thumbUrl ?? null,
      };
      setItems((list) => (list === null ? list : [added, ...list.filter((i) => i.id !== added.id)]));
    }
  }

  async function remove(id: string) {
    const res = await deleteReadingAction(id);
    setDeleteFailed(!res.ok);
    if (res.ok) setItems((list) => (list ? list.filter((i) => i.id !== id) : list));
  }

  async function clearAll() {
    if (!window.confirm("ลบประวัติทั้งหมดของคุณ?")) return;
    const res = await clearReadingsAction();
    setDeleteFailed(!res.ok);
    if (res.ok) setItems([]);
  }

  const btn = "min-h-9 shrink-0 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)]";
  return (
    <div className="mt-5">
      <div className="flex justify-start"><DescribePicker onDone={done} /></div>
      {shown && (
        <div className="mt-5">
          <p className="text-sm text-[var(--ct-mute)]">รูปนี้: {shown.summaryTh}{shown.costThb !== undefined && ` · ใช้ไป ฿${shown.costThb.toFixed(2)}`}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={btn} onClick={() => copy("all", shown.prompt)}>{copied === "all" ? "ก๊อปแล้ว" : "ก๊อปทั้งหมด"}</button>
            <Link href="/studio/write" className={`${btn} inline-flex items-center`}>ใช้วาดรูป</Link>
            <span className="text-xs text-[var(--ct-mute)]">วางในช่องบรีฟภาพเพิ่มเติมของ Organic Studio</span>
          </div>
          {copyFailed && <p role="alert" className="mt-2 text-sm text-[var(--ct-alert)]">ก๊อปไม่ได้ เลือกข้อความแล้วคัดลอกเอง</p>}
          <ul className="mt-3 space-y-2">
            {splitPrompt(shown.prompt).map(({ heading, text }) => (
              <li key={heading} className="flex items-start gap-3 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--ct-mute)]">{heading}</p>
                  <p className="mt-0.5 text-sm">{text}</p>
                </div>
                <button type="button" className={btn} onClick={() => copy(heading, `${heading}: ${text}`)}>{copied === heading ? "ก๊อปแล้ว" : "ก๊อป"}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-8" aria-label="ประวัติของคุณ">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">ประวัติของคุณ</h2>
          {items && items.length > 0 && <button type="button" className={btn} onClick={clearAll}>ลบทั้งหมด</button>}
        </div>
        {deleteFailed && <p role="alert" className="mt-2 text-sm text-[var(--ct-alert)]">ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ</p>}
        {items === null && <p className="mt-2 text-sm text-[var(--ct-mute)]">เปิดประวัติไม่ได้ในตอนนี้ ลองโหลดหน้าใหม่อีกครั้งนะครับ</p>}
        {items && items.length === 0 && <p className="mt-2 text-sm text-[var(--ct-mute)]">ยังไม่มีประวัติ รูปที่ถอดแล้วจะเก็บไว้ที่นี่</p>}
        {items && items.length > 0 && (
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-stretch gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
                <button
                  type="button" onClick={() => { setShown({ prompt: item.prompt, summaryTh: item.summaryTh }); setCopied(null); setCopyFailed(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left hover:bg-[var(--ct-soft)]"
                >
                  {item.thumbUrl
                    // eslint-disable-next-line @next/next/no-img-element -- a signed link to a private file, or a data link just made
                    ? <img src={item.thumbUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    : <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-lg bg-[var(--ct-soft)]" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.summaryTh}</span>
                    <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">{when(item.createdAt)}</span>
                    <span className="mt-1 flex gap-1" aria-hidden="true">
                      {item.palette.map((c) => <span key={c.hex} title={`${c.hex} ${c.share}%`} className="h-3 w-3 rounded-full border border-[var(--ct-line)]" style={{ background: c.hex }} />)}
                    </span>
                  </span>
                </button>
                <button type="button" className={`${btn} m-3 self-center`} onClick={() => remove(item.id)}>ลบ</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
