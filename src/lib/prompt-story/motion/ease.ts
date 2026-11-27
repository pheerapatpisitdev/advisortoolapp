/**
 * โมชันกราฟิก's clock (owner, 2026-11-26, mockup ข round 2): the mockup's own curves, so a scene moves as the owner
 * saw it. Every piece is a pure function of the scene's time t, in seconds; nothing here keeps state.
 */

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** cubic out */
export const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
/** cubic in and out: the wipe between scenes */
export const inout = (x: number) => {
  const v = clamp(x);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
/** a little past its place and back: what pops and flies in */
export const spring = (x: number) => (x <= 0 ? 0 : 1 - Math.exp(-6.5 * x) * Math.cos(10 * x));

/** to a hundredth, so the markup holds no long tails of digits */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * a piece rising into place from `start`: up `dy` px from below, from `from` of its size; the mockup's 0.7em of the
 * piece's own type is the caller's `dy` (21 px is that of the 30 px em)
 */
export function rise(t: number, start: number, dy = 21, from = 0.9): { opacity: number; transform: string } {
  const s = spring(t - start);
  return { opacity: r2(clamp((t - start) / 0.16)), transform: `translateY(${r2((1 - s) * dy)}px) scale(${r2(from + (1 - from) * s)})` };
}

/** a piece flying in from `dx`, `dy` px away, turned `rot` degrees, settling at its place from `start` */
export function fly(t: number, start: number, dx: number, dy: number, rot = 0): { opacity: number; transform: string } {
  const s = spring(t - start);
  return { opacity: r2(clamp((t - start) / 0.15)), transform: `translate(${r2((1 - s) * dx)}px, ${r2((1 - s) * dy)}px) rotate(${r2(rot * (1 - s))}deg)` };
}
