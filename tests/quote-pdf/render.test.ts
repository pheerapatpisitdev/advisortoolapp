import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const launch = vi.hoisted(() => vi.fn());
vi.mock("puppeteer-core", () => ({ default: { launch } }));
vi.mock("@sparticuz/chromium", () => ({
  default: { args: [], executablePath: vi.fn(async () => "/chrome") },
}));

import { renderQuotePdf } from "@/lib/quote-pdf/render";

/** The 45-second bound covers Chrome's launch, and the browser never outlives the call. */

function fakeBrowser(over: { pdf?: () => Promise<Uint8Array> } = {}) {
  const page = {
    emulateMediaType: vi.fn(async () => {}),
    goto: vi.fn(async () => {}),
    waitForSelector: vi.fn(async () => {}),
    evaluate: vi.fn(async (fn: () => unknown) => fn()),
    pdf: vi.fn(over.pdf ?? (async () => new Uint8Array([37, 80, 68, 70]))),
  };
  return { page, close: vi.fn(async () => {}), newPage: vi.fn(async () => page) };
}

beforeEach(() => {
  launch.mockReset();
  vi.useFakeTimers();
  vi.stubGlobal("window", {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
});
