import { QUOTE_VIDEO_COLORS, STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { StoryTopic } from "@/lib/story/topics";
import type React from "react";
import { abs, box, El, look, type Anim } from "./motion";
import { HEALTH_WORDS as HW, n, type KnowEpisode, type KnowSceneKey, type KnowShow, type NoteLine } from "./story-knowledge";
import { ageRows, baht, groupBars, limitFigs, overflowBar, PART_FILL, roomFigs, splitParts } from "./story-health-motion";
import { kspec } from "./story-knowledge-motion";
import { infoIcon, type InfoIcon } from "./story-info-icons";
import { Contact, INFO_GROUND, plot, type StoryContext } from "./story-motion";
import { countAt, SIZES, type VideoSize } from "./timeline";

/**
 * อินโฟกราฟิก (owner chose ข, 2026-11-01, mockup https://claude.ai/artifact/8PbjhVriyiYNiKv4y9X5yq): the
 * episodes of ความรู้ประกัน 1 นาที and ตอบข้อโต้แย้ง drawn as วิดีโอนำเสนอ Motion is — navy ground, gold
 * numbers and icons, the points coming in as tiles one by one, the one the voice is on ringed in gold.
 * Same words, same scenes, same beats (kspec) as the paper: only the drawing differs.
 */

const C = QUOTE_VIDEO_COLORS;
const S = STORY_CLIP_COLORS;

/** what a look draws with: อินโฟกราฟิก's navy and gold, or ปากกาพล็อตเตอร์'s one pen on cream paper */
interface Kit {
  plot: boolean;
  /** headings and the accent, a tile's own ground, bad and good news, the words, a card's ground and edge, the quieter words */
  gold: string; sky: string; red: string; green: string; white: string; tile: string; tileLine: string; soft: string;
  /** what is drawn on a gold tile, a struck-out belief, the list item the voice is on and its edge, a tick, a recap's ground and small line */
  ground: string; dim: string; on: string; onLine: string; tick: string; card: string; mute: string;
}
const INFO_KIT: Kit = {
  plot: false, gold: C.motionGold, sky: C.motionSky, red: C.motionRed, green: C.motionGreen, white: S.white, tile: "rgba(255,255,255,0.08)", tileLine: "rgba(255,255,255,0.2)", soft: "rgba(255,255,255,0.82)",
  ground: INFO_GROUND, dim: "rgba(255,255,255,0.45)", on: "rgba(255,210,63,0.12)", onLine: C.motionGold, tick: S.infoTick, card: S.white, mute: S.infoMute,
};
const PLOT_KIT: Kit = {
  plot: true, gold: S.plotInk, sky: S.plotInk, red: S.red, green: S.green, white: S.plotInk, tile: "transparent", tileLine: S.plotInk, soft: S.plotSoft,
  ground: S.plotInk, dim: S.plotDim, on: S.plotOn, onLine: S.red, tick: S.green, card: S.plotPaper, mute: S.plotSoft,
};
/**
 * The look being drawn, set by infoBody as it starts a frame: a clip is drawn in one look from its first frame
 * to its last, and its pieces are run straight after the frame is asked for.
 */
let K: Kit = INFO_KIT;
const HAND = "Mali";
/** a pen's shading: fine slanted lines in its ink */
const hatch = (ink: string) => `repeating-linear-gradient(45deg, ${ink} 0px, ${ink} 2px, transparent 2px, transparent 10px)`;

/** where things stand, for each shape: `k` scales every size set for the portrait */
const GEO: Record<VideoSize, { k: number; title: number; top: number; bottom: number; side: number; row: boolean }> = {
  portrait: { k: 1, title: 170, top: 470, bottom: 1640, side: 80, row: false },
  square: { k: 0.66, title: 48, top: 250, bottom: 900, side: 70, row: false },
  landscape: { k: 0.84, title: 40, top: 250, bottom: 900, side: 260, row: true },
};

/**
 * The icon each scene's tile shows, or each list item's, episode by episode. A scene not named here
 * takes its layout's own (a question mark, a speech bubble…); a list without icons shows its marks.
 */
const ICONS: Partial<Record<StoryTopic, Partial<Record<KnowSceneKey, InfoIcon | InfoIcon[]>>>> = {
  sumvspremium: { knowThree: "chart" },
  declare: { knowAsk: "pen", knowOne: ["heart", "pill", "bed"], knowTwo: "warn", knowThree: "doc" },
  mythclaim: { knowOne: "shield", knowTwo: ["pen", "clock", "doc"], knowThree: ["book", "pen", "handshake"] },
  mythyoung: { knowOne: "chart", knowTwo: "heart", knowThree: "warn" },
  mythjinx: { knowOne: "car" },
  fiverisks: { knowOne: "bag", knowTwo: ["family", "hourglass", "heart"], knowThree: ["car", "wheelchair"] },
  thinkfirst: { knowOne: ["calendar", "heart", "warn"], knowTwo: "chart", knowThree: ["bed", "home", "coins"] },
  groupins: { knowOne: "briefcase", knowTwo: ["briefcase", "hourglass", "doc"], knowThree: "warn" },
  welfare: { knowOne: "hospital", knowTwo: ["coins", "home", "car"], knowThree: "bag" },
  bank: { knowOne: "bank", knowTwo: "shield", knowThree: "warn" },
  pricey: { knowOne: "coffee", knowTwo: ["coins", "calendar", "chart"], knowThree: "warn" },
  orphan: { knowOne: "doc", knowTwo: ["badge", "book", "search"], knowThree: ["clock", "handshake", "phone"] },
};

const OWN: Partial<Record<KnowShow["layout"], InfoIcon>> = {
  ask: "question", myth: "speech", fact: "shield", note: "doc", card: "doc", family: "family", gift: "gift",
  // ชุดประกันสุขภาพ: the bed and the hospital are the thing drawn; the rest stand on a words-only card when a figure is missing
  split: "doc", limit: "shield", room: "bed", overflow: "warn", waiting: "clock", cashless: "hospital", groupgap: "briefcase", agecost: "chart",
};

function iconOf(topic: StoryTopic, key: KnowSceneKey, show: KnowShow): InfoIcon | undefined {
  const named = ICONS[topic]?.[key];
  return typeof named === "string" ? named : OWN[show.layout];
}
const itemIcons = (topic: StoryTopic, key: KnowSceneKey): InfoIcon[] => {
  const named = ICONS[topic]?.[key];
  return Array.isArray(named) ? named : [];
};

/** a square tile with an icon in it */
function Tile({ kind, size, bg = K.sky, color = K.white, radius }: { kind: InfoIcon; size: number; bg?: string; color?: string; radius?: number }) {
  const r = radius ?? Math.round(size * 0.24);
  if (K.plot) {
    // the pen's tile: its outline and the icon in one ink, the shading a hatched block set off behind it
    const off = Math.max(6, Math.round(size * 0.06));
    return (
      <div style={box({ position: "relative", width: size + off, height: size + off, flexShrink: 0 })}>
        <div style={abs({ left: off, top: off, width: size, height: size, borderRadius: r, background: hatch(bg) })} />
        <div style={abs({ left: 0, top: 0, width: size, height: size, borderRadius: r, background: S.plotPaper, border: `${Math.max(3, Math.round(size * 0.022))}px solid ${bg}`, alignItems: "center", justifyContent: "center" })}>
          {infoIcon(kind, Math.round(size * 0.62), bg)}
        </div>
      </div>
    );
  }
  return (
    <div style={box({ width: size, height: size, borderRadius: r, background: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 })}>
      {infoIcon(kind, Math.round(size * 0.62), color)}
    </div>
  );
}

/** a pill with a word on it: the stamp of a belief or a fact */
const Chip = ({ text, bg, size }: { text: string; bg: string; size: number }) => (K.plot
  // a rubber stamp's outline, a little askew
  ? <div style={box({ background: S.plotPaper, color: bg, border: `${Math.max(3, Math.round(size * 0.09))}px solid ${bg}`, borderRadius: Math.round(size * 0.3), padding: `${Math.round(size * 0.16)}px ${Math.round(size * 0.7)}px`, fontSize: size, fontWeight: 600, transform: "rotate(-2deg)" })}>{text}</div>
  : <div style={box({ background: bg, color: K.white, borderRadius: 999, padding: `${Math.round(size * 0.22)}px ${Math.round(size * 0.8)}px`, fontSize: size, fontWeight: 600 })}>{text}</div>
);

/** a note's lines on the navy: small ones soft, big ones bold, a red or green one on its own pill */
function Lines({ lines, k, center = true }: { lines: NoteLine[]; k: number; center?: boolean }) {
  return (
    <div style={box({ flexDirection: "column", alignItems: center ? "center" : "flex-start", flexShrink: 1 })}>
      {lines.map((l, i) => {
        const gap = i ? Math.round(16 * k) : 0;
        if (!l.big) return <div key={i} style={box({ fontSize: Math.round(44 * k), color: K.soft, marginTop: gap, textAlign: center ? "center" : "left" })}>{l.text}</div>;
        if (!l.tone) return <div key={i} style={box({ fontSize: Math.round(64 * k), fontWeight: 600, color: K.white, lineHeight: 1.25, marginTop: gap, textAlign: center ? "center" : "left" })}>{l.text}</div>;
        return <div key={i} style={box({ marginTop: gap + Math.round(4 * k) })}><Chip text={l.text} bg={l.tone === "red" ? K.red : K.green} size={Math.round(58 * k)} /></div>;
      })}
    </div>
  );
}

/** the scene's title: the first line gold and large, the second white under it */
function Title({ text, an, t, w, g }: { text: [string, string]; an?: Anim; t: number; w: number; g: (typeof GEO)[VideoSize] }) {
  return (
    <E an={an} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: g.title + (K.plot && g.title < 100 ? Math.round(44 * g.k) : 0), flexDirection: "column", alignItems: "center" }}>
      <div style={box({ fontSize: Math.round((K.plot && g.title < 100 ? 88 : 104) * g.k), fontWeight: 600, color: K.gold, lineHeight: 1.15, textAlign: "center", ...(K.plot ? { color: "transparent", WebkitTextStroke: `${Math.max(2, Math.round(3 * g.k))}px ${K.gold}` } : {}) })}>{text[0]}</div>
      {text[1] ? <div style={box({ fontSize: Math.round(56 * g.k), color: K.white, marginTop: Math.round(8 * g.k), textAlign: "center" })}>{text[1]}</div> : null}
    </E>
  );
}

/** Thai's marks above and below sit on the letter before them: they take no width of their own */
const MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;
/**
 * The size a line is set in so it fits `room` px: the drawing breaks Thai only at a space, so a
 * long run with none would run off its tile. A letter is taken as 0.6 of the size, a little wide.
 */
export function fitSize(text: string, size: number, room: number): number {
  const letters = text.replace(MARKS, "").length;
  return Math.max(Math.round(size * 0.6), Math.min(size, Math.floor(room / (letters * 0.6))));
}

/** a list item: "1 จากไปเร็ว ครอบครัวขาดรายได้" → the number, the words before the first space bold, the rest under them */
function itemParts(text: string, i: number, mark: "check" | "cross" | "box" | "warn") {
  const m = /^(\d+)\s+(.*)$/.exec(text);
  const rest = m ? m[2] : text;
  const cut = rest.indexOf(" ");
  const badge = m ? m[1] : mark === "check" ? "✓" : mark === "cross" ? "✗" : mark === "box" ? String(i + 1) : "!";
  return { badge, head: cut > 0 ? rest.slice(0, cut) : rest, tail: cut > 0 ? rest.slice(cut + 1) : "" };
}

/** One อินโฟกราฟิก scene's frame body at scene time t (story-frames.tsx adds the subtitle and footer). */
export function infoBody(key: KnowSceneKey | "storyContact", c: StoryContext, t: number, episode: KnowEpisode) {
  K = plot(c.input) ? PLOT_KIT : INFO_KIT;
  if (key === "storyContact") return <Contact c={c} t={t} />;
  if (!K.plot) return infoScene(key, c, t, episode);
  // ปากกาพล็อตเตอร์: the same scene in the pen's hand, with the machine's rail and carriage over the sheet; the
  // carriage rides with the piece being written, and waits at the right when nothing is
  const { w: fw, h: fh } = SIZES[c.size];
  const shown = episode.scenes.find((x) => x.key === key)!.show;
  const live = Object.values(kspec(shown)).filter((x) => t >= x.at && t < x.at + x.dur).sort((x, y) => y.at - x.at)[0];
  const p = live ? (t - live.at) / live.dur : 1;
  const gk = GEO[c.size].k;
  const side = Math.round(Math.min(fw, fh) * 0.095);
  const railY = GEO[c.size].bottom - Math.round(30 * gk);
  const x = side + Math.round((fw - side * 2 - 110 * gk) * p);
  return (
    <div style={abs({ left: 0, top: 0, width: fw, height: fh, fontFamily: HAND })}>
      {infoScene(key, c, t, episode)}
      <div style={abs({ left: Math.round(side * 0.3), top: railY, width: fw - Math.round(side * 0.6), height: Math.round(22 * gk), borderRadius: 999, background: S.plotRail, border: `2px solid ${S.plotRailEdge}` })} />
      <div style={abs({ left: x, top: railY - Math.round(26 * gk), width: Math.round(110 * gk), height: Math.round(74 * gk), borderRadius: Math.round(12 * gk), background: S.plotHead })} />
      <div style={abs({ left: x + Math.round(40 * gk), top: railY + Math.round(48 * gk), width: Math.round(30 * gk), height: Math.round((live ? 34 : 20) * gk), background: S.plotPaper, border: `3px solid ${S.plotHead}` })} />
      <div style={abs({ left: x + Math.round(47 * gk), top: railY + Math.round((live ? 82 : 68) * gk), width: Math.round(16 * gk), height: Math.round(16 * gk), background: S.plotPen })} />
    </div>
  );
}

/**
 * A piece of a scene. อินโฟกราฟิก brings it in by its own entrance; the pen writes it, left to right, over the
 * same moments, and it is whole from then on.
 */
function E({ an, t, style, children }: { an?: Anim; t: number; style: React.CSSProperties; children?: React.ReactNode }) {
  if (!K.plot || !an) return <El an={an} t={t} style={style}>{children}</El>;
  const p = Math.max(0, Math.min(1, (t - an.at) / an.dur));
  if (p <= 0) return <div style={{ display: "flex", ...style, opacity: 0 }}>{children}</div>;
  return <div style={{ display: "flex", ...style, ...(p < 1 ? { clipPath: `inset(-40% ${((1 - p) * 100).toFixed(1)}% -40% -10%)` } : {}) }}>{children}</div>;
}

function infoScene(key: KnowSceneKey, c: StoryContext, t: number, episode: KnowEpisode) {
  return infoShow(episode.scenes.find((s) => s.key === key)!.show, c, t, key);
}

/**
 * One show drawn in อินโฟกราฟิก or ปากกาพล็อตเตอร์ at scene time t, with no episode around it: a knowledge scene's
 * (its key names the episode's own icons), or a prompt clip's device scene (the layout's own icon).
 */
export function infoShow(show: KnowShow, c: StoryContext, t: number, key?: KnowSceneKey) {
  K = plot(c.input) ? PLOT_KIT : INFO_KIT;
  const s = kspec(show);
  const { w } = SIZES[c.size];
  const g = GEO[c.size];
  const k = g.k;
  const topic = c.input.topic as StoryTopic;
  const icon = key ? iconOf(topic, key, show) : OWN[show.layout];
  const area: React.CSSProperties = { left: g.side, width: w - g.side * 2, top: g.top, height: g.bottom - g.top, flexDirection: "column", alignItems: "center", justifyContent: "center" };
  const hero = Math.round(340 * k);
  switch (show.layout) {
    case "ask":
      return (
        <>
          <Title text={show.title} an={s.title} t={t} w={w} g={g} />
          <div style={abs(area)}>
            <E an={s.face} t={t} style={{ position: "relative", width: hero, height: hero }}>
              <Tile kind={icon ?? "question"} size={hero} />
            </E>
            <E an={s.marks} t={t} style={{ position: "absolute", left: 0, top: 0, width: w - g.side * 2, height: g.bottom - g.top }}>
              {[[-0.42, -0.3, 120], [0.36, -0.36, 90], [0.4, 0.22, 70]].map(([dx, dy, size], i) => (
                <div key={i} style={abs({ left: Math.round((w - g.side * 2) / 2 + dx * hero * 1.6), top: Math.round((g.bottom - g.top) / 2 + dy * hero * 1.6), fontSize: Math.round(size * k), fontWeight: 600, color: K.gold })}>?</div>
              ))}
            </E>
          </div>
        </>
      );
    case "myth":
      return (
        <>
          <E an={s.stamp} t={t} style={{ position: "absolute", left: 0, width: w, top: g.title + Math.round(20 * k), justifyContent: "center" }}>
            <Chip text="ความเชื่อ" bg={K.red} size={Math.round(54 * k)} />
          </E>
          <div style={abs({ ...area, flexDirection: g.row ? "row" : "column" })}>
            <E an={s.quote} t={t} style={{ flexDirection: "column", alignItems: "center" }}>
              {show.quote.map((q, i) => <div key={i} style={box({ fontSize: Math.round(112 * k), fontWeight: 600, color: K.white, lineHeight: 1.2 })}>{q}</div>)}
            </E>
            <E an={s.face} t={t} style={{ margin: g.row ? `0 0 0 ${Math.round(70 * k)}px` : `${Math.round(70 * k)}px 0 0 0` }}>
              <Tile kind={icon ?? "speech"} size={Math.round(240 * k)} bg={K.red} />
            </E>
          </div>
        </>
      );
    case "fact": {
      const strike = look(s.strike, t).p;
      return (
        <>
          <E an={s.stamp} t={t} style={{ position: "absolute", left: 0, width: w, top: g.title + Math.round(20 * k), justifyContent: "center" }}>
            <Chip text="ความจริง" bg={K.green} size={Math.round(54 * k)} />
          </E>
          <div style={abs(area)}>
            <E an={s.crossed} t={t} style={{ position: "relative", fontSize: Math.round(80 * k), color: K.dim, fontWeight: 600 }}>
              {show.crossed}
              <div style={abs({ left: 0, top: Math.round(80 * k * 0.62), width: `${Math.round(strike * 100)}%`, height: Math.max(4, Math.round(9 * k)), background: K.red, borderRadius: 6 })} />
            </E>
            <E an={s.note} t={t} style={{ flexDirection: g.row ? "row" : "column", alignItems: "center", marginTop: Math.round(60 * k) }}>
              {icon ? <div style={box({ margin: g.row ? `0 ${Math.round(56 * k)}px 0 0` : `0 0 ${Math.round(44 * k)}px 0` })}><Tile kind={icon} size={Math.round(220 * k)} bg={K.green} /></div> : null}
              <Lines lines={show.note} k={k} />
            </E>
          </div>
        </>
      );
    }
    case "flow": {
      const arrow = look(s.arrow, t).p;
      const aw = Math.round(170 * k);
      return (
        <>
          <Title text={show.title} an={s.title} t={t} w={w} g={g} />
          <div style={abs(area)}>
            <div style={box({ alignItems: "center" })}>
              <E an={s.face} t={t} style={{}}><Tile kind="person" size={Math.round(230 * k)} /></E>
              <div style={box({ width: aw, height: Math.round(40 * k), alignItems: "center", margin: `0 ${Math.round(28 * k)}px` })}>
                <div style={box({ width: Math.round((aw - 30 * k) * arrow), height: Math.round(12 * k), background: K.gold, borderRadius: 6 })} />
                {arrow > 0.9 ? <div style={box({ width: 0, height: 0, borderTop: `${Math.round(20 * k)}px solid transparent`, borderBottom: `${Math.round(20 * k)}px solid transparent`, borderLeft: `${Math.round(30 * k)}px solid ${K.gold}` })} /> : null}
              </div>
              <E an={s.icon} t={t} style={{}}><Tile kind={show.dir === "out" ? "coins" : "shield"} size={Math.round(230 * k)} bg={K.gold} color={K.ground} /></E>
            </div>
            <E an={s.note} t={t} style={{ marginTop: Math.round(60 * k) }}><Lines lines={show.note} k={k} /></E>
          </div>
        </>
      );
    }
    case "note":
    case "family":
    case "gift":
    case "card": {
      const lines = show.layout === "card" ? show.lines : show.note;
      const tileAn = show.layout === "family" ? s.people : show.layout === "gift" ? s.gift : show.layout === "card" ? s.card : s.face;
      const linesAn = show.layout === "card" ? s.card : s.note;
      const dim = show.layout === "note" && show.dim;
      return (
        <>
          <Title text={show.title} an={s.title} t={t} w={w} g={g} />
          <div style={abs({ ...area, flexDirection: g.row ? "row" : "column" })}>
            {icon ? (
              <E an={tileAn} t={t} style={{ position: "relative", margin: g.row ? `0 ${Math.round(70 * k)}px 0 0` : `0 0 ${Math.round(60 * k)}px 0` }}>
                <Tile kind={icon} size={g.row ? Math.round(300 * k) : Math.round(280 * k)} bg={dim ? K.red : show.layout === "card" ? K.gold : K.sky} color={show.layout === "card" ? K.ground : K.white} />
              </E>
            ) : null}
            <E an={linesAn} t={t} style={{ background: K.tile, border: `2px solid ${K.tileLine}`, borderRadius: Math.round(36 * k), padding: `${Math.round(40 * k)}px ${Math.round(48 * k)}px`, maxWidth: g.row ? Math.round((w - g.side * 2) * 0.62) : w - g.side * 2 }}>
              <Lines lines={lines} k={k} />
            </E>
          </div>
        </>
      );
    }
    case "list": {
      const icons = key ? itemIcons(topic, key) : [];
      const shown = show.items.map((_, i) => t >= (s[`item${i}`]?.at ?? 0));
      const now = shown.lastIndexOf(true);
      const tileH = Math.round(150 * k);
      // what is left for the words in a tile: less its padding and border, the mark, the icon
      const room = (w - g.side * 2) - Math.round((60 + 8 + 70 + 30) * k) - (icons.length ? Math.round((22 + 110) * k) : 0);
      return (
        <>
          <Title text={show.title} an={s.title} t={t} w={w} g={g} />
          <E an={s.card} t={t} style={{ ...area, position: "absolute", justifyContent: "center", alignItems: "stretch" }}>
            {show.items.map((it, i) => {
              const p = itemParts(it, i, show.mark);
              const on = i === now;
              return (
                <E key={i} an={s[`item${i}`]} t={t} style={{ alignItems: "center", minHeight: tileH, marginTop: i ? Math.round(26 * k) : 0, background: on ? K.on : K.tile, border: `${Math.max(2, Math.round(4 * k))}px solid ${on ? K.onLine : K.tileLine}`, borderRadius: Math.round(30 * k), padding: `${Math.round(20 * k)}px ${Math.round(30 * k)}px` }}>
                  <div style={box({ width: Math.round(70 * k), justifyContent: "center", fontSize: Math.round(76 * k), fontWeight: 600, color: show.mark === "check" ? K.tick : show.mark === "cross" ? K.red : K.gold, flexShrink: 0 })}>{p.badge}</div>
                  {icons[i] ? <div style={box({ marginLeft: Math.round(22 * k) })}><Tile kind={icons[i]} size={Math.round(110 * k)} bg={K.gold} color={K.ground} radius={Math.round(26 * k)} /></div> : null}
                  <div style={box({ flexDirection: "column", marginLeft: Math.round(30 * k), flexShrink: 1 })}>
                    <div style={box({ fontSize: fitSize(p.head, Math.round(58 * k), room), fontWeight: 600, color: K.white, lineHeight: 1.25 })}>{p.head}</div>
                    {p.tail ? <div style={box({ fontSize: fitSize(p.tail, Math.round(44 * k), room), color: K.soft, lineHeight: 1.3 })}>{p.tail}</div> : null}
                  </div>
                </E>
              );
            })}
          </E>
        </>
      );
    }
    case "recap":
      return (
        <>
          <Title text={["จำง่าย ๆ", ""]} an={s.title} t={t} w={w} g={g} />
          <div style={abs(area)}>
            <E an={s.card} t={t} style={{ flexDirection: "column", alignItems: "center", background: K.card, border: `${Math.round((K.plot ? 4 : 8) * k)}px solid ${K.gold}`, borderRadius: Math.round(44 * k), padding: `${Math.round(56 * k)}px ${Math.round(60 * k)}px`, maxWidth: w - g.side * 2 }}>
              {show.lines.map((l, i) => (
                <div key={i} style={box({ fontSize: Math.round((l.big ? 80 : 48) * k), fontWeight: l.big ? 600 : 400, color: l.tone === "red" ? K.red : l.tone === "green" ? K.green : l.big ? K.ground : K.mute, lineHeight: 1.3, textAlign: "center" })}>{l.text}</div>
              ))}
            </E>
          </div>
        </>
      );
    case "bars": {
      const max = Math.max(...show.rows.map((x) => x.value));
      const track = (w - g.side * 2) - Math.round(250 * k);
      return (
        <>
          <E an={s.stamp} t={t} style={{ position: "absolute", left: 0, width: w, top: g.title + Math.round(20 * k), justifyContent: "center" }}>
            <Chip text="ความจริง" bg={K.green} size={Math.round(54 * k)} />
          </E>
          <div style={abs({ ...area, alignItems: "stretch" })}>
            <E an={s.lead} t={t} style={{ flexDirection: "column", alignItems: "center", marginBottom: Math.round(60 * k) }}>
              <div style={box({ fontSize: Math.round(88 * k), fontWeight: 600, color: K.gold })}>{show.lead[0]}</div>
              <div style={box({ fontSize: Math.round(64 * k), fontWeight: 600, color: K.white })}>{show.lead[1]}</div>
            </E>
            {show.rows.map((row, i) => {
              const p = look(s[`bar${i}`], t).p;
              return (
                <div key={i} style={box({ alignItems: "center", marginTop: i ? Math.round(30 * k) : 0 })}>
                  <div style={box({ width: Math.round(230 * k), fontSize: Math.round(48 * k), color: K.white, flexShrink: 0 })}>{row.label}</div>
                  <div style={box({ alignItems: "center", width: track })}>
                    <div style={box({ width: Math.max(8, Math.round(track * 0.72 * (row.value / max) * p)), height: Math.round(70 * k), ...(K.plot ? { background: hatch(i === show.rows.length - 1 ? K.red : K.gold), border: `3px solid ${i === show.rows.length - 1 ? K.red : K.gold}` } : { background: i === show.rows.length - 1 ? K.red : K.gold, borderRadius: Math.round(16 * k) }) })} />
                    <div style={box({ marginLeft: Math.round(20 * k), fontSize: Math.round(52 * k), fontWeight: 600, color: K.white, opacity: p > 0.6 ? 1 : 0 })}>{row.text}</div>
                  </div>
                </div>
              );
            })}
            <E an={s.source} t={t} style={{ justifyContent: "center", marginTop: Math.round(40 * k), fontSize: Math.round(32 * k), color: K.soft }}>{show.source}</E>
          </div>
        </>
      );
    }
    case "split": case "limit": case "room": case "overflow": case "waiting": case "cashless": case "groupgap": case "agecost":
      // the room under the title, above the plotter's rail and carriage
      return healthInfo({ c, t, s, g, w, k, a: { x: g.side, y: g.top, w: w - g.side * 2, h: g.bottom - g.top - Math.round(70 * k) }, icon: icon ?? "doc" }, show);
    default:
      // the shelves that tell a family's story (kin, timeline, pic) are not offered in this look
      return null;
  }
}

/*
 * ชุดประกันสุขภาพ in อินโฟกราฟิก and ปากกาพล็อตเตอร์: the same eight devices story-health-motion.tsx draws on paper, with
 * its figures and its rules (never a negative number, words only when a figure is missing), drawn with the Kit — on
 * the navy in gold and white, in the pen's one ink with its bars hatched, red for what the customer pays, green for
 * what the plan does. Each piece is written by E, so the pen writes it left to right.
 */

type Show<L extends KnowShow["layout"]> = Extract<KnowShow, { layout: L }>;
type Box = { x: number; y: number; w: number; h: number };
/** what a device draws with: the frame and its time, its movements, where things stand, the room under the title, the layout's icon */
interface Dev { c: StoryContext; t: number; s: Record<string, Anim>; g: (typeof GEO)[VideoSize]; w: number; k: number; a: Box; icon: InfoIcon }

function healthInfo(d: Dev, show: Show<"split" | "limit" | "room" | "overflow" | "waiting" | "cashless" | "groupgap" | "agecost">) {
  switch (show.layout) {
    case "split": return split(d, show);
    case "limit": return limit(d, show);
    case "room": return room(d, show);
    case "overflow": return overflow(d, show);
    case "waiting": return waiting(d, show);
    case "cashless": return cashless(d, show);
    case "groupgap": return groupgap(d, show);
    case "agecost": return agecost(d, show);
  }
}

/** the size a line wrapped at its spaces is set in so its longest piece fits `room` */
const fitWords = (text: string, size: number, room: number) => Math.min(...text.split(" ").map((x) => fitSize(x, size, room)));
/** a bar's ink: the pen hatches it inside its outline; the navy fills it */
const fill = (color: string, radius: number | string): React.CSSProperties => (K.plot ? { background: hatch(color), border: `3px solid ${color}` } : { background: color, borderRadius: radius });

/** a card of words: the pen's thin outline on the sheet, or the navy's tile */
function Card({ an, t, k, style, edge, children }: { an?: Anim; t: number; k: number; style?: React.CSSProperties; edge?: string; children: React.ReactNode }) {
  return (
    <E an={an} t={t} style={{ flexDirection: "column", alignItems: "center", background: K.tile, border: `${K.plot ? 3 : 2}px solid ${edge ?? K.tileLine}`, borderRadius: Math.round(32 * k), padding: `${Math.round(32 * k)}px ${Math.round(40 * k)}px`, ...style }}>
      {children}
    </E>
  );
}

/** a label over its figure, the figure set to fit `room` */
function Figure({ label, value, color, k, room, size = 76 }: { label?: string; value: string; color: string; k: number; room: number; size?: number }) {
  return (
    <div style={box({ flexDirection: "column" })}>
      {label ? <div style={box({ fontSize: Math.round(44 * k), color: K.soft, lineHeight: 1.3 })}>{label}</div> : null}
      <div style={box({ fontSize: fitSize(value, Math.round(size * k), room), fontWeight: 600, color, lineHeight: 1.2 })}>{value}</div>
    </div>
  );
}

/** a words-only card under the title: the layout's icon on its tile, the lines on a card */
function wordsCard(d: Dev, an: Anim | undefined, lines: NoteLine[], title?: [string, string]) {
  const { t, s, g, w, k, a } = d;
  const room = a.w - Math.round(80 * k);
  return (
    <>
      {title ? <Title text={title} an={s.title} t={t} w={w} g={g} /> : null}
      <div style={abs({ left: a.x, top: a.y, width: a.w, height: a.h, flexDirection: g.row ? "row" : "column", alignItems: "center", justifyContent: "center" })}>
        <E an={an} t={t} style={{ margin: g.row ? `0 ${Math.round(70 * k)}px 0 0` : `0 0 ${Math.round(56 * k)}px 0` }}>
          <Tile kind={d.icon} size={Math.round(260 * k)} />
        </E>
        <Card an={an} t={t} k={k} style={{ maxWidth: g.row ? Math.round(a.w * 0.6) : a.w }}>
          {lines.map((l, i) => (
            <div key={i} style={box({ fontSize: l.big ? fitWords(l.text, Math.round(68 * k), room) : Math.round(46 * k), fontWeight: l.big ? 600 : 400, color: l.big ? K.white : K.soft, lineHeight: 1.3, textAlign: "center", marginTop: i ? Math.round(12 * k) : 0 })}>{l.text}</div>
          ))}
        </Card>
      </div>
    </>
  );
}

/** เหมาจ่าย vs แยกจ่าย: a card of items each under its own dashed ceiling, beside one tall green bar paying as billed */
function split(d: Dev, show: Show<"split">) {
  const { t, s, g, w, k, a } = d;
  const parts = splitParts(show);
  const gap = Math.round(40 * k);
  const foot = Math.round(70 * k);
  const cw = Math.round((a.w - gap) / 2);
  const ch = a.h - foot;
  const pad = Math.round(32 * k);
  const head = Math.round(64 * k);
  const inner = cw - pad * 2 - 8;
  const barH = Math.round(46 * k);
  const wl = look(s.whole, t);
  const lumpW = Math.round(inner * 0.72);
  const lumpH = ch - pad * 2 - Math.round(head * 1.8);
  const heading = (text: string) => <div style={box({ fontSize: head, fontWeight: 600, color: K.gold, lineHeight: 1.25 })}>{text}</div>;
  const card: React.CSSProperties = { position: "absolute", top: a.y, width: cw, height: ch, padding: pad, justifyContent: "flex-start" };
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <Card an={s.apart} t={t} k={k} style={{ ...card, left: a.x }}>
        {heading(HW.apart)}
        <div style={box({ flexDirection: "column", flexGrow: 1, justifyContent: "center" })}>
          {parts.map((part, i) => {
            const p = look(s[`part${i}`], t).p;
            return (
              <div key={i} style={box({ flexDirection: "column", marginTop: i ? Math.round(22 * k) : 0 })}>
                <div style={box({ fontSize: fitSize(part, Math.round(50 * k), inner), color: K.white, lineHeight: 1.3 })}>{part}</div>
                {/* the dashed box is the most the plan pays for the item; the bar what it was billed */}
                <div style={box({ width: inner, height: barH, border: `3px dashed ${K.soft}`, borderRadius: Math.round(10 * k), padding: 4 })}>
                  <div style={box({ width: Math.round((inner - 14) * PART_FILL[i] * p), height: barH - 14, opacity: p > 0 ? 1 : 0, ...fill(K.gold, Math.round(8 * k)) })} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card an={s.lump} t={t} k={k} style={{ ...card, left: a.x + cw + gap }}>
        {heading(HW.lump)}
        <div style={box({ flexGrow: 1, justifyContent: "center", alignItems: "flex-end" })}>
          <div style={box({ width: lumpW, height: Math.round(lumpH * wl.p), opacity: wl.opacity, justifyContent: "center", alignItems: "center", ...fill(K.green, Math.round(14 * k)) })}>
            <div style={box({ fontSize: fitSize(show.whole, Math.round(52 * k), lumpW - 20), fontWeight: 600, color: K.plot ? K.green : K.white, background: K.plot ? S.plotPaper : "transparent", padding: `0 ${Math.round(10 * k)}px`, opacity: wl.p > 0.5 ? 1 : 0 })}>{show.whole}</div>
          </div>
        </div>
      </Card>
      <E an={s.foot} t={t} style={{ position: "absolute", left: a.x, width: a.w, top: a.y + ch + Math.round(18 * k), justifyContent: "center", fontSize: Math.round(36 * k), color: K.soft }}>{HW.splitFoot}</E>
    </>
  );
}

/** วงเงินต่อปีเติมหลอด: the year's limit a tube, filled to what was used, what is left beside it */
function limit(d: Dev, show: Show<"limit">) {
  const { c, t, s, g, w, k, a } = d;
  const { limit: most, used } = limitFigs(show);
  const tubeW = Math.round(Math.min(a.w * 0.22, a.h * 0.3));
  const tubeH = Math.round(Math.min(a.h * 0.92, 900 * k));
  const tx = a.x + Math.round(a.w * (c.size === "landscape" ? 0.2 : 0.08));
  const ty = a.y + Math.round((a.h - tubeH) / 2);
  const edge = Math.max(3, Math.round(5 * k));
  const inside = tubeH - edge * 2;
  // what was used, at least a sliver so it shows; never more than the tube. Nothing used: the tube stands empty
  const share = used === undefined ? 0 : most <= 0 ? 1 : Math.min(1, Math.max(0.04, used / most));
  const level = Math.round(inside * share * look(s.fill, t).p);
  const lx = tx + tubeW + Math.round(60 * k);
  const lw = a.x + a.w - lx;
  // ใช้ไป beside the top of what was used, below เหลืออีก and above the tube's foot
  const usedTop = Math.min(Math.max(ty + tubeH - edge - Math.round(inside * share) - Math.round(60 * k), ty + Math.round(440 * k)), ty + tubeH - Math.round(160 * k));
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <E an={s.tube} t={t} style={{ position: "absolute", left: tx, top: ty, width: tubeW, height: tubeH, borderRadius: tubeW, border: `${edge}px solid ${K.gold}`, background: K.tile, overflow: "hidden", flexDirection: "column", justifyContent: "flex-end" }}>
        {[0.25, 0.5, 0.75].map((f) => <div key={f} style={abs({ right: 0, top: Math.round(inside * f), width: Math.round(tubeW * 0.24), height: 0, borderTop: `3px solid ${K.dim}` })} />)}
        <div style={box({ width: tubeW - edge * 2, height: level, flexShrink: 0, background: K.plot ? hatch(K.gold) : K.gold, opacity: level > 0 ? 1 : 0 })} />
      </E>
      <E an={s.top} t={t} style={{ position: "absolute", left: lx, top: ty, width: lw, flexDirection: "column" }}>
        <Figure value={baht(most)} color={K.gold} k={k} room={lw} size={88} />
        <div style={box({ fontSize: Math.round(52 * k), fontWeight: 600, color: K.white, lineHeight: 1.3 })}>{HW.perYear}</div>
        <div style={box({ fontSize: Math.round(38 * k), color: K.soft, lineHeight: 1.3 })}>{show.planName}</div>
      </E>
      {used !== undefined ? (
        <>
          <E an={s.left} t={t} style={{ position: "absolute", left: lx, top: ty + Math.round(260 * k), width: lw, flexDirection: "column" }}>
            {used >= most ? <Figure value={HW.full} color={K.red} k={k} room={lw} size={68} /> : <Figure label={HW.left} value={baht(most - used)} color={K.green} k={k} room={lw} />}
          </E>
          <E an={s.used} t={t} style={{ position: "absolute", left: lx, top: usedTop, width: lw, flexDirection: "column" }}>
            <Figure label={HW.used} value={baht(countAt(used, look(s.count, t).p))} color={K.white} k={k} room={lw} size={64} />
          </E>
        </>
      ) : null}
    </>
  );
}

/** ค่าห้องต่อคืน: the bed on its tile, and a card of the room a night against what the plan pays; with no room typed, the plan's figure and a line */
function room(d: Dev, show: Show<"room">) {
  const { c, t, s, g, w, k, a } = d;
  const { plan, real } = roomFigs(show);
  const wide = c.size !== "portrait";
  const tile = Math.round(300 * k);
  // beside the tile (and the pen's shading set off behind it), or under it
  const cardW = wide ? a.w - tile - Math.max(6, Math.round(tile * 0.06)) - Math.round(110 * k) : a.w - Math.round(40 * k);
  const inner = cardW - Math.round(80 * k) - 6;
  const row = (an: Anim | undefined, label: string, value: string, color: string, size: number) => (
    <E an={an} t={t} style={{ width: inner, justifyContent: "space-between", alignItems: "center", marginTop: Math.round(18 * k) }}>
      <div style={box({ fontSize: Math.round(48 * k), color: K.white, flexShrink: 0 })}>{label}</div>
      <div style={box({ fontSize: Math.round(size * k), fontWeight: 600, color })}>{value}</div>
    </E>
  );
  const rule = <div style={box({ width: inner, height: 0, borderTop: `3px dashed ${K.tileLine}`, marginTop: Math.round(20 * k) })} />;
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <div style={abs({ left: a.x, top: a.y, width: a.w, height: a.h, flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center" })}>
        <E an={s.bed} t={t} style={{ margin: wide ? `0 ${Math.round(90 * k)}px 0 0` : `0 0 ${Math.round(60 * k)}px 0` }}>
          <Tile kind="bed" size={tile} />
        </E>
        <Card an={s.card} t={t} k={k} style={{ width: cardW, alignItems: "flex-start" }}>
          <div style={box({ fontSize: Math.round(38 * k), color: K.soft })}>{show.planName}</div>
          {real !== undefined ? (
            <div style={box({ flexDirection: "column" })}>
              {row(s.real, HW.realRoom, n(real), K.white, 68)}
              {row(s.plan, HW.planPays, n(plan), K.green, 68)}
              {rule}
              {/* a room within what the plan pays is paid: no difference to show, never a negative one */}
              {real > plan
                ? row(s.own, HW.ownNight, n(countAt(real - plan, look(s.count, t).p)), K.red, 84)
                : <E an={s.own} t={t} style={{ width: inner, justifyContent: "center", marginTop: Math.round(18 * k), fontSize: fitSize(HW.enough, Math.round(76 * k), inner), fontWeight: 600, color: K.green }}>{HW.enough}</E>}
              <div style={box({ width: inner, justifyContent: "flex-end", marginTop: Math.round(10 * k), fontSize: Math.round(30 * k), color: K.soft })}>{HW.example}</div>
            </div>
          ) : (
            <div style={box({ flexDirection: "column" })}>
              {row(s.plan, HW.planNight, n(plan), K.green, 76)}
              {rule}
              <E an={s.words} t={t} style={{ width: inner, justifyContent: "center", marginTop: Math.round(20 * k), fontSize: fitWords(HW.roomWords, Math.round(54 * k), inner), fontWeight: 600, color: K.white, lineHeight: 1.35, textAlign: "center" }}>{HW.roomWords}</E>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/** ส่วนต่างที่จ่ายเอง: the bill a bar, green up to the dashed limit and red above it, what each side pays beside it; a words card with no bill */
function overflow(d: Dev, show: Show<"overflow">) {
  const { c, t, s, g, w, k, a } = d;
  const bar = overflowBar(show);
  if (!bar) return wordsCard(d, s.card, [{ text: HW.choose, big: true }, { text: HW.chooseFoot }], show.title);
  const { bill, limit: cap } = bar;
  const barW = Math.round(Math.min(a.w * 0.22, 220 * k));
  const bx = a.x + (c.size === "landscape" ? Math.round(a.w * 0.12) : Math.round(30 * k));
  // room over the bar for the limit's word, when the limit is the top; under it for the foot
  const top = a.y + Math.round(64 * k);
  const barH = a.h - Math.round(80 * k) - Math.round(64 * k);
  const base = top + barH;
  const most = Math.max(bill, cap);
  const paidH = Math.round((barH * Math.min(bill, cap)) / most);
  const limitY = base - Math.round((barH * cap) / most);
  const overH = bill > cap ? limitY - top : 0;
  const pp = look(s.paid, t).p;
  const op = look(s.over, t).p;
  const lineEnd = bx + barW + Math.round(210 * k);
  const lx = lineEnd + Math.round(24 * k);
  const lw = a.x + a.w - lx;
  const part = (y: number, h: number, color: string) => <div style={abs({ left: bx, top: y, width: barW, height: h, opacity: h > 0 ? 1 : 0, ...fill(color, Math.round(12 * k)) })} />;
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      {part(base - Math.round(paidH * pp), Math.round(paidH * pp), K.green)}
      {overH ? part(limitY - Math.round(overH * op), Math.round(overH * op), K.red) : null}
      <E an={s.line} t={t} style={{ position: "absolute", left: bx - Math.round(30 * k), top: limitY - 3, width: lineEnd - bx + Math.round(30 * k), height: 0, borderTop: `${Math.max(4, Math.round(6 * k))}px dashed ${K.red}` }} />
      {/* the limit's word with its own figure, so the bill's figure beside it is never read as the limit */}
      <E an={s.line} t={t} style={{ position: "absolute", left: bx + barW + Math.round(16 * k), top: limitY - Math.round(104 * k), flexDirection: "column", color: K.red, lineHeight: 1.2 }}>
        <div style={box({ fontSize: Math.round(36 * k) })}>{HW.limit}</div>
        <div style={box({ fontSize: fitSize(n(cap), Math.round(42 * k), lineEnd - bx - barW - Math.round(24 * k)), fontWeight: 600 })}>{n(cap)}</div>
      </E>
      <div style={abs({ left: lx, top, width: lw, height: barH, flexDirection: "column", justifyContent: "center" })}>
        <E an={s.bill} t={t} style={{ flexDirection: "column" }}><Figure label={HW.bill} value={baht(bill)} color={K.gold} k={k} room={lw} /></E>
        <E an={s.insurer} t={t} style={{ flexDirection: "column", marginTop: Math.round(24 * k) }}><Figure label={HW.insurerPays} value={baht(Math.min(bill, cap))} color={K.green} k={k} room={lw} /></E>
        {/* a bill within the limit is paid: no part the customer pays, never a negative one */}
        <E an={s.own} t={t} style={{ flexDirection: "column", marginTop: Math.round(24 * k) }}>
          {bill > cap ? <Figure label={HW.own} value={baht(countAt(bill - cap, look(s.count, t).p))} color={K.red} k={k} room={lw} /> : <Figure value={HW.enough} color={K.green} k={k} room={lw} size={68} />}
        </E>
      </div>
      <E an={s.foot} t={t} style={{ position: "absolute", left: a.x, width: a.w, top: base + Math.round(20 * k), justifyContent: "center", fontSize: Math.round(40 * k), fontWeight: 600, color: K.soft }}>{`${HW.choose}${HW.chooseFoot}`}</E>
    </>
  );
}

/** ระยะรอคอย: a line from today, a dot where each cover starts (the day above, what it covers under), the plan's conditions on a card */
function waiting(d: Dev, show: Show<"waiting">) {
  const { c, t, s, g, w, k, a } = d;
  const rows = show.rows;
  if (!rows.length) return wordsCard(d, s.card, [{ text: HW.waitFoot, big: true }], show.title);
  const last = rows.length - 1;
  const col = Math.round(a.w / rows.length);
  const dot = Math.round(56 * k);
  const atSize = Math.min(...rows.map((x) => fitSize(x.at, Math.round(80 * k), col - 24)));
  const atH = Math.round(atSize * 1.4);
  const labelSize = Math.min(...rows.map((x) => fitWords(x.label, Math.round(56 * k), col - 24)));
  const ly = a.y + Math.round(a.h * (c.size === "portrait" ? 0.3 : 0.3));
  const x0 = a.x + Math.round(col / 2);
  const len = last * col;
  const lp = look(s.line, t).p;
  const dotColor = (i: number) => (i === 0 ? K.green : i === last ? K.red : K.gold);
  const cardY = c.size === "portrait" ? a.y + Math.round(a.h * 0.62) : ly + Math.round(dot / 2 + labelSize * 2.9);
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      {len > 0 ? <div style={abs({ left: x0, top: ly - Math.round(5 * k), width: Math.round(len * lp), height: Math.max(4, Math.round(10 * k)), background: K.gold, borderRadius: 6 })} /> : null}
      {rows.map((row, i) => (
        <E key={i} an={s[`row${i}`]} t={t} style={{ position: "absolute", left: a.x + i * col, top: ly - atH - Math.round(dot / 2), width: col, flexDirection: "column", alignItems: "center" }}>
          <div style={box({ height: atH, alignItems: "flex-end", fontSize: atSize, fontWeight: 600, lineHeight: 1.2, color: i === 0 ? K.green : K.gold })}>{row.at}</div>
          <div style={box({ width: dot, height: dot, borderRadius: dot, flexShrink: 0, background: K.plot ? S.plotPaper : dotColor(i), border: `${Math.max(4, Math.round(7 * k))}px solid ${dotColor(i)}` })} />
          <div style={box({ marginTop: Math.round(18 * k), width: col - 24, justifyContent: "center", fontSize: labelSize, fontWeight: 600, color: K.white, lineHeight: 1.3, textAlign: "center" })}>{row.label}</div>
        </E>
      ))}
      <div style={abs({ left: a.x, top: cardY, width: a.w, justifyContent: "center" })}>
        <Card an={s.card} t={t} k={k} style={{ maxWidth: Math.round(a.w * 0.8) }}>
          <div style={box({ fontSize: fitWords(HW.waitFoot, Math.round(54 * k), Math.round(a.w * 0.8) - Math.round(80 * k)), fontWeight: 600, color: K.white, textAlign: "center" })}>{HW.waitFoot}</div>
        </Card>
      </div>
    </>
  );
}

/** เคลมไม่ต้องสำรองจ่าย: the network hospital, the card handed over, a green tick, รพ. ในเครือ and the show's note */
function cashless(d: Dev, show: Show<"cashless">) {
  const { t, s, g, w, k, a } = d;
  const portrait = !g.row && a.h > a.w;
  const hs = Math.round(300 * k);
  const cs = Math.round(200 * k);
  const tick = Math.round(170 * k);
  const side = portrait ? a.w : Math.round(a.w * 0.5);
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      <div style={abs({ left: a.x, top: a.y, width: a.w, height: a.h, flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center" })}>
        <div style={box({ position: "relative", width: hs + Math.round(cs * 0.75), height: hs + Math.round(cs * 0.35), flexShrink: 0, margin: portrait ? `0 0 ${Math.round(60 * k)}px 0` : `0 ${Math.round(70 * k)}px 0 0` })}>
          <E an={s.hosp} t={t} style={{ position: "absolute", left: 0, top: 0 }}><Tile kind="hospital" size={hs} /></E>
          <E an={s.card} t={t} style={{ position: "absolute", left: Math.round(hs * 0.78), top: Math.round(hs * 0.48), transform: "rotate(-8deg)" }}><Tile kind="badge" size={cs} bg={K.gold} color={K.ground} /></E>
        </div>
        <div style={box({ flexDirection: "column", alignItems: "center", width: side })}>
          <E an={s.tick} t={t} style={{ width: tick, height: tick, borderRadius: tick, alignItems: "center", justifyContent: "center", background: K.plot ? S.plotPaper : K.green, border: `${Math.max(4, Math.round(8 * k))}px solid ${K.green}` }}>
            <svg width={Math.round(tick * 0.62)} height={Math.round(tick * 0.62)} viewBox="0 0 100 100"><path d="M18 52 L40 73 L82 28" fill="none" stroke={K.plot ? K.green : K.white} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </E>
          <E an={s.word} t={t} style={{ marginTop: Math.round(30 * k), fontSize: fitSize(HW.network, Math.round(84 * k), side - 20), fontWeight: 600, color: K.gold }}>{HW.network}</E>
          <E an={s.note} t={t} style={{ marginTop: Math.round(12 * k), width: side - 20, justifyContent: "center", fontSize: fitWords(show.note, Math.round(48 * k), side - 20), color: K.soft, lineHeight: 1.35, textAlign: "center" }}>{show.note}</E>
        </div>
      </div>
    </>
  );
}

/** ประกันกลุ่มไม่พอ: the bill a long bar, what the group plan pays a short green one, what is still short on a card; words only without both */
function groupgap(d: Dev, show: Show<"groupgap">) {
  const { c, t, s, g, w, k, a } = d;
  const figs = groupBars(show);
  if (!figs) return wordsCard(d, s.card, [{ text: HW.groupMaybe, big: true }], show.title);
  const { bill, group } = figs;
  const wide = c.size === "landscape";
  const labelSize = Math.round(50 * k);
  const barH = Math.round(76 * k);
  const block = Math.round(labelSize * 1.35) + barH + Math.round(56 * k);
  const bars = wide ? { x: a.x, y: a.y + Math.round((a.h - block * 2) / 2), w: Math.round(a.w * 0.58) } : { x: a.x, y: a.y + (c.size === "portrait" ? Math.round(60 * k) : 0), w: a.w };
  const figW = Math.round(bars.w * 0.32);
  const track = bars.w - figW - Math.round(24 * k);
  const most = Math.max(bill, group);
  const card = wide ? { x: a.x + Math.round(a.w * 0.64), y: a.y, w: Math.round(a.w * 0.36), h: a.h } : { x: a.x, y: bars.y + block * 2, w: a.w, h: a.y + a.h - (bars.y + block * 2) };
  const inner = Math.round(card.w * (wide ? 1 : 0.7)) - Math.round(80 * k);
  const row = (i: number, label: string, value: number, color: string, an: string) => {
    const p = look(s[an], t).p;
    const len = Math.max(12, Math.round((track * value) / most));
    return (
      <div style={abs({ left: bars.x, top: bars.y + i * block, width: bars.w, flexDirection: "column" })}>
        <div style={box({ fontSize: labelSize, fontWeight: 600, color: K.white, lineHeight: 1.35 })}>{label}</div>
        <div style={box({ alignItems: "center" })}>
          <div style={box({ width: track, height: barH, flexShrink: 0 })}>
            <div style={box({ width: Math.round(len * p), height: barH, opacity: p > 0 ? 1 : 0, ...fill(color, Math.round(12 * k)) })} />
          </div>
          <E an={s[`${an}Fig`]} t={t} style={{ marginLeft: Math.round(24 * k), width: figW, fontSize: fitSize(n(value), Math.round(64 * k), figW), fontWeight: 600, color }}>{n(value)}</E>
        </div>
      </div>
    );
  };
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      {row(0, HW.realBill, bill, K.gold, "bill")}
      {row(1, HW.groupPays, group, K.green, "group")}
      <div style={abs({ left: card.x, top: card.y, width: card.w, height: card.h, alignItems: "center", justifyContent: "center" })}>
        <Card an={s.card} t={t} k={k} style={{ width: Math.round(card.w * (wide ? 1 : 0.7)) }}>
          {/* what the group plan pays covers the bill: nothing short, never a negative */}
          {bill > group ? (
            <div style={box({ flexDirection: "column", alignItems: "center" })}>
              <div style={box({ fontSize: Math.round(52 * k), fontWeight: 600, color: K.white, lineHeight: 1.3 })}>{HW.short}</div>
              <div style={box({ fontSize: fitSize(baht(bill - group), Math.round(88 * k), inner), fontWeight: 600, color: K.red, lineHeight: 1.25 })}>{baht(countAt(bill - group, look(s.count, t).p))}</div>
            </div>
          ) : <div style={box({ fontSize: fitSize(HW.groupEnough, Math.round(72 * k), inner), fontWeight: 600, color: K.green })}>{HW.groupEnough}</div>}
        </Card>
      </div>
    </>
  );
}

/** เบี้ยขึ้นตามอายุ: a bar of the year's premium at each age, rising, the last in red, where the figures come from under them */
function agecost(d: Dev, show: Show<"agecost">) {
  const { c, t, s, g, w, k, a } = d;
  // one age is no rise to show: the title on a card (the episode should not build one; this is its guard)
  if (show.rows.length < 2) return wordsCard(d, s.card, [{ text: show.title[0], big: true }, ...(show.title[1] ? [{ text: show.title[1] }] : [])]);
  const rows = ageRows(show);
  const last = rows.length - 1;
  const chart = c.size === "landscape" ? { x: a.x + Math.round(120 * k), w: a.w - Math.round(240 * k) } : { x: a.x + Math.round(20 * k), w: a.w - Math.round(40 * k) };
  const slot = Math.round(chart.w / rows.length);
  const barW = Math.min(Math.round(slot * 0.6), Math.round(170 * k));
  const figSize = Math.min(...rows.map((x) => fitSize(n(x.annual), Math.round(50 * k), slot - 12)));
  const labels = rows.map((x) => `${x.age} ${HW.years}`);
  const labelSize = Math.min(...labels.map((x) => fitSize(x, Math.round(52 * k), slot - 12)));
  const sourceSize = fitWords(show.source, Math.round(36 * k), a.w - 40);
  const base = a.y + a.h - Math.round(labelSize * 1.6) - Math.round(sourceSize * 3.2);
  const room = base - (a.y + Math.round(figSize * 1.6));
  const most = Math.max(1, ...rows.map((x) => x.annual));
  return (
    <>
      <Title text={show.title} an={s.title} t={t} w={w} g={g} />
      {rows.map((row, i) => {
        const p = look(s[`bar${i}`], t).p;
        const h = Math.max(8, Math.round((room * row.annual) / most));
        const color = i === last ? K.red : K.gold;
        return (
          <div key={i} style={abs({ left: chart.x + i * slot, top: base - Math.round(h * p) - Math.round(figSize * 1.4), width: slot, flexDirection: "column", alignItems: "center" })}>
            <div style={box({ height: Math.round(figSize * 1.4), alignItems: "flex-end", fontSize: figSize, fontWeight: 600, color: i === last ? K.red : K.white, opacity: p > 0.6 ? 1 : 0 })}>{n(row.annual)}</div>
            <div style={box({ width: barW, height: Math.round(h * p), opacity: p > 0 ? 1 : 0, ...fill(color, `${Math.round(14 * k)}px ${Math.round(14 * k)}px 0 0`), ...(K.plot ? { borderBottom: "none" } : {}) })} />
          </div>
        );
      })}
      <div style={abs({ left: chart.x - Math.round(20 * k), top: base - 2, width: chart.w + Math.round(40 * k), height: Math.max(3, Math.round(5 * k)), background: K.gold, borderRadius: 3 })} />
      {labels.map((label, i) => (
        <div key={i} style={abs({ left: chart.x + i * slot, top: base + Math.round(labelSize * 0.25), width: slot, justifyContent: "center", fontSize: labelSize, fontWeight: 600, color: i === last ? K.red : K.white })}>{label}</div>
      ))}
      <E an={s.source} t={t} style={{ position: "absolute", left: a.x + 20, width: a.w - 40, top: base + Math.round(labelSize * 1.7), justifyContent: "center", fontSize: sourceSize, color: K.soft, lineHeight: 1.35, textAlign: "center" }}>{show.source}</E>
    </>
  );
}
