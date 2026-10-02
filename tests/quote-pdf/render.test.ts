import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const launch = vi.hoisted(() => vi.fn());
vi.mock("puppeteer-core", () => ({ default: { launch } }));
vi.mock("@sparticuz/chromium", () => ({
  default: { args: ["--single-process"], executablePath: vi.fn(async () => "/chrome") },
}));

import chromium from "@sparticuz/chromium";
import { renderQuotePdf } from "@/lib/quote-pdf/render";

/** The 45-second bound covers Chrome's launch, and the browser never outlives the call. */

function fakeBrowser(over: { pdf?: () => Promise<Uint8Array>; close?: () => Promise<void> } = {}) {
  const page = {
    emulateMediaType: vi.fn(async () => {}),
    emulateTimezone: vi.fn(async () => {}),
    goto: vi.fn(async () => {}),
    setCookie: vi.fn(async () => {}),
    waitForSelector: vi.fn(async () => {}),
    evaluate: vi.fn(async (fn: () => unknown) => fn()),
    pdf: vi.fn(over.pdf ?? (async () => new Uint8Array([37, 80, 68, 70]))),
  };
  return { page, close: vi.fn(over.close ?? (async () => {})), newPage: vi.fn(async () => page) };
}

beforeEach(() => {
  launch.mockReset();
  vi.useFakeTimers();
  vi.stubGlobal("window", {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("renderQuotePdf", () => {
  it("prints, and tolerates a page with no __quotePdf hook", async () => {
    const b = fakeBrowser();
    launch.mockResolvedValue(b);
    const pdf = await renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    expect(pdf.toString()).toBe("%PDF");
    expect(b.page.evaluate).toHaveBeenCalled();
    expect(b.close).toHaveBeenCalled();
  });

  it("rejects at the deadline when the launch never answers", async () => {
    launch.mockReturnValue(new Promise(() => {}));
    const result = renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    const caught = expect(result).rejects.toThrow(/1000 ms/);
    await vi.advanceTimersByTimeAsync(1000);
    await caught;
  });

  it("closes a browser that comes up after the deadline", async () => {
    const b = fakeBrowser();
    let up!: (v: unknown) => void;
    launch.mockReturnValue(new Promise((r) => (up = r)));
    const result = renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    const caught = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await caught;
    expect(b.close).not.toHaveBeenCalled();
    up(b);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.close).toHaveBeenCalledTimes(1);
  });

  it("closes the browser when printing fails", async () => {
    const b = fakeBrowser({ pdf: async () => { throw new Error("boom"); } });
    launch.mockResolvedValue(b);
    await expect(renderQuotePdf("http://x/plb", { timeoutMs: 1000 })).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(0);
    expect(b.close).toHaveBeenCalled();
  });

  it("gives the launch the same bound", async () => {
    launch.mockResolvedValue(fakeBrowser());
    await renderQuotePdf("http://x/plb", { timeoutMs: 1234 });
    expect(launch.mock.calls[0][0]).toMatchObject({ timeout: 1234 });
  });

  it("uses puppeteer's own flags for a local Chrome", async () => {
    vi.stubEnv("CHROME_PATH", "/Applications/Chrome");
    launch.mockResolvedValue(fakeBrowser());
    await renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    const opts = launch.mock.calls[0][0];
    expect(opts).toMatchObject({ executablePath: "/Applications/Chrome", headless: true });
    expect(opts.args).toBeUndefined();
  });

  it("uses the serverless flags and headless shell with the bundled Chrome", async () => {
    vi.stubEnv("CHROME_PATH", "");
    launch.mockResolvedValue(fakeBrowser());
    await renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    const opts = launch.mock.calls[0][0];
    expect(opts).toMatchObject({ executablePath: "/chrome", headless: "shell" });
    expect(opts.args).toBe(chromium.args);
  });

  /** The iHealthy page reads its language from a cookie only, so English is a cookie set first. */
  it("prints the iHealthy page in English when asked, with the cookie set before the page loads", async () => {
    const b = fakeBrowser();
    launch.mockResolvedValue(b);
    await renderQuotePdf("http://x/ihealthy-ultra?age=35", { timeoutMs: 1000, lang: "en" });
    expect(b.page.setCookie).toHaveBeenCalledWith(expect.objectContaining({ name: "ihu-lang", value: "en", url: "http://x/ihealthy-ultra?age=35" }));
    expect(b.page.setCookie.mock.invocationCallOrder[0]).toBeLessThan(b.page.goto.mock.invocationCallOrder[0]);
  });

  it("sets no cookie for Thai", async () => {
    const b = fakeBrowser();
    launch.mockResolvedValue(b);
    await renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    expect(b.page.setCookie).not.toHaveBeenCalled();
  });

  /** The page stamps "พิมพ์เมื่อ" in the browser's zone, and Vercel's is UTC (final review, item 3). */
  it("prints in Bangkok's time zone, set before the page loads", async () => {
    const b = fakeBrowser();
    launch.mockResolvedValue(b);
    await renderQuotePdf("http://x/plb", { timeoutMs: 1000 });
    expect(b.page.emulateTimezone).toHaveBeenCalledWith("Asia/Bangkok");
    expect(b.page.emulateTimezone.mock.invocationCallOrder[0]).toBeLessThan(b.page.goto.mock.invocationCallOrder[0]);
  });

  /** A warm instance must not keep Chrome running after the answer (final review, item 8). */
  it("waits for the browser to close before answering", async () => {
    let closed = false;
    const b = fakeBrowser({ close: () => new Promise<void>((r) => setTimeout(() => { closed = true; r(); }, 500)) });
    launch.mockResolvedValue(b);
    let done = false;
    const result = renderQuotePdf("http://x/plb", { timeoutMs: 5000 }).then((pdf) => { done = true; return pdf; });
    await vi.advanceTimersByTimeAsync(100);
    expect(b.close).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(closed).toBe(true);
    expect(done).toBe(true);
    expect((await result).toString()).toBe("%PDF");
  });

  it("does not wait more than two seconds for a browser that will not close", async () => {
    const b = fakeBrowser({ close: () => new Promise<void>(() => {}) });
    launch.mockResolvedValue(b);
    let done = false;
    const result = renderQuotePdf("http://x/plb", { timeoutMs: 5000 }).then((pdf) => { done = true; return pdf; });
    await vi.advanceTimersByTimeAsync(1900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
    expect((await result).toString()).toBe("%PDF");
  });
});
