import { staticFile } from "remotion";

/** A file's bytes, as much of a Node Buffer as themes.tsx and story-faces.ts use: its length and base64. */
export class Bytes extends Uint8Array {
  override toString(enc?: string): string {
    if (enc !== "base64") return super.toString();
    let s = "";
    for (let i = 0; i < this.length; i += 0x8000) s += String.fromCharCode(...this.subarray(i, i + 0x8000));
    return btoa(s);
  }
}

/** readFile(join(process.cwd(), "public/…")): the same file from this project's public folder; a link as it is */
export async function readFile(file: string): Promise<Bytes> {
  const rel = /^https?:\/\//.test(file) ? file : staticFile(file.slice(file.indexOf("public/") + "public/".length));
  const r = await fetch(rel);
  if (!r.ok) throw new Error(`a file: ${r.status}`);
  return new Bytes(await r.arrayBuffer());
}
