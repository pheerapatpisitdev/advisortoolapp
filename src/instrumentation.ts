import * as Sentry from "@sentry/nextjs";
import { SENTRY_COMMON } from "@/lib/sentry-options";

/**
 * Server errors to Sentry. Most failures here are caught and written with console.error — a
 * webhook's after(), a cron, a picture that would not draw — and a caught error never reaches
 * onRequestError, so console.error itself is reported too. Before this they reached only
 * Vercel's log, which nobody reads (review, 2026-10-11).
 *
 * The server only. Sentry in the browser put 82 kB on every page (shared JS 103 → 185 kB),
 * which a customer arriving from an advert on a phone pays for; what breaks here breaks on
 * the server — the bots, the webhooks, the crons, the wallet.
 */
export function register() {
  Sentry.init({
    ...SENTRY_COMMON,
    dsn: process.env.SENTRY_DSN,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  });
}

/** an error a route, an action or a page threw without catching */
export const onRequestError = Sentry.captureRequestError;
