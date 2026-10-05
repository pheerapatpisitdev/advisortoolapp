import type { Lang } from "./output";

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
  /** said with a unit: พัน, หมื่น, แสน, ล้าน, k, M… */
  unit: boolean;
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
    out.push({ raw: text.slice(m.index, end).trim(), value: n * (m[3] ? (UNIT[m[3]] ?? UNIT[m[3].toLowerCase()]) : 1), priced: Boolean(m[1] || m[4]), unit: Boolean(m[3]), at: m.index, end });
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
 * no digit: "เบี้ยเฉลี่ยวันละ 20 บาท", "เบี้ย 4,914 บาท", "ตกเดือนละ 1,800 บาท", "ปีละ 14,350 บาท".
 */
const PREMIUM_LEAD = /(เบี้ย|ตกวันละ|ตกเดือนละ|วันละ|เดือนละ|ปีละ|ต่อเดือน|ต่อปี)[^\d\n]{0,12}$/;
/** what after an amount makes it a premium: "1,548 บาท/เดือน", "48 บาทต่อวัน", "43,200 บาท ต่อปี" */
const PREMIUM_TAIL = /^\s*(?:\/|ต่อ)\s*(?:เดือน|ปี|วัน)/;
/**
 * Money paid out rather than paid in, said by the day, month or year: "ชดเชยนอนโรงพยาบาลวันละ
 * 1,000 บาท", "บำนาญเดือนละ 10,000 บาท", "ห้องเดี่ยวมาตรฐาน วันละ 5,000 บาท", within BENEFIT_REACH
 * letters before the premium word (anywhere in the clause when only a tail says premium) — or a household's own money (HOUSEHOLD). Only วันละ, เดือนละ,
 * ปีละ and ต่อ… give way to these — an amount after เบี้ย or ตก… is a premium whatever came before.
 */
const BENEFIT = /ชดเชย|บำนาญ|ค่ารักษา|ห้อง|รายได้|ลดหย่อน|เงินคืน|รับเงิน|วงเงิน/;
/** how far before the premium word a benefit word may sit: "ชดเชยนอนโรงพยาบาลวันละ", "ห้องเดี่ยวมาตรฐาน วันละ" */
const BENEFIT_REACH = 20;
/**
 * A household's own money, right before the word: "ผ่อนบ้านเดือนละ", "เงินเดือน 30,000 บาท/เดือน",
 * "ค่าเทอมลูกปีละ", "รายจ่ายเดือนละ". Only right before — "ผ่อนบ้านอยู่ วันละ 48 บาท" is a premium.
 */
const HOUSEHOLD = /(?:ผ่อน(?:บ้าน|รถ|คอนโด)?|เงินเดือน|ค่าเทอม(?:ลูก)?|รายจ่าย)\s*$/;
/**
 * …and an amount whose only premium sign is after it is cover when คุ้มครอง is right before it:
 * "คุ้มครองสูงสุด 60 ล้านบาทต่อปี". Not "คุ้มครองครอบครัว เพียง 1,196 บาท/เดือน" (a premium).
 */
const COVER = /คุ้มครอง(?:สูงสุด)?(?:ถึง)?\s*$/;
/**
 * Right after เบี้ย (or ตก…ละ) an amount is a premium even without บาท when it looks like money —
 * a comma or three digits: "เบี้ย 1,548", "ตกเดือนละ 1,196"; not "เบี้ยส่วน CI 123", whose
 * เบี้ย is not right before it.
 */
const BARE_LEAD = /(?:เบี้ย(?:ปีแรก)?(?:เฉลี่ย)?(?:วันละ|เดือนละ|ปีละ)?|ตก(?:วัน|เดือน|ปี)ละ)\s*(?:แค่|เพียง|เริ่มต้น|ประมาณ)?\s*$/;
/** the words a premium clause starts with before its premium word: "(เฉลี่ยวันละ …", "จ่ายแค่ …" */
const CLAUSE_HEAD = /(?:จ่าย|ชำระ)?(?:เบี้ย)?(?:ปีแรก)?(?:เฉลี่ย|แค่|เพียง|เริ่มต้น|เริ่ม)*\s*$/;

/** a premium in a text: the amount as written, and the clause around it that says it */
interface PremiumSpan {
  raw: string;
  from: number;
  to: number;
}

/**
 * The amounts in a text said as a premium, with the clause that says each. An amount counts only
 * as money — in baht (บาท, ฿, THB), with a unit (พัน, หมื่น, ล้าน…), by the month, year or day
 * after it, or money-like right after เบี้ย (BARE_LEAD) — so "เบี้ยส่วน CI 123", "จ่ายเบี้ยแค่ 9 ปี" and "เบี้ยสำหรับอายุ 35" are not; and
 * only next to เบี้ย, วันละ, เดือนละ, ปีละ, ต่อเดือน, ต่อปี, ตกวันละ, ตกเดือนละ before it, or /เดือน,
 * /ปี, /วัน, ต่อ… after it. A benefit paid by the day, month or year (BENEFIT, COVER) is not.
 */
function premiumSpans(text: string, lang: Lang = "th"): PremiumSpan[] {
  if (lang === "en") return premiumSpansEn(text);
  const out: PremiumSpan[] = [];
  let prevEnd = 0;
  for (const a of amounts(text)) {
    const lineStart = text.lastIndexOf("\n", a.at - 1) + 1;
    // the words since the last amount on this line: the clause this one is said in
    const since = Math.max(lineStart, prevEnd);
    prevEnd = a.end;
    if (a.raw.endsWith("%")) continue;
    const after = text.slice(a.end);
    const tail = PREMIUM_TAIL.exec(after);
    const before = text.slice(since, a.at);
    const bare = BARE_LEAD.test(before) && /,|\d{3}/.test(a.raw);
    if (!a.priced && !a.unit && !tail && !bare) continue;
    const lead = PREMIUM_LEAD.exec(before);
    const said = lead ? before.slice(0, lead.index) : before;
    // before วันละ/เดือนละ… the benefit word sits close; with only a tail, anywhere in the clause
    // ("ลดหย่อนภาษีเงินได้บุคคลธรรมดาได้สูงสุด 100,000 บาทต่อปี")
    const benefit = BENEFIT.test(lead ? said.slice(-BENEFIT_REACH) : said) || HOUSEHOLD.test(said);
    const premium = lead
      ? /^(เบี้ย|ตก)/.test(lead[1]) || !benefit
      : Boolean(tail) && !benefit && !COVER.test(said);
    if (!premium) continue;
    const startAt = lead ? since + lead.index : a.at;
    const head = CLAUSE_HEAD.exec(text.slice(since, startAt));
    out.push({ raw: a.raw, from: head ? since + head.index : startAt, to: a.end + (tail ? tail[0].length : 0) });
  }
  return out;
}

/**
 * English premiums (spec 2026-10-06), built as the Thai ones above: an amount said as money (THB,
 * baht, ฿, a unit) or money-like right after "premium", next to "premium" or a period word before
 * it ("a month", "per year", "daily"…) or a period after it ("a day", "per month", "/mo", "/yr",
 * "monthly"…). A benefit paid by the period ("room & board 5,000 THB per day", "tax deduction up
 * to 25,000 THB a year") or cover ("up to 25,000,000 THB a year") is not; an amount after
 * "premium" is a premium whatever came before.
 */
const PREMIUM_LEAD_EN = /\b(premiums?|per month|a month|monthly|per year|a year|yearly|annually|per day|a day|daily)\b[^\d\n]{0,12}$/i;
const PREMIUM_TAIL_EN = /^\s*(?:\/\s*(?:mo|mth|month|yr|year|day|annum)\b|(?:per|a|an|each|every)\s+(?:month|year|day)\b|monthly\b|yearly\b|annually\b|daily\b)/i;
// "costs" is a benefit's word ("out-of-pocket costs of THB 500,000") unless it prices the plan ("it costs only THB 54 a day")
const BENEFIT_EN = /cover|medical|hospital|room|board|tax|deduct|cash|benefit|pension|income|refund|limit|claim|compensat|payout|pays out|reimburse|salary|rent|mortgage|tuition|school|loan|bills?\b|expens|treatment|surgery|stay|spend|save|\bcosts?\b(?!\s+(?:you\s+)?(?:only|just|from|about|around|less|under|as little|\d|THB|฿))/i;
/** a benefit said right after the amount and its period: "Save THB 25,000 a year on tax" */
const BENEFIT_AFTER_EN = /^\s*(?:on|in|of|for)\s+(?:your\s+)?(?:tax(?:es)?|bills?|costs?|expenses?|savings?|treatment)\b/i;
const COVER_EN = /(?:up to|maximum(?: of)?|max\.?|limit(?: of)?)\s*$/i;
const BARE_LEAD_EN = /\bpremiums?\s*(?:(?:of|from|is|are|at|only|just|about|around|starting|:)\s*)*$/i;
const CLAUSE_HEAD_EN = /(?:\b(?:pay(?:ing)?|premiums?|first-year|from|only|just|about|around|for|of|at)\s*)*$/i;

function premiumSpansEn(text: string): PremiumSpan[] {
  const out: PremiumSpan[] = [];
  let prevEnd = 0;
  for (const a of amounts(text)) {
    const lineStart = text.lastIndexOf("\n", a.at - 1) + 1;
    const since = Math.max(lineStart, prevEnd);
    prevEnd = a.end;
    if (a.raw.endsWith("%")) continue;
    const tail = PREMIUM_TAIL_EN.exec(text.slice(a.end));
    const before = text.slice(since, a.at);
    const bare = BARE_LEAD_EN.test(before) && /,|\d{3}/.test(a.raw);
    // only money counts: "Pay in 12 monthly instalments" has a period after a count, not a premium
    if (!a.priced && !a.unit && !bare) continue;
    const lead = PREMIUM_LEAD_EN.exec(before);
    const said = lead ? before.slice(0, lead.index) : before;
    // the benefit word may sit before the period word or between it and the amount ("Daily cash of THB 1,000")
    const benefit = BENEFIT_EN.test(lead ? before.slice(Math.max(0, lead.index - BENEFIT_REACH)) : said)
      || BENEFIT_AFTER_EN.test(text.slice(a.end + (tail ? tail[0].length : 0)));
    const premium = lead
      ? /^premium/i.test(lead[1]) || !benefit
      : bare || (Boolean(tail) && !benefit && !COVER_EN.test(said));
    if (!premium) continue;
    const startAt = lead ? since + lead.index : a.at;
    const head = CLAUSE_HEAD_EN.exec(text.slice(since, startAt));
    out.push({ raw: a.raw, from: head ? since + head.index : startAt, to: a.end + (tail ? tail[0].length : 0) });
  }
  return out;
}

/**
 * The amounts in a text said as a premium (premiumSpans), in the text's language — English
 * phrases for an English ad. A long ad's model may write none of these, true or not: the code
 * prints every premium (spec 2026-10-05, "AI never writes a premium").
 */
export function premiumAmounts(text: string, lang: Lang = "th"): string[] {
  return [...new Set(premiumSpans(text, lang).map((p) => p.raw))];
}

/**
 * A text with each premium clause cut out and the line tidied after it: the brackets and
 * separators left empty go, and a line left with nothing but its bullet goes. The rest of the
 * line — a sample case's age, sum, term, multiple — stays.
 */
export function withoutPremiums(text: string): string {
  return text.split("\n").flatMap((line) => {
    const spans = premiumSpans(line);
    if (spans.length === 0) return [line];
    let out = line;
    for (const p of [...spans].reverse()) out = out.slice(0, p.from) + out.slice(p.to);
    out = out
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s*([:·,;])(\s*[:·,;])+/g, "$1")
      .replace(/:\s*\(/g, " (")
      .replace(/[\s:·,;—–-]+$/, "")
      .replace(/:\s*·\s*/g, ": ");
    return /^[\s\-•*:·]*$/.test(out) ? [] : [out];
  }).join("\n");
}

/**
 * A person the copy speaks of: ผู้หญิง, ผู้ชาย, หญิง or ชาย, then within a few letters อายุ N or
 * วัย N, or N ปี. Only after a sex word, so "ก่อนอายุ 60", "ถึงอายุ 99" and "อายุ 20–65 ปี" are not.
 */
const PERSON = /(ผู้หญิง|ผู้ชาย|หญิง|ชาย)([^\d\n]{0,4}?)(?:(?:อายุ|วัย)\s*(\d{1,2})(?!\d)|(\d{1,2})\s*ปี)/g;
/**
 * a sex word that is not one person: ลูกชาย, เด็กชาย, ทั้งหญิง…, หญิงชาย, and the second of
 * "หญิงและชาย" — but "ผู้ชายอายุ 35 และผู้หญิงอายุ 30" is two people
 */
const NOT_ONE_BEFORE = /(?:ลูก|เด็ก|ทั้ง|หญิง|ชาย)$|(?<!ผู้)(?:หญิง|ชาย)\s*และ\s*$/;
const NOT_ONE_BETWEEN = /หญิง|ชาย|และ/;
/** an age that opens a range, not a person's: "30–40", "30 ถึง 40 ปี", "40 ขึ้นไป" */
const RANGE_AFTER = /^\s*(?:ปี|ขวบ)?\s*(?:[–—-]|ถึง|ขึ้นไป)/;

export interface PersonPhrase {
  /** as written: "ผู้หญิงอายุ 35", "หญิง 35 ปี", "ชายอายุ ๔๐" */
  phrase: string;
  sex: "F" | "M";
  age: number;
  at: number;
  end: number;
}

/**
 * The people a text speaks of, one sex and one age each (Thai digits read as Arabic). Both sexes
 * together, a child (ลูกชาย, เด็กชาย) and an age range are not one person, and are left out.
 */
export function personPhrases(text: string, lang: Lang = "th"): PersonPhrase[] {
  if (lang === "en") return personPhrasesEn(text);
  const read = arabic(text);
  const out: PersonPhrase[] = [];
  for (const m of read.matchAll(PERSON)) {
    const end = m.index + m[0].length;
    if (NOT_ONE_BEFORE.test(read.slice(Math.max(0, m.index - 12), m.index))) continue;
    if (NOT_ONE_BETWEEN.test(m[2])) continue;
    if (RANGE_AFTER.test(read.slice(end))) continue;
    out.push({ phrase: text.slice(m.index, end).trim(), sex: m[1].endsWith("หญิง") ? "F" : "M", age: Number(m[3] ?? m[4]), at: m.index, end });
  }
  return out;
}

/** the English words for one adult of a sex; a child (son, girl…) is not one of them */
const SEX_EN = String.raw`(?:women|woman|men|man|females?|males?|ladies|lady|gentlemen|gentleman)`;
/**
 * a sex word, then an age: "female, 35", "men aged 40", "woman (age 35)", "male 40 years old" —
 * not a count: "2 years into her job", "3 times more", "1 of 3", a decade ("30s")
 */
const PERSON_SEX_FIRST = new RegExp(String.raw`\b(${SEX_EN})\b[,:\s]*\(?\s*(?:(?:aged|age)\s*:?\s*)?(\d{1,2})(?![\d])(?![,.]\d)(?!\s*(?:%|thb|baht|million|k\b|minutes?|hours?|days?|weeks?|months?|kids?|children|plans?|times\b|x\b|of\b|out of\b))(?!\s*-?\s*(?:years?|yrs?)\b(?!\s*-?\s*old))(?!'?s\b)`, "gi");
/** an age, then a sex word: "a 35-year-old woman", "40 years old male" */
const PERSON_AGE_FIRST = new RegExp(String.raw`(?<![\d,.])(\d{1,2})\s*-?\s*(?:years?|yrs?)\s*-?\s*old\b[,\s]*(${SEX_EN})\b`, "gi");
/** the second of "men and women", or a sex word right after an age range's "–"/"to" */
const NOT_ONE_BEFORE_EN = new RegExp(String.raw`\b${SEX_EN}\s*(?:and|&|or|\/)\s*$`, "i");
const NOT_ONE_AFTER_EN = new RegExp(String.raw`^\s*(?:and|&|or|\/)\s*${SEX_EN}\b`, "i");
/** an age that opens a range: "20–65", "30 to 40", "30 and over", "40+" */
const RANGE_AFTER_EN = /^\s*(?:-?\s*(?:years?|yrs?)(?:\s*-?\s*old)?)?\s*(?:[–—-]\s*\d|to\s+\d|and\s+(?:over|above|up|older)|or\s+(?:over|older|above)|\+|plus\b)/i;
const RANGE_BEFORE_EN = /(?:\d\s*(?:[–—-]|to)\s*|between\s*)$/i;

/** English people (spec 2026-10-06), as personPhrases: one sex and one age each; both sexes, a child and a range are not one person. */
function personPhrasesEn(text: string): PersonPhrase[] {
  const out: PersonPhrase[] = [];
  const sexOf = (w: string): "F" | "M" => (/^(?:wo|fe|lad)/i.test(w) ? "F" : "M");
  for (const m of text.matchAll(PERSON_SEX_FIRST)) {
    const end = m.index + m[0].length;
    if (NOT_ONE_BEFORE_EN.test(text.slice(Math.max(0, m.index - 14), m.index))) continue;
    if (RANGE_AFTER_EN.test(text.slice(end))) continue;
    out.push({ phrase: m[0].trim(), sex: sexOf(m[1]), age: Number(m[2]), at: m.index, end });
  }
  for (const m of text.matchAll(PERSON_AGE_FIRST)) {
    const end = m.index + m[0].length;
    if (RANGE_BEFORE_EN.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
    if (NOT_ONE_AFTER_EN.test(text.slice(end))) continue;
    if (out.some((p) => p.at < end && m.index < p.end)) continue;
    out.push({ phrase: m[0].trim(), sex: sexOf(m[2]), age: Number(m[1]), at: m.index, end });
  }
  return out.sort((a, b) => a.at - b.at);
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
