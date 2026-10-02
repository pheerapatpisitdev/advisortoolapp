"use client";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { Hook } from "@/lib/content/clip";
import { overlayAt, playerJump } from "@/lib/video/preview";
import { FRAME, HOOK_SIZE, HOOK_Y, hookLines, hookMainSize, SUB_SIZE, SUB_Y, subFontSize, subLines, type StyleLook } from "@/lib/video/styles";
import type { Span, Sub } from "@/lib/video/timeline";

/** the face the render draws the words in (poster-png.ts: IBM Plex Sans Thai SemiBold) */
const plex = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["600"], display: "swap" });

/** what the live preview lays over the preview file: the edit as it stands on screen */
export interface LiveEdit {
  keep: Span[];
  /** on the cut clip's clock (preview.ts subsShown) */
  subs: Sub[];
  hook: Hook;
  look: StyleLook;
}

// satori breaks only where hookLines/subLines did: the browser must not break a row again
const rows = (lines: string[]) => lines.map((l, i) => <div key={i} style={{ display: "flex", justifyContent: "center", whiteSpace: "nowrap" }}>{l}</div>);
const stroke = (look: StyleLook): CSSProperties => (look.stroke ? { WebkitTextStroke: look.stroke } : {});

/** the hook as overlays.tsx hookElement draws it, in the 1080-wide frame */
function HookLayer({ hook, look }: { hook: Hook; look: StyleLook }) {
  const top = hook.top?.trim() ?? "";
  const lines = hookLines(hook.main.trim());
  return (
    <div style={{ position: "absolute", left: 0, top: HOOK_Y, width: HOOK_SIZE.width, height: HOOK_SIZE.height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {top ? (
        <div style={{ display: "flex", padding: "14px 30px", borderRadius: 18, background: look.hookTopBg, color: look.hookTopInk, fontWeight: 600, fontSize: 44, marginBottom: 18, flexShrink: 0, whiteSpace: "nowrap" }}>{top}</div>
      ) : null}
      <div style={{ display: "flex", padding: "22px 40px", borderRadius: 24, background: look.hookMainBg, color: look.hookMainInk, fontWeight: 600, fontSize: hookMainSize(lines.length, Boolean(top)), lineHeight: 1.25, flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 1020, ...stroke(look) }}>
        {rows(lines)}
      </div>
    </div>
  );
}

/** a subtitle as overlays.tsx subElement draws it, in the 1080-wide frame */
function SubLayer({ text, look }: { text: string; look: StyleLook }) {
  const lines = subLines(text);
  return (
    <div style={{ position: "absolute", left: 0, top: SUB_Y, width: SUB_SIZE.width, height: SUB_SIZE.height, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 1000,
          ...(look.box ? { background: look.box.background, borderRadius: look.box.borderRadius, padding: look.box.padding } : {}),
          fontWeight: 600, fontSize: subFontSize(look.fontSize, lines.length), lineHeight: 1.25, textAlign: "center",
          color: look.box ? look.box.color : look.color, ...stroke(look),
        }}
      >
        {rows(lines)}
      </div>
    </div>
  );
}

/**
 * The clip editor's player (owner, 2026-10-02). With `live`, it plays the preview file and skips
 * what is cut, and lays the hook and the subtitles over it as the render will: drawn in the
 * 1080×1920 frame the render makes, then scaled to the player's width, so each line breaks and
 * sits where it will in the Reel. Without `live` it plays a file as it is (the edited take).
 */
export function EditPreview({ player, src, live }: {
  player: RefObject<HTMLVideoElement | null>;
  src: string;
  live: LiveEdit | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const seen = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  // the loop reads the edit as it is now, not as it was when the loop began
  const edit = useRef(live);
  useEffect(() => { edit.current = live; });
  const [shown, setShown] = useState({ hook: false, sub: -1 });

  /** skip a cut (or stop after the last kept second), and lay over what shows at this moment */
  const sync = useCallback(() => {
    const p = player.current;
    const l = edit.current;
    if (!p || !l) return;
    const jump = playerJump(p.currentTime, l.keep, p.duration);
    if (jump === "end") { if (!p.paused) p.pause(); }
    else if (jump !== null) p.currentTime = jump;
    const at = overlayAt(p.currentTime, l.keep, l.subs, Boolean(l.hook.main.trim()));
    setShown((s) => (s.hook === at.hook && s.sub === at.sub ? s : { hook: at.hook, sub: at.sub }));
  }, [player]);

  const isLive = live !== null;
  useEffect(() => {
    const p = player.current;
    if (!p || !isLive) return;
    let frame = 0;
    // timeupdate comes four times a second; a cut is skipped on the frame it starts
    const loop = () => {
      sync();
      if (!p.paused && !p.ended) frame = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      const l = edit.current;
      // played again from the end: from the first kept second
      if (l && l.keep.length > 0 && playerJump(p.currentTime, l.keep, p.duration) === "end") p.currentTime = l.keep[0][0];
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    p.addEventListener("play", onPlay);
    p.addEventListener("timeupdate", sync);
    p.addEventListener("seeked", sync);
    p.addEventListener("loadedmetadata", sync);
    return () => {
      cancelAnimationFrame(frame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("timeupdate", sync);
      p.removeEventListener("seeked", sync);
      p.removeEventListener("loadedmetadata", sync);
    };
  }, [player, sync, isLive]);

  // an edit changed while paused shows at once
  useEffect(() => { sync(); }, [live, sync]);

  const sub = live && shown.sub >= 0 ? live.subs[shown.sub] : undefined;
  return (
    <div ref={box} className="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-lg bg-black">
      {/* the render stretches the clip to 1080×1920 (command.ts), so the preview fills the frame the same way */}
      <video ref={player} src={src} controls playsInline preload="metadata" className="absolute inset-0 size-full object-fill" />
      {live && width > 0 && (
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 ${plex.className}`}
          style={{ width: FRAME.width, height: FRAME.height, transform: `scale(${width / FRAME.width})`, transformOrigin: "0 0" }}
        >
          {shown.hook && live.hook.main.trim() ? <HookLayer hook={live.hook} look={live.look} /> : null}
          {sub ? <SubLayer text={sub.text} look={live.look} /> : null}
        </div>
      )}
    </div>
  );
}
