import type { Instrumentation } from "next";

/**
 * Server errors to Sentry (src/sentry.server.ts). Before this they reached only Vercel's log,
 * which nobody reads (review, 2026-10-11).
 *
 * The Node server only, loaded on demand. Sentry in the browser put 82 kB on every page
 * (shared JS 103 → 185 kB) and in the middleware 56 kB (32 → 88 kB) — paid by a customer
 * arriving from an advert on a phone — while what breaks here breaks on the server: the
 * bots, the webhooks, the crons, the wallet.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server");
}

/** an error a route, an action or a page threw without catching */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureRequestError } = await import("./sentry.server");
  captureRequestError(...args);
};
