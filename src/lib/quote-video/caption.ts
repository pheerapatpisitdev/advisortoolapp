/**
 * The subtitle shows one short piece of the line at a time, as the voice reaches it, in place of the
 * whole scene's line at once (owner, 2026-10-20, mockup https://claude.ai/artifact/DvoHffsVRRzHtNghkdpCGW,
 * option ข): a piece is cut at a space, fills one line of the band at most, and never runs past the end
 * of a sentence (ครับ / ค่ะ / คะ / ? . !). A single word wider than the band is a piece of its own and wraps.
 */

/** Thai marks above and below a letter, Myanmar's, and the zero-width joiners: they take no room */
const MARK = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u102B-\u103E\u200B-\u200D\u2060]/u;
/** Chinese, Japanese and Korean letters and full-width forms: a whole em each */
const WIDE = /[\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/u;
const MYANMAR = /[\u1000-\u109F]/u;
/** a word that ends a sentence */
const END = /(ครับ|ค่ะ|คะ|[?.!。？！။])$/u;
/** a word that is only a figure: 10, 1,000,000, 2.5, 60% */
const FIGURE = /^[\d,.%]+$/;

/** how wide a text is drawn, in ems of its font size, a little over Plex's real widths so a piece never wraps */
export function textEms(text: string): number {
  let n = 0;
  for (const ch of text) n += ch === " " ? 0.3 : MARK.test(ch) ? 0 : WIDE.test(ch) ? 1 : MYANMAR.test(ch) ? 0.75 : 0.57;
  return n;
}

/** the line's words in pieces, each the indexes of its words, in order; lineEm is the band's inner width in ems */
export function captionPieces(words: string[], lineEm: number): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let ems = 0;
  words.forEach((w, i) => {
    const width = textEms(w);
    if (cur.length && ems + 0.3 + width > lineEm) {
      // a figure goes on with what it counts ("10 / ปี" never splits) when the piece keeps another word
      const carry = cur.length > 1 && FIGURE.test(words[cur[cur.length - 1]]) ? [cur.pop()!] : [];
      out.push(cur);
      cur = carry;
      ems = carry.length ? textEms(words[carry[0]]) : 0;
    }
    ems += (cur.length ? 0.3 : 0) + width;
    cur.push(i);
    if (END.test(w)) { out.push(cur); cur = []; ems = 0; }
  });
  if (cur.length) out.push(cur);
  return out;
}

/**
 * The words on screen while word `word` is being said: -1 before the voice shows the first piece,
 * words.length once it is done shows the last.
 */
export function captionShown(words: string[], lineEm: number, word: number): number[] {
  const pieces = captionPieces(words, lineEm);
  if (!pieces.length) return [];
  const k = Math.max(0, Math.min(word, words.length - 1));
  return pieces.find((p) => p.includes(k)) ?? pieces[pieces.length - 1];
}

/** the word being said at t (or the last one started), by its share of the line's letters as the subtitles time them */
export function wordAt(words: string[], t: number, voiceSec: number, lead: number): number {
  const total = words.reduce((n, w) => n + w.length, 0) || 1;
  let acc = 0;
  let word = -1;
  words.forEach((w, i) => {
    if (t >= lead + (acc / total) * voiceSec) word = i;
    acc += w.length;
  });
  return word;
}
