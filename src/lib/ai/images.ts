/**
 * Image models, called as plain REST — the request shapes are the owner's Maryjane project's
 * (src/lib/ai/image.ts), which has drawn with both of these in production.
 *
 * Kept apart from providers.ts because nothing about them is shared with text: they are priced
 * per picture rather than per token, they answer in base64, and they take far longer.
 */

/** a photo the picture must draw from — a person's face, for people in posters */
export interface ReferenceImage {
  bytes: Buffer;
  mimeType: string;
}

export interface ImageArgs {
  apiKey: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  signal?: AbortSignal;
  references?: ReferenceImage[];
}

/** the providers whose callers below send reference photos; drawImage asks no other with them */
export const TAKES_REFERENCES = new Set(["google", "openai"]);

/** Gemini's interactions body: the text, then each photo as an image item after it. */
export function googleImageBody(model: string, prompt: string, params: Record<string, unknown>, references: ReferenceImage[] = []): unknown {
  return {
    model,
    input: [
      { type: "text", text: prompt },
      ...references.map((r) => ({ type: "image", mime_type: r.mimeType, data: r.bytes.toString("base64") })),
    ],
    response_format: {
      type: "image",
      // JPEG only: Maryjane found image/png refused with a 400 every time (2026-08-26)
      mime_type: "image/jpeg",
      aspect_ratio: params.aspect_ratio ?? "1:1",
      image_size: params.image_size ?? "1K",
    },
  };
}

/** OpenAI's edit endpoint, which takes the photos as image[]; generations takes none. */
export function openAiEditForm(model: string, prompt: string, params: Record<string, unknown>, references: ReferenceImage[]): FormData {
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  form.set("n", "1");
  form.set("size", String(params.size ?? "1024x1024"));
  form.set("quality", String(params.quality ?? "medium"));
  references.forEach((r, i) => form.append("image[]", new Blob([new Uint8Array(r.bytes)], { type: r.mimeType }), `ref-${i}.${r.mimeType.split("/")[1] ?? "jpg"}`));
  return form;
}

/** the shapes a cover is drawn in; everything else stays square */
export type Aspect = "1:1" | "9:16" | "16:9";

/**
 * A model row's params with this picture's shape put in. Gemini takes the ratio itself; OpenAI
 * only draws 1024x1536 and 1536x1024, the nearest, which cropToAspect then cuts to the ratio.
 * Without an aspect the params are the row's own.
 */
export function withAspect(provider: string, params: Record<string, unknown>, aspect?: Aspect): Record<string, unknown> {
  if (!aspect) return params;
  if (provider === "google") return { ...params, aspect_ratio: aspect };
  if (provider === "openai") return { ...params, size: aspect === "9:16" ? "1024x1536" : aspect === "16:9" ? "1536x1024" : "1024x1024" };
  return params;
}

export interface DrawnImage {
  bytes: Buffer;
  mimeType: string;
}

/**
 * The picture wherever a provider put it: OpenAI answers { data: [{ b64_json }] }, Gemini's
 * interactions endpoint { type: "image", data, mime_type }, its older one { inlineData }.
 * Walked rather than addressed, as Maryjane does, because these shapes move.
 */
export function findImagePart(body: unknown): { base64: string; mimeType: string } | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [body];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) { stack.push(...node); continue; }
    const o = node as Record<string, unknown>;
    if (o.type === "image" && typeof o.data === "string") return { base64: o.data, mimeType: String(o.mime_type ?? "image/png") };
    if (typeof o.b64_json === "string") return { base64: o.b64_json, mimeType: String(o.mime_type ?? "image/png") };
    const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined;
    if (inline && typeof inline === "object" && typeof inline.data === "string") {
      return { base64: inline.data, mimeType: String(inline.mimeType ?? inline.mime_type ?? "image/png") };
    }
    stack.push(...Object.values(o));
  }
  return null;
}

async function send(url: string, init: RequestInit): Promise<DrawnImage> {
  const res = await fetch(url, init);
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`${new URL(url).host} ${res.status}: ${raw.slice(0, 200)}`);
  }
  if (!res.ok) {
    const err = (body as { error?: { message?: string } }).error;
    throw new Error(`${new URL(url).host} ${res.status}: ${err?.message ?? raw.slice(0, 200)}`);
  }
  const found = findImagePart(body);
  if (!found) throw new Error(`${new URL(url).host}: answered without a picture`);
  return { bytes: Buffer.from(found.base64, "base64"), mimeType: found.mimeType };
}

export const IMAGE_CALLERS: Record<string, (a: ImageArgs) => Promise<DrawnImage>> = {
  openai: ({ apiKey, model, prompt, params, signal, references }) => references?.length
    ? send("https://api.openai.com/v1/images/edits", {
      method: "POST",
      // no content-type: fetch writes the multipart boundary itself
      headers: { authorization: `Bearer ${apiKey}` },
      body: openAiEditForm(model, prompt, params, references),
      signal,
    })
    : send("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, n: 1, size: params.size ?? "1024x1024", quality: params.quality ?? "medium" }),
      signal,
    }),

  google: ({ apiKey, model, prompt, params, signal, references }) =>
    send("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(googleImageBody(model, prompt, params, references)),
      signal,
    }),
};
