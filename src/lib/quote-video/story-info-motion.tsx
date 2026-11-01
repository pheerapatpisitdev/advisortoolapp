import { QUOTE_VIDEO_COLORS, STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { StoryTopic } from "@/lib/story/topics";
import type React from "react";
import { abs, box, El, look, type Anim } from "./motion";
import type { KnowEpisode, KnowSceneKey, KnowShow, NoteLine } from "./story-knowledge";
import { kspec } from "./story-knowledge-motion";
import { infoIcon, type InfoIcon } from "./story-info-icons";
import { Contact, INFO_GROUND, type StoryContext } from "./story-motion";
import { SIZES, type VideoSize } from "./timeline";

/**
 * อินโฟกราฟิก (owner chose ข, 2026-11-01, mockup https://claude.ai/artifact/8PbjhVriyiYNiKv4y9X5yq): the
 * episodes of ความรู้ประกัน 1 นาที and ตอบข้อโต้แย้ง drawn as วิดีโอนำเสนอ Motion is — navy ground, gold
 * numbers and icons, the points coming in as tiles one by one, the one the voice is on ringed in gold.
 * Same words, same scenes, same beats (kspec) as the paper: only the drawing differs.
 */

const C = QUOTE_VIDEO_COLORS;
const GOLD = C.motionGold;
const SKY = C.motionSky;
const RED = C.motionRed;
const GREEN = C.motionGreen;
const WHITE = STORY_CLIP_COLORS.white;
const TILE = "rgba(255,255,255,0.08)";
const TILE_LINE = "rgba(255,255,255,0.2)";
const SOFT = "rgba(255,255,255,0.82)";

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

const OWN: Partial<Record<KnowShow["layout"], InfoIcon>> = { ask: "question", myth: "speech", fact: "shield", note: "doc", card: "doc", family: "family", gift: "gift" };

function iconOf(topic: StoryTopic, key: KnowSceneKey, show: KnowShow): InfoIcon | undefined {
  const named = ICONS[topic]?.[key];
  return typeof named === "string" ? named : OWN[show.layout];
}
const itemIcons = (topic: StoryTopic, key: KnowSceneKey): InfoIcon[] => {
  const named = ICONS[topic]?.[key];
  return Array.isArray(named) ? named : [];
};

/** a square tile with an icon in it */
function Tile({ kind, size, bg = SKY, color = WHITE, radius }: { kind: InfoIcon; size: number; bg?: string; color?: string; radius?: number }) {
  return (
    <div style={box({ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.24), background: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 })}>
      {infoIcon(kind, Math.round(size * 0.62), color)}
    </div>
  );
}

/** a pill with a word on it: the stamp of a belief or a fact */
const Chip = ({ text, bg, size }: { text: string; bg: string; size: number }) => (
  <div style={box({ background: bg, color: WHITE, borderRadius: 999, padding: `${Math.round(size * 0.22)}px ${Math.round(size * 0.8)}px`, fontSize: size, fontWeight: 600 })}>{text}</div>
);

/** a note's lines on the navy: small ones soft, big ones bold, a red or green one on its own pill */
function Lines({ lines, k, center = true }: { lines: NoteLine[]; k: number; center?: boolean }) {
  return (
    <div style={box({ flexDirection: "column", alignItems: center ? "center" : "flex-start", flexShrink: 1 })}>
      {lines.map((l, i) => {
        const gap = i ? Math.round(16 * k) : 0;
        if (!l.big) return <div key={i} style={box({ fontSize: Math.round(44 * k), color: SOFT, marginTop: gap, textAlign: center ? "center" : "left" })}>{l.text}</div>;
        if (!l.tone) return <div key={i} style={box({ fontSize: Math.round(64 * k), fontWeight: 600, color: WHITE, lineHeight: 1.25, marginTop: gap, textAlign: center ? "center" : "left" })}>{l.text}</div>;
        return <div key={i} style={box({ marginTop: gap + Math.round(4 * k) })}><Chip text={l.text} bg={l.tone === "red" ? RED : GREEN} size={Math.round(58 * k)} /></div>;
      })}
    </div>
  );
}

/** the scene's title: the first line gold and large, the second white under it */
function Title({ text, an, t, w, g }: { text: [string, string]; an?: Anim; t: number; w: number; g: (typeof GEO)[VideoSize] }) {
  return (
    <El an={an} t={t} style={{ position: "absolute", left: 40, width: w - 80, top: g.title, flexDirection: "column", alignItems: "center" }}>
      <div style={box({ fontSize: Math.round(104 * g.k), fontWeight: 600, color: GOLD, lineHeight: 1.15, textAlign: "center" })}>{text[0]}</div>
      {text[1] ? <div style={box({ fontSize: Math.round(56 * g.k), color: WHITE, marginTop: Math.round(8 * g.k), textAlign: "center" })}>{text[1]}</div> : null}
    </El>
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
  if (key === "storyContact") return <Contact c={c} t={t} />;
  const show = episode.scenes.find((s) => s.key === key)!.show;
  const s = kspec(show);
  const { w } = SIZES[c.size];
  const g = GEO[c.size];
  const k = g.k;
  const topic = c.input.topic as StoryTopic;
  const icon = iconOf(topic, key, show);
  const area: React.CSSProperties = { left: g.side, width: w - g.side * 2, top: g.top, height: g.bottom - g.top, flexDirection: "column", alignItems: "center", justifyContent: "center" };
  const hero = Math.round(340 * k);
  switch (show.layout) {
    case "ask":
      return (
        <>
          <Title text={show.title} an={s.title} t={t} w={w} g={g} />
          <div style={abs(area)}>
            <El an={s.face} t={t} style={{ position: "relative", width: hero, height: hero }}>
              <Tile kind={icon ?? "question"} size={hero} />
            </El>
            <El an={s.marks} t={t} style={{ position: "absolute", left: 0, top: 0, width: w - g.side * 2, height: g.bottom - g.top }}>
              {[[-0.42, -0.3, 120], [0.36, -0.36, 90], [0.4, 0.22, 70]].map(([dx, dy, size], i) => (
                <div key={i} style={abs({ left: Math.round((w - g.side * 2) / 2 + dx * hero * 1.6), top: Math.round((g.bottom - g.top) / 2 + dy * hero * 1.6), fontSize: Math.round(size * k), fontWeight: 600, color: GOLD })}>?</div>
              ))}
            </El>
          </div>
        </>
      );
    case "myth":
      return (
        <>
          <El an={s.stamp} t={t} style={{ position: "absolute", left: 0, width: w, top: g.title + Math.round(20 * k), justifyContent: "center" }}>
            <Chip text="ความเชื่อ" bg={RED} size={Math.round(54 * k)} />
          </El>
          <div style={abs({ ...area, flexDirection: g.row ? "row" : "column" })}>
            <El an={s.quote} t={t} style={{ flexDirection: "column", alignItems: "center" }}>
              {show.quote.map((q, i) => <div key={i} style={box({ fontSize: Math.round(112 * k), fontWeight: 600, color: WHITE, lineHeight: 1.2 })}>{q}</div>)}
            </El>
            <El an={s.face} t={t} style={{ margin: g.row ? `0 0 0 ${Math.round(70 * k)}px` : `${Math.round(70 * k)}px 0 0 0` }}>
              <Tile kind={icon ?? "speech"} size={Math.round(240 * k)} bg={RED} />
            </El>
          </div>
        </>
      );
    case "fact": {
      const strike = look(s.strike, t).p;
      return (
        <>
          <El an={s.stamp} t={t} style={{ position: "absolute", left: 0, width: w, top: g.title + Math.round(20 * k), justifyContent: "center" }}>
            <Chip text="ความจริง" bg={GREEN} size={Math.round(54 * k)} />
          </El>
          <div style={abs(area)}>
            <El an={s.crossed} t={t} style={{ position: "relative", fontSize: Math.round(80 * k), color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
              {show.crossed}
              <div style={abs({ left: 0, top: Math.round(80 * k * 0.62), width: `${Math.round(strike * 100)}%`, height: Math.max(4, Math.round(9 * k)), background: RED, borderRadius: 6 })} />
            </El>
            <El an={s.note} t={t} style={{ flexDirection: g.row ? "row" : "column", alignItems: "center", marginTop: Math.round(60 * k) }}>
              {icon ? <div style={box({ margin: g.row ? `0 ${Math.round(56 * k)}px 0 0` : `0 0 ${Math.round(44 * k)}px 0` })}><Tile kind={icon} size={Math.round(220 * k)} bg={GREEN} /></div> : null}
              <Lines lines={show.note} k={k} />
            </El>
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
              <El an={s.face} t={t} style={{}}><Tile kind="person" size={Math.round(230 * k)} /></El>
              <div style={box({ width: aw, height: Math.round(40 * k), alignItems: "center", margin: `0 ${Math.round(28 * k)}px` })}>
                <div style={box({ width: Math.round((aw - 30 * k) * arrow), height: Math.round(12 * k), background: GOLD, borderRadius: 6 })} />
                {arrow > 0.9 ? <div style={box({ width: 0, height: 0, borderTop: `${Math.round(20 * k)}px solid transparent`, borderBottom: `${Math.round(20 * k)}px solid transparent`, borderLeft: `${Math.round(30 * k)}px solid ${GOLD}` })} /> : null}
              </div>
              <El an={s.icon} t={t} style={{}}><Tile kind={show.dir === "out" ? "coins" : "shield"} size={Math.round(230 * k)} bg={GOLD} color={INFO_GROUND} /></El>
            </div>
            <El an={s.note} t={t} style={{ marginTop: Math.round(60 * k) }}><Lines lines={show.note} k={k} /></El>
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
              <El an={tileAn} t={t} style={{ position: "relative", margin: g.row ? `0 ${Math.round(70 * k)}px 0 0` : `0 0 ${Math.round(60 * k)}px 0` }}>
                <Tile kind={icon} size={g.row ? Math.round(300 * k) : Math.round(280 * k)} bg={dim ? RED : show.layout === "card" ? GOLD : SKY} color={show.layout === "card" ? INFO_GROUND : WHITE} />
              </El>
            ) : null}
            <El an={linesAn} t={t} style={{ background: TILE, border: `2px solid ${TILE_LINE}`, borderRadius: Math.round(36 * k), padding: `${Math.round(40 * k)}px ${Math.round(48 * k)}px`, maxWidth: g.row ? Math.round((w - g.side * 2) * 0.62) : w - g.side * 2 }}>
              <Lines lines={lines} k={k} />
            </El>
          </div>
        </>
      );
    }
    case "list": {
      const icons = itemIcons(topic, key);
      const shown = show.items.map((_, i) => t >= (s[`item${i}`]?.at ?? 0));
      const now = shown.lastIndexOf(true);
      const tileH = Math.round(150 * k);
      // what is left for the words in a tile: less its padding and border, the mark, the icon
      const room = (w - g.side * 2) - Math.round((60 + 8 + 70 + 30) * k) - (icons.length ? Math.round((22 + 110) * k) : 0);
      return (
        <>
          <Title text={show.title} an={s.title} t={t} w={w} g={g} />
          <El an={s.card} t={t} style={{ ...area, position: "absolute", justifyContent: "center", alignItems: "stretch" }}>
            {show.items.map((it, i) => {
              const p = itemParts(it, i, show.mark);
              const on = i === now;
              return (
                <El key={i} an={s[`item${i}`]} t={t} style={{ alignItems: "center", minHeight: tileH, marginTop: i ? Math.round(26 * k) : 0, background: on ? "rgba(255,210,63,0.12)" : TILE, border: `${Math.max(2, Math.round(4 * k))}px solid ${on ? GOLD : TILE_LINE}`, borderRadius: Math.round(30 * k), padding: `${Math.round(20 * k)}px ${Math.round(30 * k)}px` }}>
                  <div style={box({ width: Math.round(70 * k), justifyContent: "center", fontSize: Math.round(76 * k), fontWeight: 600, color: show.mark === "check" ? STORY_CLIP_COLORS.infoTick : show.mark === "cross" ? RED : GOLD, flexShrink: 0 })}>{p.badge}</div>
                  {icons[i] ? <div style={box({ marginLeft: Math.round(22 * k) })}><Tile kind={icons[i]} size={Math.round(110 * k)} bg={GOLD} color={INFO_GROUND} radius={Math.round(26 * k)} /></div> : null}
                  <div style={box({ flexDirection: "column", marginLeft: Math.round(30 * k), flexShrink: 1 })}>
                    <div style={box({ fontSize: fitSize(p.head, Math.round(58 * k), room), fontWeight: 600, color: WHITE, lineHeight: 1.25 })}>{p.head}</div>
                    {p.tail ? <div style={box({ fontSize: fitSize(p.tail, Math.round(44 * k), room), color: SOFT, lineHeight: 1.3 })}>{p.tail}</div> : null}
                  </div>
                </El>
              );
            })}
          </El>
        </>
      );
    }
    case "recap":
      return (
        <>
          <Title text={["จำง่าย ๆ", ""]} an={s.title} t={t} w={w} g={g} />
          <div style={abs(area)}>
            <El an={s.card} t={t} style={{ flexDirection: "column", alignItems: "center", background: WHITE, border: `${Math.round(8 * k)}px solid ${GOLD}`, borderRadius: Math.round(44 * k), padding: `${Math.round(56 * k)}px ${Math.round(60 * k)}px`, maxWidth: w - g.side * 2 }}>
              {show.lines.map((l, i) => (
                <div key={i} style={box({ fontSize: Math.round((l.big ? 80 : 48) * k), fontWeight: l.big ? 600 : 400, color: l.tone === "red" ? RED : l.tone === "green" ? GREEN : l.big ? INFO_GROUND : STORY_CLIP_COLORS.infoMute, lineHeight: 1.3, textAlign: "center" })}>{l.text}</div>
              ))}
            </El>
          </div>
        </>
      );
    case "bars": {
      const max = Math.max(...show.rows.map((x) => x.value));
      const track = (w - g.side * 2) - Math.round(250 * k);
      return (
        <>
          <El an={s.stamp} t={t} style={{ position: "absolute", left: 0, width: w, top: g.title + Math.round(20 * k), justifyContent: "center" }}>
            <Chip text="ความจริง" bg={GREEN} size={Math.round(54 * k)} />
          </El>
          <div style={abs({ ...area, alignItems: "stretch" })}>
            <El an={s.lead} t={t} style={{ flexDirection: "column", alignItems: "center", marginBottom: Math.round(60 * k) }}>
              <div style={box({ fontSize: Math.round(88 * k), fontWeight: 600, color: GOLD })}>{show.lead[0]}</div>
              <div style={box({ fontSize: Math.round(64 * k), fontWeight: 600, color: WHITE })}>{show.lead[1]}</div>
            </El>
            {show.rows.map((row, i) => {
              const p = look(s[`bar${i}`], t).p;
              return (
                <div key={i} style={box({ alignItems: "center", marginTop: i ? Math.round(30 * k) : 0 })}>
                  <div style={box({ width: Math.round(230 * k), fontSize: Math.round(48 * k), color: WHITE, flexShrink: 0 })}>{row.label}</div>
                  <div style={box({ alignItems: "center", width: track })}>
                    <div style={box({ width: Math.max(8, Math.round(track * 0.72 * (row.value / max) * p)), height: Math.round(70 * k), background: i === show.rows.length - 1 ? RED : GOLD, borderRadius: Math.round(16 * k) })} />
                    <div style={box({ marginLeft: Math.round(20 * k), fontSize: Math.round(52 * k), fontWeight: 600, color: WHITE, opacity: p > 0.6 ? 1 : 0 })}>{row.text}</div>
                  </div>
                </div>
              );
            })}
            <El an={s.source} t={t} style={{ justifyContent: "center", marginTop: Math.round(40 * k), fontSize: Math.round(32 * k), color: SOFT }}>{show.source}</El>
          </div>
        </>
      );
    }
    default:
      // the shelves that tell a family's story (kin, timeline, pic) are not offered in this look
      return null;
  }
}
