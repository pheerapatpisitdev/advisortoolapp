import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Aspect } from "@/lib/ai/images";
import { cropHere } from "@/lib/content/crop-here";
import { drawPngHere, laidOutHeightHere } from "@/lib/draw/core";
import { DRAW_CORE } from "@/lib/draw/version";
import { fromTree, fromWireFonts, type WireFont } from "@/lib/draw/wire";
import { printPdfHere } from "@/lib/quote-pdf/print";
import type { PrintCookie } from "@/lib/draw/remote";
import type { PrintedLang } from "@/lib/quote-pdf/langs";

/**
 * advisortool-draw: the Cloud Run service that draws for the web app (Cloudflare move step 1,
 * owner chose ก 2026-11-02). The app's own code on the drawing side — src/lib/draw/core.ts,
 * content/crop-here.ts, quote-pdf/print.ts — bundled into one file by draw/ship.sh, so a picture
 * drawn here is the picture the app would have drawn.
 *
 *   POST /png     { tree, size, fonts }        → the PNG
 *   POST /height  { tree, width, fonts }       → { height }
 *   POST /crop?aspect=9:16   the image's bytes → the cut, its type in content-type
 *   POST /pdf     { url, timeoutMs, lang?, cookies } → the PDF
 *   GET  /health                               → { ok, core }
 *
 * Who may call is Cloud Run's to say: the service lets in only the account of the app's Google
 * key (draw/ship.sh). Every POST carries the drawing code's fingerprint (x-draw-core); a caller
 * whose code is not the code here gets 409 and draws for itself.
 */

const PORT = Number(process.env.PORT ?? 8080);
/** a picture's JSON is a few hundred KB at most; a cover to crop a few MB */
const MAX_BODY = 25 * 1024 * 1024;
const ASPECTS = new Set<Aspect>(["1:1", "9:16", "16:9"]);

class Refused extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Refused(413, "too large");
    parts.push(chunk as Buffer);
  }
  return Buffer.concat(parts);
}

const asJson = (b: Buffer) => {
  try {
    return JSON.parse(b.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Refused(400, "not JSON");
  }
};

function send(res: ServerResponse, status: number, type: string, data: Buffer | string) {
  res.writeHead(status, { "content-type": type, "x-draw-core": DRAW_CORE });
  res.end(data);
}

async function answer(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://draw");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, "application/json", JSON.stringify({ ok: true, core: DRAW_CORE }));
  if (req.method !== "POST") throw new Refused(405, "POST only");
  const core = req.headers["x-draw-core"];
  if (core !== DRAW_CORE) throw new Refused(409, `drawing code ${String(core)} is not ${DRAW_CORE} here`);
  const raw = await body(req);

  switch (url.pathname) {
    case "/png": {
      const { tree, size, fonts } = asJson(raw) as { tree: unknown; size: { width: number; height: number; scale?: number }; fonts: WireFont[] };
      const png = await drawPngHere(fromTree(tree) as never, size, fromWireFonts(fonts));
      return send(res, 200, "image/png", png);
    }
    case "/height": {
      const { tree, width, fonts } = asJson(raw) as { tree: unknown; width: number; fonts: WireFont[] };
      const height = await laidOutHeightHere(fromTree(tree) as never, width, fromWireFonts(fonts));
      return send(res, 200, "application/json", JSON.stringify({ height }));
    }
    case "/crop": {
      const aspect = url.searchParams.get("aspect") as Aspect;
      if (!ASPECTS.has(aspect)) throw new Refused(400, "aspect");
      const out = await cropHere(raw, aspect, req.headers["content-type"] ?? "image/jpeg");
      return send(res, 200, out.mimeType, out.bytes);
    }
    case "/pdf": {
      const { url: page, timeoutMs, lang, cookies } = asJson(raw) as { url: string; timeoutMs: number; lang?: PrintedLang; cookies: PrintCookie[] };
      if (!/^https?:\/\//.test(page)) throw new Refused(400, "url");
      const pdf = await printPdfHere(page, { timeoutMs: Math.min(Number(timeoutMs) || 45_000, 55_000), cookies, ...(lang ? { lang } : {}) });
      return send(res, 200, "application/pdf", pdf);
    }
    default:
      throw new Refused(404, "no such route");
  }
}

createServer((req, res) => {
  answer(req, res).catch((e) => {
    const status = e instanceof Refused ? e.status : 500;
    if (status === 500) console.error(`draw: ${req.url} failed`, e);
    if (!res.headersSent) send(res, status, "text/plain; charset=utf-8", e instanceof Error ? e.message : String(e));
    else res.destroy();
  });
}).listen(PORT, () => console.log(`draw ${DRAW_CORE} on :${PORT}`));
