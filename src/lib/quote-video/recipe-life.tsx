import type { CSSProperties, ReactNode } from "react";
import { RECIPE_COLORS } from "@/lib/card-theme";
import { bezier, contactBlock, enter, fitSize, footLine, type RecipeClip } from "./recipe-blocks";

/**
 * The `life` clip, เส้นชีวิต (owner, 2026-11-11, mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88,
 * ก ก ก): deep green ground, cream Trirong type and a gold rail down the left that keeps filling as
 * the ages pass. The rail is the one thing drawn from the clip's own time T, so it can travel across
 * a scene join; everything else is scene time t. Sizes are the mockup's container-query widths
 * (1cqw = 1% of the clip width); cues are its `--d` seconds. Every figure comes from the clip's facts.
 */

const { ground: GROUND, ink: INK, gold: GOLD } = RECIPE_COLORS.life;
const FACE = "Trirong";

/** where the rail's gold stands at the start of each scene, in % of the clip height */
const RAIL = [8, 34, 52, 78, 100];
const RAIL_TRAVEL = 1.2;
const RAIL_EASE = bezier(0.3, 0.8, 0.2, 1);

/** the rail fill in % of height at clip time T: it eases to the scene's stop over the scene's first 1.2 s, so it never jumps at a join */
export function railFill(scenes: { start: number }[], T: number): number {
  let i = 0;
  scenes.forEach((s, k) => { if (T >= s.start) i = k; });
  const to = RAIL[Math.min(i, RAIL.length - 1)];
  if (i === 0) return to;
  const from = RAIL[Math.min(i - 1, RAIL.length - 1)];
  const p = RAIL_EASE(Math.min(1, Math.max(0, (T - scenes[i].start) / RAIL_TRAVEL)));
  return from + (to - from) * p;
}

export function lifeFrame(c: RecipeClip, index: number, t: number, T: number, w: number, h: number): ReactNode {
  const u = w / 1080;
  const cq = (n: number) => Math.round((n * w) / 100);
  const { facts, figures } = c;
  // the column the words sit in: the rail takes the left 20 % (the mockup's padding-left)
  const room = w - cq(20) - cq(9);

  const piece = (kind: Parameters<typeof enter>[0], cue: number, style: CSSProperties, children: ReactNode) => (
    <div style={{ display: "flex", ...style, ...enter(kind, t - cue, u) }}>{children}</div>
  );
  const age: CSSProperties = { fontWeight: 600, fontSize: cq(6), color: GOLD, letterSpacing: "0.04em" };
  const txt: CSSProperties = { flexDirection: "column", fontWeight: 400, fontSize: cq(6.2), lineHeight: 1.35 };
  const amount = (text: string, cue: number) =>
    piece("up", cue, { whiteSpace: "nowrap", fontWeight: 700, fontSize: fitSize(text, room, cq(11)), color: GOLD, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }, text);
  const year = (n: string | number) =>
    piece("up", 0.15, { whiteSpace: "nowrap", fontWeight: 700, fontSize: fitSize(String(n), room, cq(30)), lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }, String(n));
  const line = (a: string, b?: string) => <><div style={{ display: "flex" }}>{a}</div>{b ? <div style={{ display: "flex" }}>{b}</div> : null}</>;

  let body: ReactNode;
  if (index === 0) {
    body = (
      <>
        {piece("fade", 0, age, "วันนี้ · อายุ")}
        {year(facts.age)}
        {piece("up", 0.6, txt, "เริ่มออมปีละ")}
        {amount(`${figures.yearly} บาท`, 0.8)}
      </>
    );
  } else if (index === 1) {
    body = (
      <>
        {piece("fade", 0, age, `อีก ${facts.payYears ?? ""} ปี · อายุ`)}
        {year(facts.lastPayAge ?? "")}
        {piece("up", 0.6, txt, line("จ่ายครบ หยุดจ่าย", "ความคุ้มครองยังอยู่"))}
      </>
    );
  } else if (index === 2) {
    body = (
      <>
        {piece("fade", 0, age, "ตลอดช่วงก่อนอายุ")}
        {year(figures.splitAge)}
        {piece("up", 0.6, txt, "หากจากไป ครอบครัวได้รับ")}
        {amount(figures.early, 0.8)}
      </>
    );
  } else if (index === 3) {
    body = (
      <>
        {piece("fade", 0, age, `จาก ${figures.splitAge} ยาวถึงอายุ`)}
        {year(facts.coverToAge ?? "")}
        {piece("up", 0.6, txt, "ยังคุ้มครองต่อ")}
        {amount(figures.late, 0.8)}
      </>
    );
  } else {
    body = contactBlock(c, "วางเส้นชีวิตของคุณ", t, w, u, { family: FACE, weight: 700, color: INK, accent: GOLD, light: 400, enter: { kind: "up", name: 0.2, rest: 0.5 }, room, align: "left" });
  }

  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", background: GROUND, color: INK, fontFamily: FACE }}>
      <div style={{ display: "flex", position: "absolute", left: cq(11), top: 0, width: cq(0.8), height: h, background: RECIPE_COLORS.life.track }}>
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: "100%", height: `${railFill(c.scenes, T).toFixed(3)}%`, background: GOLD }} />
      </div>
      <div style={{ display: "flex", position: "absolute", left: cq(8.4), top: Math.round(h * 0.47), width: cq(6), height: cq(6), borderRadius: "50%", background: GOLD, boxShadow: `0 0 0 ${cq(2)}px ${RECIPE_COLORS.life.halo}` }} />
      {/* every scene, the closing card too, stands in the column right of the rail (the mockup's padding-left 20cqw) */}
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: w, height: h, flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: cq(3), paddingLeft: cq(20), paddingRight: cq(9) }}>{body}</div>
      {footLine(c, w, h, RECIPE_COLORS.life.foot)}
    </div>
  );
}
