import type { CSSProperties } from "react";
import type { CardChart } from "@/lib/quote-card";
import type { CardPalette } from "@/lib/card-theme";
import { highlighterUri } from "@/lib/highlighter";
import { figureShape } from "./chart-figures";

/**
 * The cash-value drawing, as the value table's picture carries it — above the table, the way
 * the sales page sets its chart over its table (owner, 2026-10-06: moved off the quote card).
 *
 * Kept beside the routes rather than in one of them, because a route module may export only
 * its handlers.
 */

/** Every band of the drawing, in pixels; the route adds `chartBlockHeight` to its canvas. */
const H = {
  /** the space above the hairline that opens the block */
  gap: 30,
  hairline: 1,
  afterHairline: 22,
  title: 40,
  /** the strip of colour keys under the drawing */
  legend: 46,
};

/** How tall the block is, so the canvas can be the sum of its bands. */
export function chartBlockHeight(chart: CardChart): number {
  return H.gap + H.hairline + H.afterHairline + H.title + chart.height + H.legend;
}

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** The break-even's label, with the highlighter stroke the value table marks the same year with. */
function Marked({ p, children }: { p: CardPalette; children: string }) {
  return (
    <div
      style={{
        display: "flex", padding: "2px 16px", marginLeft: -16, color: p.ink,
        backgroundImage: highlighterUri(p.highlighter), backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </div>
  );
}

/**
 * The contract as three lines. The drawing library takes SVG elements but silently drops an
 * <img> holding an SVG data URI, which is how the first attempt at this came out blank — so
 * the shapes are written out here rather than handed over as a picture.
 */
export function Chart({ chart, p }: { chart: CardChart; p: CardPalette }) {
  const { width: w, height: h } = chart;
  /** a label placed over the drawing; the SVG itself carries no text at all */
  const label = (style: CSSProperties) => ({
    position: "absolute" as const, display: "flex", fontSize: 22, color: p.mute, ...style,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, p.hair)} />
      <div style={spacer(H.afterHairline)} />
      {/* titled like the table under it, which it is read with */}
      <div style={{ ...band(H.title), fontSize: 25, color: p.accent }}>{chart.title}</div>
      <div style={{ display: "flex", position: "relative", width: w, height: h, flexShrink: 0 }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <line x1={86} y1={h - 44} x2={w - 14} y2={h - 44} stroke={p.rule} strokeWidth={2} />
          <line x1={86} y1={18} x2={86} y2={h - 44} stroke={p.rule} strokeWidth={2} />
          {chart.grid && (
            <line x1={86} y1={chart.grid.y} x2={w - 14} y2={chart.grid.y} stroke={p.rule} strokeWidth={2} />
          )}
          <polyline fill="none" stroke={p.line.cover} strokeWidth={4} strokeDasharray="10 7" points={chart.cover} />
          {chart.premium && (
            <polyline fill="none" stroke={p.line.premium} strokeWidth={4} points={chart.premium} />
          )}
          <polyline fill="none" stroke={p.line.cash} strokeWidth={5} points={chart.cash} />
          {/* standing on the line, under the break-even marker so the marker is never covered */}
          {chart.figures.map(figureShape)}
          {chart.breakEven && (
            // the highlighter's yellow, as the value table marks the same year; ringed in ink so
            // it still reads where it sits on top of the navy line
            <circle cx={chart.breakEven.x} cy={chart.breakEven.y} r={11} fill={p.highlighter} stroke={p.figure} strokeWidth={3} />
          )}
        </svg>
        <div style={label({ right: w - 78, top: 6, justifyContent: "flex-end" })}>{chart.topLabel}</div>
        {chart.grid && (
          <div style={label({ right: w - 78, top: chart.grid.y - 14, justifyContent: "flex-end" })}>
            {chart.grid.label}
          </div>
        )}
        <div style={label({ right: w - 78, top: h - 58, justifyContent: "flex-end" })}>0</div>
        {/* set smaller than the axis figures: there is one of these every ten years, and at
            the chart's own size they would otherwise crowd the line they belong to */}
        {chart.ticks.map((t) => (
          <div
            key={t.label}
            style={label({ left: t.x - 26, top: h - 28, width: 52, fontSize: 19, justifyContent: "center" })}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div style={{ ...band(H.legend), alignItems: "center" }}>
        {chart.legend.map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", marginRight: 34 }}>
            {/* the cover's key is broken into two, because the line it stands for is dashed */}
            {l.kind === "cover" ? (
              <div style={{ display: "flex", alignItems: "center", marginRight: 12 }}>
                <div style={{ display: "flex", width: 11, height: 5, background: p.line.cover }} />
                <div style={{ display: "flex", width: 4, height: 5 }} />
                <div style={{ display: "flex", width: 11, height: 5, background: p.line.cover }} />
              </div>
            ) : (
              <div style={{ display: "flex", width: 26, height: 5, background: p.line[l.kind], marginRight: 12 }} />
            )}
            <div style={{ display: "flex", fontSize: 23, color: p.mute }}>{l.label}</div>
          </div>
        ))}
        {chart.breakEven && (
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* a drawn dot rather than a bullet character — the Thai faces have no ● in them */}
            <div
              style={{
                // room for the marker, which reaches back 16px past the words it sits behind
                display: "flex", width: 16, height: 16, borderRadius: 8, marginRight: 26,
                background: p.highlighter, border: `2px solid ${p.figure}`,
              }}
            />
            <div style={{ display: "flex", fontSize: 23 }}><Marked p={p}>{chart.breakEven.label}</Marked></div>
          </div>
        )}
      </div>
    </div>
  );
}
