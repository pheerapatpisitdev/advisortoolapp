import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";
import { cleanPdfMemory } from "@/lib/assistant/pdf";

/**
 * What the home page's assistant accepts from the browser, made safe before it reaches a model.
 *
 * askCopilot (src/app/actions.ts) is a server action anyone can call with anything: the page
 * sends the conversation so far and the slots it was handed back, and nothing stopped a caller
 * sending a "system" message, a hundred turns of a hundred thousand characters each, or turns
 * carrying pictures — which the providers would have read, and billed, as vision input
 * (review, 2026-10-01). The page itself never sends any of that, so cleaning it costs a real
 * visitor nothing.
 */

/** the box's own limit on a question, and so on any turn a person really typed */
export const MAX_USER_CHARS = 500;
/**
 * An answer the page shows can run long — a quotation with its notes, a library answer at the
 * model's 700 tokens of Thai — so the assistant's turns get more room than the customer's.
 */
export const MAX_ASSISTANT_CHARS = 2000;
/** the answers read the last six turns and no more (src/lib/copilot/answer.ts, library.ts) */
export const MAX_TURNS = 6;

/**
 * Only the customer's and the assistant's words, as plain text, the last MAX_TURNS of them,
 * each cut to its length. Anything else — another role, a turn that is not text, pictures —
 * is dropped rather than refused: a broken history is a shorter memory, not an error.
 */
export function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_TURNS * 4)) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS);
    // `images` and anything else on the turn are left behind by building it afresh
    if (text) out.push({ role, content: text });
  }
  return out.slice(-MAX_TURNS);
}

/** every product a brain writes into its slots (src/lib/assistant/slots.ts and the brains) */
const PRODUCTS = new Set(["lifeprotect", "ihealthy", "legacy", "ishield", "undecided"]);
/** the whole of a real session's slots is a few hundred characters */
const MAX_SLOTS_JSON = 4000;
const MAX_STRING = 1000;
const MAX_ARRAY = 10;
const MAX_DEPTH = 3;

/** unknown is fine — left out or null; a value has to be one */
const sexOk = (v: unknown) => v === undefined || v === null || v === "M" || v === "F";
const ageOk = (v: unknown) => v === undefined || v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 120);

/** plain JSON of bounded size: short strings, finite numbers, short arrays, shallow objects */
function plain(v: unknown, depth = 0): boolean {
  if (v === null || typeof v === "boolean") return true;
  if (typeof v === "string") return v.length <= MAX_STRING;
  if (typeof v === "number") return Number.isFinite(v);
  if (depth >= MAX_DEPTH) return false;
  if (Array.isArray(v)) return v.length <= MAX_ARRAY && v.every((x) => plain(x, depth + 1));
  if (typeof v === "object") {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(v as Record<string, unknown>).every((x) => plain(x, depth + 1));
  }
  return false;
}

/**
 * The slots the page handed back, or null when they are not slots this app could have written.
 *
 * Each brain re-reads its slots against its own rules before it prices anything (a variant it
 * may not quote, an age outside the table), so what is checked here is the shape every brain
 * shares: a plain, small object, a known product, an age and sex that are an age and a sex,
 * people that are people, and formSent only ever true. Slots that fail are dropped and the
 * conversation carries on from nothing, which is what a visitor who cleared the page gets.
 */
export function cleanSlots(raw: unknown): AnySlots | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw) || !plain(raw)) return null;
  let size: number;
  try {
    size = JSON.stringify(raw).length;
  } catch {
    return null;
  }
  if (size > MAX_SLOTS_JSON) return null;
  const s = raw as Record<string, unknown>;
  if (s.product !== undefined && !PRODUCTS.has(s.product as string)) return null;
  if (!ageOk(s.age) || !sexOk(s.sex)) return null;
  if (s.formSent !== undefined && s.formSent !== true) return null;
  if (s.people !== undefined) {
    if (!Array.isArray(s.people)) return null;
    for (const p of s.people) {
      if (!p || typeof p !== "object") return null;
      const { age, sex } = p as { age?: unknown; sex?: unknown };
      if (typeof age !== "number" || typeof sex !== "string" || !ageOk(age) || !sexOk(sex)) return null;
    }
  }
  for (const k of ["coverWanted", "takenSum"]) {
    const v = s[k];
    if (v !== undefined && (typeof v !== "number" || v < 0 || v > 1e9)) return null;
  }
  if (Object.keys(s).length === 0) return null;
  // the PDF memory is checked field by field, and a bad field costs only that field (pdf.ts)
  if (s.pdf === undefined) return s as unknown as AnySlots;
  const { pdf, ...rest } = s;
  const memory = cleanPdfMemory(pdf);
  return (memory ? { ...rest, pdf: memory } : rest) as unknown as AnySlots;
}
