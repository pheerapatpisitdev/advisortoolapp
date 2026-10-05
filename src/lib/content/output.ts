/**
 * A generated piece as data, and as the text that gets pasted.
 *
 * Kept apart from write.ts so the page's browser code can build the pasted text without
 * importing the AI client, which holds the keys and must never reach a browser bundle.
 */

import type { ClipVideo } from "./clip";
import { INSURER } from "@/lib/insurer";
import type { Look } from "./looks";
import type { PiecePerson } from "./people";
import type { PosterSpec } from "./poster";

/** The regulator's line, the same words the sales pages end on. Added here, never by the model. */
export const DISCLAIMER = "ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง";
export const TAX_LINE = "สิทธิประโยชน์ทางภาษีเป็นไปตามเงื่อนไขที่กรมสรรพากรกำหนด";
/** Who insures it. No piece named the insurer; this goes under every one, old ones included. */
export const INSURER_LINE = `รับประกันภัยโดย ${INSURER}`;

/**
 * The language a piece is written in. Thai is the default and is never stored: only an English
 * piece carries `lang: "en"` in its own JSON (output and its poster), so no migration was needed.
 */
export type Lang = "th" | "en";
export function langOf(o: { lang?: Lang } | undefined): Lang {
  return o?.lang === "en" ? "en" : "th";
}

/** The same two lines for an English piece (iHealthy Ultra posts for expats). Added here, never by the model. */
export const DISCLAIMER_EN = "Please make sure you understand the coverage details and conditions before deciding to buy insurance.";
export const INSURER_LINE_EN = "Underwritten by Krungthai-AXA Life Insurance PCL";
export function insurerLine(lang: Lang): string {
  return lang === "en" ? INSURER_LINE_EN : INSURER_LINE;
}

/**
 * The lines the system puts under a piece: the regulator's, the tax line whenever the words
 * talk about tax (not only when the tax angle was picked), and the insurer. Worked out when
 * the piece is copied, so pieces written before a line existed get it too.
 */
export function footer(out: Pick<ContentOutput, "hooks" | "body" | "closing" | "disclaimer" | "lang">): string {
  const lines = out.disclaimer.split("\n").filter(Boolean);
  // English: the tax line is Thai-law wording and an English piece makes no tax claim.
  if (langOf(out) === "en") return [...lines, INSURER_LINE_EN].join("\n");
  const said = [...out.hooks, out.body, out.closing].join(" ");
  if (!lines.includes(TAX_LINE) && /ภาษี|ลดหย่อน/.test(said)) lines.push(TAX_LINE);
  lines.push(INSURER_LINE);
  return lines.join("\n");
}

export interface ContentOutput {
  /** one hook per piece since pieces are planned; older pieces carry three to choose from */
  hooks: string[];
  /** the planner's one-line angle; absent on pieces written before there was a planner */
  angle?: string;
  body: string;
  closing: string;
  hashtags: string[];
  imagePrompt: string;
  disclaimer: string;
  /** "en" when the piece is written in English; absent means Thai */
  lang?: "en";
  /** the poster the writer designed; absent on pieces written before posters */
  poster?: PosterSpec;
  /**
   * For an ad, what it was written to. An ad's Ads Manager fields live in the piece's own:
   * headline in hooks[0], primary text in body, description in closing. A long-form ad (Ads
   * Studio, 2026-10-05) names its planned angle, who it is for and the age its table is priced
   * at, and whose premium its headline shows (`sex`) on which row (`head`, the row's heading);
   * `tone` is "". Ads written from a campaign's dimension queue (2026-10-04) keep their four
   * dimensions and `combo`; ads from before the queue have only angle and tone.
   */
  ad?: { angle: string; tone: string; reader?: string; age?: number; sex?: "F" | "M"; head?: string; hook?: string; persona?: string; style?: string; combo?: string };
  /** who drew the photograph behind the poster, as the card names it ("GPT Image HD") */
  pictureBy?: string;
  /** a person from the library drawn into the picture, and their pose; a redraw keeps them */
  person?: PiecePerson;
  /**
   * The true story the owner gave the round, kept so its numbers stay allowed when the piece
   * is edited and checked again — they are in no brief.
   */
  fact?: string;
  /**
   * For a ตัวเลขชัดๆ piece, the engine's figures it was written from (numbersYardstick of its
   * sheet). They are in no brief either, so without them the first save of an untouched
   * numbers post flagged every premium in it as not from the rate table. For a long-form ad,
   * its premium table, headline figures and the Page's contacts, for the same reason.
   */
  figures?: string;
  /**
   * รีวิวเคลม: false while the claim paper on the poster carries only the AI's stickers. The
   * owner looks at it in the editor, adds any the AI missed, and ticks it; until then the
   * piece may not go to a Page (publish-flow's clear()). Absent on every other piece.
   */
  paperChecked?: boolean;
  /** a คลิปวนลูป: the script's closing runs back into its hook, and the card says so (prompt.ts LOOP_RULES) */
  loop?: boolean;
  /** written with สูตรคอนเทนต์โปร ticked (pro.ts) */
  pro?: boolean;
  /**
   * The writing formula the piece was written with (formula.ts). Pieces written before there
   * were two carry `pro` instead, and are read as "pro" (outputFormula).
   */
  formula?: "pro" | "finish";
  /** สูตรอ่าน-ดูจนจบ: why a reader would pass the piece on, as the planner or writer chose it (finish.ts) */
  shareWhy?: "use" | "insider" | "voice";
  /** สูตรอ่าน-ดูจนจบ: each loop the writer opened and where it closed, in the piece's own words */
  loops?: { open: string; close: string }[];
  /** สูตรอ่าน-ดูจนจบ: the checklist items the agent ticked (finish-check.ts) */
  finishTicks?: string[];
  /** the kind of picture the background was drawn as (looks.ts); absent on pictures drawn before there were kinds */
  look?: Look;
  /**
   * Which of `hooks` went to the Page, for older pieces that carry three; absent is the
   * first. A held post taken back and sent again (a move, an edit) goes with the same one.
   */
  postedHook?: number;
  /**
   * Changes on every write of the output (store.ts sets it), so a write that read the piece
   * earlier can ask "still as I read it?" — an edit saved while a picture was drawing, or a
   * picture landing while an edit was saved, is then read again instead of written over.
   */
  rev?: string;
  /**
   * The clip an agent filmed for this piece — a clip piece's whole point, or a script's once
   * it was filmed (owner, 2026-10-02). A piece that has one goes to the Page as a Reel.
   */
  video?: ClipVideo;
}

/** The piece as it will be pasted: one hook, the body, the closing, the tags, the footer. */
export function fullText(out: ContentOutput, hook = 0): string {
  return [
    out.hooks[hook] ?? out.hooks[0],
    out.body,
    out.closing,
    out.hashtags.join(" "),
    footer(out),
  ].filter(Boolean).join("\n\n");
}

/** What Facebook shows of a post before "ดูเพิ่มเติม", roughly — the figure Meta gives for ads. */
export const FOLD = 125;

/**
 * The piece split where the reader's screen folds it. Counted in code points, as Maryjane's
 * thai-text.ts counts: a Thai vowel or tone mark is a character of its own, so "ผู้" is three,
 * which is closer to how the fold falls than counting letters a reader would.
 */
export function atFold(text: string, limit = FOLD): { shown: string; hidden: string; length: number } {
  const chars = [...text];
  return { shown: chars.slice(0, limit).join(""), hidden: chars.slice(limit).join(""), length: chars.length };
}

/** a hashtag as Facebook links one: "#" at a word's start and what follows up to a space or the next "#" */
const HASHTAG = /(?<![^\s])#[^\s#]+/g;

/** The caption in runs, each hashtag its own, so the feed's blue can be drawn on them; joined, the text back. */
export function captionParts(text: string): { text: string; tag: boolean }[] {
  const out: { text: string; tag: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(HASHTAG)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), tag: false });
    out.push({ text: m[0], tag: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), tag: false });
  return out;
}
