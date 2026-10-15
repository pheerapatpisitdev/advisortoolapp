import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isFace } from "@/lib/story/faces";

/**
 * The cartoon faces as the clip's drawer takes them: data URIs of the files in
 * public/story/faces (lib/story/faces.ts), read once a process. A scene draws dozens of frames
 * with the same 48 faces, so each file is read and encoded once.
 */

const DIR = join(process.cwd(), "public/story/faces");
const cache = new Map<string, Promise<string>>();

function faceUri(faceId: string, gray: boolean): Promise<string> {
  if (!isFace(faceId)) return Promise.reject(new Error(`no face ${faceId}`));
  const key = `${faceId}${gray ? "-g" : ""}`;
  let got = cache.get(key);
  if (!got) {
    got = readFile(join(DIR, `${key}.jpg`)).then((b) => `data:image/jpeg;base64,${b.toString("base64")}`);
    got.catch(() => cache.delete(key));
    cache.set(key, got);
  }
  return got;
}

/** every face asked for, in colour and in grey: `${id}` and `${id}-g` */
export async function faceUris(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const pairs = await Promise.all(unique.flatMap((id) => [
    faceUri(id, false).then((u) => [id, u] as const),
    faceUri(id, true).then((u) => [`${id}-g`, u] as const),
  ]));
  return Object.fromEntries(pairs);
}
