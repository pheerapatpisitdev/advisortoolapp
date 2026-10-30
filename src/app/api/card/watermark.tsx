/**
 * The study-only notice laid across the middle of every card picture (owner, 2026-10-30).
 *
 * A card travels as an image and arrives without the chat it was sent in, so the notice that the
 * figures are an illustration, not the policy, is drawn into it. Two lines, tilted, faint enough
 * that the figures under it still read. The type is sized from the card's width, so a 1000 px
 * card and a 1700 px one carry it at the same proportion (the owner chose 4.8% of the width).
 *
 * The web pages carry the same words, see src/components/sales/Watermark.tsx.
 */
export const WATERMARK_LINES = ["ข้อมูลเพื่อการศึกษาเท่านั้น", "ไม่ได้เป็นส่วนหนึ่งของกรมธรรม์"] as const;

export function Watermark({ width, color }: { width: number; color: string }) {
  return (
    <div
      style={{
        position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        transform: "rotate(-24deg)", opacity: 0.11, color,
        fontFamily: "Plex", fontWeight: 600, fontSize: Math.round(width * 0.048), lineHeight: 1.25,
      }}
    >
      {WATERMARK_LINES.map((line) => (
        <div key={line} style={{ display: "flex" }}>{line}</div>
      ))}
    </div>
  );
}
