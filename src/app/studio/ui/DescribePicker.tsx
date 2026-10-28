"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ACCEPTED_TYPES } from "@/lib/content/describe";
import type { Swatch } from "@/lib/content/palette";
import type { DescribeResult } from "@/lib/content/describe-run";
import { fileProblem } from "@/lib/content/picture-shrink";
import { describeCall } from "../describe-call";
import { shrinkImage } from "./shrink-image";

/** a good read; `thumbUrl` (the thumbnail the browser made, as a data link) and `palette` are what the browser knows, for showing the new history item at once */
export type DescribeOk = Extract<DescribeResult, { ok: true }> & { thumbUrl?: string; palette?: Swatch[] };

/** `url` is the chosen file's own preview link (confirm mode only), let go of once the box closes */
type State =
  | { phase: "idle" }
  | { phase: "picked"; file: File; url: string; error?: string }
  | { phase: "working"; file: File; url?: string; kb: number | null }
  | { phase: "failed"; error: string };

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * "ถอดจากรูป": choose a picture, have it shrunk and read, and hand the prompt to `onDone`.
 * Shared by the brief field and the ถอดรูปเป็น prompt page. While one picture is being read a
 * second click or a second file does nothing, so a double press cannot pay for two.
 *
 * With `confirm` (the ถอดรูปเป็น prompt page, owner chose ก 2026-10-28) a chosen picture is shown
 * first with เริ่มถอด prompt / เปลี่ยนรูป / ยกเลิก, and nothing is read or counted until เริ่ม is
 * pressed; `beside` is drawn next to the button, told whether a read is running.
 */
export function DescribePicker({ onDone, asPerson = false, confirm = false, beside }: {
  onDone: (r: DescribeOk) => void;
  /** a person from the people library will be drawn in: the main person is written as them (describe.ts AS_PERSON) */
  asPerson?: boolean;
  confirm?: boolean;
  beside?: (working: boolean) => ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [state, setState] = useState<State>({ phase: "idle" });

  // the preview link of the picture on show, let go of when it changes or the page closes
  const previewUrl = state.phase === "picked" || state.phase === "working" ? state.url : undefined;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function pick(file: File) {
    if (busy.current) return;
    const problem = fileProblem(file);
    if (problem) { setState({ phase: "failed", error: problem }); return; }
    if (confirm) setState({ phase: "picked", file, url: URL.createObjectURL(file) });
    else void read(file);
  }

  async function read(file: File, url?: string) {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: "working", file, url, kb: null });
    // a failed read in confirm mode keeps the picture up, so เริ่ม can be pressed again
    const fail = (error: string) => setState(url ? { phase: "picked", file, url, error } : { phase: "failed", error });
    try {
      const shrunk = await shrinkImage(file);
      setState({ phase: "working", file, url, kb: Math.max(1, Math.round(shrunk.bytes / 1024)) });
      const r = await describeCall({ base64: shrunk.base64, mimeType: shrunk.mimeType, palette: shrunk.palette, thumb: shrunk.thumb, asPerson });
      if (r.ok) { setState({ phase: "idle" }); onDone({ ...r, palette: shrunk.palette, ...(shrunk.thumb ? { thumbUrl: `data:image/jpeg;base64,${shrunk.thumb}` } : {}) }); }
      else fail(r.error);
    } catch (e) {
      fail(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
    } finally {
      busy.current = false;
    }
  }

  const working = state.phase === "working";
  const btn = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-60";
  const pickButton = (
    <button type="button" disabled={working} onClick={() => input.current?.click()} className={btn}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.5 5.5h15v13h-15zM4.5 15.5l4.5-4.5 4 4 2.5-2.5 4 4M15.5 9.5h.01" />
      </svg>
      {working && !confirm ? "กำลังอ่านรูป…" : "ถอดจากรูป"}
    </button>
  );
  const fileInput = (
    <input
      ref={input} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) pick(file);
      }}
    />
  );
  const failed = state.phase === "failed" && <span role="alert" className="text-xs text-[var(--ct-alert)]">{state.error}</span>;

  if (!confirm) {
    return (
      <div className="flex flex-col items-end gap-1">
        {pickButton}
        {fileInput}
        {state.phase === "working" && <span className="text-xs text-[var(--ct-mute)]">{state.file.name}{state.kb ? ` · ${state.kb} KB` : ""}</span>}
        {failed}
      </div>
    );
  }

  const shown = state.phase === "picked" || state.phase === "working" ? state : null;
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3">
        {pickButton}
        {fileInput}
        {beside?.(working)}
      </div>
      {failed && <p className="mt-1">{failed}</p>}
      {shown && (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] p-3">
          <div className="flex items-start gap-3">
            {shown.url && (
              // eslint-disable-next-line @next/next/no-img-element -- the chosen file's own preview link, never sent anywhere
              <img src={shown.url} alt="รูปที่เลือก" className="max-h-40 w-24 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 text-sm">
              <p className="break-all font-medium">{shown.file.name}</p>
              <p className="text-xs text-[var(--ct-mute)]">
                {state.phase === "working" ? (state.kb ? `ย่อแล้ว ${state.kb} KB` : "กำลังย่อรูป…") : `${fileSize(shown.file.size)} · ยังไม่เริ่มอ่าน`}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button" disabled={working} onClick={() => void read(shown.file, shown.url)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--ct-solid)] px-3 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-60"
            >
              {working && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}
              {working ? "กำลังอ่านรูป…" : state.phase === "picked" && state.error ? "ลองอีกครั้ง" : "เริ่มถอด prompt"}
            </button>
            {!working && (
              <>
                <button type="button" className={btn} onClick={() => input.current?.click()}>เปลี่ยนรูป</button>
                <button type="button" className={btn} onClick={() => setState({ phase: "idle" })}>ยกเลิก</button>
              </>
            )}
          </div>
          {state.phase === "picked" && state.error && <p role="alert" className="mt-2 text-xs text-[var(--ct-alert)]">{state.error}</p>}
          <p className="mt-2 text-xs text-[var(--ct-mute)]">{working ? "กดซ้ำไม่ได้ จ่ายรอบเดียว" : "กดเริ่มแล้วนับ 1 รอบ"}</p>
        </div>
      )}
    </div>
  );
}
