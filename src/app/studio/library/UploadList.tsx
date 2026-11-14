"use client";
import Link from "next/link";
import { useReducer, useRef, useState } from "react";
import type { LibraryTool } from "@/lib/scene-library/catalog";
import { claimRow, NO_ROW, rowReducer, uploadHref, type RowAction, type RowState } from "@/lib/scene-library/upload-flow";
import { KIND_NAME, SHOTS_MAX, stateWord, type UploadView } from "@/lib/scene-library/upload-rules";

/**
 * The owner's files (spec 2026-11-14-library-owner-only-design.md, "ของฉัน"): ไฟล์ของฉัน with ถอนออกจากคลัง on a
 * file in the library, นำกลับเข้าคลัง on one taken out, and ลบ with its inline question on every file; and the card
 * a shared file is in เลือกดู. UploadList is a plain function of its props (the state lives in MyFiles) so a
 * press is tested by calling it; "ลบไฟล์นี้?" is asked in the row, never with confirm().
 */

const NONE: ReadonlySet<string> = new Set();
type Done = { ok: true } | { ok: false; error: string };
const FAILED = "ทำไม่สำเร็จ ลองใหม่อีกครั้ง";

const pic = (id: string, n: number) => `/api/library-upload?id=${id}&n=${n}`;
const btn = "inline-flex min-h-tap items-center justify-center rounded-lg border px-3 text-sm disabled:opacity-60";
const quiet = `${btn} border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]`;
const solid = `${btn} border-transparent bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]`;
const warn = `${btn} border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]`;

function Thumb({ id, n, className }: { id: string; n: number; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the owner's own picture, served by the route that checks who may see it
    <img src={pic(id, n)} alt="" loading="lazy" decoding="async" className={`${className} rounded-lg bg-[var(--ct-ground)] object-contain`} />
  );
}

interface ListProps {
  rows: readonly UploadView[];
  ui: RowState;
  dispatch: (a: RowAction) => void;
  /** the rows whose call is on its way: every button of the row waits */
  busy?: ReadonlySet<string>;
  errors?: Record<string, string>;
  onRemove?: (id: string) => void;
  onHide?: (id: string) => void;
  onShow?: (id: string) => void;
}

export function UploadList({ rows, ui, dispatch, busy = NONE, errors = {}, onRemove, onHide, onShow }: ListProps) {
  const row = (r: UploadView) => {
    const held = busy.has(r.id);
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
            <p className="text-xs text-[var(--ct-mute)]">{KIND_NAME[r.kind]}</p>
            {r.note && <p className="break-words text-xs text-[var(--ct-mute)]">{r.note}</p>}
            <p className="text-xs">
              <span className="rounded-full bg-[var(--ct-soft)] px-2 text-[var(--ct-accent)]">{stateWord(r.kind, r.state)}</span>
              {(r.state === "no" || r.state === "gone") && r.reason && <span className="ml-2 text-[var(--ct-alert)]">{r.reason}</span>}
            </p>
          </div>
        </div>

        {ui.removing === r.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">ลบไฟล์นี้?</span>
            <button type="button" disabled={held} onClick={() => onRemove?.(r.id)} className={warn}>ยืนยัน</button>
            <button type="button" disabled={held} onClick={() => dispatch({ type: "cancel" })} className={quiet}>ยกเลิก</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {r.state === "ok" && <button type="button" disabled={held} onClick={() => onHide?.(r.id)} className={quiet}>ถอนออกจากคลัง</button>}
            {r.state === "gone" && <button type="button" disabled={held} onClick={() => onShow?.(r.id)} className={solid}>นำกลับเข้าคลัง</button>}
            <button type="button" disabled={held} onClick={() => dispatch({ type: "ask-remove", id: r.id })} className={quiet}>ลบ</button>
          </div>
        )}

        {errors[r.id] && <p role="alert" className="text-xs text-[var(--ct-alert)]">{errors[r.id]}</p>}
      </li>
    );
  };
  return <ul className="grid gap-2">{rows.map(row)}</ul>;
}

/**
 * ของฉัน: ไฟล์ของฉัน. Each row's call (ลบ, ถอนออกจากคลัง, นำกลับเข้าคลัง) is claimed once, its buttons held while it is
 * on its way; the board applies a done call to its lists, and a refusal shows under the row.
 */
export function MyFiles({ rows, onRemove, onHide, onShow }: {
  rows: readonly UploadView[];
  onRemove: (id: string) => Promise<Done>;
  onHide: (id: string) => Promise<Done>;
  onShow: (id: string) => Promise<Done>;
}) {
  const [ui, dispatch] = useReducer(rowReducer, NO_ROW);
  const [busy, setBusy] = useState<ReadonlySet<string>>(NONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  // the calls on their way, checked and taken in the press itself (busy is for drawing the buttons)
  const flying = useRef<Set<string>>(new Set());
  async function run(id: string, call: (id: string) => Promise<Done>) {
    if (!claimRow(flying.current, id)) return;
    mark(id, true);
    setErrors((e) => { const rest = { ...e }; delete rest[id]; return rest; });
    const done = await call(id).catch((): Done => ({ ok: false, error: FAILED }));
    flying.current.delete(id);
    mark(id, false);
    if (done.ok) dispatch({ type: "done", id });
    else setErrors((e) => ({ ...e, [id]: done.error }));
  }
  return (
    <section aria-label="ไฟล์ของฉัน" className="grid gap-2">
      <h2 className="text-base font-semibold">ไฟล์ของฉัน ({rows.length})</h2>
      {rows.length ? (
        <UploadList
          rows={rows} ui={ui} dispatch={dispatch} busy={busy} errors={errors}
          onRemove={(id) => run(id, onRemove)} onHide={(id) => run(id, onHide)} onShow={(id) => run(id, onShow)}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-4 text-center text-sm text-[var(--ct-mute)]">ยังไม่มีไฟล์ อัปโหลดได้ที่แท็บอัปโหลด</p>
      )}
    </section>
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
        <span className={`${tag} bg-[var(--ct-soft)] text-[var(--ct-accent)]`}>ไฟล์ของฉัน</span>
      </div>
      {open["prompt-story"]
        ? <Link href={uploadHref(view)} className={`${solid} w-full`}>ใช้แบบนี้</Link>
        : <span className="text-xs text-[var(--ct-mute)]">ยังไม่เปิดให้ใช้</span>}
    </article>
  );
}
