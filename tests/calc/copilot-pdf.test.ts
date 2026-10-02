import { describe, expect, it } from "vitest";
import { answerFromKnowledge } from "@/lib/copilot/answer";
import type { AnySlots } from "@/lib/assistant/slots";

/**
 * The website's side of the PDF: the file is a link under the answer, and a request for it
 * reaches the dispatcher even before any quote exists, so it is answered by the same words as
 * on the bot instead of by the library.
 */
const PDF = "/api/quote-pdf?page=plb&age=35&sex=M&v=1";

describe("the PDF on the website", () => {
  it("is the remembered quote's path, handed to the page as a link", async () => {
    const slots = { product: "undecided", pdf: { path: PDF, asked: [] } } as unknown as AnySlots;
    const answer = await answerFromKnowledge("ขอไฟล์ PDF", [], slots);
    expect(answer.pdf).toBe(PDF);
  });

  it("is asked for before a quote, and is told what is needed first", async () => {
    const answer = await answerFromKnowledge("ขอไฟล์ PDF", [], null);
    expect(answer.pdf).toBeUndefined();
    expect(answer.text).toContain("ทำไฟล์ PDF ให้ได้ครับ");
  });
});
