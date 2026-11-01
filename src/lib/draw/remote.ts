import type { ReactNode } from "react";
import { providerKey } from "@/lib/ai/client";
import type { DrawFont } from "@/lib/draw/fonts";
import { toTree, toWireFonts } from "@/lib/draw/tree";
import { DRAW_CORE } from "@/lib/draw/version";
import { googleIdToken, parseGcpKey } from "@/lib/video/engines/cloudrun";

/**
 * The draw service on Cloud Run, advisortool-draw (draw/server.ts): pictures, the quote PDF and
 * the cover crop are made there, not on the web app's server (Cloudflare move step 1, owner chose
 * ก 2026-11-02, mockup https://claude.ai/artifact/AZyE2MYMK1f66JSta6cxN7).
 *
 * Set by one env var, DRAW_URL; without it every caller draws where it is, as before. The service
 * lets in only the Google account of the key Cloud Run's clips already use (provider "gcp" on
 * ตั้งค่า AI): the app signs in with that key, so there is no secret of its own to keep in step.
 * Every call here throws on any failure — not set, no key, a refusal, a timeout — and the caller
 * then draws where it is, so a service that is down costs time, never a picture.
 */

export class DrawUnavailable extends Error {}

const serviceUrl = (): string | null => process.env.DRAW_URL?.trim().replace(/\/+$/, "") || null;

export const drawServiceSet = (): boolean => serviceUrl() !== null;

async function signIn(url: string): Promise<string> {
  const stored = await providerKey("gcp").catch(() => null);
  const key = stored ? parseGcpKey(stored) : null;
  if (!key) throw new DrawUnavailable("no Google Cloud key to sign in to the draw service");
  return googleIdToken(key, url).catch((e) => {
    throw new DrawUnavailable(e instanceof Error ? e.message : String(e));
  });
}

async function call(route: string, body: BodyInit, contentType: string, timeoutMs: number, query = ""): Promise<Response> {
  const url = serviceUrl();
  if (!url) throw new DrawUnavailable("draw service not set");
  const token = await signIn(url);
  const res = await fetch(`${url}${route}${query}`, {
    method: "POST",
    headers: { "content-type": contentType, authorization: `Bearer ${token}`, "x-draw-core": DRAW_CORE },
    body,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    const why = await res.text().catch(() => "");
    throw new DrawUnavailable(`draw service ${route} ${res.status}: ${why.slice(0, 200)}`);
  }
  return res;
}

const json = (o: unknown) => JSON.stringify(o);

export async function drawPngThere(
  element: ReactNode, size: { width: number; height: number; scale?: number }, fonts: DrawFont[],
): Promise<Buffer> {
  const res = await call("/png", json({ tree: toTree(element), size, fonts: toWireFonts(fonts) }), "application/json", 20_000);
  return Buffer.from(await res.arrayBuffer());
}

export async function laidOutHeightThere(element: ReactNode, width: number, fonts: DrawFont[]): Promise<number> {
  const res = await call("/height", json({ tree: toTree(element), width, fonts: toWireFonts(fonts) }), "application/json", 10_000);
  const { height } = (await res.json()) as { height: number };
  if (typeof height !== "number") throw new DrawUnavailable("draw service /height: no height");
  return height;
}

export async function cropThere(bytes: Buffer, aspect: string, mimeType: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const res = await call("/crop", new Uint8Array(bytes), mimeType, 20_000, `?aspect=${encodeURIComponent(aspect)}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") ?? mimeType };
}

export interface PrintCookie { name: string; value: string; httpOnly?: boolean }

export async function printPdfThere(
  url: string, opts: { timeoutMs: number; lang?: string; cookies: PrintCookie[] },
): Promise<Buffer> {
  // the service's own deadline is the caller's; a little longer here so its answer, not ours, ends it
  const res = await call("/pdf", json({ url, ...opts }), "application/json", opts.timeoutMs + 5_000);
  return Buffer.from(await res.arrayBuffer());
}
