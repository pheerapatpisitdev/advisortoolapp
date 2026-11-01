/**
 * The Worker's bindings when this request runs on Cloudflare (OpenNext puts its context on
 * globalThis under this symbol for every request), null on Vercel or in a test. Read here rather
 * than through @opennextjs/cloudflare, so the Vercel build never loads the adapter.
 */
export interface CloudflareEnv {
  /** the files under public/, as the Worker serves them */
  ASSETS?: { fetch: (input: Request | string | URL) => Promise<Response> };
  /** runLater's queue (src/lib/later.ts, wrangler.jsonc) */
  LATER_QUEUE?: { send: (body: unknown) => Promise<void> };
}

export function cloudflareEnv(): CloudflareEnv | null {
  const context = (globalThis as Record<symbol, { env?: CloudflareEnv } | undefined>)[Symbol.for("__cloudflare-context__")];
  return context?.env ?? null;
}

/** a file under public/ (`card/family.jpg`): off disk on Vercel, from the Worker's own assets on Cloudflare */
export async function publicFile(rel: string): Promise<Buffer> {
  const assets = cloudflareEnv()?.ASSETS;
  if (assets) {
    const res = await assets.fetch(new URL(`/${rel}`, "https://assets.local"));
    if (!res.ok) throw new Error(`public/${rel}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  return readFile(path.join(process.cwd(), "public", rel));
}
