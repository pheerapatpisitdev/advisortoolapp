import type { CSSProperties, ReactNode } from "react";
import { RECIPE_COLORS } from "@/lib/card-theme";
import { contactBlock, counted, enter, fitSize, footLine, type RecipeClip } from "./recipe-blocks";

/**
 * The `ask` clip, เปิดด้วยคำถาม (owner, 2026-11-11, mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88,
 * ก ก ก): a yellow poster in heavy Kanit that opens on a question, lands the sum the family gets,
 * trades it for three plain rows and ends on the agent. The 2nd and 4th scenes swap ground and ink.
 * Sizes are the mockup's container-query widths (1cqw = 1% of the clip width); cues are its `--d`
 * seconds. Every figure comes from the clip's facts.
 */

const { yellow: YELLOW, ink: INK, mark: MARK } = RECIPE_COLORS.ask;
const FACE = "Kanit";

/** one scene at scene time t; T (the clip's own time) is not used: every scene here stands alone */
export function askFrame(c: RecipeClip, index: number, t: number, _T: number, w: number, h: number): ReactNode {
  const u = w / 1080;
  const cq = (n: number) => Math.round((n * w) / 100);
  const inverted = index === 1 || index === 3;
  const ground = inverted ? INK : YELLOW;
  const ink = inverted ? YELLOW : INK;
  const room = w - cq(9) * 2;
  const { facts, figures } = c;

  const piece = (kind: Parameters<typeof enter>[0], cue: number, style: CSSProperties, children: ReactNode, key?: string) => (
    <div key={key} style={{ display: "flex", ...style, ...enter(kind, t - cue, u) }}>{children}</div>
  );
  const big: CSSProperties = { flexDirection: "column", fontWeight: 900, fontSize: cq(13.5), lineHeight: 1.08 };
  const sub: CSSProperties = { fontWeight: 500, fontSize: cq(5.6), lineHeight: 1.3 };

  let body: ReactNode;
  if (index === 0) {
    body = (
      <>
        {/* the tag leans, so the lean sits on an inner box and the entrance moves the outer one */}
        {piece("pop", 0, { alignSelf: "flex-start" },
          <div style={{ display: "flex", background: INK, color: YELLOW, fontWeight: 800, fontSize: cq(5), padding: `${cq(1)}px ${cq(4)}px`, transform: "rotate(-3deg)" }}>ถามจริง</div>)}
        {piece("slam", 0.25, big, <><div style={{ display: "flex" }}>ถ้าพรุ่งนี้</div><div style={{ display: "flex" }}>ไม่มีคุณ</div></>)}
        {/* the red reaches up past its box (a shadow, so nothing moves): Kanit 900's ่ over ที่ stands above the line (first real still, 2026-11-12) */}
        {piece("wipe", 0.9, big,
          <>
            <div style={{ display: "flex" }}>
              <span style={{ display: "flex", background: MARK, color: RECIPE_COLORS.ask.onMark, padding: `0 ${cq(2)}px`, boxShadow: `0 -${cq(1.6)}px 0 ${MARK}` }}>ที่บ้าน</span>อยู่ได้
            </div>
            <div style={{ display: "flex" }}>กี่เดือน?</div>
          </>)}
      </>
    );
  } else if (index === 1) {
    // sized from the settled figure, so the count-up never changes the size
    const settled = counted(facts.lead.baht, 99);
    body = (
      <>
        {piece("up", 0, sub, "มีแผนนี้ ครอบครัวได้รับ")}
        {piece("slam", 0.2, { whiteSpace: "nowrap", fontWeight: 900, fontSize: fitSize(settled, room, cq(19)), lineHeight: 1, fontVariantNumeric: "tabular-nums" }, counted(facts.lead.baht, t - 0.2))}
        {piece("up", 0.9, sub, `บาท หากจากไปก่อนอายุ ${figures.splitAge}`)}
      </>
    );
  } else if (index === 2) {
    const rows: [string | number, string, string][] = [
      [facts.perDayAmount ?? "", "บาทต่อวัน", `ปีละ ${figures.yearly}`],
      [facts.payYears ?? "", "ปี จ่ายจบ", `ตอนอายุ ${facts.lastPayAge ?? ""}`],
      [facts.coverToAge ?? "", "คุ้มครองยาว", `ถึงอายุ ${facts.coverToAge ?? ""}`],
    ];
    body = (
      <>
        {piece("left", 0, { fontWeight: 900, fontSize: cq(10), lineHeight: 1.08 }, "แลกกับ")}
        {rows.map(([n, a, b], i) =>
          piece("right", 0.3 * (i + 1), { alignItems: "center", gap: cq(4), background: INK, color: RECIPE_COLORS.ask.rowInk, padding: `${cq(3.5)}px ${cq(4)}px`, borderRadius: cq(3), fontWeight: 500, fontSize: cq(5.2), lineHeight: 1.25 },
            <>
              <div style={{ display: "flex", color: YELLOW, fontWeight: 900, fontSize: cq(9), minWidth: cq(11), fontVariantNumeric: "tabular-nums" }}>{n}</div>
              <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex" }}>{a}</div><div style={{ display: "flex" }}>{b}</div></div>
            </>, a))}
      </>
    );
  } else {
    body = contactBlock(c, "ขอตัวเลขของคุณเอง", t, w, u, { family: FACE, weight: 800, color: ink, accent: ink, light: 500 });
  }

  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", background: ground, color: ink, fontFamily: FACE }}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: w, height: h, flexDirection: "column", justifyContent: "center", alignItems: index === 3 ? "center" : "stretch", gap: cq(4), padding: cq(9) }}>{body}</div>
      {footLine(c, w, h, inverted ? RECIPE_COLORS.ask.footOnInk : RECIPE_COLORS.ask.footOnYellow)}
    </div>
  );
}
