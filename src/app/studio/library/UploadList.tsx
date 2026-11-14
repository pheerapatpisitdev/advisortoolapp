"use client";
import Link from "next/link";
import { useReducer, useRef, useState } from "react";
import type { LibraryTool } from "@/lib/scene-library/catalog";
import { ALREADY_DECIDED as ALREADY, claimRow, NO_ROW, NOT_FOUND, rowReducer, uploadHref, type RowAction, type RowState } from "@/lib/scene-library/upload-flow";
import { KIND_NAME, REASONS, SHOTS_MAX, stateWord, type UploadView } from "@/lib/scene-library/upload-rules";

/**
 * The upload tabs' rows (spec 2026-11-14-library-uploads-design.md, "The page"): ของฉัน's ไฟล์ที่ฉันส่ง with
 * its inline ลบ question, the owner's คิวตรวจ with the reasons panel (for ไม่ผ่าน, and for ถอนออกจากคลัง in its
 * third list ในคลังแล้ว, spec 2026-11-14-library-withdraw-design.md), and the card a shared file is in เลือกดู.
 * UploadList is a plain function of its props (the state lives in MyFiles / ReviewQueue) so a press is tested
 * by calling it; "ลบไฟล์นี้?" is asked in the row, never with confirm().
 */

const NONE: ReadonlySet<string> = new Set();
type Done = { ok: true } | { ok: false; error: string };
type Verdict = "ok" | "no" | "queue" | "closed";
const FAILED = "ทำไม่สำเร็จ ลองใหม่อีกครั้ง";

const pic = (id: string, n: number) => `/api/library-upload?id=${id}&n=${n}`;
const btn = "inline-flex min-h-tap items-center justify-center rounded-lg border px-3 text-sm disabled:opacity-60";
const quiet = `${btn} border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]`;
const solid = `${btn} border-transparent bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]`;
const warn = `${btn} border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]`;

function Thumb({ id, n, className }: { id: string; n: number; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a member's own picture, served by the route that checks who may see it
    <img src={pic(id, n)} alt="" loading="lazy" decoding="async" className={`${className} rounded-lg bg-[var(--ct-ground)] object-contain`} />
  );
}

/**
 * The four reasons, then the confirm and ยกเลิก: ไม่ผ่าน's in the queue, ถอนออกจากคลัง's in ในคลังแล้ว. A plain
 * function, not a component, so the row's tree holds its buttons (and a press is tested by calling it).
 */
function reasonsPanel(o: {
  ui: RowState; dispatch: (a: RowAction) => void; held: boolean; label: string; line?: string; confirm: string; onConfirm: (reason: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {o.line && <p className="text-xs text-[var(--ct-mute)]">{o.line}</p>}
      <div role="group" aria-label={o.label} className="flex flex-wrap gap-2">
        {REASONS.map((reason) => (
          <button
            key={reason} type="button" aria-pressed={o.ui.reason === reason} onClick={() => o.dispatch({ type: "pick", reason })}
            className={`${btn} ${o.ui.reason === reason ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)]"}`}
          >{reason}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={o.ui.reason === null || o.held} onClick={() => o.ui.reason && o.onConfirm(o.ui.reason)} className={warn}>{o.confirm}</button>
        <button type="button" disabled={o.held} onClick={() => o.dispatch({ type: "cancel" })} className={quiet}>ยกเลิก</button>
      </div>
    </div>
  );
}

interface ListProps {
  /** mine: ไฟล์ที่ฉันส่ง; queue: the owner's waiting rows; library: the owner's ในคลังแล้ว */
  mode: "mine" | "queue" | "library";
  rows: readonly UploadView[];
  ui: RowState;
  dispatch: (a: RowAction) => void;
  /** the rows whose call is on its way */
  busy?: ReadonlySet<string>;
  errors?: Record<string, string>;
  /** rows someone else decided first: their message only, no buttons */
  settled?: ReadonlySet<string>;
  onRemove?: (id: string) => void;
  onDecide?: (id: string, verdict: Verdict, reason?: string) => void;
  onWithdraw?: (id: string, reason: string) => void;
}

export function UploadList({ mode, rows, ui, dispatch, busy = NONE, errors = {}, settled, onRemove, onDecide, onWithdraw }: ListProps) {
  const row = (r: UploadView) => {
    const held = busy.has(r.id);
    const stale = settled?.has(r.id) ?? false;
    const shots = Math.min(r.files, SHOTS_MAX);
    return (
      <li key={r.id} className="grid gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
        <div className="flex gap-3">
          {shots > 0 && (
            <div className="flex shrink-0 gap-1">
              {Array.from({ length: shots }, (_, n) => <Thumb key={n} id={r.id} n={n} className="aspect-[4/3] w-16" />)}
            </div>
          )}
          <div className="grid min-w-0 flex-1 content-start gap-0.5">
            <p className="break-words text-sm font-semibold">{r.name}</p>
            <p className="text-xs text-[var(--ct-mute)]">{KIND_NAME[r.kind]}{mode !== "mine" ? ` · จาก ${r.by ?? "สมาชิก"}` : ""}</p>
            {r.note && <p className="break-words text-xs text-[var(--ct-mute)]">{r.note}</p>}
            {mode !== "queue" && (
              <p className="text-xs">
                <span className="rounded-full bg-[var(--ct-soft)] px-2 text-[var(--ct-accent)]">{stateWord(r.kind, r.state)}</span>
                {mode === "mine" && (r.state === "no" || r.state === "gone") && r.reason && <span className="ml-2 text-[var(--ct-alert)]">{r.reason}</span>}
              </p>
            )}
          </div>
        </div>

        {mode === "mine" && (ui.removing === r.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">ลบไฟล์นี้?</span>
            <button type="button" disabled={held} onClick={() => onRemove?.(r.id)} className={warn}>ยืนยัน</button>
            <button type="button" disabled={held} onClick={() => dispatch({ type: "cancel" })} className={quiet}>ยกเลิก</button>
          </div>
        ) : (
          <div>
            <button type="button" disabled={held} onClick={() => dispatch({ type: "ask-remove", id: r.id })} className={quiet}>ลบ</button>
          </div>
        ))}

        {mode === "queue" && !stale && (r.kind === "ask" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={held} onClick={() => onDecide?.(r.id, "queue")} className={solid}>รับเข้าคิวทำ</button>
            <button type="button" disabled={held} onClick={() => onDecide?.(r.id, "closed")} className={quiet}>ปิดคำขอ</button>
          </div>
        ) : ui.refusing === r.id ? (
          reasonsPanel({ ui, dispatch, held, label: "เหตุผลที่ไม่ผ่าน", confirm: "ยืนยันไม่ผ่าน", onConfirm: (reason) => onDecide?.(r.id, "no", reason) })
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={held} onClick={() => onDecide?.(r.id, "ok")} className={solid}>อนุมัติ</button>
            <button type="button" disabled={held} onClick={() => dispatch({ type: "ask-no", id: r.id })} className={quiet}>ไม่ผ่าน</button>
          </div>
        ))}

        {mode === "library" && !stale && (ui.refusing === r.id ? (
          reasonsPanel({
            ui, dispatch, held, label: "เหตุผลที่ถอนออก", line: "เลือกเหตุผลที่คนส่งจะเห็น", confirm: "ยืนยันถอนออก",
            onConfirm: (reason) => onWithdraw?.(r.id, reason),
          })
        ) : (
          <div>
            <button type="button" disabled={held} onClick={() => dispatch({ type: "ask-no", id: r.id })} className={quiet}>ถอนออกจากคลัง</button>
          </div>
        ))}

        {errors[r.id] && <p role="alert" className="text-xs text-[var(--ct-alert)]">{errors[r.id]}</p>}
      </li>
    );
  };
  return <ul className="grid gap-2">{rows.map(row)}</ul>;
}

const empty = (t: string) => <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-4 text-center text-sm text-[var(--ct-mute)]">{t}</p>;

/** ของฉัน: ไฟล์ที่ฉันส่ง. The row's own ลบ question; a refusal shows under the row. */
export function MyFiles({ rows, onRemove }: { rows: readonly UploadView[]; onRemove: (id: string) => Promise<Done> }) {
  const [ui, dispatch] = useReducer(rowReducer, NO_ROW);
  const [busy, setBusy] = useState<ReadonlySet<string>>(NONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  // the calls on their way, checked and taken in the press itself (busy is for drawing the buttons)
  const flying = useRef<Set<string>>(new Set());
  async function remove(id: string) {
    if (!claimRow(flying.current, id)) return;
    mark(id, true);
    setErrors((e) => { const rest = { ...e }; delete rest[id]; return rest; });
    const done = await onRemove(id).catch((): Done => ({ ok: false, error: FAILED }));
    flying.current.delete(id);
    mark(id, false);
    if (done.ok) dispatch({ type: "done", id });
    else setErrors((e) => ({ ...e, [id]: done.error }));
  }
  return (
    <section aria-label="ไฟล์ที่ฉันส่ง" className="grid gap-2">
      <h2 className="text-base font-semibold">ไฟล์ที่ฉันส่ง ({rows.length})</h2>
      {rows.length ? <UploadList mode="mine" rows={rows} ui={ui} dispatch={dispatch} busy={busy} errors={errors} onRemove={remove} /> : empty("ยังไม่ได้ส่งไฟล์ ไปที่แท็บอัปโหลดได้เลย")}
    </section>
  );
}

/**
 * คิวตรวจ: the owner's three lists, ไฟล์รออนุมัติ, คำขอชิ้นใหม่ and ในคลังแล้ว (the shared rows, to withdraw). A verdict
 * or a withdraw is the board's to apply; a row someone got to first keeps its message here until the page is read
 * again (the board has already dropped it from its list). One reasons panel and one claim set serve all three.
 */
export function ReviewQueue({ rows, shared, onDecide, onWithdraw }: {
  rows: readonly UploadView[];
  shared: readonly UploadView[];
  onDecide: (id: string, verdict: Verdict, reason?: string) => Promise<Done>;
  onWithdraw: (id: string, reason: string) => Promise<Done>;
}) {
  const [ui, dispatch] = useReducer(rowReducer, NO_ROW);
  const [busy, setBusy] = useState<ReadonlySet<string>>(NONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  const [stale, setStale] = useState<UploadView[]>([]);
  // the calls on their way, checked and taken in the press itself (busy is for drawing the buttons)
  const flying = useRef<Set<string>>(new Set());
  /** one row's call: claimed once, its buttons held, and a row someone got to first (`first` errors) kept with its message */
  async function run(id: string, from: readonly UploadView[], call: () => Promise<Done>, first: readonly string[]) {
    if (!claimRow(flying.current, id)) return;
    const row = from.find((r) => r.id === id);
    mark(id, true);
    setErrors((e) => { const rest = { ...e }; delete rest[id]; return rest; });
    const done = await call().catch((): Done => ({ ok: false, error: FAILED }));
    flying.current.delete(id);
    mark(id, false);
    if (done.ok) { dispatch({ type: "done", id }); return; }
    setErrors((e) => ({ ...e, [id]: done.error }));
    if (first.includes(done.error) && row) { setStale((s) => (s.some((x) => x.id === id) ? s : [...s, row])); dispatch({ type: "done", id }); }
  }
  const decide = (id: string, verdict: Verdict, reason?: string) => run(id, rows, () => onDecide(id, verdict, reason), [ALREADY]);
  const withdraw = (id: string, reason: string) => run(id, shared, () => onWithdraw(id, reason), [ALREADY, NOT_FOUND]);
  // a stale row keeps the state it was drawn with: wait in the queue, ok in ในคลังแล้ว
  const along = (list: readonly UploadView[], ok: boolean) => [...list, ...stale.filter((s) => (s.state === "ok") === ok && !list.some((r) => r.id === s.id))];
  const shown = along(rows, false);
  const inLibrary = along(shared, true);
  const settled = new Set(stale.map((s) => s.id));
  const files = shown.filter((r) => r.kind !== "ask");
  const asks = shown.filter((r) => r.kind === "ask");
  const live = (list: UploadView[]) => list.filter((r) => !settled.has(r.id)).length;
  const props = { ui, dispatch, busy, errors, settled, onDecide: decide, onWithdraw: withdraw };
  return (
    <div className="grid gap-5">
      <section aria-label="ไฟล์รออนุมัติ" className="grid gap-2">
        <h2 className="text-base font-semibold">ไฟล์รออนุมัติ ({live(files)})</h2>
        {files.length ? <UploadList mode="queue" rows={files} {...props} /> : empty("ไม่มีไฟล์รออนุมัติ")}
      </section>
      <section aria-label="คำขอชิ้นใหม่" className="grid gap-2">
        <h2 className="text-base font-semibold">คำขอชิ้นใหม่ ({live(asks)})</h2>
        {asks.length ? <UploadList mode="queue" rows={asks} {...props} /> : empty("ไม่มีคำขอใหม่")}
      </section>
      <section aria-label="ในคลังแล้ว" className="grid gap-2">
        <div className="grid gap-0.5">
          <h2 className="text-base font-semibold">ในคลังแล้ว ({live(inLibrary)})</h2>
          <p className="text-xs text-[var(--ct-mute)]">ไฟล์ที่ทุกคนเห็นในแท็บเลือกดู ถอนออกได้ทุกเมื่อ</p>
        </div>
        {inLibrary.length ? <UploadList mode="library" rows={inLibrary} {...props} /> : empty("ยังไม่มีไฟล์ในคลัง")}
      </section>
    </div>
  );
}

/** a shared part or style in เลือกดู, after the catalogue's cards */
export function UploadCard({ view, open }: { view: UploadView; open: Record<LibraryTool, boolean> }) {
  const tag = "rounded-full px-2 text-xs leading-5";
  return (
    <article className="grid content-start gap-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-2">
      <Thumb id={view.id} n={0} className="block aspect-[4/3] w-full" />
      <h3 className="break-words text-sm font-semibold leading-snug">{view.name}</h3>
      <div className="flex flex-wrap gap-1">
        <span className={`${tag} border border-[var(--ct-hair)] text-[var(--ct-mute)]`}>{KIND_NAME[view.kind]}</span>
        <span className={`${tag} bg-[var(--ct-soft)] text-[var(--ct-accent)]`}>จากสมาชิก</span>
      </div>
      {open["prompt-story"]
        ? <Link href={uploadHref(view)} className={`${solid} w-full`}>ใช้แบบนี้</Link>
        : <span className="text-xs text-[var(--ct-mute)]">ยังไม่เปิดให้ใช้</span>}
    </article>
  );
}
