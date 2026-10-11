import * as Sentry from "@sentry/nextjs";
import { SENTRY_COMMON } from "@/lib/sentry-options";

/**
 * Most failures here are caught and written with console.error — a webhook's after(), a
 * cron, a picture that would not draw — and a caught error never reaches onRequestError, so
 * console.error itself is reported too.
 */
Sentry.init({
  ...SENTRY_COMMON,
  dsn: process.env.SENTRY_DSN,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});

export const captureRequestError = Sentry.captureRequestError;
