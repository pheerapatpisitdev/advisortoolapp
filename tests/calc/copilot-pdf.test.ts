import { describe, expect, it } from "vitest";
import { answerFromKnowledge } from "@/lib/copilot/answer";
import type { AnySlots } from "@/lib/assistant/slots";

/**
 * The website's side of the PDF: each file is a link under the answer. A request for one
 * before any quote reaches the dispatcher, which asks which plan as it would in the inbox —
 * the quote that follows offers the file.
 */
const PDF = "/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB10&v=1";
const PDF2 = "/api/quote-pdf?page=plb&age=33&sex=F&sum=1000000&variant=PLB10&v=1";

describe("the PDF on the website", () => {
  it("is the remembered quote's path, handed to the page as a link", async () => {
    const slots = { product: "undecided", pdf: { paths: [PDF], asked: [] } } as unknown as AnySlots;
    const answer = await answerFromKnowledge("ขอไฟล์ PDF", [], slots);
    expect(answer.pdfs).toEqual([PDF]);
  });

  it("is one link per file for a couple", async () => {
    const slots = { product: "undecided", pdf: { paths: [PDF, PDF2], asked: [] } } as unknown as AnySlots;
    const answer = await answerFromKnowledge("ขอไฟล์ PDF", [], slots);
    expect(answer.pdfs).toEqual([PDF, PDF2]);
    // and the way on is still offered under them
    expect(answer.guide?.map((g) => g.label)).toContain("สนใจสมัคร");
  });

  it("asked for before a quote, is answered by asking which plan", async () => {
    const answer = await answerFromKnowledge("ขอไฟล์ PDF", [], null);
    expect(answer.pdfs).toBeUndefined();
    expect(answer.text).toContain("สนใจแบบไหนครับ");
  });
});
