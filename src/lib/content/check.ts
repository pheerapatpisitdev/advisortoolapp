/**
 * The first check on a generated post: the numbers, and the words.
 *
 * Pure and without a model, so it costs nothing, runs on every piece, and cannot itself
 * invent anything. It only ever warns — the owner reads the post and decides — because a
 * rule that silently rewrote copy would be one more thing putting words in their mouth.
 */

export type WordKind = "banned" | "misspelling";

/** one entry of the owner's list, kept in ins_content_words and edited on /admin/knowledge */
export interface ContentWord {
  word: string;
  kind: WordKind;
  /** what to write instead; a misspelling has one, a banned claim usually does not */
  fix: string | null;
}

const UNIT: Record<string, number> = { "ล้าน": 1_000_000, "แสน": 100_000, "หมื่น": 10_000, "พัน": 1_000 };

/**
 * An amount as copy writes it: digits, then perhaps a Thai unit, then perhaps บาท or %.
 * `1 ล้าน`, `1,000,000 บาท` and `1.5 ล้านบาท` all land on one value, so the check compares
 * what was said rather than how it was typed.
 */
const AMOUNT = /(\d[\d,]*(?:\.\d+)?)\s*(ล้าน|แสน|หมื่น|พัน)?\s*(บาท|%)?/g;

/**
 * A script's own time markers, `[0–3 วิ]`, are stage directions and not claims.
 *
 * Only those: it was every `[…]`, so "[ตัวอย่าง: เบี้ยแค่ 3,500 บาท/เดือน]" went unchecked,
 * and a marker left unclosed hid everything up to the next "]".
 */
const stripMarkers = (text: string) => text.replace(/\[\s*\d+\s*[–-]\s*\d+\s*วิ[^\[\]\n]*\]/g, (m) => " ".repeat(m.length));

/**
 * Thai digits read as Arabic ones: "๕๐๐,๐๐๐ บาท" is the same claim as "500,000 บาท", and a
 * check that only knew 0–9 let it through. One character for one, so a match found in the
 * converted text is at the same place in the original, and is reported as the owner wrote it.
 */
const arabic = (text: string) => text.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));

interface Amount {
  raw: string;
  value: number;
  /** said as money or a percentage, rather than a bare count */
  priced: boolean;
}

function amounts(text: string): Amount[] {
  const out: Amount[] = [];
  // markers are blanked to their own length, so indexes still line up with `text`
  for (const m of stripMarkers(arabic(text)).matchAll(AMOUNT)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    out.push({ raw: text.slice(m.index, m.index + m[0].length).trim(), value: n * (m[2] ? UNIT[m[2]] : 1), priced: Boolean(m[3]) });
  }
  return out;
}

/** Every amount in a text, as plain values. */
export function numbersIn(text: string): number[] {
  return amounts(text).map((a) => a.value);
}

/**
 * The amounts in `output` that `brief` never had.
 *
 * Small bare numbers are the copy's own counting — "3 เหตุผล", "2 นาที" — and are left
 * alone; anything of a hundred or more, or said in baht or as a percentage, is a claim and has
 * to be one the model was handed. `every`: no counting is spared — for ความรู้, written from
 * general knowledge, where "ระยะรอคอย 30 วัน" is a claim about somebody's policy.
 */
export function strayNumbers(output: string, brief: string, opts: { every?: boolean } = {}): string[] {
  const allowed = new Set(numbersIn(brief).map(key));
  const stray = amounts(output)
    .filter((a) => opts.every || a.value >= 100 || a.priced)
    .filter((a) => !allowed.has(key(a.value)))
    .map((a) => a.raw);
  return [...new Set(stray)];
}

/** float-safe identity for an amount: 3.38 and 3.380 are the same figure */
const key = (n: number) => n.toFixed(2);

export interface WordHit extends ContentWord {
  at: number;
}

/**
 * The owner's words found in the text, in reading order.
 *
 * A banned claim preceded by ไม่ is the copy denying it — "เงินปันผลไม่การันตี" is exactly the
 * sentence the rule wants written — so that occurrence does not count.
 */
export function findWords(text: string, words: ContentWord[]): WordHit[] {
  const hits: WordHit[] = [];
  for (const w of words) {
    if (!w.word) continue;
    for (let at = text.indexOf(w.word); at >= 0; at = text.indexOf(w.word, at + w.word.length)) {
      if (w.kind === "banned" && text.slice(Math.max(0, at - 3), at) === "ไม่") continue;
      hits.push({ ...w, at });
      break;
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}
