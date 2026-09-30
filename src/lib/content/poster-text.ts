import { strayNumbers } from "./check";
import { checkPolicy } from "./policy";
import type { PosterSpec } from "./poster";

/**
 * A poster whose words the image model drew (owner, 2026-10-01): what was read back off the
 * picture set against what it was told to draw. Pure and browser-safe, so the editor shows the
 * same verdict the server kept. It finds and warns; the agent looks and ticks (publish-flow.ts
 * holds the piece until they have).
 */

export const READ_FAILED = "อ่านตัวหนังสือบนภาพไม่ได้ ตรวจเองนะครับ";

/** a poster's words as one string, kind by kind — what the picture was drawn from */
export function blocksKey(p: Pick<PosterSpec, "blocks">): string {
  return p.blocks.map((b) => `${b.kind}:${b.text}`).join("\n");
}

/** none: the code draws the words · unchecked / checked: the model drew them · stale: edited since */
export function aiTextState(p: PosterSpec | undefined): "none" | "unchecked" | "checked" | "stale" {
  if (!p?.aiText) return "none";
  if (p.aiText.blocks !== blocksKey(p)) return "stale";
  return p.aiText.checked ? "checked" : "unchecked";
}

const arabic = (t: string) => t.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
/** a model reads a picture's lines and spaces its own way; the words are what is compared */
const squeeze = (t: string) => arabic(t).replace(/[\s​]+/g, "");
const clip = (t: string, n = 40) => (t.length > n ? `${t.slice(0, n)}…` : t);

export function comparePosterRead(read: string, poster: Pick<PosterSpec, "blocks">): string[] {
  if (!read.trim()) return [READ_FAILED];
  const issues: string[] = [];
  let rest = squeeze(read);
  for (const b of poster.blocks) {
    const want = squeeze(b.text);
    const at = want ? rest.indexOf(want) : -1;
    if (at < 0) {
      issues.push(`หาไม่เจอบนภาพ (อาจสะกดเพี้ยน): “${b.text}”`);
      continue;
    }
    rest = `${rest.slice(0, at)}|${rest.slice(at + want.length)}`;
  }
  const words = poster.blocks.map((b) => b.text).join("\n");
  const figures = strayNumbers(read, words, { every: true });
  if (figures.length) issues.push(`ตัวเลขบนภาพที่ไม่มีในข้อความ: ${figures.join(", ")}`);
  for (const extra of rest.split("|").filter((t) => [...t.replace(/[^฀-๿A-Za-z]/g, "")].length >= 4)) {
    issues.push(`มีตัวหนังสืออื่นบนภาพ: “${clip(extra)}”`);
  }
  for (const f of checkPolicy(read)) issues.push(`กฎ Facebook: ${f.message}`);
  return issues;
}

/**
 * Whether the code sets the poster's words. Not when the model drew them into its picture — but a
 * picture that has gone missing draws the code's words on the plain theme, rather than nothing.
 */
export function codeDrawsWords(p: Pick<PosterSpec, "aiText">, hasPhoto: boolean): boolean {
  return !(p.aiText && hasPhoto);
}
