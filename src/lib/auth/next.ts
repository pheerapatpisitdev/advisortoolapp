/**
 * Where to go after signing in: a path on this site, or Studio. Anything that could leave the
 * site — `//evil.example`, `/\evil.example`, a full URL — is refused, so the sign-in page cannot
 * be used to bounce somebody somewhere else with our name on the way.
 */
export function safeNext(raw: unknown, fallback = "/studio"): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\") || raw.includes("\n") || raw.includes("\r")) return fallback;
  if (raw === "/login" || raw.startsWith("/login?")) return fallback;
  return raw;
}
