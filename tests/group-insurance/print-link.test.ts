import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/quote-pdf/render", () => ({ renderQuotePdf: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => ({ refuseUnless: vi.fn() }));

import { POST } from "@/app/api/group-quote-pdf/route";
import { refuseUnless } from "@/lib/auth/viewer";
import {
  decodePrintQuote, encodePrintQuote, pdfFileName, readPrintQuote, type PrintQuote,
} from "@/lib/group-insurance/print-link";
import { renderQuotePdf } from "@/lib/quote-pdf/render";
import { siteOrigin } from "@/lib/site-url";

/** The phone's "แชร์ PDF": the quotation travels to the server's printer and nothing else does. */

const QUOTE: PrintQuote = {
  product: "health",
  lang: "th",
  customerName: "บริษัท สยามพาร์ทเนอร์ จำกัด",
  quoteNo: "QT-20261120-412",
  quoteDate: "20/11/2569",
  groups: [
    { name: "พนักงาน", bizType: "biz1", planIdx: 1, includeRider: false, riderIdx: 0, count: "40" },
    { name: "ผู้บริหาร", bizType: "biz2", planIdx: 3, includeRider: true, riderIdx: 4, count: "5" },
  ],
};

describe("readPrintQuote", () => {
  it("keeps a quotation the calculator could have made", () => {
    expect(readPrintQuote(QUOTE)).toEqual(QUOTE);
  });

  it("refuses a product, class or language it does not know", () => {
    expect(readPrintQuote({ ...QUOTE, product: "life" })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, lang: "zh" })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, groups: [{ ...QUOTE.groups[0], bizType: "biz9" }] })).toBeNull();
  });

  it("refuses plans out of range and a rider more than one step above its plan", () => {
    expect(readPrintQuote({ ...QUOTE, groups: [{ ...QUOTE.groups[0], planIdx: 6 }] })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, groups: [{ ...QUOTE.groups[0], planIdx: 1, riderIdx: 3 }] })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, groups: [{ ...QUOTE.groups[0], planIdx: 1.5 }] })).toBeNull();
  });

  it("refuses head counts that are not whole numbers, and no groups at all", () => {
    expect(readPrintQuote({ ...QUOTE, groups: [{ ...QUOTE.groups[0], count: "1e3" }] })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, groups: [{ ...QUOTE.groups[0], count: "-5" }] })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, groups: [] })).toBeNull();
  });

  it("refuses a quotation number or date in any other shape", () => {
    expect(readPrintQuote({ ...QUOTE, quoteNo: "<script>" })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, quoteDate: "tomorrow" })).toBeNull();
  });

  it("refuses names past their length and takes control characters out", () => {
    expect(readPrintQuote({ ...QUOTE, customerName: "ก".repeat(121) })).toBeNull();
    expect(readPrintQuote({ ...QUOTE, customerName: "A\u0000B\nC" })?.customerName).toBe("A B C");
  });
});

describe("the sheet page's address", () => {
  it("carries the quotation there and back, Thai and all", () => {
    expect(decodePrintQuote(encodePrintQuote(QUOTE))).toEqual(QUOTE);
  });

  it("gives nothing for an address that was not written by encodePrintQuote", () => {
    expect(decodePrintQuote(undefined)).toBeNull();
    expect(decodePrintQuote("not base64!")).toBeNull();
    expect(decodePrintQuote(Buffer.from('{"product":"health"}').toString("base64url"))).toBeNull();
  });
});

describe("pdfFileName", () => {
  it("names the file after the customer, or the quotation's number when no name was typed", () => {
    expect(pdfFileName(QUOTE)).toBe("ใบเสนอราคา-ประกันกลุ่ม-บริษัท สยามพาร์ทเนอร์ จำกัด.pdf");
    expect(pdfFileName({ ...QUOTE, customerName: "" })).toBe("ใบเสนอราคา-ประกันกลุ่ม-QT-20261120-412.pdf");
    expect(pdfFileName({ ...QUOTE, lang: "en", customerName: "A/B Co." })).toBe("Group-Insurance-Quote-A B Co..pdf");
  });
});

const render = vi.mocked(renderQuotePdf);
const refuse = vi.mocked(refuseUnless);
let n = 0;
const post = (body: unknown) =>
  new Request("http://localhost/api/group-quote-pdf", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.1.0.${++n}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  render.mockReset();
  render.mockResolvedValue(Buffer.from("%PDF-1.4"));
  refuse.mockReset();
  refuse.mockResolvedValue(null);
});

describe("POST /api/group-quote-pdf", () => {
  it("prints our own sheet page with the quotation asked for", async () => {
    const res = await POST(post(QUOTE));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(render).toHaveBeenCalledWith(`${siteOrigin()}/group-insurance/sheet?q=${encodePrintQuote(QUOTE)}`, expect.anything());
  });

  it("refuses somebody not signed in", async () => {
    refuse.mockResolvedValue(Response.json({ ok: false }, { status: 401 }));
    const res = await POST(post(QUOTE));
    expect(res.status).toBe(401);
    expect(render).not.toHaveBeenCalled();
  });

  it("refuses a body that is not a quotation", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect((await POST(post({ ...QUOTE, url: "https://evil.example" }))).status).toBe(200);
    expect((await POST(post({ ...QUOTE, product: "x" }))).status).toBe(400);
    // the extra key above is dropped, never printed
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0]).not.toContain("evil");
  });

  it("says so when the printer fails", async () => {
    render.mockRejectedValue(new Error("chrome"));
    const res = await POST(post(QUOTE));
    expect(res.status).toBe(503);
  });
});
