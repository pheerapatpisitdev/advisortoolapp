"use client";
import { useEffect, useRef, useState } from "react";
import { clockOf, MAX_CAPTION, reelDescription } from "@/lib/content/clip";
import { onPage } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { keepOf } from "@/lib/video/preview";
import { mapTime } from "@/lib/video/timeline";
import { ask } from "../ask";
import { saveClipCaption, transcribeClip } from "../clip";
import { PlanPanel } from "../PlanPanel";
import { PublishPanel } from "../PublishPanel";
import { BackIcon, CheckIcon } from "../ui/editor-icons";
import { ClipEditStudio } from "./ClipEditStudio";

/**
 * A Reel before it goes (owner, 2026-10-02): the clip to watch, the caption to edit, what was
 * said that a post would be flagged for — each jumps the player to its second — and ลงเพจ.
 * ตัดต่อ opens the clip editor (ClipEditStudio) in its place; once it has made a take, the
 * player plays that take, which is what goes up.
 */
export function ClipEditor({ item, planner, onSaved, onPublished, onStatus, onItem, onClose, onDirtyChange, suggestDay, clipEditing }: {
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
  /** the owner's switch (admin/ai): off hides the editor's door; a take already made still plays and posts */
  clipEditing: boolean;
}) {
  const v = item.output.video;
  const edit = v?.edit;
  const player = useRef<HTMLVideoElement>(null);
  const [editing, setEditing] = useState(false);
  // the take the editor made plays first; the clip as filmed is a press away
  const [take, setTake] = useState<"edited" | "original">("edited");
  const hasTake = Boolean(edit?.renderedPath) && !v?.expired;
  const showing = hasTake && take === "edited" ? "edited" : "original";
  const stale = hasTake && edit?.renderedRev !== edit?.rev;
  const pendingSeek = useRef<number | null>(null);
  const [caption, setCaption] = useState(v?.caption ?? "");
  // a new caption from the server (a listen, a save) replaces what is in the box — unless the
  // agent has typed over the last one and not saved it: their words stay, and still read as unsaved
  const [shown, setShown] = useState(v?.caption);
  if (shown !== v?.caption) {
    const typed = caption.trim() !== (shown ?? "").trim();
    setShown(v?.caption);
    if (!typed) setCaption(v?.caption ?? "");
  }
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

  /** to a second of the clip as filmed: on the edited take, where that second landed; one the take no longer matches plays the original */
  const seek = (at: number) => {
    const p = player.current;
    if (!p || !v) return;
    let to = at;
    if (showing === "edited") {
      if (stale || !edit?.silences) { pendingSeek.current = at; setTake("original"); return; }
      to = mapTime(at, keepOf(v, edit));
    }
    p.currentTime = to;
    void p.play().catch(() => undefined);
  };
  const seekPending = () => {
    const p = player.current;
    if (!p || pendingSeek.current === null) return;
    p.currentTime = pendingSeek.current;
    pendingSeek.current = null;
    void p.play().catch(() => undefined);
  };
  const flags = v?.flags;
  const captionWarnings = flags ? flags.words.length + flags.numbers.length + (flags.policy?.length ?? 0) : 0;
  const button = "min-h-tap rounded-lg border border-[var(--ct-line)] px-4 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
  const chip = (on: boolean) => `min-h-tap rounded-lg border px-3 text-sm ${on ? "border-[var(--ct-accent)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] hover:bg-[var(--ct-soft)]"}`;
  // the editor needs words to cut by and a file to cut; a held Reel's editor only shows what was made
  const canEdit = Boolean(clipEditing && v && !v.expired && (v.transcript?.length ?? 0) > 0 && (!locked || edit?.proxyPath));

  // every answer of the editor is this piece, wherever it lives (a tab's list or one opened from the calendar): onSaved, never onItem's new-clip count
  if (editing && v) return <ClipEditStudio item={item} onItem={onSaved} onClose={() => setEditing(false)} />;

  return (
    <section className="space-y-4 rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4 pt-14 lg:pt-4">
      <div>
        <button type="button" onClick={leave} className="-ml-1 inline-flex min-h-tap items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
          <BackIcon className="size-4" />
          กลับไปรายการ
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">คลิป Reel{v ? ` · ${clockOf(v.durationSec)}` : ""}</h2>
          {hasTake && <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">คลิปที่ตัดต่อแล้ว</span>}
          {stale && <span className="rounded-full bg-[var(--ct-warn-bg)] px-2.5 py-0.5 text-xs text-[var(--ct-warn-ink)]">ยังไม่ได้สร้างใหม่</span>}
        </div>
        {v?.brief && <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เรื่อง: {v.brief}</p>}
      </div>

      {!v ? <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีคลิป — แนบคลิปที่การ์ด</p>
        // the sweep lets a Reel's file go once Facebook has it: that is not a clip to attach again
        : v.expired ? (locked
          ? <p className="text-sm text-[var(--ct-mute)]">ไฟล์ต้นฉบับถูกลบจากระบบแล้ว — Reel ยังอยู่บนเพจ</p>
          : <p className="text-sm text-[var(--ct-warn-ink)]">ไฟล์คลิปหมดอายุ — แนบคลิปใหม่ที่การ์ด</p>)
          // a GET that redirects to a signed link (api/content-video/[id]); the path is there so a new take is a new address
          : (
            <div className="space-y-2">
              <video
                ref={player} controls playsInline preload="metadata" onLoadedMetadata={seekPending}
                src={showing === "edited"
                  ? `/api/content-video/${item.id}?take=edited&v=${encodeURIComponent(edit!.renderedPath!)}`
                  : `/api/content-video/${item.id}?v=${encodeURIComponent(v.path)}`}
                className="mx-auto block max-h-[60vh] max-w-full rounded-lg bg-black"
              />
              {hasTake && (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" aria-pressed={showing === "edited"} onClick={() => setTake("edited")} className={chip(showing === "edited")}>คลิปที่ตัดต่อแล้ว (จะลงอันนี้)</button>
                  <button type="button" aria-pressed={showing === "original"} onClick={() => setTake("original")} className={chip(showing === "original")}>ต้นฉบับ</button>
                </div>
              )}
              {canEdit && (
                <div className="flex justify-center">
                  <button type="button" onClick={() => setEditing(true)} disabled={working !== null || sending} className={`${button} font-medium text-[var(--ct-accent)]`}>
                    {locked ? "ดูการตัดต่อ" : hasTake ? "แก้การตัดต่อ" : "ตัดต่อ"}
                  </button>
                </div>
              )}
            </div>
          )}

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
              <p className="text-[var(--ct-mute)]">{v.transcribeFailed ? "ถอดเสียงไม่สำเร็จ" : "ยังไม่ได้ถอดเสียง"}{locked ? "" : " — ลงเพจได้ แต่ระบบจะขอให้ยืนยันว่ายังไม่ได้ตรวจเสียงพูด"}</p>
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
                      <button type="button" onClick={() => seek(f.at)} className="min-h-tap text-left text-[var(--ct-warn-ink)] underline decoration-dotted underline-offset-2">
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
                <summary className="flex min-h-tap cursor-pointer items-center">ข้อความที่ถอดได้</summary>
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
          <summary className="flex min-h-tap cursor-pointer items-center text-[var(--ct-mute)]">ข้อความที่จะขึ้นพร้อมคลิป</summary>
          <p className="whitespace-pre-line rounded-lg bg-[var(--ct-ground)] p-3 leading-relaxed">{reelDescription({ ...item.output, video: { ...v, caption } })}</p>
        </details>
      )}

      {note && <p role="status" className="text-sm text-[var(--ct-mute)]">{note}</p>}

      {planner
        ? <PlanPanel item={item} suggestDay={suggestDay} onSaved={onSaved} />
        // held or posted, the box still says where it went (and links to it) after the file is gone
        : v && (!v.expired || locked) && (
          // a listen still running would write its caption over a Reel already sent: sending waits for it
          <PublishPanel
            item={item} hook={0} beforePublish={save} onPublished={onPublished} suggestDay={suggestDay} onBusy={setSending}
            drawing={working === "listen"} drawingNote="กำลังถอดเสียงอยู่ — รอให้เสร็จก่อนจึงจะลงเพจได้"
          />
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
