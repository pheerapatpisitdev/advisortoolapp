import { CARD_PALETTE, POSTER_THEMES, posterScrim } from "@/lib/card-theme";
import { INSURER_LINE } from "./output";
import { backgroundDataUri } from "./store";
import { SIZES, type Layout, type PosterDocument, type PosterSpec, type SizeId } from "./poster";
import { fitScale, fontSize, LINE_HEIGHT, logoAt, metrics, withBreaks, type Canvas, type Metrics } from "./poster-layout";
import { codeDrawsWords } from "./poster-text";
import { renderPng } from "./poster-png";
import { fitInBox, imageSize } from "./logo";

/**
 * A content piece's poster as PNG bytes — what /api/content-poster serves, and what is
 * uploaded when a piece is posted to a Page. One drawing for both, so the picture that goes up
 * is the one the owner looked at.
 */

const JUSTIFY: Record<Layout, "flex-start" | "center" | "flex-end"> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

/**
 * The poster's lines, one under another; `marked` draws the sub line on the highlighter.
 * Called as a function, not used as a component: satori takes an array of children, but not
 * one returned by a component, and lays a fragment out as a row of its own.
 */
function lines(spec: PosterSpec, m: Metrics, scale: number, marked = false) {
  const c = POSTER_THEMES[spec.theme];
  const ink = { badge: c.badgeInk, headline: c.headline, sub: c.sub, footer: c.footer } as const;
  return spec.blocks.map((b, i) => {
    const size = fontSize(b.kind, m, scale);
    const pill = b.kind === "badge" || (marked && b.kind === "sub");
    return (
      <div
        key={i}
        style={{
          // no display:flex on a line of text: a flex item cannot shrink below its
          // min-content, and a Thai sentence has no spaces, so it overflows to the right
          maxWidth: "100%",
          marginTop: i === 0 ? 0 : m.gap,
          fontSize: size,
          lineHeight: LINE_HEIGHT,
          fontWeight: b.kind === "headline" || (marked && b.kind === "sub") ? 600 : 400,
          color: marked && b.kind === "sub" ? CARD_PALETTE.ink : ink[b.kind],
          ...(c.textShadow && !pill ? { textShadow: c.textShadow } : {}),
          ...(pill
            ? {
                alignSelf: "flex-start",
                backgroundColor: b.kind === "badge" ? c.badgeBg : CARD_PALETTE.highlighter,
                borderRadius: b.kind === "badge" ? 999 : Math.round(size * 0.18),
                padding: `${Math.round(size * 0.3)}px ${Math.round(size * (b.kind === "badge" ? 0.8 : 0.45))}px`,
              }
            : {}),
        }}
      >
        {withBreaks(b.text)}
      </div>
    );
  });
}

/** The Page's logo in its spot, fitted into its box at its own shape (logo.ts). */
function Logo({ spec, canvas, uri }: { spec: PosterSpec; canvas: Canvas; uri: string | null }) {
  if (!spec.logo || !uri) return null;
  const at = logoAt(canvas, spec.logo.spot);
  // sized to the picture's own shape, so the box's edge is the logo's edge
  const { w, h } = fitInBox(imageSize(Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64")), at);
  return (
    <div style={{ position: "absolute", left: at.left, top: at.top, width: at.w, height: at.h, display: "flex", justifyContent: at.align, alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn by satori, not a page */}
      <img src={uri} alt="" width={w} height={h} style={{ width: w, height: h }} />
    </div>
  );
}

/** who insures it, small in the bottom margin, so a reshared picture still says */
function InsurerLine({ spec, canvas, m }: { spec: PosterSpec; canvas: Canvas; m: Metrics }) {
  const c = POSTER_THEMES[spec.theme];
  return (
    <div
      style={{
        position: "absolute",
        left: m.padX,
        // a story's bottom is under the reply bar, so the line sits higher there
        bottom: canvas.height / canvas.width > 1.5 ? Math.round(m.padBottom * 0.55) : Math.round(m.padX * 0.33),
        fontSize: Math.round(19 * m.k),
        lineHeight: 1.3,
        color: c.footer,
        opacity: 0.85,
        ...(c.textShadow ? { textShadow: c.textShadow } : {}),
      }}
    >
      {INSURER_LINE}
    </div>
  );
}

function Poster({ spec, canvas, photo, logo }: { spec: PosterSpec; canvas: Canvas; photo: string | null; logo: string | null }) {
  const c = POSTER_THEMES[spec.theme];
  // a square photograph drawn as "cover": a square as wide as the canvas's longer side, centred,
  // so 4:5 and 9:16 crop it rather than stretch it (Maryjane's coverSide)
  const cover = Math.max(canvas.width, canvas.height);
  // the words keep clear of the logo only when there is one to draw
  const m = metrics(canvas, logo ? spec.logo?.spot : null);
  const scale = fitScale(spec, canvas, Boolean(logo));
  const words = codeDrawsWords(spec, Boolean(photo));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: JUSTIFY[spec.layout],
        padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
        backgroundImage: photo ? `url(${photo})` : `linear-gradient(160deg, ${c.from}, ${c.to})`,
        ...(photo ? { backgroundSize: `${cover}px ${cover}px`, backgroundPosition: "center" } : {}),
        fontFamily: "Plex",
        position: "relative",
      }}
    >
      {/* the model drew the words into the picture (poster-text.ts): no wash, no second set of words */}
      {words && photo && c.scrim !== null && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: posterScrim(spec.theme, spec.layout) }} />
      )}
      {words && lines(spec, m, scale)}
      <InsurerLine spec={spec} canvas={canvas} m={m} />
      <Logo spec={spec} canvas={canvas} uri={logo} />
    </div>
  );
}

/** the words' share of a claim poster's height; the papers take the rest */
const WORDS_SHARE = 0.44;

/** Where a paper's card sits in the papers' area: its top-left corner and the paper's own size. */
export interface PaperBox { left: number; top: number; w: number; h: number }

/**
 * The papers laid out on a grid with a gap between them, never over one another (owner,
 * 2026-09-26: a fanned pile hid half of each paper and drew them small). Every grid from one
 * row to one column is tried, and the one whose smallest paper is largest wins — two
 * landscape papers on a square go side by side, a long claims-table screenshot goes above
 * the next. `frame` is the white border each card adds around its paper.
 */
export function paperGrid(ratios: number[], areaW: number, areaH: number, gap: number, frame: number): PaperBox[] {
  const n = ratios.length;
  let best: { boxes: PaperBox[]; least: number; total: number } | null = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (areaW - (cols - 1) * gap) / cols;
    const cellH = (areaH - (rows - 1) * gap) / rows;
    const sized = ratios.map((r) => {
      const w = Math.max(1, Math.round(Math.min(cellW - 2 * frame, (cellH - 2 * frame) * r)));
      return { w, h: Math.max(1, Math.round(w / r)) };
    });
    const boxes = sized.map(({ w, h }, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      // a short last row is centred under the full ones
      const rowLeft = (areaW - (inRow * cellW + (inRow - 1) * gap)) / 2;
      const cx = rowLeft + (i % cols) * (cellW + gap) + cellW / 2;
      const cy = row * (cellH + gap) + cellH / 2;
      return { left: Math.round(cx - w / 2 - frame), top: Math.round(cy - h / 2 - frame), w, h };
    });
    const areas = sized.map(({ w, h }) => w * h);
    const least = Math.min(...areas);
    const total = areas.reduce((a, b) => a + b, 0);
    if (!best || least > best.least || (least === best.least && total > best.total)) best = { boxes, least, total };
  }
  return best?.boxes ?? [];
}

/** the papers' share of the width when a person stands beside them */
const PAPERS_BESIDE_PERSON = 0.6;

/** a slight lean, alternating, so the cards read as paper; small enough not to touch a neighbour */
const TILT = [-1.5, 1.5, -1];

/**
 * รีวิวเคลม: the words at the top, the owner's stickered papers below them as a pile of white
 * cards, and the amount paid on the highlighter. Over the theme's colour, or over a drawn
 * photograph with the theme's wash where the words sit.
 */
function DocumentPoster({ spec, canvas, papers, photo, logo }: {
  spec: PosterSpec; canvas: Canvas; papers: { uri: string; doc: PosterDocument }[]; photo: string | null; logo: string | null;
}) {
  const c = POSTER_THEMES[spec.theme];
  const m = metrics(canvas, logo ? spec.logo?.spot : null);
  const room = canvas.height - m.padTop - m.padBottom;
  const wordsH = Math.round(room * WORDS_SHARE);
  // the words fitted to their share alone: a canvas whose usable height is that share (the
  // logo's margin is already out of `room`)
  const scale = fitScale(spec, { width: canvas.width, height: wordsH + 2 * m.padX }, false);
  const frame = Math.round(14 * m.k);
  // a person drawn into the photograph stands in its right third; the papers keep left of them
  const areaW = spec.personAside ? Math.round(m.usableWidth * PAPERS_BESIDE_PERSON) : m.usableWidth;
  const areaH = room - wordsH - m.gap;
  const shown = papers.slice(0, 3);
  const boxes = paperGrid(shown.map((p) => p.doc.ratio), areaW, areaH, Math.round(24 * m.k), frame);
  const cover = Math.max(canvas.width, canvas.height);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
        backgroundImage: photo ? `url(${photo})` : `linear-gradient(160deg, ${c.from}, ${c.to})`,
        ...(photo ? { backgroundSize: `${cover}px ${cover}px`, backgroundPosition: "center" } : {}),
        fontFamily: "Plex",
        position: "relative",
      }}
    >
      {photo && c.scrim !== null && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: posterScrim(spec.theme, "top") }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", height: wordsH }}>
        {lines(spec, m, scale, true)}
      </div>
      <div style={{ display: "flex", position: "relative", width: areaW, height: areaH, marginTop: m.gap }}>
        {shown.map((p, i) => {
          const { left, top, w, h } = boxes[i];
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left,
                top,
                display: "flex",
                padding: frame,
                backgroundColor: CARD_PALETTE.ground,
                borderRadius: Math.round(10 * m.k),
                boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
                transform: `rotate(${TILT[i]}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- drawn by satori, not a page */}
              <img src={p.uri} width={w} height={h} style={{ width: w, height: h }} alt="" />
            </div>
          );
        })}
      </div>
      <InsurerLine spec={spec} canvas={canvas} m={m} />
      <Logo spec={spec} canvas={canvas} uri={logo} />
    </div>
  );
}

/** The poster drawn at a size; a background that has gone missing draws the plain theme. */
export async function drawPoster(spec: PosterSpec, size: SizeId = "square"): Promise<Buffer> {
  const canvas = SIZES[size];
  const [photo, logo] = await Promise.all([
    spec.background ? backgroundDataUri(spec.background) : null,
    // a logo gone missing is left off, and the words take its margin back
    spec.logo ? backgroundDataUri(spec.logo.path) : null,
  ]);
  // a paper gone missing is left out; with none left, the plain poster, as for a missing background
  const papers = (await Promise.all((spec.documents ?? []).map(async (doc) => ({ doc, uri: await backgroundDataUri(doc.path) }))))
    .flatMap((p) => (p.uri ? [{ doc: p.doc, uri: p.uri }] : []));
  if (papers.length) return renderPng(<DocumentPoster spec={spec} canvas={canvas} papers={papers} photo={photo} logo={logo} />, canvas);
  return renderPng(<Poster spec={spec} canvas={canvas} photo={photo} logo={logo} />, canvas);
}
