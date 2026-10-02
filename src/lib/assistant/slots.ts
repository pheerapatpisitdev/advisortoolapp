import type { LegacySlots } from "./legacy/answer";
import type { IShieldSlots } from "./ishield/answer";
import type { HealthSlots } from "./ihealthy/route";
import type { Routed } from "./lifeprotect/route";
import type { PdfPage } from "@/lib/quote-pdf/pages";

/**
 * A customer the bot has asked which plan they came for, and who has not yet said.
 *
 * It carries a person because the question and the answer are two turns: someone who opens
 * with "หญิง 35" has already given the two things either brain would ask for next, and being
 * asked for them again after tapping a button is the bot admitting it was not listening.
 */
export interface Undecided {
  product: "undecided";
  age?: number;
  sex?: "M" | "F";
  /** everyone the message named, when it named more than one; the life brain prices them all */
  people?: { age: number; sex: "M" | "F" }[];
  /** the application form has gone, which the report counts and the bot does not repeat */
  formSent?: true;
}

/**
 * Everything a session row can be holding.
 *
 * A row written before the health brain existed has no `product` at all; `answerAny` reads
 * that as the life plan, which is the only thing it can have been.
 */
export type AnySlots = Routed | HealthSlots | LegacySlots | IShieldSlots | Undecided;

/**
 * What the bot remembers about the sales-page PDF, across every plan in one conversation.
 *
 * Kept beside the slots rather than in any one brain's, because a customer who was quoted
 * Life Protect and then PLB is asking for PLB's file, and the brain that quoted it may not be
 * the one holding the conversation by then.
 */
export interface PdfMemory {
  /** the latest quote's PDF, when the sales page can print that quote */
  path?: string;
  /** the latest quote's card, sent instead when there is no PDF of it */
  card?: string;
  /** the pages the bot has already offered the file for: asked once per plan, then a button */
  asked: PdfPage[];
  /** the customer said no to the offer; the button stays, the question does not come back */
  declined?: true;
}

export type WithPdf<T> = T & { pdf?: PdfMemory };
