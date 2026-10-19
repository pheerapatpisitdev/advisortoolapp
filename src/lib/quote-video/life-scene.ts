/**
 * The second picture on a clip being made (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/Gv6qeAs74uQGqHKRMfFSDw, แบบ 2): one life in ten events as the bar fills —
 * เกิด, เป็นเด็ก, วัยเรียน, ทำงาน, แต่งงาน, มีลูก, เกษียณ, ชรา, อยู่คนเดียว, จากไป — each in its own place,
 * the old place fading under the new. The people grow and age between events; the label names the
 * event and the age; ten dots show how far along it is. The bar waits at 98% for the render, and the
 * picture stays on จากไป until the clip is done (owner).
 *
 * SVG markup, drawn from numbers only (no words from anyone), for a 300 × 190 viewBox. Pure and browser-safe.
 */

const GROUND = 150;
const END = 98;
const NAVY = "#1b2235";
const BLUE = "#2f63d8";
const ORANGE = "#ef7d22";
const GOLD = "#f5b300";
const PINK = "#f07aa8";
const WOOD = "#7a4a24";
const LEAF = "#4f9d4a";
const RED = "#e8476b";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const along = (keys: [number, number][], v: number) => {
  for (let i = 1; i < keys.length; i++) {
    if (v <= keys[i][0]) { const [x0, y0] = keys[i - 1], [x1, y1] = keys[i]; return lerp(y0, y1, clamp((v - x0) / (x1 - x0))); }
  }
  return keys[keys.length - 1][1];
};
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; };

/** the ten events: where each starts on the bar, its name, the age from → to */
export const LIFE_EVENTS: { from: number; label: string; age: [number, number] }[] = [
  { from: 0, label: "เกิด", age: [0, 0] },
  { from: 8, label: "เป็นเด็ก", age: [3, 9] },
  { from: 18, label: "วัยเรียน", age: [10, 21] },
  { from: 28, label: "ทำงาน", age: [22, 28] },
  { from: 38, label: "แต่งงาน", age: [29, 31] },
  { from: 48, label: "มีลูก", age: [32, 45] },
  { from: 60, label: "เกษียณ", age: [60, 64] },
  { from: 70, label: "ชรา", age: [68, 78] },
  { from: 80, label: "อยู่คนเดียว", age: [80, 85] },
  { from: 90, label: "จากไป", age: [86, 86] },
];

/* ---------- people ---------- */

const HEIGHT: [number, number][] = [[0, 22], [3, 28], [8, 36], [18, 48], [25, 50], [50, 50], [85, 45]];
const HEAD: [number, number][] = [[0, 7.5], [8, 6.4], [18, 5.7], [85, 5.6]];
const STOOP: [number, number][] = [[0, 0], [60, 0], [85, 7]];
const hairOf = (age: number) => (age < 50 ? NAVY : mix("#1b2235", "#dcdfe5", clamp((age - 50) / 22)));

type Point = [number, number];
interface Person {
  age: number;
  /** the step's phase; absent, they stand */
  walk?: number;
  /** long hair and a dress */
  she?: boolean;
  dress?: string;
  veil?: boolean;
  tie?: string;
  bag?: boolean;
  backpack?: boolean;
  cap?: boolean;
  cane?: boolean;
  flowers?: boolean;
  /** sitting on a seat this high */
  sit?: number;
  /** the waving hand's phase */
  wave?: number;
  /** where the right (hold) or left (holdL) hand is */
  hold?: Point;
  holdL?: Point;
}

function person(x: number, o: Person): string {
  const age = o.age, H = along(HEIGHT, age), rh = along(HEAD, age), stoop = along(STOOP, age);
  const leg = 0.42 * H, torso = 0.34 * H, w = 2.4;
  const s = o.walk === undefined ? 0 : H * (age > 65 ? 0.05 : 0.1) * Math.sin(o.walk);
  const hipX = x;
  let hipY = GROUND - leg, legs: string;
  if (o.sit !== undefined) {
    hipY = GROUND - o.sit;
    legs = `M${r1(hipX)} ${r1(hipY)}L${r1(hipX + leg * 0.5)} ${r1(hipY)}L${r1(hipX + leg * 0.5)} ${GROUND}`;
  } else {
    legs = `M${r1(hipX)} ${r1(hipY)}L${r1(hipX + s)} ${GROUND}M${r1(hipX)} ${r1(hipY)}L${r1(hipX - s)} ${GROUND}`;
  }
  const shY = hipY - torso, sx = hipX + stoop * 0.8, hx = hipX + stoop, hy = shY - rh - 1.5;
  let lh: Point = [sx - s * 0.7 - 2, shY + 0.3 * H];
  let rh2: Point = [sx + s * 0.7 + 2, shY + 0.3 * H];
  if (o.cane) rh2 = [sx + 8, shY + 0.28 * H];
  if (o.wave !== undefined) rh2 = [sx + 9 + 2 * Math.sin(o.wave), shY - 11];
  if (o.hold) rh2 = o.hold;
  if (o.holdL) lh = o.holdL;
  let out = "";
  if (o.veil) out += `<path d="M${r1(hx)} ${r1(hy - rh)}L${r1(hx - rh - 9)} ${r1(shY + torso * 0.9)}L${r1(hx - 1)} ${r1(shY + 2)}z" fill="#fff" stroke="#d6dde9" stroke-width="1" opacity=".95"/>`;
  if (o.backpack) out += `<rect x="${r1(sx - 7)}" y="${r1(shY + 1)}" width="6" height="${r1(torso * 0.7)}" rx="1.5" fill="${BLUE}"/>`;
  out += `<g stroke="${NAVY}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${legs}M${r1(hipX)} ${r1(hipY)}L${r1(sx)} ${r1(shY)}M${r1(sx)} ${r1(shY + 1)}L${r1(lh[0])} ${r1(lh[1])}M${r1(sx)} ${r1(shY + 1)}L${r1(rh2[0])} ${r1(rh2[1])}"/></g>`;
  if (o.she || o.dress) out += `<path d="M${r1(sx)} ${r1(shY + 3)}L${r1(hipX - 7)} ${r1(hipY + 5)}L${r1(hipX + 7)} ${r1(hipY + 5)}z" fill="${o.dress ?? PINK}" stroke="${NAVY}" stroke-width="1.2"/>`;
  if (o.tie) out += `<path d="M${r1(sx)} ${r1(shY + 2)}l0 ${r1(torso * 0.45)}" stroke="${o.tie}" stroke-width="2.2"/>`;
  // head, then hair: none on a baby, longer for her, greying with age
  if (o.she && age >= 3) {
    out += `<path d="M${r1(hx - rh - 1)} ${r1(hy)}q0 ${r1(rh * 1.6)} -1 ${r1(rh * 1.7)}l${r1(rh * 0.9)} 0l0 ${r1(-rh * 1.2)}z`
      + `M${r1(hx + rh + 1)} ${r1(hy)}q0 ${r1(rh * 1.6)} 1 ${r1(rh * 1.7)}l${r1(-rh * 0.9)} 0l0 ${r1(-rh * 1.2)}z" fill="${hairOf(age)}"/>`;
  }
  out += `<circle cx="${r1(hx)}" cy="${r1(hy)}" r="${r1(rh)}" fill="#fff" stroke="${NAVY}" stroke-width="${w}"/>`;
  if (age >= 1.5) {
    const e = rh * 0.98, top = hy - rh * 0.25;
    out += `<path d="M${r1(hx - e)} ${r1(top)}a${r1(rh)} ${r1(rh)} 0 0 1 ${r1(2 * e)} 0q${r1(-e * 0.7)} ${r1(-rh * 0.35)} ${r1(-e)} ${r1(-rh * 0.15)}q${r1(-e * 0.5)} ${r1(rh * 0.1)} ${r1(-e)} ${r1(rh * 0.15)}z" fill="${hairOf(age)}"/>`;
  }
  if (age > 62) out += `<g stroke="${NAVY}" stroke-width="1" fill="none"><circle cx="${r1(hx + 1.5)}" cy="${r1(hy + 0.5)}" r="2"/><circle cx="${r1(hx + rh * 0.9)}" cy="${r1(hy + 0.5)}" r="1.6"/></g>`;
  if (o.cap) out += `<path d="M${r1(hx - 9)} ${r1(hy - rh + 1)}L${r1(hx)} ${r1(hy - rh - 3)}L${r1(hx + 9)} ${r1(hy - rh + 1)}L${r1(hx)} ${r1(hy - rh + 4)}z" fill="${NAVY}"/><path d="M${r1(hx + 7)} ${r1(hy - rh + 1)}l1 6" stroke="${GOLD}" stroke-width="1.4"/>`;
  if (o.bag) out += `<rect x="${r1(rh2[0] - 6)}" y="${r1(rh2[1])}" width="12" height="9" rx="1.5" fill="${WOOD}"/>`;
  if (o.cane) out += `<line x1="${r1(rh2[0])}" y1="${r1(rh2[1])}" x2="${r1(rh2[0] + 3)}" y2="${GROUND}" stroke="${WOOD}" stroke-width="2.2" stroke-linecap="round"/><path d="M${r1(rh2[0] - 3)} ${r1(rh2[1] + 1)}q3 -4 6 0" stroke="${WOOD}" stroke-width="2.2" fill="none"/>`;
  if (o.flowers) out += ([[-2, -3, PINK], [2, -4, "#fff"], [0, -1, GOLD]] as const).map(([dx, dy, c]) => `<circle cx="${r1(rh2[0] + dx)}" cy="${r1(rh2[1] + dy)}" r="2.2" fill="${c}"/>`).join("");
  return out;
}

/* ---------- places ---------- */

// one gradient per pair of colours: the same id always holds the same colours, so cards on one page can share it
const sky = (top: string, low: string) => {
  const id = `sky${top.slice(1)}${low.slice(1)}`;
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${low}"/></linearGradient></defs><rect x="0" y="0" width="300" height="${GROUND}" fill="url(#${id})"/>`;
};
const floor = (c: string) => `<rect x="0" y="${GROUND}" width="300" height="${190 - GROUND}" fill="${c}"/>`;
const sunAt = (x: number, y: number, c: string) => `<circle cx="${x}" cy="${y}" r="11" fill="${c}"/>`;
const tree = (x: number, h: number, crown: number, c = LEAF) =>
  `<line x1="${x}" y1="${GROUND}" x2="${x}" y2="${GROUND - h}" stroke="${WOOD}" stroke-width="4" stroke-linecap="round"/>`
  + `<circle cx="${x}" cy="${r1(GROUND - h - crown * 0.4)}" r="${crown}" fill="${c}"/><circle cx="${r1(x - crown * 0.7)}" cy="${r1(GROUND - h + crown * 0.1)}" r="${r1(crown * 0.7)}" fill="${c}"/><circle cx="${r1(x + crown * 0.7)}" cy="${r1(GROUND - h + crown * 0.1)}" r="${r1(crown * 0.7)}" fill="${c}"/>`;
const bench = (x: number) =>
  `<g stroke="${WOOD}" stroke-width="3" stroke-linecap="round"><line x1="${x - 24}" y1="${GROUND - 14}" x2="${x + 24}" y2="${GROUND - 14}"/><line x1="${x - 24}" y1="${GROUND - 30}" x2="${x + 24}" y2="${GROUND - 30}"/>`
  + `<line x1="${x - 20}" y1="${GROUND - 14}" x2="${x - 20}" y2="${GROUND}"/><line x1="${x + 20}" y1="${GROUND - 14}" x2="${x + 20}" y2="${GROUND}"/><line x1="${x - 22}" y1="${GROUND - 30}" x2="${x - 22}" y2="${GROUND - 14}"/><line x1="${x + 22}" y1="${GROUND - 30}" x2="${x + 22}" y2="${GROUND - 14}"/></g>`;
const heart = (x: number, y: number, s: number, c = RED, op = 1) =>
  `<path d="M${r1(x)} ${r1(y + 5 * s)}c${r1(-6 * s)} ${r1(-4 * s)} ${r1(-5 * s)} ${r1(-10 * s)} 0 ${r1(-7 * s)}c${r1(5 * s)} ${r1(-3 * s)} ${r1(6 * s)} ${r1(3 * s)} 0 ${r1(7 * s)}z" fill="${c}" opacity="${r1(op)}"/>`;
const leaves = (t: number, c: string) => Array.from({ length: 8 }, (_, i) => {
  const x = (i * 41 + 13 + Math.sin(t + i) * 8) % 300, y = (t * 14 + i * 19) % GROUND;
  return `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="3" ry="1.6" fill="${c}" transform="rotate(${r1((t * 60 + i * 40) % 360)} ${r1(x)} ${r1(y)})"/>`;
}).join("");

/** each event's place and people, k of the way through it, t seconds of movement, at this age */
const PLACES: ((k: number, t: number, age: number) => string)[] = [
  // เกิด: a hospital room, the baby in a cot, a heart over it
  (_k, t) => {
    let s = `<rect x="0" y="0" width="300" height="${GROUND}" fill="#f3f6fb"/>` + floor("#dfe5ef");
    s += `<rect x="30" y="30" width="56" height="46" rx="3" fill="#cfe3ff" stroke="#fff" stroke-width="4"/><line x1="58" y1="30" x2="58" y2="76" stroke="#fff" stroke-width="3"/>`;
    s += `<circle cx="248" cy="44" r="14" fill="#fff" stroke="#f1c4cf" stroke-width="2"/><path d="M244 36h8v5h5v8h-5v5h-8v-5h-5v-8h5z" fill="${RED}"/>`;
    s += `<rect x="112" y="108" width="76" height="26" rx="10" fill="#fff" stroke="#c9d3e6" stroke-width="2"/><line x1="120" y1="134" x2="116" y2="${GROUND}" stroke="#c9d3e6" stroke-width="3"/><line x1="180" y1="134" x2="184" y2="${GROUND}" stroke="#c9d3e6" stroke-width="3"/>`;
    const kick = Math.sin(t * 6) * 2;
    s += `<rect x="134" y="112" width="34" height="13" rx="6.5" fill="#bcd6ff"/><circle cx="130" cy="115" r="7" fill="#fff" stroke="${NAVY}" stroke-width="2.2"/><path d="M128 108q2 -3 4 0" stroke="${NAVY}" fill="none" stroke-width="1.2"/>`;
    s += `<path d="M166 114l${r1(8 + kick)} -5M166 120l${r1(8 - kick)} -2" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/>`;
    return s + heart(150, 86 - Math.abs(Math.sin(t * 2)) * 4, 1.3);
  },
  // เป็นเด็ก: a playground with a slide and a ball
  (k, t, age) => {
    let s = sky("#cfe6ff", "#e9f5ff") + floor("#bfe3a8") + sunAt(250, 30, "#ffd34d") + tree(40, 30, 18);
    s += `<g stroke="#e05a4f" stroke-width="3" stroke-linecap="round" fill="none"><path d="M205 ${GROUND}L205 100M220 ${GROUND}L220 100M205 112h15M205 126h15M205 140h15"/><path d="M220 100q10 0 20 25t22 25" stroke="${GOLD}" stroke-width="4"/></g>`;
    const x = lerp(90, 160, k);
    return s + person(x, { age, walk: t * 8 }) + `<circle cx="${r1(x + 16)}" cy="${r1(GROUND - 5 - Math.abs(Math.sin(t * 5)) * 16)}" r="5" fill="${ORANGE}"/>`;
  },
  // วัยเรียน: the school with the Thai flag, then the cap at the end
  (k, t, age) => {
    let s = sky("#d7e9ff", "#eef6ff") + floor("#d9dfe8");
    s += `<rect x="150" y="64" width="120" height="86" fill="#f3e0c4" stroke="#d9b98d" stroke-width="2"/><path d="M142 64L210 34L278 64z" fill="#c4601a"/><circle cx="210" cy="52" r="7" fill="#fff" stroke="${NAVY}" stroke-width="1.5"/><path d="M210 47v5h3" stroke="${NAVY}" stroke-width="1.2" fill="none"/>`;
    for (const wx of [160, 184, 236, 252]) s += `<rect x="${wx}" y="80" width="12" height="14" fill="#cfe3ff"/>`;
    s += `<rect x="200" y="112" width="20" height="38" fill="${WOOD}"/><line x1="276" y1="${GROUND}" x2="276" y2="20" stroke="#8a93a6" stroke-width="2"/>`;
    s += `<rect x="276" y="20" width="18" height="12" fill="${RED}"/><rect x="276" y="22" width="18" height="8" fill="#fff"/><rect x="276" y="24" width="18" height="4" fill="#2d2a6e"/>`;
    return s + person(lerp(60, 130, k), { age, walk: t * 8, backpack: true, cap: k > 0.7 });
  },
  // ทำงาน: the city at midday
  (k, t, age) => {
    let s = sky("#cfe1fb", "#eaf2ff") + floor("#cfd6e2") + sunAt(40, 26, "#ffd34d");
    ([[150, 70, 26], [180, 96, 22], [206, 60, 30], [240, 84, 24], [266, 50, 28]] as const).forEach(([x, h, w], i) => {
      s += `<rect x="${x}" y="${GROUND - h}" width="${w}" height="${h}" fill="${["#9fb3d6", "#8aa2cc", "#a9bbdc"][i % 3]}"/>`;
      for (let r = 0; r < Math.floor(h / 12); r++) s += `<rect x="${x + 5}" y="${GROUND - h + 6 + r * 12}" width="${w - 10}" height="4" fill="#eaf2ff" opacity=".8"/>`;
    });
    return s + person(lerp(60, 130, k), { age, walk: t * 8, tie: ORANGE, bag: true });
  },
  // แต่งงาน: two under a flower arch, hearts rising
  (_k, t, age) => {
    let s = sky("#ffe9f0", "#fff6f8") + floor("#cfe8bf");
    s += `<path d="M104 ${GROUND}L104 82a46 46 0 0 1 92 0L196 ${GROUND}" stroke="#f3d9a6" stroke-width="5" fill="none"/>`;
    for (let a = 0; a <= 12; a++) { const th = Math.PI - (a / 12) * Math.PI; s += `<circle cx="${r1(150 + Math.cos(th) * 46)}" cy="${r1(82 - Math.sin(th) * 46)}" r="4" fill="${a % 2 ? PINK : "#fff"}"/>`; }
    const sway = Math.sin(t * 2) * 1.5;
    s += person(136 + sway, { age, tie: NAVY, hold: [150, GROUND - 32] });
    s += person(164 + sway, { age, she: true, dress: "#ffffff", veil: true, holdL: [150, GROUND - 32], flowers: true, hold: [172 + sway, GROUND - 34] });
    for (let i = 0; i < 4; i++) { const up = (t * 16 + i * 14) % 56; s += heart(118 + i * 22, 70 - up, 0.8, RED, 1 - up / 56); }
    return s;
  },
  // มีลูก: home, the child growing as they walk
  (k, t, age) => {
    let s = sky("#d9ebff", "#f0f7ff") + floor("#c7e6b2") + sunAt(260, 30, "#ffc94d") + tree(36, 34, 20);
    s += `<rect x="168" y="86" width="96" height="64" fill="#f6e3cf" stroke="#d9b98d" stroke-width="2"/><path d="M158 88L216 52L274 88z" fill="${ORANGE}"/><rect x="206" y="112" width="20" height="38" fill="${WOOD}"/><rect x="178" y="100" width="20" height="16" fill="#cfe3ff"/><rect x="236" y="100" width="20" height="16" fill="#cfe3ff"/>`;
    const x = lerp(70, 120, k), walk = t * 6;
    return s + person(x, { age, walk, tie: BLUE }) + person(x + 34, { age: age - 2, walk: walk + 1, she: true }) + person(x + 17, { age: lerp(1, 8, k), walk: walk + 2 });
  },
  // เกษียณ: by the sea, the two of them waving
  (_k, t, age) => {
    let s = sky("#ffe0b8", "#fff1dc") + sunAt(240, 70, "#ff9f43");
    s += `<rect x="0" y="96" width="300" height="${GROUND - 96}" fill="#7fb6e8"/>`;
    for (let i = 0; i < 5; i++) s += `<path d="M${r1(10 + i * 60 + Math.sin(t + i) * 5)} ${108 + (i % 2) * 14}q8 -4 16 0" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>`;
    s += floor("#f3dca8");
    s += `<path d="M40 ${GROUND}q6 -40 -2 -70" stroke="${WOOD}" stroke-width="5" fill="none"/><path d="M38 80q-22 -6 -30 6M38 80q-6 -20 -22 -22M38 80q14 -16 30 -10M38 80q22 0 26 14" stroke="${LEAF}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    return s + person(130, { age, wave: t * 6, tie: ORANGE }) + person(156, { age: age - 2, she: true, wave: t * 6 + 1.5 });
  },
  // ชรา: an autumn park, walking slowly with canes
  (k, t, age) => {
    const s = sky("#ffd9b0", "#ffeedd") + floor("#e9cf9f") + tree(250, 34, 22, "#e08a3c") + tree(40, 28, 16, "#d9a441") + leaves(t, "#e08a3c");
    const x = lerp(90, 140, k);
    return s + person(x, { age, walk: t * 3.5, cane: true }) + person(x + 28, { age: age - 2, walk: t * 3.5 + 1, she: true, cane: true });
  },
  // อยู่คนเดียว: dusk, one on the bench, the space beside them empty, the lamp lit
  (_k, t, age) => {
    let s = sky("#7d6aa8", "#e9a77c") + floor("#c9b9a4") + leaves(t * 0.6, "#c87a3a");
    s += `<line x1="236" y1="${GROUND}" x2="236" y2="62" stroke="#59607a" stroke-width="3"/><path d="M228 62h16l-3 -8h-10z" fill="#59607a"/><circle cx="236" cy="66" r="12" fill="#ffe08a" opacity="${r1(0.35 + 0.1 * Math.sin(t * 2))}"/><circle cx="236" cy="64" r="3.5" fill="#ffe08a"/>`;
    return s + bench(150) + person(138, { age, sit: 14, cane: true });
  },
  // จากไป: night, a headstone with flowers, a soft star going up
  (k, t) => {
    let s = `<rect x="0" y="0" width="300" height="${GROUND}" fill="#1f2a4d"/>` + floor("#3c4a3a");
    for (let i = 0; i < 16; i++) s += `<circle cx="${(i * 53 + 17) % 300}" cy="${(i * 29 + 11) % 110}" r="${i % 3 ? 1 : 1.5}" fill="#fff" opacity="${r1(0.5 + 0.5 * Math.abs(Math.sin(t * 1.5 + i)))}"/>`;
    s += `<circle cx="250" cy="34" r="12" fill="#f3f0d8"/><circle cx="256" cy="30" r="11" fill="#1f2a4d"/>`;
    s += `<path d="M128 ${GROUND}L128 106a22 22 0 0 1 44 0L172 ${GROUND}z" fill="#c9cdd6" stroke="#9aa1b0" stroke-width="2"/><path d="M150 112v16M143 118h14" stroke="#9aa1b0" stroke-width="2.4"/>`;
    s += ([[-26, PINK], [-18, "#fff"], [18, GOLD], [26, PINK]] as const).map(([dx, c]) => `<line x1="${150 + dx}" y1="${GROUND}" x2="${150 + dx}" y2="${GROUND - 10}" stroke="${LEAF}" stroke-width="1.6"/><circle cx="${150 + dx}" cy="${GROUND - 12}" r="3.5" fill="${c}"/>`).join("");
    const y = 96 - k * 60 - Math.sin(t * 2) * 2;
    return s + `<circle cx="150" cy="${r1(y)}" r="9" fill="#fff6c8" opacity=".35"/><path d="M150 ${r1(y - 5)}l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="#fff6c8"/>`;
  },
];

/** the event at p, how far through it, and how long since it began (in % of the bar) */
export function lifeAt(p: number): { i: number; k: number; since: number } {
  let i = 0;
  LIFE_EVENTS.forEach((e, n) => { if (p >= e.from) i = n; });
  const from = LIFE_EVENTS[i].from, to = i + 1 < LIFE_EVENTS.length ? LIFE_EVENTS[i + 1].from : END;
  return { i, k: clamp((p - from) / Math.max(1, to - from)), since: p - from };
}

function timeline(i: number): string {
  const x = (n: number) => r1(30 + n * 26.7);
  let s = `<line x1="${x(0)}" y1="172" x2="${x(9)}" y2="172" stroke="#c9d3e6" stroke-width="2.5" stroke-linecap="round"/><line x1="${x(0)}" y1="172" x2="${x(i)}" y2="172" stroke="${BLUE}" stroke-width="2.5" stroke-linecap="round"/>`;
  LIFE_EVENTS.forEach((_, n) => { s += `<circle cx="${x(n)}" cy="172" r="${n === i ? 4.5 : 3}" fill="${n <= i ? BLUE : "#fff"}" stroke="${n <= i ? BLUE : "#c9d3e6"}" stroke-width="1.5"/>`; });
  return s;
}

function label(i: number, age: number): string {
  const e = LIFE_EVENTS[i], dark = i >= 8;
  const text = i === 0 || i === LIFE_EVENTS.length - 1 ? e.label : `${e.label} · อายุ ${Math.round(age)} ปี`;
  const w = 14 + text.length * 5.6;
  return `<rect x="${r1(150 - w / 2)}" y="6" width="${r1(w)}" height="17" rx="8.5" fill="${dark ? "#2d3a63" : "#fff"}" stroke="${dark ? "#4b5a8a" : "#d6dde9"}"/>`
    + `<text x="150" y="18.5" font-size="10" text-anchor="middle" font-weight="700" fill="${dark ? "#fff" : NAVY}">${text}</text>`;
}

/** the picture at `pct` percent (0–100), `t` seconds into the movement */
export function lifeScene(pct: number, t: number): string {
  const p = Math.max(0, Math.min(END, Number.isFinite(pct) ? pct : 0));
  const { i, k, since } = lifeAt(p);
  const age = lerp(LIFE_EVENTS[i].age[0], LIFE_EVENTS[i].age[1], k);
  let s = "";
  // the place before fades out under the new one for the first moments of an event
  const f = i > 0 ? clamp(since / 1.2) : 1;
  if (f < 1) s += PLACES[i - 1](1, t, LIFE_EVENTS[i - 1].age[1]);
  s += `<g opacity="${r1(f)}">${PLACES[i](k, t, age)}</g>`;
  return s + `<rect x="0" y="160" width="300" height="30" fill="#f4f7fb"/>` + timeline(i) + label(i, age);
}
