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

const UNIT: Record<string, number> = {
  "ล้าน": 1_000_000, "แสน": 100_000, "หมื่น": 10_000, "พัน": 1_000,
  million: 1_000_000, thousand: 1_000, M: 1_000_000, k: 1_000, K: 1_000,
};

/**
 * An amount as copy writes it: digits, then perhaps a Thai unit, then perhaps บาท or %.
 * `1 ล้าน`, `1,000,000 บาท` and `1.5 ล้านบาท` all land on one value, so the check compares
 * what was said rather than how it was typed. English copy is read the same way: `THB 1,000`,
 * `฿1,000`, `1,000 baht`, `1.5 million`, `100M`, `50k` (M and k only straight after the digits).
 */
const AMOUNT = /(?:(?<![A-Za-z])(THB|฿)\s?)?(\d[\d,]*(?:\.\d+)?)\s*(ล้าน|แสน|หมื่น|พัน|(?:[Mm]illion|MILLION|[Tt]housand|THOUSAND)(?![A-Za-z])|[MkK](?![A-Za-z]))?\s*(บาท|%|(?:[Bb]aht|BAHT|THB)(?![A-Za-z]))?/g;

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
  /** where it starts and ends in the text */
  at: number;
  end: number;
}

function amounts(text: string): Amount[] {
  const out: Amount[] = [];
  // markers are blanked to their own length, so indexes still line up with `text`
  for (const m of stripMarkers(arabic(text)).matchAll(AMOUNT)) {
    const n = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const end = m.index + m[0].trimEnd().length;
    out.push({ raw: text.slice(m.index, end).trim(), value: n * (m[3] ? (UNIT[m[3]] ?? UNIT[m[3].toLowerCase()]) : 1), priced: Boolean(m[1] || m[4]), at: m.index, end });
  }
  return out;
}

/** Every amount in a text, as plain values. */
export function numbersIn(text: string): number[] {
  return amounts(text).map((a) => a.value);
}

/**
 * Small bare numbers are the copy's own counting — "3 เหตุผล", "2 นาที" — and are left alone;
 * anything of a hundred or more, or said in baht or as a percentage, is a claim.
 */
const claimed = (a: Amount) => a.value >= 100 || a.priced;

/** The amounts in a text that are claims rather than counting (สูตรอ่าน-ดูจนจบ's on-screen check). */
export function claimedNumbers(text: string): number[] {
  return amounts(text).filter(claimed).map((a) => a.value);
}

/**
 * The amounts in `output` that `brief` never had: every claim has to be one the model was
 * handed. `every`: no counting is spared — for ความรู้, written from general knowledge, where
 * "ระยะรอคอย 30 วัน" is a claim about somebody's policy.
 */
export function strayNumbers(output: string, brief: string, opts: { every?: boolean } = {}): string[] {
  const allowed = new Set(numbersIn(brief).map(key));
  const stray = amounts(output)
    .filter((a) => opts.every || claimed(a))
    .filter((a) => !allowed.has(key(a.value)))
    .map((a) => a.raw);
  return [...new Set(stray)];
}

/**
 * The amounts in `text` equal to one of `values`, as written: "9,483.50 บาท" and "9483.5" are both
 * 9,483.50. For figures a text may not repeat even where they are true, such as an ad's premiums.
 */
export function sameFigures(text: string, values: number[]): string[] {
  const banned = new Set(values.map(key));
  return [...new Set(amounts(text).filter((a) => banned.has(key(a.value))).map((a) => a.raw))];
}

/**
 * A word that makes the amount after it a premium, with at most a few letters between them and
 * no digit: "เบี้ยเฉลี่ยวันละ 20", "เบี้ย 4,914", "ตกเดือนละ 1,800", "วันละ 48".
 */
const PREMIUM_LEAD = /(เบี้ย|ตกวันละ|ตกเดือนละ|วันละ|เดือนละ|ต่อเดือน|ต่อปี)[^\d\n]{0,12}$/;
/** what after an amount makes it a premium: "1,548 บาท/เดือน", "43,200 บาท ต่อปี" */
const PREMIUM_TAIL = /^\s*(?:\/|ต่อ)\s*(?:เดือน|ปี)/;
/** "6 ปี", "3 เดือน", "30 วัน": a length of time, even straight after เบี้ย ("จ่ายเบี้ยแค่ 6 ปี") */
const DURATION = /^\s*(?:ปี|เดือน|วัน|งวด|ครั้ง|เท่า|แผน)/;
/**
 * Money paid out rather than paid in, said by the day, month or year: "ชดเชยนอนโรงพยาบาลวันละ
 * 1,000 บาท", "บำนาญเดือนละ 10,000 บาท". Only วันละ, เดือนละ and ต่อ… give way to these — an
 * amount after เบี้ย or ตก… is a premium whatever came before.
 */
const BENEFIT = /ชดเชย|บำนาญ|ค่ารักษา|ค่าห้อง|รายได้|ลดหย่อน|เงินคืน|รับเงิน|วงเงิน/;

/**
 * The amounts in a text said as a premium: next to เบี้ย, วันละ, เดือนละ, ต่อเดือน, ต่อปี, /เดือน,
 * /ปี, ตกวันละ or ตกเดือนละ. Coverage, ages, counts and percentages are not, and neither is a
 * benefit paid by the day or the month. A long ad's model may write none of these, true or not:
 * the code prints every premium (spec 2026-10-05, "AI never writes a premium").
 */
export function premiumAmounts(text: string): string[] {
  const out: string[] = [];
  for (const a of amounts(text)) {
    if (a.raw.endsWith("%")) continue;
    const after = text.slice(a.end);
    if (DURATION.test(after) && !/บาท|฿|THB/i.test(a.raw)) continue;
    const lineStart = text.lastIndexOf("\n", a.at - 1) + 1;
    const before = text.slice(lineStart, a.at);
    const lead = PREMIUM_LEAD.exec(before);
    // the words just before the premium word, or before the amount when only its tail says so
    const context = before.slice(Math.max(0, (lead ? lead.index : before.length) - 24), lead ? lead.index : before.length);
    const premium = lead
      ? /^(เบี้ย|ตก)/.test(lead[1]) || !BENEFIT.test(context)
      : PREMIUM_TAIL.test(after) && !BENEFIT.test(context);
    if (premium) out.push(a.raw);
  }
  return [...new Set(out)];
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
