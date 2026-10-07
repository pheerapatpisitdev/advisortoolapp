import type { GuideItem } from "@/lib/copilot/guide";
import type { PriceReply } from "@/lib/copilot/price";
import { writtenFor, type Channel } from "./channel";
import type { Said } from "./common";

/**
 * A priced reply as the bubbles a customer is sent.
 *
 * Written once because two paths build it: the dispatcher, for the plans that have no brain,
 * and the PLB brain, which prices the same way. The words are written for wherever they are
 * about to be read; the first card rides on the first bubble with the PDF that prints it,
 * where it is remembered for a later "ขอไฟล์ PDF", and each further card is a bubble of its own.
 */
export function pricedAnswer(
  priced: PriceReply, channel: Channel,
): { messages: Said[]; priced: boolean; guide?: GuideItem[] } {
  return {
    messages: [
      {
        text: writtenFor(channel, priced.text),
        ...(priced.cards?.[0] ? { card: priced.cards[0] } : {}),
        ...(priced.pdfPath ? { pdfPath: priced.pdfPath } : {}),
      },
      ...(priced.cards?.slice(1) ?? []).map((card) => ({ text: "", card })),
    ],
    priced: priced.priced,
    ...(priced.guide?.length ? { guide: priced.guide } : {}),
  };
}
