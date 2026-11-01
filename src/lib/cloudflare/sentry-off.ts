/**
 * src/sentry.server.ts on the Cloudflare build: @sentry/nextjs reads its own file's path as it
 * loads, which a Worker has not got, and every request failed before it began. Errors there go to
 * Cloudflare's own log (wrangler.jsonc, observability); @sentry/cloudflare is for when the owner
 * sets a DSN. next.config.ts puts this file in place when CF_BUILD is set.
 */
export const captureRequestError = (): void => {};
