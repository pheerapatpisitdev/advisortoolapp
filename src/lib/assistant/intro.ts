import type { Channel } from "./channel";
import type { AnyAnswer } from "./dispatch";
import type { AnySlots, WithIntro } from "./slots";

/**
 * The picture sent once, ahead of a customer's first quotation: a family without cover beside
 * a family with it. It sets the figure the quotation is about to give against what happens
 * without one, which the owner wanted read first (2026-10-07).
 *
 * The picture's own numbers are an example — 30,000 buys 2,000,000 — and it goes as it is,
 * without a line saying so, on the owner's instruction.
 */
export const INTRO_PICTURE = "/intro/protect-compare-2.jpg";

/** The inbox channels. The website draws every card together after its words, so "ahead of" means nothing there. */
const CHANNELS_WITH_INTRO: Channel[] = ["facebook", "line"];

/** The conversation's slots without the flag, which is not any brain's business. */
export function withoutIntro(stored: AnySlots | null): AnySlots | null {
  if (!stored || !("introSeen" in stored)) return stored;
  const slots = { ...(stored as WithIntro<AnySlots>) };
  delete slots.introSeen;
  return slots;
}

/**
 * The answer, with the picture ahead of its words when this is the first quotation a customer
 * on one of those plans is given — and the flag written back onto the slots either way, so
 * whatever a brain did to the slots, the next turn still knows.
 *
 * A bubble with no words and a card is a picture on its own, which every channel already sends.
 */
export function withIntroPicture(answer: AnyAnswer, seen: boolean, channel: Channel): AnyAnswer {
  // only the two brains the owner chose — about cover for the family, not health or illness
  // benefits — and marked by the dispatcher, which knows who quoted
  const { introFor, ...rest } = answer;
  if (seen) return { ...rest, slots: { ...rest.slots, introSeen: true } as WithIntro<AnySlots> };
  const quoted = rest.priced && rest.messages.some((m) => m.card);
  if (!introFor || !quoted || !CHANNELS_WITH_INTRO.includes(channel)) return rest;
  return {
    ...rest,
    messages: [{ text: "", card: INTRO_PICTURE }, ...rest.messages],
    slots: { ...rest.slots, introSeen: true } as WithIntro<AnySlots>,
  };
}
