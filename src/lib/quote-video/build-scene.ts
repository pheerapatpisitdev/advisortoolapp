/**
 * The little picture on a clip being made (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/4rXrAQzBQGT3GtBsQTbpZY, option จ): two stick-figure builders in hard hats put
 * up a house beside a tree that grows with the clip. The bar's share decides how far the work is:
 * bricks to 60% (the voice and files), then the roof, then the door and windows; at 100% the tree
 * flowers and fruits and the builders jump. `t` is seconds of the builders' own movement.
 *
 * SVG markup, drawn from numbers only (no words from anyone), for a 300 × 190 viewBox. Pure and browser-safe.
 */

const GROUND = 172;
const PILE = 34;
const NAVY = "#1b2235";
const HAT = "#f5b300";
const BLUE = "#2f63d8";
const BLUE2 = "#3f73e3";
const SKY = "#9fc0f5";
const ORANGE = "#ef7d22";
const LEAF = "#4f9d4a";
const WOOD = "#7a4a24";
const PINK = "#f07aa8";
const LIGHT = "#ffd34d";

type Arm = [number, number];
interface Pose { walk?: number; jump?: boolean; arms: [Arm, Arm]; hold?: (x: number, y: number) => string }

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const tri = (u: number) => 1 - Math.abs(1 - 2 * (((u % 1) + 1) % 1));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** a builder, feet at (x, GROUND - lift); each arm is where the hand is from the shoulder */
function man(x: number, lift: number, o: Pose): string {
  const y = GROUND - lift, hip = y - 14, sh = y - 28, hy = y - 35;
  const s = 5 * Math.sin(o.walk ?? 0);
  const legs = o.jump
    ? `M${r1(x)} ${r1(hip)}L${r1(x - 6)} ${r1(y - 4)}M${r1(x)} ${r1(hip)}L${r1(x + 6)} ${r1(y - 4)}`
    : `M${r1(x)} ${r1(hip)}L${r1(x + s)} ${r1(y)}M${r1(x)} ${r1(hip)}L${r1(x - s)} ${r1(y)}`;
  const [a, b] = o.arms;
  const body = `M${r1(x)} ${r1(hip)}L${r1(x)} ${r1(sh - 2)}M${r1(x)} ${r1(sh)}L${r1(x + a[0])} ${r1(sh + a[1])}M${r1(x)} ${r1(sh)}L${r1(x + b[0])} ${r1(sh + b[1])}`;
  return `<g stroke="${NAVY}" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="${legs}${body}"/><circle cx="${r1(x)}" cy="${r1(hy)}" r="5.5" fill="#fff"/></g>`
    + `<path d="M${r1(x - 7)} ${r1(hy - 2)}a7 6 0 0 1 14 0z" fill="${HAT}" stroke="${NAVY}" stroke-width="1.4"/>`
    + (o.hold ? o.hold(x + b[0], sh + b[1]) : "");
}

const cheer = (x: number, t: number, ph: number) => man(x, Math.abs(Math.sin(t * 5 + ph)) * 12, { jump: true, arms: [[-9, -12], [9, -12]] });
const hammer = (x: number, y: number) =>
  `<line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x - 7)}" y2="${r1(y - 6)}" stroke="${WOOD}" stroke-width="2.4" stroke-linecap="round"/>`
  + `<rect x="${r1(x - 12)}" y="${r1(y - 11)}" width="8" height="6" rx="1" fill="#6b7385" transform="rotate(-40 ${r1(x - 8)} ${r1(y - 8)})"/>`;

/** the wall's bricks, bottom row first, left to right: 7 across, 4 high */
const BW = 20, BH = 13, COLS = 7, ROWS = 4, X0 = 118, Y0 = GROUND - ROWS * BH;
const BRICKS = Array.from({ length: COLS * ROWS }, (_, k) => ({ x: X0 + (k % COLS) * BW, y: Y0 + (ROWS - 1 - Math.floor(k / COLS)) * BH }));

/** the tree beside the house: a sapling at the start, full grown by 98%, in flower and fruit when done */
function tree(pct: number, done: boolean, t: number): string {
  const g = clamp(pct / 98), x = 84, top = GROUND - 12 - 52 * g, r = 5 + 20 * g;
  let s = `<line x1="${x}" y1="${GROUND}" x2="${x}" y2="${r1(top + r * 0.6)}" stroke="${WOOD}" stroke-width="${r1(2 + 4 * g)}" stroke-linecap="round"/>`;
  for (const [dx, dy, k] of [[0, 0, 1], [-0.7, 0.35, 0.75], [0.7, 0.35, 0.75]]) s += `<circle cx="${r1(x + dx * r)}" cy="${r1(top + dy * r)}" r="${r1(r * k)}" fill="${LEAF}"/>`;
  if (done) {
    const bloom: [number, number, string][] = [[-10, -6, PINK], [8, -12, ORANGE], [12, 4, PINK], [-4, 8, ORANGE], [0, -16, PINK], [-14, 6, ORANGE]];
    bloom.forEach(([dx, dy, c], i) => { s += `<circle cx="${x + dx}" cy="${r1(top + dy + Math.sin(t * 3 + i) * 0.8)}" r="3" fill="${c}"/>`; });
  }
  for (let k = 0; k < 6; k++) { const gx = 20 + k * 48, h = r1(4 + 3 * g); s += `<path d="M${gx} ${GROUND}l3 -${h}l3 ${h}" stroke="${LEAF}" fill="none" stroke-width="1.6"/>`; }
  return s;
}

/**
 * The picture at `pct` percent (0–100), `t` seconds into the builders' movement. `uid` keeps its roof's
 * clip apart from other cards' on the same page (an SVG id is the whole page's).
 */
export function buildScene(pct: number, t: number, uid = "b"): string {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const n = BRICKS.length;
  const laid = Math.min(n, Math.floor(clamp(p / 60) * n + 1e-9));
  const finish = clamp((p - 60) / 30), done = p >= 100;
  // its own sky, so the card holds no colour of its own
  let s = `<defs><linearGradient id="sky-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf3ff"/><stop offset="1" stop-color="#f8fbff"/></linearGradient></defs><rect width="300" height="190" fill="url(#sky-${uid})"/>`;
  s += `<rect x="0" y="${GROUND}" width="300" height="20" fill="#eef1f5"/><line x1="0" y1="${GROUND}" x2="300" y2="${GROUND}" stroke="#c9cfd9" stroke-width="1.5"/>`;
  s += tree(p, done, t);
  // the pile of bricks by the path, smaller as they are laid
  const pile = done ? 0 : Math.max(1, Math.ceil((1 - laid / n) * 6));
  for (let k = 0; k < pile; k++) s += `<rect x="${PILE - 18 + (k % 3) * 12}" y="${GROUND - 9 - Math.floor(k / 3) * 9}" width="11" height="8" rx="1" fill="${BLUE}"/>`;
  for (let k = 0; k < laid; k++) s += `<rect x="${BRICKS[k].x}" y="${BRICKS[k].y}" width="${BW - 1.5}" height="${BH - 1.5}" rx="1.5" fill="${k % 2 ? BLUE : BLUE2}"/>`;

  // the roof rises from the wall, then the door and the windows go in
  const L = X0 - 8, R = X0 + COLS * BW + 8, apex = Y0 - 48;
  if (finish > 0) {
    const h = r1((Y0 - apex) * clamp(finish / 0.7));
    s += `<clipPath id="roof-${uid}"><rect x="0" y="${r1(Y0 - h)}" width="300" height="${h}"/></clipPath>`
      + `<path d="M${L} ${Y0}L${(L + R) / 2} ${apex}L${R} ${Y0}z" fill="${ORANGE}" stroke="#c4601a" stroke-width="1.5" clip-path="url(#roof-${uid})"/>`;
  }
  const fit = clamp((finish - 0.7) / 0.3);
  if (fit > 0) {
    const glass = done ? LIGHT : SKY;
    s += `<rect x="${X0 + 58}" y="${r1(GROUND - 34 * fit)}" width="22" height="${r1(34 * fit)}" fill="${WOOD}"/>`;
    for (const wx of [X0 + 14, X0 + 100]) s += `<rect x="${wx}" y="${Y0 + 10}" width="24" height="18" fill="${glass}" stroke="#fff" stroke-width="2" opacity="${r1(fit)}"/>`;
  }
  if (done) return s + cheer(46, t, 0) + cheer(276, t, 1.3);

  // one builder carries bricks (roof tiles once the wall is up) from the pile to the house and walks back
  const goal = laid < n ? Math.min(BRICKS[laid].x - 4, X0 - 14) : X0 - 14;
  const u = (t / 3.2) % 1, there = u < 0.5;
  const ax = PILE + 10 + (goal - PILE - 10) * tri(u);
  const load = laid < n ? BLUE : ORANGE;
  s += man(ax, 0, {
    walk: t * 9,
    arms: there ? [[-4, -12], [4, -12]] : [[-6, 10], [6, 10]],
    hold: (hx, hy) => (there ? `<rect x="${r1(hx - 12)}" y="${r1(hy - 8)}" width="16" height="10" rx="1.5" fill="${load}"/>` : ""),
  });
  // the other hammers at the wall
  const sw = Math.sin(t * 9);
  s += man(X0 + COLS * BW + 14, 0, { arms: [[-6, 8], [-8 - 3 * sw, -6 - 9 * sw]], hold: hammer });
  if (sw > 0.85) s += `<text x="${X0 + COLS * BW - 6}" y="${GROUND - 46}" font-size="9" font-weight="700" fill="${ORANGE}">ป๊อก!</text>`;
  return s;
}
