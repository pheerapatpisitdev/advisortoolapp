/**
 * วิดีโอโฆษณา's own drawing in the Remotion clip (owner chose ก ×6 on the mockup, 2026-11-22; remotion/src/Clip.tsx):
 * a scene with a photo shows the photo, pushed in slowly as คลิปตามโจทย์'s pictures are, under the hook's headline,
 * a body's figure or the closing words and the agent; the closing words also go over a Motion contact card, and the
 * regulator's line goes on the last scene of every ad. Every figure here is drawn from the quote's facts, never from
 * an AI line. Plain elements only (no Remotion import): Clip.tsx decodes the photos before the first frame.
 */
import type { CSSProperties, ReactNode } from "react";
import { AD_COLORS as A } from "@/lib/card-theme";
import { DISCLAIMER } from "@/lib/content/output";
import type { Contact } from "@/lib/quote-video/draw";
import { fitSize } from "@/lib/quote-video/recipe-blocks";
import type { QuoteVideoFacts } from "@/lib/quote-video/script";
import type { AdBodyKey } from "./keys";

/** the push of StoryClip.tsx (PUSH): 1.00 at the scene's start to 1.12 at its end */
const PUSH = 0.12;
/** the Motion clip's side margin (motion.tsx SIDE), at 1080 wide */
const SIDE = 64;
/** where the regulator's line sits, above the band the subtitle takes (motion.tsx Subtitle, bottom 96) */
const NOTE_BOTTOM = 206;
/** where the closing words and the agent's card end, above the regulator's line */
const CLOSE_BOTTOM = 330;

const flex = (s: CSSProperties): CSSProperties => ({ display: "flex", ...s });
const line = (s: CSSProperties): CSSProperties => ({ display: "flex", whiteSpace: "nowrap", ...s });

/**
 * A body scene's figure as the photo shows it (R6, 2026-11-22): the quote's own figure for that scene, so a photo
 * never carries a number the AI wrote. value and versus fall back to the price should the quote lack them (the
 * plan offers them only when it has them: plan.ts bodiesFor).
 */
export function bodyFigure(f: QuoteVideoFacts, key: AdBodyKey): string {
  if (key === "cover") return `${f.lead.label} ${f.lead.amount} บาท`;
  if (key === "value" && f.breakEven) return `อายุ ${f.breakEven.age} ขอคืนได้ ${f.breakEven.cash} บาท`;
  if (key === "versus" && f.totalPaid) return `ออมรวม ${f.totalPaid} บาท`;
  return f.perDayAmount ? `วันละ ${f.perDayAmount} บาท` : `${f.spokenPrice.per} ${f.spokenPrice.amount} บาท`;
}

/**
 * The closing words as lines broken at their spaces only (a Thai line breaks at a space, as KeepWords keeps it),
 * each drawn on one line: the biggest size, up to 64, at which the longest word fits and the whole takes three lines
 * at most (no smaller than 44 for a long line the AI wrote), measured at 0.6 em a letter as the recipes are.
 */
function ctaLines(cta: string, room: number, u: number): { size: number; lines: string[] } {
  const words = cta.trim().split(/\s+/).filter(Boolean);
  const longest = words.reduce((m, x) => Math.max(m, [...x].length), 1);
  const wrap = (size: number) => {
    const per = room / (size * 0.6);
    const out: string[] = [];
    for (const word of words) {
      const last = out[out.length - 1];
      if (last !== undefined && [...last].length + 1 + [...word].length <= per) out[out.length - 1] = `${last} ${word}`;
      else out.push(word);
    }
    return out;
  };
  let size = Math.floor(Math.min(64 * u, room / (longest * 0.6)));
  while (size > 44 * u && wrap(size).length > 3) size -= 2;
  return { size, lines: wrap(size) };
}

/**
 * The closing words over the contact scene (the CTA's voice without its polite ending, make.ts adCta): a gold rule,
 * then the words in white. Drawn in the Motion clip's own white and gold, so on ไวท์บอร์ด themed (themes.tsx)
 * repaints them in the board's ink as it does the card under them. Over a photo the words carry a shadow; on a
 * Motion card they do not (on the white board it reads as a smudge, first local render 2026-11-22). Unplaced: the
 * caller puts it where it goes.
 */
export function adCtaBlock(cta: string, w: number, onPhoto = true): ReactNode {
  const u = w / 1080;
  const { size, lines } = ctaLines(cta, (1080 - SIDE * 2) * u, u);
  return (
    <div style={flex({ flexDirection: "column", alignItems: "center", width: (1080 - SIDE * 2) * u, fontFamily: "Plex" })}>
      <div style={flex({ width: 120 * u, height: 8 * u, borderRadius: 4 * u, background: A.gold, marginBottom: 22 * u })} />
      {lines.map((l, i) => (
        <div key={i} style={line({ fontSize: size, fontWeight: 600, lineHeight: 1.3, color: A.ink, ...(onPhoto ? { textShadow: A.shadow } : {}) })}>{l}</div>
      ))}
    </div>
  );
}

/**
 * The regulator's line (content/output.ts DISCLAIMER) on the last scene of every ad, photo or Motion, on a dark pill
 * that reads on any ground. It is one Thai run with no space: Clip.tsx draws it outside KeepWords, so Chrome breaks
 * it where its dictionary allows and it wraps inside the clip, its two lines balanced (one line needs ~1010 px at 26).
 */
export function AdDisclaimer({ w }: { w: number }): ReactNode {
  const u = w / 1080;
  return (
    <div style={flex({ position: "absolute", left: SIDE * u, width: (1080 - SIDE * 2) * u, bottom: NOTE_BOTTOM * u, justifyContent: "center" })}>
      <div style={flex({ background: A.note, borderRadius: 18 * u, padding: `${10 * u}px ${22 * u}px`, fontFamily: "Plex", fontSize: 26 * u, lineHeight: 1.4, color: A.ink, textAlign: "center", justifyContent: "center", textWrap: "balance" })}>
        {DISCLAIMER}
      </div>
    </div>
  );
}

/** the agent's card on the closing photo: their photo or initial, name, phone and LINE, in the clip's navy on white */
function contactCard(k: Contact, u: number): ReactNode {
  const pad = 36 * u;
  const face = 150 * u;
  const room = (1080 - SIDE * 2) * u - pad * 2 - face - 32 * u;
  const name = k.name.trim();
  const phone = `โทร ${k.phone}`;
  const lineId = k.line ? `LINE ${k.line}` : "";
  return (
    <div style={flex({ width: (1080 - SIDE * 2) * u, background: A.card, color: A.onCard, borderRadius: 40 * u, padding: pad, alignItems: "center", marginTop: 40 * u })}>
      {k.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={k.photo} width={face} height={face} style={{ width: face, height: face, borderRadius: face / 2, objectFit: "cover", flexShrink: 0 }} alt="" />
      ) : (
        <div style={flex({ width: face, height: face, borderRadius: face / 2, background: A.noPhoto, alignItems: "center", justifyContent: "center", fontSize: 72 * u, fontWeight: 600, flexShrink: 0 })}>{[...name][0] ?? "?"}</div>
      )}
      <div style={flex({ flexDirection: "column", marginLeft: 32 * u, width: room })}>
        <div style={line({ fontSize: fitSize(name, room, 52 * u), fontWeight: 600 })}>{name}</div>
        <div style={line({ fontSize: fitSize(phone, room, 40 * u), marginTop: 6 * u })}>{phone}</div>
        {lineId ? <div style={line({ fontSize: fitSize(lineId, room, 40 * u) })}>{lineId}</div> : null}
      </div>
    </div>
  );
}

export interface AdPhotoProps {
  src: string;
  /** the scene's time and length, for the push */
  t: number;
  dur: number;
  w: number;
  h: number;
  kind: "hook" | "body" | "close";
  /** hook: the hook's headline (1–2 lines, each ≤ HEADLINE_MAX) */
  headline?: string[];
  /** body: the scene's figure (bodyFigure) */
  line?: string;
  /** close: the closing words and the agent */
  cta?: string;
  contact?: Contact;
}

/**
 * A scene drawn on its photo (spec, Rendering): the photo filling the frame and pushed in 1.00 → 1.12, darkened over
 * its lower half, with the hook's headline, a body's figure on a band, or the closing words and the agent's card;
 * the credit line every clip keeps at its foot (motion.tsx).
 */
export function AdPhotoScene({ src, t, dur, w, h, kind, headline, line: figure, cta, contact }: AdPhotoProps): ReactNode {
  const u = w / 1080;
  const room = (1080 - SIDE * 2) * u;
  const push = 1 + PUSH * Math.min(1, Math.max(0, t / dur));
  const heads = (headline ?? []).filter((x) => x.trim());
  const headSize = Math.min(...heads.map((x) => fitSize(x, room, 92 * u)), 92 * u);
  return (
    <div style={flex({ position: "absolute", left: 0, top: 0, width: w, height: h, overflow: "hidden", background: A.ground, fontFamily: "Plex", color: A.ink })}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ position: "absolute", left: 0, top: 0, width: w, height: h, objectFit: "cover", transform: `scale(${push.toFixed(4)})` }} />
      <div style={flex({ position: "absolute", left: 0, top: h / 2, width: w, height: h / 2, background: `linear-gradient(180deg, ${A.scrimClear} 0%, ${A.scrim} 100%)` })} />
      {kind === "hook" && heads.length ? (
        <div style={flex({ position: "absolute", left: SIDE * u, width: room, bottom: 360 * u, flexDirection: "column", alignItems: "center" })}>
          {heads.map((x, i) => (
            <div key={i} style={line({ fontSize: headSize, fontWeight: 600, lineHeight: 1.25, color: i === 0 ? A.ink : A.gold, textShadow: A.shadow })}>{x}</div>
          ))}
        </div>
      ) : null}
      {kind === "body" && figure ? (
        <div style={flex({ position: "absolute", left: SIDE * u, width: room, bottom: 360 * u, justifyContent: "center" })}>
          <div style={flex({ background: A.band, borderRadius: 28 * u, padding: `${18 * u}px ${32 * u}px` })}>
            <div style={line({ fontSize: fitSize(figure, room - 64 * u, 76 * u), fontWeight: 600, color: A.gold })}>{figure}</div>
          </div>
        </div>
      ) : null}
      {kind === "close" ? (
        <div style={flex({ position: "absolute", left: SIDE * u, width: room, bottom: CLOSE_BOTTOM * u, flexDirection: "column", alignItems: "center" })}>
          {cta ? adCtaBlock(cta, w) : null}
          {contact ? contactCard(contact, u) : null}
        </div>
      ) : null}
      <div style={flex({ position: "absolute", left: 0, width: w, bottom: 34 * u, justifyContent: "center", fontSize: 26 * u, color: A.ink, opacity: 0.6 })}>Application by www.advisortool.app</div>
    </div>
  );
}

/**
 * where the closing words go over a Motion contact card (Clip.tsx): above the regulator's line, clear of the card.
 * A plain function, not a component, so themed (themes.tsx) sees its pieces and repaints them with the card.
 */
export function adCtaOver(cta: string, w: number): ReactNode {
  const u = w / 1080;
  return (
    <div style={flex({ position: "absolute", left: SIDE * u, width: (1080 - SIDE * 2) * u, bottom: CLOSE_BOTTOM * u, justifyContent: "center" })}>
      {adCtaBlock(cta, w, false)}
    </div>
  );
}
