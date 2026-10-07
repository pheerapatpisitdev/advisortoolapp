import type { LegacySlots } from "./legacy/answer";
import type { IShieldSlots } from "./ishield/answer";
import type { PlbSlots } from "./plb/answer";
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
export type AnySlots = Routed | HealthSlots | LegacySlots | IShieldSlots | PlbSlots | Undecided;

/**
 * What the bot remembers about the sales-page PDF, across every plan in one conversation.
 *
 * Kept beside the slots rather than in any one brain's, because a customer who was quoted
 * Life Protect and then PLB is asking for PLB's file, and the brain that quoted it may not be
 * the one holding the conversation by then.
 */
export interface PdfMemory {
  /**
   * The latest answer's PDFs, in the order its quotes were sent: one person's one, a couple's
   * two. Each of them asked for a quote, so each is owed their own file.
   */
  paths?: string[];
  /** the latest quote's card, sent instead when there is no PDF of it */
  card?: string;
  /**
   * The latest quote has neither a PDF nor a card (the pension plan). Remembered rather than
   * left blank, because blank would leave the quote before it standing — and that is another
   * plan's file.
   */
  latestHasNoPdf?: true;
  /** the pages the bot has already offered the file for: asked once per plan, then a button */
  asked: PdfPage[];
  /** the customer said no to the offer; the button stays, the question does not come back */
  declined?: true;
  /**
   * The last answer ended with the offer. Kept here as well as in its words because the words
   * may not come back whole — the website cuts a long answer at 2,000 characters, and the offer
   * is its last line. One turn long: whatever answers next writes it again or drops it.
   */
  offered?: true;
}

export type WithPdf<T> = T & { pdf?: PdfMemory };

/**
 * The intro picture has been sent (./intro). Kept on the conversation, beside the PDF's memory
 * and for the same reason: it belongs to the customer, not to any one plan's brain, so it is
 * taken off the slots before a brain sees them and written back onto whatever comes out.
 */
export type WithIntro<T> = T & { introSeen?: true };
