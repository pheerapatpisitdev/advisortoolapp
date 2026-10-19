import { buildScene } from "./build-scene";
import { lifeScene } from "./life-scene";

/**
 * Which picture a clip being made shows under its bar (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/Gv6qeAs74uQGqHKRMfFSDw): the builders' house (build-scene.ts) or a life in
 * ten events (life-scene.ts), at random — read from the clip's id, so one clip keeps its picture
 * from the first read until it is done. Pure and browser-safe.
 */

export type LoadingKind = "house" | "life";

/** the clip's picture: half the ids get each */
export function loadingKindOf(id: string): LoadingKind {
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0) % 2 ? "life" : "house";
}

/** the picture's SVG markup at `pct`, `t` seconds into its movement; `uid` keeps a card's own ids apart */
export function loadingScene(kind: LoadingKind, pct: number, t: number, uid: string): string {
  return kind === "life" ? lifeScene(pct, t) : buildScene(pct, t, uid);
}
