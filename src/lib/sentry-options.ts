/**
 * Where errors go (owner, 2026-10-11): Sentry, which e-mails the owner the first time a new
 * error is seen. Off until SENTRY_DSN is set in Vercel — with no DSN the SDK sends nothing.
 *
 * No performance tracing (the free plan's events are for errors), and no personal data: a
 * customer's words travel in chat, not in error reports, and the IP and cookies stay home.
 */
export const SENTRY_COMMON = {
  tracesSampleRate: 0,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? "development",
};
