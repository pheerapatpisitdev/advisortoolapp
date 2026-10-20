/**
 * ลูกเล่นคลิปใหม่'s switch as plain data (fx-switch.ts reads and saves it): browser-safe, for /admin/switches' buttons.
 */
export const FX_MODES = ["owner", "all", "off"] as const;
export type FxMode = (typeof FX_MODES)[number];
export const FX_MODE_LABEL: Record<FxMode, string> = { owner: "เจ้าของคนเดียว", all: "ทุกคน", off: "ปิด" };

/** where it is kept in ins_ai_settings.feature_switches */
export const FX_KEY = "clipFx";

export const isFxMode = (v: unknown): v is FxMode => typeof v === "string" && (FX_MODES as readonly string[]).includes(v);

/** the mode as stored; "owner" when there is none or it cannot be read */
export function fxModeOf(switches: unknown): FxMode {
  const row = switches && typeof switches === "object" ? (switches as Record<string, unknown>)[FX_KEY] : undefined;
  const mode = row && typeof row === "object" ? (row as Record<string, unknown>).for : undefined;
  return isFxMode(mode) ? mode : "owner";
}

