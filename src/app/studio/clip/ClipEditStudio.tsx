"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLIP_MIN_SEC, CLIP_STYLES, clockOf, MAX_EDITED_SECONDS, MAX_HOOK_MAIN, MAX_HOOK_TOP, SUBMIT_STALE_MS, tooLong,
  type ClipEdit, type EditJob,
} from "@/lib/content/clip";
import type { Theme } from "@/lib/content/poster";
import { onPage } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { mergeBack, POLL_GIVE_UP, retryDelay } from "@/lib/video/edit-saves";
import { keepOf, subsShown } from "@/lib/video/preview";
import { STYLE_LABEL, styleLook } from "@/lib/video/styles";
import { keptDuration } from "@/lib/video/timeline";
import { ask } from "../ask";
import { editTheme, openEdit, pollEdit, renderEdit, saveEdit, useOriginal as backToOriginal, type EditPatch } from "../clip-edit";
import { BackIcon } from "../ui/editor-icons";
import { EditPreview, type LiveEdit } from "./EditPreview";

/** what the agent changes here; the rest of the edit is the server's */
type Draft = Pick<ClipEdit, "cut" | "trimSilence" | "subs" | "hook" | "style">;
const draftOf = (e: ClipEdit): Draft => ({ cut: e.cut, trimSilence: e.trimSilence, subs: e.subs, hook: e.hook, style: e.style });

const SAVE_MS = 800;
const POLL_MS = 3000;
const LOST = "การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ";
const len = (s: string) => [...s].length;

/** the job under way — one on the row, or a submit claim not yet stale (clip.ts) — or null */
function running(edit: ClipEdit | undefined): EditJob["kind"] | null {
  if (edit?.job) return edit.job.kind;
  const claim = edit?.submitting;
  return claim && Date.now() - new Date(claim.at).getTime() <= SUBMIT_STALE_MS ? claim.kind : null;
}

/**
 * ตัดต่อคลิป (owner, 2026-10-02): the preview with the cuts, the subtitles and the hook laid on
 * live, the four looks, the sentences to keep or cut, the subtitle lines to fix, and สร้างคลิป.
 * Opening asks for the preview once (openEdit — a prepare is limited, so the wait is a poll,
 * never another open); every change is saved on its own, 0.8 s after the last.
 */
export function ClipEditStudio({ item, onItem, onClose }: {
  item: ContentItem;
  /** the piece as each answer brings it */
  onItem: (item: ContentItem) => void;
  onClose: () => void;
}) {
  const v = item.output.video;
  const edit = v?.edit;
  const locked = onPage(item.publish);
  // a clip whose file the sweep let go has no preview and no take: nothing is asked for
  const gone = !v || Boolean(v.expired);
  const ready = Boolean(edit?.proxyPath && edit?.silences);
  const job = running(edit);

  const toItem = useRef(onItem);
  // the piece as it is now, for answers that arrive after the render that sent them
  const current = useRef(item);
  useEffect(() => { toItem.current = onItem; current.current = item; });
  // the editor still open: a save the connection dropped is tried again only while it is
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /** `save`: about a save, cleared when one goes through */
  const [note, setNote] = useState<{ text: string; error: boolean; save?: boolean } | null>(null);
  // opening is under way from the first paint, so "not prepared" never flashes before it
  const [busy, setBusy] = useState<"open" | "render" | "original" | null>(locked || gone ? null : "open");
  const [saveState, setSaveState] = useState<"idle" | "waiting" | "saving" | "saved" | "retrying">("idle");
  const [theme, setTheme] = useState<Theme>("navy");

  // the agent's edit on screen. A new edit from the server (the preview made, a reload after a
  // refusal) replaces it; the answer to the agent's own save does not, so typing is never undone
  const [draft, setDraft] = useState<Draft | null>(() => (edit && ready ? draftOf(edit) : null));
  const [seenRev, setSeenRev] = useState(ready ? edit?.rev : undefined);
  const own = useRef(new Set<string>());
  if (ready && edit && edit.rev !== seenRev) {
    setSeenRev(edit.rev);
    if (!own.current.has(edit.rev) || !draft) setDraft(draftOf(edit));
  }

  // the player shows the edit live, or the take the render made — a new take as it arrives
  const [view, setView] = useState<"live" | "take">("live");
  const [seenTake, setSeenTake] = useState(edit?.renderedPath);
  if (edit?.renderedPath !== seenTake) {
    setSeenTake(edit?.renderedPath);
    setView(edit?.renderedPath ? "take" : "live");
  }
  const player = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);

  async function open() {
    setBusy("open");
    setNote(null);
    const r = await openEdit(item.id).catch(() => null);
    setBusy(null);
    if (!r) { setNote({ text: LOST, error: true }); return; }
    if (!r.ok) { setNote({ text: r.error, error: true }); return; }
    toItem.current(r.item);
  }

  // openEdit once, as the editor opens: never again for the wait (each one may cost a prepare)
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || locked || gone) return;
    opened.current = true;
    void open();
    // once per editor; a later item is the same piece
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gone) return;
    let alive = true;
    editTheme(item.id).then((t) => { if (alive) setTheme(t); }).catch(() => undefined);
    return () => { alive = false; };
  }, [item.id, gone]);

  // while a job runs, ask after it every 3 s — one ask at a time, stopped when the editor closes,
  // and after a few failures in a row (ลองใหม่ starts it again: a poll, never another open)
  const [pollStalled, setPollStalled] = useState(false);
  const polling = job !== null && !gone && !pollStalled;
  useEffect(() => {
    if (!polling) return;
    let stop = false;
    let failed = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await pollEdit(item.id).catch(() => null);
      if (stop) return;
      if (r?.ok) {
        failed = 0;
        toItem.current(r.item);
      } else if (++failed >= POLL_GIVE_UP) {
        setNote({ text: r ? r.error : "ถามสถานะงานตัดต่อไม่ได้ — การเชื่อมต่อหลุด", error: true });
        setPollStalled(true);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { stop = true; clearTimeout(timer); };
  }, [polling, item.id]);

  /** the edit as the server has it, on screen: from a fresh read, or the last one when that fails too */
  async function reload() {
    const r = await pollEdit(item.id).catch(() => null);
    const fresh = r?.ok ? r.item : current.current;
    const e = fresh.output.video?.edit;
    if (e?.proxyPath && e.silences) { setDraft(draftOf(e)); setSeenRev(e.rev); }
    if (r?.ok) toItem.current(r.item);
  }

  // saves go one after another; what changes while one is on its way goes in the next
  const pending = useRef<EditPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  /** saves the connection dropped in a row, for the wait before the next try */
  const dropped = useRef(0);

  function flush(): Promise<boolean> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    queue.current = queue.current.then(async () => {
      const patch = pending.current;
      if (Object.keys(patch).length === 0) return true;
      pending.current = {};
      setSaveState("saving");
      const r = await saveEdit(item.id, patch).catch(() => null);
      if (r?.ok) {
        dropped.current = 0;
        const rev = r.item.output.video?.edit?.rev;
        if (rev) own.current.add(rev);
        toItem.current(r.item);
        setNote((n) => (n?.save ? null : n));
        setSaveState(Object.keys(pending.current).length > 0 ? "waiting" : "saved");
        return true;
      }
      if (!r) {
        // the connection dropped: the change goes back in, under what was typed since, and is tried again
        pending.current = mergeBack(patch, pending.current);
        dropped.current += 1;
        setSaveState("retrying");
        setNote({ text: "บันทึกการตัดต่อไม่ได้ — การเชื่อมต่อหลุด กำลังลองใหม่…", error: true, save: true });
        if (alive.current && !timer.current) timer.current = setTimeout(() => void flush(), retryDelay(dropped.current));
        return false;
      }
      // refused: say why, and show the edit as the server has it; what was typed since is let go too
      dropped.current = 0;
      pending.current = {};
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setSaveState("idle");
      setNote({ text: `การแก้ล่าสุดยังไม่ได้บันทึก — ${r.error}`, error: true, save: true });
      await reload();
      return false;
    });
    return queue.current;
  }

  // closing with a change not yet sent sends it anyway — after any save on its way, so an older one never lands last
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    void queue.current.then(async () => {
      const patch = pending.current;
      if (Object.keys(patch).length === 0) return;
      pending.current = {};
      const r = await saveEdit(item.id, patch).catch(() => null);
      if (r?.ok) toItem.current(r.item);
    });
  }, [item.id]);

  function change(patch: EditPatch) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    pending.current = { ...pending.current, ...patch };
    setView("live");
    setSaveState("waiting");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_MS);
  }

  async function leave() {
    await flush();
    onClose();
  }

  async function render() {
    // the inputs are shut from the press, so nothing typed lands between the save and the render
    setBusy("render");
    if (!(await flush())) { setBusy(null); return; }
    setNote(null);
    const r = await renderEdit(item.id).catch(() => null);
    setBusy(null);
    if (!r) { setNote({ text: LOST, error: true }); await reload(); return; }
    if (!r.ok) { setNote({ text: r.error, error: true }); return; }
    toItem.current(r.item);
  }

  async function original() {
    if (!(await ask("กลับไปใช้คลิปต้นฉบับ? คลิปที่ตัดต่อไว้จะถูกลบ ส่วนการตัดต่อในหน้านี้ยังอยู่ สร้างใหม่ได้", "ใช้คลิปต้นฉบับ"))) return;
    setBusy("original");
    if (!(await flush())) { setBusy(null); return; }
    setNote(null);
    const r = await backToOriginal(item.id).catch(() => null);
    setBusy(null);
    if (!r) { setNote({ text: LOST, error: true }); return; }
    if (!r.ok) { setNote({ text: r.error, error: true }); return; }
    setNote({ text: "กลับไปใช้คลิปต้นฉบับแล้ว — Reel จะลงเป็นคลิปที่ถ่ายมา", error: false });
    toItem.current(r.item);
  }

  const look = useMemo(() => (draft ? styleLook(draft.style, theme) : null), [draft, theme]);
  const keep = useMemo(() => (v && draft && edit?.silences ? keepOf(v, { ...draft, silences: edit.silences }) : []), [v, draft, edit?.silences]);
  const live: LiveEdit | null = useMemo(
    () => (draft && look ? { keep, subs: subsShown(draft, keep), hook: draft.hook, look } : null),
    [draft, look, keep],
  );
  const kept = keptDuration(keep);
  const tooLongNow = kept > MAX_EDITED_SECONDS;
  const tooShort = kept < CLIP_MIN_SEC;
  const showTake = view === "take" && Boolean(edit?.renderedPath);
  const stale = Boolean(edit?.renderedPath) && edit?.renderedRev !== edit?.rev;
  const readOnly = locked || job !== null || busy !== null;
  const cut = new Set(draft?.cut ?? []);

  /** to a moment of the clip as filmed: the live preview plays it (cut parts skip on) */
  function seek(at: number) {
    if (showTake) { pendingSeek.current = at; setView("live"); return; }
    const p = player.current;
    if (!p) return;
    p.currentTime = at;
    void p.play().catch(() => undefined);
  }
  useEffect(() => {
    const p = player.current;
    if (view !== "live" || !p || pendingSeek.current === null) return;
    const go = () => {
      if (pendingSeek.current === null) return;
      p.currentTime = pendingSeek.current;
      pendingSeek.current = null;
      void p.play().catch(() => undefined);
    };
    if (p.readyState >= 1) go(); else p.addEventListener("loadedmetadata", go, { once: true });
    return () => p.removeEventListener("loadedmetadata", go);
  }, [view]);

  // the one ลองใหม่ on screen: a stalled poll asks again; a failed render renders again; a preview never made is asked for once more
  const jobFailed = Boolean(edit?.error) && !job && !locked;
  const notPrepared = !ready && !job && !locked && busy !== "open";
  const retry: (() => void) | null = pollStalled ? () => { setNote(null); setPollStalled(false); }
    : jobFailed && ready ? (tooLongNow || tooShort ? null : () => void render())
      : notPrepared ? () => void open()
        : null;

  const button = "min-h-tap rounded-lg border border-[var(--ct-line)] px-4 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
  const field = "min-h-tap w-full min-w-0 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)] read-only:bg-[var(--ct-ground)]";
  const chip = (on: boolean) => `inline-flex min-h-tap items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50 ${on ? "border-[var(--ct-accent)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] hover:bg-[var(--ct-soft)]"}`;
  const segments = v?.transcript ?? [];
  const suggestion = v?.hookSuggestion?.main?.trim() ? v.hookSuggestion : null;
  const loose = (draft?.subs ?? []).map((s, j) => ({ s, j })).filter(({ s }) => s.seg === undefined || !segments[s.seg]);

  function subInput(s: Draft["subs"][number], j: number, dim: boolean) {
    return (
      <li key={j} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
        <button type="button" onClick={() => seek(s.start)} className="min-h-tap text-left text-xs tabular-nums text-[var(--ct-accent)] underline-offset-2 hover:underline">{clockOf(s.start)}</button>
        <input
          value={s.text} readOnly={readOnly} maxLength={120} aria-label={`ซับเวลา ${clockOf(s.start)}`}
          onChange={(e) => draft && change({ subs: draft.subs.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)) })}
          className={`${field} ${dim ? "text-[var(--ct-mute)] line-through" : ""}`}
        />
      </li>
    );
  }

  return (
    <section className="@container space-y-4 rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4 pt-14 lg:pt-4">
      <div>
        <button type="button" onClick={() => void leave()} className="-ml-1 inline-flex min-h-tap items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
          <BackIcon className="size-4" />
          กลับไปหน้าคลิป
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">ตัดต่อคลิป</h2>
          {edit?.renderedPath && <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">คลิปที่ตัดต่อแล้ว</span>}
          {edit?.renderedPath && stale && <span className="rounded-full bg-[var(--ct-warn-bg)] px-2.5 py-0.5 text-xs text-[var(--ct-warn-ink)]">ยังไม่ได้สร้างใหม่</span>}
          {!readOnly && saveState !== "idle" && (
            <span role="status" className={`ml-auto text-xs ${saveState === "retrying" ? "text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>
              {saveState === "saved" ? "บันทึกแล้ว" : saveState === "retrying" ? "ยังไม่ได้บันทึก — กำลังลองใหม่" : "กำลังบันทึก…"}
            </span>
          )}
        </div>
      </div>

      {gone ? (
        <p className="text-sm text-[var(--ct-mute)]">
          {locked ? "ไฟล์ต้นฉบับถูกลบจากระบบแล้ว — Reel ยังอยู่บนเพจ" : "ไฟล์คลิปหมดอายุแล้ว — ตัดต่อไม่ได้ แนบคลิปใหม่ที่การ์ด"}
        </p>
      ) : (
        <>
          {locked && <p className="rounded-lg bg-[var(--ct-ground)] p-3 text-sm text-[var(--ct-mute)]">Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ดูได้อย่างเดียว ยกเลิกคิวก่อนถ้าจะตัดต่อ</p>}
          {job && (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
              <span className="size-2.5 shrink-0 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
              {job === "prepare" ? "กำลังเตรียมคลิป…" : "กำลังสร้างคลิป… ปิดหน้านี้ได้ งานจะทำต่อ"}
            </p>
          )}
          {busy === "open" && !job && <p role="status" className="text-sm text-[var(--ct-mute)]">กำลังเปิดหน้าตัดต่อ…</p>}
          {/* what went wrong, in the server's own words where it has them, and one ลองใหม่ */}
          {(jobFailed || note || (notPrepared && !locked) || retry) && (
            <div
              className={`flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm ${jobFailed || note?.error ? "border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                {jobFailed && <p role="alert">{edit!.error}</p>}
                {note && <p role={note.error ? "alert" : "status"}>{note.text}</p>}
                {notPrepared && !jobFailed && !note && <p>ยังไม่ได้เตรียมคลิปสำหรับตัดต่อ</p>}
              </div>
              {retry && <button type="button" onClick={retry} disabled={busy !== null} className={button}>ลองใหม่</button>}
            </div>
          )}
          {locked && !ready && !job && <p className="text-sm text-[var(--ct-mute)]">ยังไม่ได้เตรียมคลิปสำหรับตัดต่อ</p>}

          {!ready || !draft || !v ? null : (
            <div className="grid items-start gap-4 @xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @3xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
              <div className="mx-auto w-full max-w-[17rem] space-y-2 @xl:sticky @xl:top-4 @xl:max-w-none">
                <EditPreview
                  player={player}
                  // GETs that redirect to signed links; the path is there so a new file is a new address
                  src={showTake
                    ? `/api/content-video/${item.id}?take=edited&v=${encodeURIComponent(edit!.renderedPath!)}`
                    : `/api/content-video/${item.id}/proxy?v=${encodeURIComponent(edit!.proxyPath!)}`}
                  live={showTake ? null : live}
                />
                {edit?.renderedPath && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" aria-pressed={!showTake} onClick={() => setView("live")} className={`${chip(!showTake)} justify-center`}>ตัวอย่าง</button>
                    <button type="button" aria-pressed={showTake} onClick={() => setView("take")} className={`${chip(showTake)} justify-center`}>คลิปที่สร้างแล้ว</button>
                  </div>
                )}
                <p className="text-sm tabular-nums">
                  เหลือ <b>{clockOf(Math.ceil(kept))}</b> จาก {clockOf(v.durationSec)}
                </p>
                {tooLongNow && (
                  <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-2.5 text-sm text-[var(--ct-alert)]">{tooLong(kept)}</p>
                )}
                {tooShort && <p role="alert" className="text-sm text-[var(--ct-alert)]">คลิปที่เหลือสั้นเกินไป — Reel ต้องยาวอย่างน้อย {CLIP_MIN_SEC} วินาที</p>}
                {showTake && <p className="text-xs text-[var(--ct-mute)]">นี่คือคลิปที่จะลงเพจ{stale ? " — แต่การตัดต่อเปลี่ยนไปแล้ว กดสร้างคลิปอีกครั้งเพื่อให้ตรง" : ""}</p>}
              </div>

              <div className="min-w-0 space-y-5">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">แบบตัวหนังสือ</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {CLIP_STYLES.map((s) => {
                      const sample = styleLook(s, theme);
                      return (
                        <button key={s} type="button" aria-pressed={draft.style === s} disabled={readOnly} onClick={() => change({ style: s })} className={chip(draft.style === s)}>
                          <span className="rounded bg-black px-1.5 py-0.5">
                            <span
                              className="rounded px-1 text-xs font-semibold"
                              style={{ background: sample.box?.background ?? "transparent", color: sample.box ? sample.box.color : sample.color }}
                            >กข</span>
                          </span>
                          <span className="min-w-0 truncate">{STYLE_LABEL[s]}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="mb-1.5 text-sm font-medium">Hook ช่วงต้นคลิป <span className="font-normal text-[var(--ct-mute)]">(ขึ้น 2.6 วินาทีแรก)</span></legend>
                  <label className="block">
                    <span className="mb-1 flex justify-between text-xs text-[var(--ct-mute)]"><span>บรรทัดเล็กด้านบน (ไม่บังคับ)</span><span className="tabular-nums">{len(draft.hook.top ?? "")}/{MAX_HOOK_TOP}</span></span>
                    <input
                      value={draft.hook.top ?? ""} readOnly={readOnly} maxLength={MAX_HOOK_TOP}
                      onChange={(e) => change({ hook: { ...draft.hook, top: e.target.value } })} className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex justify-between text-xs text-[var(--ct-mute)]"><span>ข้อความหลัก</span><span className="tabular-nums">{len(draft.hook.main)}/{MAX_HOOK_MAIN}</span></span>
                    <input
                      value={draft.hook.main} readOnly={readOnly} maxLength={MAX_HOOK_MAIN} placeholder="เว้นว่างได้ ถ้าไม่ใส่ hook"
                      onChange={(e) => change({ hook: { ...draft.hook, main: e.target.value } })} className={field}
                    />
                  </label>
                  {suggestion && !readOnly && suggestion.main !== draft.hook.main && (
                    <button type="button" onClick={() => change({ hook: { ...suggestion } })} className="min-h-tap text-left text-sm text-[var(--ct-accent)] underline decoration-dotted underline-offset-2">
                      ใช้ที่ระบบแนะนำ: {suggestion.top ? `${suggestion.top} · ` : ""}{suggestion.main}
                    </button>
                  )}
                </fieldset>

                <label className="flex min-h-tap items-center gap-3 text-sm">
                  <input
                    type="checkbox" checked={draft.trimSilence} disabled={readOnly}
                    onChange={(e) => change({ trimSilence: e.target.checked })} className="size-5 shrink-0 accent-[var(--ct-accent)]"
                  />
                  ตัดช่วงเงียบออก
                </label>

                <div>
                  <p className="text-sm font-medium">ประโยคในคลิป</p>
                  <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เอาเครื่องหมายออกเพื่อตัดประโยคนั้นทิ้ง · แก้ซับได้ในช่องใต้ประโยค · กดเวลาเพื่อดูตรงนั้น</p>
                  <ol className="mt-2 divide-y divide-[var(--ct-hair)] rounded-lg border border-[var(--ct-hair)]">
                    {segments.map((s, i) => {
                      const isCut = cut.has(i);
                      const lines = draft.subs.map((x, j) => ({ x, j })).filter(({ x }) => x.seg === i);
                      return (
                        <li key={i} className="space-y-1 p-2.5">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                            <label className="flex min-h-tap min-w-0 items-start gap-3 py-1 text-sm">
                              <input
                                type="checkbox" checked={!isCut} disabled={readOnly}
                                onChange={(e) => change({ cut: e.target.checked ? draft.cut.filter((n) => n !== i) : [...draft.cut, i].sort((a, b) => a - b) })}
                                className="mt-0.5 size-5 shrink-0 accent-[var(--ct-accent)]"
                              />
                              <span className={`min-w-0 break-words ${isCut ? "text-[var(--ct-mute)] line-through" : ""}`}>{s.text}</span>
                            </label>
                            <button type="button" onClick={() => seek(s.start)} className="min-h-tap px-1 text-xs tabular-nums text-[var(--ct-accent)] underline-offset-2 hover:underline">{clockOf(s.start)}</button>
                          </div>
                          {s.cut && s.why && <p className="pl-8 text-xs text-[var(--ct-warn-ink)]">ระบบแนะนำให้ตัด: {s.why}</p>}
                          {lines.length > 0 && <ul className="space-y-1 pl-8">{lines.map(({ x, j }) => subInput(x, j, isCut))}</ul>}
                        </li>
                      );
                    })}
                  </ol>
                  {loose.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--ct-mute)]">ซับอื่น</p>
                      <ul className="mt-1 space-y-1">{loose.map(({ s, j }) => subInput(s, j, false))}</ul>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">ลบข้อความในช่องให้ว่าง = เอาซับบรรทัดนั้นออก</p>
                </div>
              </div>
            </div>
          )}

          {ready && !locked && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--ct-hair)] pt-4">
              <button
                type="button" onClick={() => void render()} disabled={readOnly || tooLongNow || tooShort}
                className="min-h-tap rounded-lg bg-[var(--ct-solid)] px-5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
              >
                {busy === "render" ? "กำลังเริ่มสร้างคลิป…" : edit?.renderedPath ? "สร้างคลิปใหม่" : "สร้างคลิป"}
              </button>
              {edit?.renderedPath && (
                <button type="button" onClick={() => void original()} disabled={readOnly} className={button}>
                  {busy === "original" ? "กำลังเปลี่ยน…" : "กลับไปใช้คลิปต้นฉบับ"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
