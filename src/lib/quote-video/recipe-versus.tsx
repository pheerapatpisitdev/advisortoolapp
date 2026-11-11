import type { CSSProperties, ReactNode } from "react";
import { contactBlock, enter, fitSize, footLine, type RecipeClip } from "./recipe-blocks";

/**
 * The `versus` clip, เทียบให้เห็น (owner, 2026-11-11, mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88,
 * ก ก ก): an off-white sheet in IBM Plex Sans Thai, navy and blue with one orange pill. Two halves
 * set what is paid against what comes back, two bars show it, the difference stands alone and the
 * agent closes. Sizes are the mockup's container-query widths (1cqw = 1% of the clip width); cues
 * are its `--d` seconds. Every figure comes from the clip's facts.
 *
 * The bars are drawn to true scale (owner's mockup note: the gap is thin when the two sums are close,
 * so scene 3 states the difference in words and figures instead of stretching the bars). Plex is
 * loaded at 400 and 600 only; the mockup's 500 and 700 are drawn as 400 and 600.
 */

const SHEET = "#fbfaf7";
const INK = "#1b2a4a";
const BLUE = "#1e56d6";
const GREY = "#c9d2e3";
const PALE = "#e9edf5";
const PILL = "#ff5a3c";
const FACE = "Plex";

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function versusFrame(c: RecipeClip, index: number, t: number, _T: number, w: number, h: number): ReactNode {
  const u = w / 1080;
  const cq = (n: number) => Math.round((n * w) / 100);
  const { facts, figures } = c;
  const { paid, cash, diff } = figures;
  // a clip without its three sums would draw an empty figure: refuse rather than render it
  if (paid === undefined || cash === undefined || diff === undefined || !facts.totalPaid || !facts.breakEven) throw new Error("versus recipe does not fit");
  const be = facts.breakEven;
  const pad = cq(9);
  const room = w - pad * 2;

  const piece = (kind: Parameters<typeof enter>[0], cue: number, style: CSSProperties, children: ReactNode) => (
    <div style={{ display: "flex", ...style, ...enter(kind, t - cue, u) }}>{children}</div>
  );
  /** one-line text fitted to `at` px; `cap` is the mockup's size */
  const oneLine = (text: string, at: number, cap: number, style: CSSProperties) => ({ whiteSpace: "nowrap" as const, fontSize: fitSize(text, at, cap), ...style });

  let body: ReactNode;
  if (index === 0) {
    // two halves edge to edge (the mockup cancels the scene padding), each a column centred in its half
    const half = Math.round(w / 2);
    const inner = half - cq(6) * 2;
    const side = (bg: string, color: string, kind: "left" | "right", cue: number, cap: string, val: string) =>
      piece(kind, cue, { width: half, height: h, flexDirection: "column", justifyContent: "center", gap: cq(3), padding: cq(6), background: bg, color },
        <>
          <div style={{ display: "flex", fontWeight: 400, fontSize: cq(4.4), lineHeight: 1.3 }}>{cap}</div>
          <div style={{ display: "flex", whiteSpace: "nowrap", fontWeight: 600, fontSize: fitSize(val, inner, cq(7.4)), fontVariantNumeric: "tabular-nums" }}>{val}</div>
        </>);
    body = (
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: w, height: h }}>
        {side(PALE, INK, "left", 0, facts.payYears !== undefined ? `จ่ายรวม ${facts.payYears} ปี` : "จ่ายรวม", facts.totalPaid)}
        {side(BLUE, "#fff", "right", 0.25, `อายุ ${be.age} เวนคืนได้`, be.cash)}
      </div>
    );
  } else if (index === 1) {
    // title, then two bars on one baseline; the bar area is a fixed number of px so the heights are exact
    const titleText = "จ่ายไป กับ ได้คืน";
    const titleSize = fitSize(titleText, room, cq(9));
    const titleSlot = Math.round(titleSize * 1.15);
    const gap = cq(2);
    const colW = Math.floor((room - cq(5)) / 2);
    const valSlot = Math.round(cq(7.4) * 1.3);
    const capSlot = Math.round(cq(4.4) * 1.3);
    const vsH = h - pad * 2 - cq(8) - titleSlot - cq(4) - cq(12);
    const barArea = vsH - valSlot - capSlot - gap * 2;
    const top = Math.max(paid, cash);
    const column = (val: string, color: string, height: number, valCue: number, barCue: number, cap: string) => (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", width: colW, height: vsH, gap }}>
        {piece("fade", valCue, oneLine(val, colW, cq(7.4), { fontWeight: 600, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }), val)}
        {piece("grow", barCue, { width: colW, height: Number(height.toFixed(2)), background: color, borderRadius: `${cq(2)}px ${cq(2)}px 0 0` }, null)}
        <div style={{ display: "flex", whiteSpace: "nowrap", fontWeight: 400, fontSize: fitSize(cap, colW, cq(4.4)), lineHeight: 1.3 }}>{cap}</div>
      </div>
    );
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: cq(4), width: room }}>
        {piece("up", 0, { ...oneLine(titleText, room, cq(9), { fontWeight: 600, lineHeight: 1.15, marginTop: cq(8) }) }, titleText)}
        <div style={{ display: "flex", flexDirection: "row", gap: cq(5), alignItems: "flex-end", height: vsH }}>
          {column(facts.totalPaid, GREY, (barArea * paid) / top, 1, 0.2, "จ่ายรวม")}
          {column(be.cash, BLUE, (barArea * cash) / top, 1.2, 0.4, `เวนคืนอายุ ${be.age}`)}
        </div>
      </div>
    );
  } else if (index === 2) {
    const gain = `+${thousands(diff)}`;
    const cover = `${figures.early} ก่อนอายุ ${figures.splitAge}`;
    const coverSize = fitSize(cover, room, cq(7.4));
    const line = (text: string) => <div style={{ display: "flex", whiteSpace: "nowrap" }}>{text}</div>;
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: cq(4), width: room }}>
        {piece("up", 0, oneLine("ได้คืนมากกว่าที่จ่าย", room, cq(4.4), { fontWeight: 400, lineHeight: 1.3 }), "ได้คืนมากกว่าที่จ่าย")}
        {piece("pop", 0.2, oneLine(gain, room, cq(20), { fontWeight: 600, color: BLUE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }), gain)}
        {piece("left", 0.9, { fontWeight: 600, fontSize: cq(4.6), background: PILL, color: "#fff", padding: `${cq(1)}px ${cq(4)}px`, borderRadius: 99 }, "และระหว่างทาง")}
        {piece("up", 1.1, { flexDirection: "column", fontWeight: 600, fontSize: coverSize, lineHeight: 1.15 }, <>{line("มีความคุ้มครอง")}{line(cover)}</>)}
      </div>
    );
  } else {
    body = contactBlock(c, "ดูตัวเลขของคุณ", t, w, u, { family: FACE, weight: 600, color: INK, accent: INK, light: 400, enter: { kind: "up", name: 0.2, rest: 0.5 }, room, align: "left" });
  }

  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", background: SHEET, color: INK, fontFamily: FACE }}>
      {index === 0 ? (
        body
      ) : (
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: w, height: h, flexDirection: "column", justifyContent: index === 1 ? "flex-start" : "center", alignItems: "flex-start", padding: pad }}>{body}</div>
      )}
      {footLine(c, w, h, "rgba(27,42,74,0.6)")}
    </div>
  );
}
