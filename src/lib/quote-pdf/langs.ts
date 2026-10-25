import type { Lang } from "@/lib/ihealthy-lang";

/** The iHealthy page's languages other than Thai, each of which its PDF can be printed in. */
export const PRINTED_LANGS = ["en", "zh", "ru", "my"] as const satisfies readonly Exclude<Lang, "th">[];
export type PrintedLang = (typeof PRINTED_LANGS)[number];
