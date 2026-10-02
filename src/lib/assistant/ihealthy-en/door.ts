import type { ChatMessage } from "@/lib/ai/types";
import type { AnyAnswer } from "../dispatch";
import { languageOf, type ChatLang } from "../expat";
import { answerHealth } from "../ihealthy/answer";
import type { HealthSlots } from "../ihealthy/route";
import type { AnySlots } from "../slots";
import { answerHealthEn } from "./answer";

/**
 * Every message on an Expat Page comes through here, instead of the dispatcher's own doors.
 *
 * These Pages sell one thing, so there is no menu of plans and no guessing from the
 * advertisement: every conversation is about iHealthy Ultra. What is decided here is only the
 * language — English unless the customer writes Thai (owner, 2026-10-02) — and the person
 * travels across a switch either way, so nobody is asked their age twice for changing language.
 */
export async function answerExpat(
  history: ChatMessage[], stored: AnySlots | null,
): Promise<AnyAnswer> {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const health = stored && "product" in stored && stored.product === "ihealthy" ? stored as HealthSlots : null;
  const previous: ChatLang | undefined = stored ? (health?.lang === "en" ? "en" : "th") : undefined;
  const carried = health ?? personOf(stored);

  if (languageOf(last, previous) === "en") return answerHealthEn(history, carried);

  const thai = carried ? withoutLang(carried) : null;
  const answer = await answerHealth(history, thai);
  return { ...answer, slots: withoutLang(answer.slots) };
}

/** Only the person survives from a conversation about something else. */
function personOf(stored: AnySlots | null): HealthSlots | null {
  if (!stored) return null;
  const { age, sex } = stored as { age?: number; sex?: "M" | "F" };
  if (age === undefined && sex === undefined) return null;
  return {
    product: "ihealthy", intent: "quote",
    ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}),
  };
}

function withoutLang(slots: HealthSlots): HealthSlots {
  const rest = { ...slots };
  delete rest.lang;
  return rest;
}
