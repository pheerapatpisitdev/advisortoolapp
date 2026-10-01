/**
 * Where to go after signing in: a path on this site, or Studio. Anything that could leave the
 * site — `//evil.example`, `/\evil.example`, a full URL — is refused, so the sign-in page cannot
 * be used to bounce somebody somewhere else with our name on the way.
 *
 * A control character or a backslash anywhere is refused too (review, 2026-10-01): browsers
 * drop tabs and newlines from a URL and read `\` as `/`, so `/<tab>/evil.example` would turn
 * into `//evil.example` after this check had passed it.
 */
export function safeNext(raw: unknown, fallback = "/studio"): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(raw)) return fallback;
  if (raw === "/login" || raw.startsWith("/login?")) return fallback;
  return raw;
}
