/**
 * What a clip's row keeps about its making, for the Remotion move's phase 0 (owner chose ก ก ก ก,
 * 2026-10-19, mockup https://claude.ai/artifact/WiEBsFZauc5iQKzEaWGGdJ): the real reason a clip
 * failed (`fail_reason`; the agent still sees only the plain `error`) and its cost part by part
 * (`cost_parts`), so the old engine and Remotion can be set side by side. Both are the server's
 * alone (migration 20261126); nothing here changes what anyone is charged.
 */

/** shotstack: a คลิปตามโจทย์ in ดีไซน์พิเศษ, put together by Shotstack (owner, 2026-10-21) */
export type ClipEngine = "remotion" | "ffmpeg" | "shotstack";

export interface CostParts {
  /** the voice, every line, in baht */
  voice?: number;
  /** AI pictures and cut-outs, in baht */
  pictures?: number;
  /** ภาพขยับ: the moving scenes the วิดีโอ lane made, in baht */
  motion?: number;
  engine?: ClipEngine;
  /** from the start of the cut (voice done) to Cloud Run taking the job: the drawing on Vercel, or Remotion's uploads */
  prepSec?: number;
  /** from Cloud Run taking the job to its answer: start, render and upload */
  renderSec?: number;
  /** renderSec at the job's machine's list price, in baht */
  renderThb?: number;
  /** the Google voice that read a clip whose ElevenLabs voice could not (owner, 2026-10-20) */
  googleVoice?: string;
}

/**
 * Cloud Run jobs' list price in asia-southeast1 (Tier 2): $0.000024 a vCPU-second and $0.0000025
 * a GiB-second, at 36 baht a dollar, as the Remotion trial priced it (2026-10-17).
 */
const VCPU_SEC_USD = 0.000024;
const GIB_SEC_USD = 0.0000025;
const THB_PER_USD = 36;
/** each job's machine: remotion-<drawing> 8 vCPU / 8 GiB, clip-ffmpeg 4 vCPU / 8 GiB */
const MACHINE: Record<Exclude<ClipEngine, "shotstack">, { vcpu: number; gib: number }> = { remotion: { vcpu: 8, gib: 8 }, ffmpeg: { vcpu: 4, gib: 8 } };

/** baht for `secs` of an engine's job; the seconds count from the hand-over, so a little over what is billed */
export function renderThbFor(engine: Exclude<ClipEngine, "shotstack">, secs: number): number {
  const m = MACHINE[engine];
  return round(Math.max(0, secs) * (m.vcpu * VCPU_SEC_USD + m.gib * GIB_SEC_USD) * THB_PER_USD, 4);
}

/**
 * Shotstack bills the clip's own length, not the time it took: pay-as-you-go 20¢ a minute (shotstack.io/pricing,
 * 2026-10-21). A Sandbox render is free (it carries their watermark).
 */
const SHOTSTACK_USD_PER_MIN = 0.2;
export function shotstackThbFor(clipSec: number, env: "v1" | "stage" | undefined): number {
  return env === "stage" ? 0 : round((Math.max(0, clipSec) / 60) * SHOTSTACK_USD_PER_MIN * THB_PER_USD, 4);
}

/** seconds between two times, to a tenth; null when either is not a time */
export function secondsBetween(from: string | number | undefined, to: number): number | null {
  const t = typeof from === "number" ? from : Date.parse(from ?? "");
  return Number.isFinite(t) ? round(Math.max(0, (to - t) / 1000), 1) : null;
}

/** the stage a clip was in when it failed, in the owner's words */
const STAGE: Record<string, string> = { drawing: "ขณะเตรียม", rendering: "ขณะ Cloud Run ทำ" };

/**
 * The reason as kept: the stage, then the error's own words, with every link taken out (a signed
 * link must never sit in the table) and cut to 400 letters.
 */
export function failReason(why: unknown, stage?: string): string {
  const said = why instanceof Error ? why.message : typeof why === "string" ? why : "unknown error";
  const words = said.replace(/https?:\/\/\S+/g, "<link>").replace(/\s+/g, " ").trim() || "unknown error";
  const at = stage ? STAGE[stage] ?? stage : "";
  return (at ? `${at} · ${words}` : words).slice(0, 400);
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
