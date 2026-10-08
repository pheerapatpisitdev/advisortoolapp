"use client";
import { useRef, useState } from "react";
import { ACCEPTED_TYPES } from "@/lib/content/describe";
import type { Swatch } from "@/lib/content/palette";
import type { DescribeResult } from "@/lib/content/describe-run";
import { fileProblem } from "@/lib/content/picture-shrink";
import { describeCall } from "../describe-call";
import { shrinkImage } from "./shrink-image";

/** a good read; `thumbUrl` (the thumbnail the browser made, as a data link) and `palette` are what the browser knows, for showing the new history item at once */
export type DescribeOk = Extract<DescribeResult, { ok: true }> & { thumbUrl?: string; palette?: Swatch[] };

type State = { phase: "idle" } | { phase: "working"; name: string; kb: number | null } | { phase: "failed"; error: string };

/**
 * "ถอดจากรูป": choose a picture, have it shrunk and read, and hand the prompt to `onDone`.
 * Shared by the brief field and the ถอดรูปเป็น prompt page. While one picture is being read a
 * second click or a second file does nothing, so a double press cannot pay for two.
 */
export function DescribePicker({ onDone }: { onDone: (r: DescribeOk) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [state, setState] = useState<State>({ phase: "idle" });

  async function pick(file: File) {
    if (busy.current) return;
    const problem = fileProblem(file);
    if (problem) { setState({ phase: "failed", error: problem }); return; }
    busy.current = true;
    setState({ phase: "working", name: file.name, kb: null });
    try {
      const shrunk = await shrinkImage(file);
      setState({ phase: "working", name: file.name, kb: Math.max(1, Math.round(shrunk.bytes / 1024)) });
      const r = await describeCall({ base64: shrunk.base64, mimeType: shrunk.mimeType, palette: shrunk.palette, thumb: shrunk.thumb });
      if (r.ok) { setState({ phase: "idle" }); onDone({ ...r, palette: shrunk.palette, ...(shrunk.thumb ? { thumbUrl: `data:image/jpeg;base64,${shrunk.thumb}` } : {}) }); }
      else setState({ phase: "failed", error: r.error });
    } catch (e) {
      setState({ phase: "failed", error: e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
    } finally {
      busy.current = false;
    }
  }

  const working = state.phase === "working";
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button" disabled={working} onClick={() => input.current?.click()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.5 5.5h15v13h-15zM4.5 15.5l4.5-4.5 4 4 2.5-2.5 4 4M15.5 9.5h.01" />
        </svg>
        {working ? "กำลังอ่านรูป…" : "ถอดจากรูป"}
      </button>
      <input
        ref={input} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      {working && <span className="text-xs text-[var(--ct-mute)]">{state.name}{state.kb ? ` · ${state.kb} KB` : ""}</span>}
      {state.phase === "failed" && <span role="alert" className="text-xs text-[var(--ct-alert)]">{state.error}</span>}
    </div>
  );
}
