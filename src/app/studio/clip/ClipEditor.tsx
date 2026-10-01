"use client";
import { useEffect, useRef, useState } from "react";
import { clockOf, MAX_CAPTION, reelDescription } from "@/lib/content/clip";
import { onPage } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { ask } from "../ask";
import { clipViewUrl, saveClipCaption, transcribeClip } from "../clip";
import { PlanPanel } from "../PlanPanel";
import { PublishPanel } from "../PublishPanel";
import { BackIcon, CheckIcon } from "../ui/editor-icons";

/**
 * A Reel before it goes (owner, 2026-10-02): the clip to watch, the caption to edit, what was
 * said that a post would be flagged for — each jumps the player to its second — and ลงเพจ.
 */
export function ClipEditor({ item, planner, onSaved, onPublished, onStatus, onItem, onClose, onDirtyChange, suggestDay }: {
  item: ContentItem;
  /** the agent may not post: วางแผน instead of ลงเพจ, as PieceEditor does */
  planner?: boolean;
  onSaved: (item: ContentItem) => void;
  onPublished: (item: ContentItem) => void;
  onStatus: (status: ContentItem["status"]) => void | Promise<unknown>;
  /** a fresh transcript (and the caption drafted from it) */
  onItem: (item: ContentItem) => void;
  onClose: () => void;
  /** the caption holds words not yet saved: the workbench asks before Back leaves them, as for PieceEditor */
  onDirtyChange?: (dirty: boolean) => void;
  suggestDay?: string | null;
}) {
  const v = item.output.video;
  const player = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [caption, setCaption] = useState(v?.caption ?? "");
  // a new caption from the server (a listen, a save) replaces what is in the box
  const [shown, setShown] = useState(v?.caption);
  if (shown !== v?.caption) { setShown(v?.caption); setCaption(v?.caption ?? ""); }
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState<"save" | "listen" | null>(null);
  const [sending, setSending] = useState(false);
  const locked = onPage(item.publish);
  const dirty = !locked && caption.trim() !== (v?.caption ?? "").trim();
  const dirtyTo = useRef(onDirtyChange);
  useEffect(() => { dirtyTo.current = onDirtyChange; });
  useEffect(() => { dirtyTo.current?.(dirty); }, [dirty]);
  useEffect(() => () => dirtyTo.current?.(false), []);

  async function leave() {
    if (dirty && !(await ask("แคปชันที่แก้ยังไม่ได้บันทึก — ออกจากหน้านี้เลยไหม?", "ออกเลย"))) return;
    onClose();
  }

  // a link good for an hour, asked again when a new take is attached
  useEffect(() => {
    let live = true;
    clipViewUrl(item.id).then((url) => { if (live) setSrc(url); }).catch(() => { if (live) setSrc(null); });
    return () => { live = false; };
  }, [item.id, v?.path]);

  /** PublishPanel's beforePublish too: the caption on screen is the one that goes */
  async function save(): Promise<boolean> {
    if (!dirty) return true;
    setWorking("save");
    const r = await saveClipCaption(item.id, caption).catch(() => null);
    setWorking(null);
    if (!r) { setNote("การเชื่อมต่อหลุด ลองบันทึกอีกครั้งนะครับ"); return false; }
    if (!r.ok) { setNote(r.error); return false; }
    setNote(null);
    onSaved(r.item);
    return true;
  }

  async function listen() {
    setWorking("listen");
    setNote("กำลังถอดเสียง…");
    const r = await transcribeClip(item.id).catch(() => null);
    setWorking(null);
    if (!r) { setNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ"); return; }
    if (!r.ok) { setNote(r.error); return; }
    setNote(null);
    onItem(r.item);
  }

  const seek = (at: number) => {
    const p = player.current;
    if (!p || !src) return;
    p.currentTime = at;
    void p.play().catch(() => undefined);
  };
  const flags = v?.flags;
  const captionWarnings = flags ? flags.words.length + flags.numbers.length + (flags.policy?.length ?? 0) : 0;
  const button = "min-h-11 rounded-lg border border-[var(--ct-line)] px-4 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <section className="space-y-4 rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4 pt-14 lg:pt-4">
      <div>
        <button type="button" onClick={leave} className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
          <BackIcon className="size-4" />
          กลับไปรายการ
        </button>
        <h2 className="mt-2 text-base font-semibold">คลิป Reel{v ? ` · ${clockOf(v.durationSec)}` : ""}</h2>
        {v?.brief && <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เรื่อง: {v.brief}</p>}
      </div>

      {!v ? <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีคลิป — แนบคลิปที่การ์ด</p>
        : v.expired ? <p className="text-sm text-[var(--ct-warn-ink)]">ไฟล์คลิปหมดอายุ — แนบคลิปใหม่ที่การ์ด</p>
          : <video ref={player} src={src ?? undefined} controls playsInline preload="metadata" className="mx-auto block max-h-[60vh] max-w-full rounded-lg bg-black" />}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">แคปชัน</span>
        <textarea
          value={caption} onChange={(e) => setCaption(e.target.value)} readOnly={locked || sending} rows={6} maxLength={MAX_CAPTION}
          className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--ct-accent)]"
        />
        {locked && <span className="text-xs text-[var(--ct-mute)]">ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนถ้าจะแก้แคปชัน</span>}
      </label>
      {!locked && dirty && (
        <button type="button" onClick={() => void save()} disabled={working !== null || sending} className={button}>
          {working === "save" ? "กำลังบันทึก…" : "บันทึกแคปชัน"}
        </button>
      )}

      {flags && captionWarnings > 0 && (
        <div className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
          <p className="font-medium">ในแคปชัน — ตรวจก่อนลงเพจ</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {flags.words.map((w, i) => <li key={`w${i}`}>{w.kind === "banned" ? `“${w.word}” — คำโฆษณาที่ควรเลี่ยง` : `“${w.word}” → “${w.fix}”`}</li>)}
            {flags.numbers.map((n, i) => <li key={`n${i}`}>ตัวเลข {n} ไม่มีในข้อมูลของแบบนี้</li>)}
            {(flags.policy ?? []).map((f, i) => (
              <li key={`p${i}`} className={f.severity === "block" ? "text-[var(--ct-alert)]" : ""}>
                {f.severity === "block" ? "ผิดกฎโฆษณา Facebook" : "เสี่ยงผิดกฎ Facebook"}: {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {v && (
        <div className="rounded-lg border border-[var(--ct-hair)] p-3 text-sm">
          <p className="font-medium">เสียงพูดในคลิป</p>
          {!v.transcript ? (
            <div className="mt-1 space-y-2">
              <p className="text-[var(--ct-mute)]">{v.transcribeFailed ? "ถอดเสียงไม่สำเร็จ" : "ยังไม่ได้ถอดเสียง"} — ลงเพจได้ แต่ระบบจะขอให้ยืนยันว่ายังไม่ได้ตรวจเสียงพูด</p>
              {!locked && !v.expired && (
                <button type="button" onClick={listen} disabled={working !== null || sending} className={button}>
                  {working === "listen" ? "กำลังถอดเสียง…" : "ถอดเสียงอีกครั้ง"}
                </button>
              )}
            </div>
          ) : (
            <>
              {(v.spokenFlags ?? []).length > 0 ? (
                <ul className="mt-1">
                  {(v.spokenFlags ?? []).map((f, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => seek(f.at)} className="min-h-11 text-left text-[var(--ct-warn-ink)] underline decoration-dotted underline-offset-2">
                        <span className="tabular-nums">{clockOf(f.at)}</span> · {f.message}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-[var(--ct-mute)]"><CheckIcon className="size-4 text-[var(--ct-accent)]" />ไม่พบคำที่ต้องระวัง</p>
              )}
              <p className="mt-1 text-xs text-[var(--ct-mute)]">ระบบถอดเสียงอาจได้ยินผิด — กดเวลาเพื่อฟังตรงนั้น</p>
              <details className="mt-2">
                <summary className="flex min-h-11 cursor-pointer items-center">ข้อความที่ถอดได้</summary>
                <ol className="mt-1 space-y-1">
                  {v.transcript.map((s, i) => (
                    <li key={i} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                      <button type="button" onClick={() => seek(s.start)} className="min-h-9 text-left text-xs tabular-nums text-[var(--ct-accent)] underline-offset-2 hover:underline">{clockOf(s.start)}</button>
                      <span className="py-1.5">{s.text}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </div>
      )}

      {v && (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-[var(--ct-mute)]">ข้อความที่จะขึ้นพร้อมคลิป</summary>
          <p className="whitespace-pre-line rounded-lg bg-[var(--ct-ground)] p-3 leading-relaxed">{reelDescription({ ...item.output, video: { ...v, caption } })}</p>
        </details>
      )}

      {note && <p role="status" className="text-sm text-[var(--ct-mute)]">{note}</p>}

      {planner
        ? <PlanPanel item={item} suggestDay={suggestDay} onSaved={onSaved} />
        : v && !v.expired && (
          <PublishPanel item={item} hook={0} beforePublish={save} onPublished={onPublished} drawing={false} suggestDay={suggestDay} onBusy={setSending} />
        )}

      {item.status === "draft" && (
        <button type="button" onClick={() => void onStatus("used")} disabled={working !== null || sending} className={`${button} inline-flex items-center gap-1.5 text-[var(--ct-accent)]`}>
          <CheckIcon className="size-4" />
          ใช้จริง
        </button>
      )}
    </section>
  );
}
