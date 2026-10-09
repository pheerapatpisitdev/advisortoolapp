import { FACE_THEME, FIGURE_COLORS } from "@/lib/card-theme";

/**
 * A cartoon face in a round badge, set before who the card is for: a man in blue, a woman in
 * pink (owner, 2026-10-09).
 *
 * Drawn as SVG shapes in a 100-unit square, for the reason chart-figures.tsx gives — the
 * drawing library drops an <img> holding an SVG data URI — and as a plain function returning
 * <g>s, since it neither calls a component nor reads a fragment inside an <svg>.
 */
export function insuredFace(sex: "M" | "F", size: number) {
  const t = FACE_THEME[sex];
  const { skin, hair, blush } = FIGURE_COLORS;
  const woman = sex === "F";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx={50} cy={50} r={47} fill={t.ground} stroke={t.ring} strokeWidth={3} />
      {/* long hair falls behind the face and shoulders */}
      {woman && <path d="M27,46 C25,18 75,18 73,46 L75,72 C66,77 34,77 25,72 Z" fill={hair} />}
      {/* the shoulders, in the badge's colour, kept inside its circle */}
      <path d="M22,88 C27,72 73,72 78,88 A47,47 0 0 1 22,88 Z" fill={t.ring} />
      <rect x={44} y={60} width={12} height={12} rx={4} fill={skin} />
      <circle cx={30} cy={47} r={4.5} fill={skin} />
      <circle cx={70} cy={47} r={4.5} fill={skin} />
      <circle cx={50} cy={45} r={20} fill={skin} />
      {woman
        ? <path d="M28,48 C23,12 77,12 72,48 C66,38 56,34 47,38 C39,40 33,43 28,48 Z" fill={hair} />
        : <path d="M28,46 C23,12 77,12 72,46 C69,37 62,34 55,35 C50,32 40,32 34,37 C31,40 29,43 28,46 Z" fill={hair} />}
      {/* a bow on her hair, in her colour */}
      {woman && (
        <g>
          <path d="M66,21 L77,15 L77,28 Z" fill={t.ring} />
          <path d="M66,21 L55,15 L55,28 Z" fill={t.ring} />
          <circle cx={66} cy={21} r={3.2} fill={t.ground} stroke={t.ring} strokeWidth={1.5} />
        </g>
      )}
      <circle cx={43} cy={47} r={2.4} fill={hair} />
      <circle cx={57} cy={47} r={2.4} fill={hair} />
      <circle cx={37.5} cy={53} r={3.2} fill={blush} opacity={0.55} />
      <circle cx={62.5} cy={53} r={3.2} fill={blush} opacity={0.55} />
      <path d="M44,54 q6,5 12,0" fill="none" stroke={hair} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
