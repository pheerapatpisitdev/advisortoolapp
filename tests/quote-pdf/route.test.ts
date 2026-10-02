import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/quote-pdf/render", () => ({ renderQuotePdf: vi.fn() }));

import { GET } from "@/app/api/quote-pdf/route";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { queryFrom } from "@/lib/ihealthy-link";
import { cardVersionFor } from "@/lib/card-theme";
import { renderQuotePdf } from "@/lib/quote-pdf/render";
import { siteOrigin } from "@/lib/site-url";

/** The route opens our own page, pre-filled from its link, and prints it: it must open nothing else. */

const render = vi.mocked(renderQuotePdf);
let n = 0;
/** A fresh caller each time, so one test's calls never count against the next. */
const req = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { headers: { "x-real-ip": `10.0.0.${++n}`, ...headers } });
const V = cardVersionFor();
const PLB = `/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB12&v=${V}`;

beforeEach(() => {
  render.mockReset();
  render.mockResolvedValue(Buffer.from("%PDF-1.4"));
});

describe("GET /api/quote-pdf", () => {
  it("prints our own page with the figures asked for", async () => {
    const res = await GET(req(PLB));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="plb-M35.pdf"');
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    expect(render).toHaveBeenCalledWith(
      `${siteOrigin()}/plb?age=35&sex=M&sum=1000000&variant=PLB12`,
      expect.anything(),
    );
  });

  it("refuses a page outside the six", async () => {
    const res = await GET(req("/api/quote-pdf?page=fhc&age=35&sex=M&sum=1000000&variant=PLB12"));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(render).not.toHaveBeenCalled();
  });

  it("refuses figures the engine cannot price", async () => {
    const res = await GET(req("/api/quote-pdf?page=plb&age=99&sex=M&sum=1000000&variant=PLB12"));
    expect(res.status).toBe(400);
    expect(render).not.toHaveBeenCalled();
  });

  it("refuses a key it does not know", async () => {
    const res = await GET(req(`${PLB}&next=https://evil.example`));
    expect(res.status).toBe(400);
    expect(render).not.toHaveBeenCalled();
  });

  it("refuses a key given twice", async () => {
    const res = await GET(req(`${PLB}&age=36`));
    expect(res.status).toBe(400);
    expect(render).not.toHaveBeenCalled();
  });

  it("answers 503 with the page link when Chrome fails", async () => {
    render.mockRejectedValue(new Error("no chrome"));
    const res = await GET(req(PLB));
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("/plb?age=35");
    expect(body).toContain("ส่งไฟล์ไม่สำเร็จครับ เปิดหน้านี้แล้วกดปุ่มบันทึก PDF ได้เลยครับ");
  });

  it("limits a caller, but not the bot", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const ip = { "x-real-ip": "192.0.2.77" };
    for (let i = 0; i < 6; i++) expect((await GET(req(PLB, ip))).status).toBe(200);
    const limited = await GET(req(PLB, ip));
    expect(limited.status).toBe(429);
    expect(await limited.text()).toContain("รอสักครู่แล้วขอใหม่นะครับ");
    expect((await GET(req(PLB, { ...ip, authorization: "Bearer s3cret" }))).status).toBe(200);
    expect((await GET(req(PLB, { ...ip, authorization: "Bearer wrong" }))).status).toBe(429);
    vi.unstubAllEnvs();
  });

  it("prints the iHealthy proposal", async () => {
    const table = iHealthyTable();
    const query = queryFrom(table, IHEALTHY_OPENING);
    const res = await GET(req(`/api/quote-pdf?page=ihealthy-ultra&${query}&v=${V}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('inline; filename="ihealthy-ultra-F35.pdf"');
    expect(render.mock.calls[0][0]).toBe(`${siteOrigin()}/ihealthy-ultra?${query}`);
  });

  it("refuses an iHealthy link that is not what the page would write back", async () => {
    const res = await GET(req("/api/quote-pdf?page=ihealthy-ultra&age=35&sex=F&sa=1e308"));
    expect(res.status).toBe(400);
    expect(render).not.toHaveBeenCalled();
  });

  it("refuses an unknown key on the iHealthy page", async () => {
    const query = queryFrom(iHealthyTable(), IHEALTHY_OPENING);
    const res = await GET(req(`/api/quote-pdf?page=ihealthy-ultra&${query}&sum=5`));
    expect(res.status).toBe(400);
    expect(render).not.toHaveBeenCalled();
  });

  /**
   * The cache is keyed on the whole address, so a `v` of the caller's choosing would be a fresh
   * Chrome every time (final review, item 9). Only the current one is printed.
   */
  it("redirects a link with another version to the current one, without printing", async () => {
    for (const path of [
      "/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB12&v=x",
      "/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB12",
    ]) {
      const res = await GET(req(path));
      expect(res.status, path).toBe(308);
      const to = new URL(res.headers.get("location")!, "http://localhost");
      expect(to.pathname).toBe("/api/quote-pdf");
      expect(to.searchParams.get("v")).toBe(V);
      expect(to.searchParams.get("age")).toBe("35");
      expect(to.searchParams.get("variant")).toBe("PLB12");
    }
    expect(render).not.toHaveBeenCalled();
  });

  it("refuses a bad link before redirecting it", async () => {
    const res = await GET(req("/api/quote-pdf?page=plb&age=99&sex=M&sum=1000000&variant=PLB12&v=x"));
    expect(res.status).toBe(400);
  });

  /** LINE's flag for the phone's own browser (final review, item 10): accepted, and printed past. */
  it("accepts LINE's openExternalBrowser flag and leaves it out of the page it prints", async () => {
    const res = await GET(req(`${PLB}&openExternalBrowser=1`));
    expect(res.status).toBe(200);
    expect(render).toHaveBeenCalledWith(`${siteOrigin()}/plb?age=35&sex=M&sum=1000000&variant=PLB12`, expect.anything());
  });

  it("accepts the flag on the iHealthy page too", async () => {
    const query = queryFrom(iHealthyTable(), IHEALTHY_OPENING);
    const res = await GET(req(`/api/quote-pdf?page=ihealthy-ultra&${query}&v=${V}&openExternalBrowser=1`));
    expect(res.status).toBe(200);
    expect(render.mock.calls[0][0]).toBe(`${siteOrigin()}/ihealthy-ultra?${query}`);
  });

  it("keeps the flag through the version redirect", async () => {
    const res = await GET(req("/api/quote-pdf?page=plb&age=35&sex=M&sum=1000000&variant=PLB12&v=x&openExternalBrowser=1"));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location")!, "http://localhost").searchParams.get("openExternalBrowser")).toBe("1");
  });

  it("refuses the flag with any other value", async () => {
    const res = await GET(req(`${PLB}&openExternalBrowser=0`));
    expect(res.status).toBe(400);
    expect(render).not.toHaveBeenCalled();
  });

  it("leaves the flag out of the page link it falls back to", async () => {
    render.mockRejectedValue(new Error("no chrome"));
    const res = await GET(req(`${PLB}&openExternalBrowser=1`));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("openExternalBrowser");
  });
});
