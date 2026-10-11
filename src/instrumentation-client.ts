import * as Sentry from "@sentry/nextjs";
import { SENTRY_COMMON } from "@/lib/sentry-options";

/** A page that breaks in the browser, reported as the server's errors are (src/instrumentation.ts). */
Sentry.init({ ...SENTRY_COMMON, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
