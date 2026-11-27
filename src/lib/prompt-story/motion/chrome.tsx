import type { JSX } from "react";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { captionShown, wordAt } from "@/lib/quote-video/caption";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { LEAD, SIZES, wordTimes, XFADE, type VideoSize } from "@/lib/quote-video/timeline";
import { VIDEO_WORDS } from "@/lib/quote-video/video-words";
import { abs, alpha, box, place, PROMPT } from "./css";
import { clamp, ease, fly, r2, rise } from "./ease";
import { fitSize } from "./fit";
import { BARS, GEO, WIPE_W } from "./geo";

/**
 * What runs over โมชันกราฟิก's scenes (owner, 2026-11-26, mockup ข round 2): the voice's subtitle, the progress bar,
 * the gold edge of the wipe between scenes, and the agent's card that closes the clip. Pure functions of time.
 */

const C = STORY_CLIP_COLORS;
/** Prompt's letters against the ones caption.ts measures (Plex's): about a tenth wider, so fewer fit the band */
const PROMPT_WIDE = 1.1;

/** the voice's words a line-sized piece at a time (caption.ts), on the dark pill; the word being spoken on gold, the ones to come quieter */
export function MotionSubtitle({ words, voiceSec, size, t }: { words: string[]; voiceSec: number; size: VideoSize; t: number }): JSX.Element {
  const { w } = SIZES[size];
  const g = GEO[size].sub;
  const fs = g.fs;
  const times = wordTimes(words.join(" "), voiceSec, LEAD);
  const shown = captionShown(words, (g.maxWidth - 1.2 * fs) / (fs * PROMPT_WIDE), wordAt(words, t, voiceSec, LEAD));
  return (
    <div style={abs({ left: 60, width: w - 120, bottom: g.bottom, justifyContent: "center", fontFamily: PROMPT })}>
      <div style={box({ flexWrap: "wrap", justifyContent: "center", maxWidth: g.maxWidth, background: C.mgScrim, color: C.white, borderRadius: r2(0.5 * fs), padding: `${r2(0.28 * fs)}px ${r2(0.6 * fs)}px`, fontSize: fs, fontWeight: 600, lineHeight: 1.35, columnGap: r2(0.3 * fs) })}>
        {shown.map((i) => {
          const at = times[i];
          if (t >= at.from && t < at.to) {
            const pop = 0.8 + 0.2 * ease((t - at.from) / 0.22);
            return <div key={i} style={box({ color: C.mgInk, background: C.mgGold, borderRadius: r2(0.25 * fs), padding: `0 ${r2(0.18 * fs)}px`, margin: `0 ${r2(-0.18 * fs)}px`, transform: `scale(${r2(pop)})` })}>{words[i]}</div>;
          }
          return <div key={i} style={box(t < at.from ? { opacity: 0.5 } : {})}>{words[i]}</div>;
        })}
      </div>
    </div>
  );
}

/** thin segments along the top, one a scene, each filling gold as its scene runs (to where the next one comes in) */
export function motionBars({ size, T, starts, durs }: { size: VideoSize; T: number; starts: number[]; durs: number[] }): JSX.Element {
  const { w } = SIZES[size];
  return (
    <div style={abs({ left: BARS.side, top: BARS.top, width: w - BARS.side * 2, height: BARS.h, gap: BARS.gap })}>
      {starts.map((s, i) => (
        <div key={i} style={box({ flexGrow: 1, flexBasis: 0, height: BARS.h, borderRadius: BARS.h, overflow: "hidden", background: alpha(C.mgMute, 0.45) })}>
          <div style={abs({ left: 0, top: 0, height: BARS.h, width: `${r2(clamp((T - s) / Math.max(0.01, durs[i] - XFADE)) * 100)}%`, background: C.mgGold })} />
        </div>
      ))}
    </div>
  );
}

/** the gold edge at the wipe's front, `x` across the frame (0–1) */
export function motionWipe({ x, size }: { x: number; size: VideoSize }): JSX.Element {
  const { w, h } = SIZES[size];
  return <div style={abs({ left: r2(x * w - WIPE_W / 2), top: 0, width: WIPE_W, height: h, background: C.mgGold })} />;
}

/**
 * The clip's last scene: the mockup's contact card on the cream, reading what story-motion.tsx's Contact reads (the
 * agent's photo or initial, name, phone, LINE and own lines), the kicker for the customer or the general one, the
 * two closing lines in the narrator's voice, the small print every agent's card carries, and the footer.
 */
export function motionContact({ contact, customer, narrator, size, t }: { contact: StoryContext["contact"]; customer: string; narrator: "F" | "M"; size: VideoSize; t: number }): JSX.Element {
  const { w, h } = SIZES[size];
  const g = GEO[size].contact;
  const vw = VIDEO_WORDS.th;
  const kicker = customer ? vw.contactFor(customer) : vw.contactMore;
  const lines = vw.contactLines(narrator);
  const initial = [...contact.name.trim()][0] ?? "?";
  const more = contact.more ? contact.more.split("\n").filter(Boolean) : [];
  const af = g.af;
  const face = r2(5.6 * af);
  const pad = r2(1.3 * af);
  const nameFs = fitSize(contact.name, g.ag.w - pad * 2 - face - af, 1.7 * af);
  const [kf, f1, f2] = [fitSize(kicker, g.head.w - 1.6 * g.fs[0], g.fs[0]), fitSize(lines[0], g.head.w * 0.96, g.fs[1]), fitSize(lines[1], g.head.w * 0.96, g.fs[2])];
  const card = fly(t, 0.7, g.from.dx, g.from.dy, -3);
  const ring = t < 1.4 ? null : ((((t - 1.4) % 1.1) + 1.1) % 1.1) / 1.1;
  const pillFs = r2(1.25 * af);
  const tag = { fontSize: pillFs, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", borderRadius: r2(0.5 * pillFs), padding: `${r2(0.35 * pillFs)}px ${r2(0.7 * pillFs)}px` } as const;
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", fontFamily: PROMPT, color: C.mgInk }}>
      <div style={abs({ left: 0, top: 0, width: w, height: h, background: `radial-gradient(${C.mgDot} 12%, ${alpha(C.mgDot, 0)} 13%) 0 0 / 48px 48px, ${C.mgCream}` })} />
      <div style={abs({ ...place(g.head), flexDirection: "column", alignItems: g.left ? "flex-start" : "center", justifyContent: "center", gap: 4.5 })}>
        <div style={box({ fontSize: kf, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", borderRadius: 999, padding: `${r2(0.2 * kf)}px ${r2(0.8 * kf)}px`, background: C.mgCoral, color: C.white, ...rise(t, 0.15, 0.7 * kf) })}>{kicker}</div>
        <div style={box({ fontSize: f1, fontWeight: 800, lineHeight: 1.22, whiteSpace: "nowrap", color: C.mgNavy, ...rise(t, 0.33, 0.7 * f1) })}>{lines[0]}</div>
        <div style={box({ fontSize: f2, fontWeight: 800, lineHeight: 1.22, whiteSpace: "nowrap", color: C.mgCoral, ...rise(t, 0.51, 0.7 * f2) })}>{lines[1]}</div>
      </div>
      <div style={abs({ left: g.ag.x, top: g.ag.y, width: g.ag.w, flexDirection: "column", ...card })}>
        <div style={box({ flexDirection: "column", background: C.white, borderRadius: r2(1.2 * af), padding: pad, boxShadow: `0 ${af}px ${r2(2.2 * af)}px ${alpha(C.mgNavy, 0.25)}` })}>
          <div style={box({ alignItems: "center", gap: af })}>
            {contact.photo ? (
              <div style={box({ width: face, height: face, flexShrink: 0, borderRadius: face / 2, overflow: "hidden" })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contact.photo} width={face} height={face} alt="" style={{ width: face, height: face, objectFit: "cover" }} />
              </div>
            ) : (
              <div style={box({ width: face, height: face, flexShrink: 0, borderRadius: face / 2, background: C.mgGold, alignItems: "center", justifyContent: "center", fontSize: r2(2.6 * af), fontWeight: 800 })}>{initial}</div>
            )}
            <div style={box({ flexDirection: "column", flexShrink: 1 })}>
              <div style={box({ fontSize: nameFs, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap" })}>{contact.name}</div>
              {more.map((l, i) => <div key={i} style={box({ fontSize: r2(1.2 * af), fontWeight: 400, lineHeight: 1.3, color: C.mgMute })}>{l}</div>)}
            </div>
          </div>
          <div style={box({ flexWrap: "wrap", gap: r2(0.6 * af), marginTop: r2(0.8 * af) })}>
            <div style={box({ ...tag, background: C.mgGrey })}>{`${vw.phone} ${contact.phone}`}</div>
            {contact.line ? (
              <div style={box({ ...tag, background: C.mgTeal, color: C.white })}>
                {ring === null ? null : <div style={abs({ left: 0, top: 0, right: 0, bottom: 0, borderRadius: r2(0.5 * pillFs), border: `${r2(0.14 * pillFs)}px solid ${C.mgTeal}`, opacity: r2(1 - ring), transform: `scale(${r2(1 + ring * 0.35)})` })} />}
                <div style={box({})}>{`LINE ${contact.line}`}</div>
              </div>
            ) : null}
          </div>
        </div>
        {/* the small print every agent's card carries (story-motion.tsx Contact); the drawing breaks Thai only at a space */}
        <div style={box({ flexWrap: "wrap", fontSize: r2(0.85 * af), fontWeight: 400, lineHeight: 1.35, color: C.mgMute, marginTop: r2(0.7 * af), opacity: r2(ease((t - 1.4) / 0.4)) })}>
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครอง และเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </div>
      </div>
      <div style={abs({ left: 0, width: w, bottom: 27, justifyContent: "center", fontSize: 24, opacity: 0.55, color: C.mgInk })}>Application by www.advisortool.app</div>
    </div>
  );
}
