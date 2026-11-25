import type { ChatMessage } from "@/lib/ai/types";
import type { AnyAnswer } from "../dispatch";
import { languageOf, THAI, type ChatLang } from "../expat";
import { ageIn, one, sexIn } from "../common";
import type { HealthSlots } from "../ihealthy/route";
import type { AnySlots } from "../slots";
import { noteAfterAnswer } from "../unanswered";
import { expatLanguage, personOf } from "./door";
import { personInEn, planNamedInEn } from "./route";
import { segmentsOf } from "./topics";
import {
  FATCA_EN, FATCA_TH, STALL_EN, US_CHECK_EN, US_CHECK_TH, US_DETAILS_EN, US_DETAILS_TH, US_PREPARING_EN, US_PREPARING_TH,
  US_STALL_TH, US_WANTS_EN, US_WANTS_TH,
} from "./words";

/**
 * A customer of US nationality on an Expat Page (owner chose ข ข ก, 2026-11-26; mockup
 * https://claude.ai/artifact/YY9Q7HJ9znRjZexpDYra7y).
 *
 * Krungthai-AXA does not sell the package to them, as FATCA has it, and the bot was pricing it
 * all the same for the admin to take back. They are told so, once, and of the partner that can;
 * from then on nothing of the package's is quoted, sent or answered. The bot knows nothing of
 * AXA Insurance's own plans, so what is asked of them is the admin's.
 *
 * Read by pattern and only where the words can be nothing else. A nationality read wrongly
 * turns a customer away, so a country named in passing — insurance there, a trip, a hospital's
 * name — says nothing.
 */

/** Not any of these: "us" the pronoun is read only where the words around it say otherwise. */
const US = String.raw`(?:U\.?S\.?A\b\.?|U\.S\.|US\b|United States(?: of America)?\b|America\b|American\b)`;
const NATIONS = "british|english|scottish|welsh|irish|australian|canadian|kiwi|new zealander|german|french|italian|spanish|"
  + "portuguese|dutch|belgian|swiss|austrian|swedish|norwegian|danish|finnish|icelandic|polish|czech|slovak|hungarian|romanian|"
  + "bulgarian|greek|turkish|russian|ukrainian|israeli|indian|pakistani|nepali|bangladeshi|sri lankan|chinese|taiwanese|"
  + "hong ?konger|japanese|korean|filipino|filipina|thai|vietnamese|burmese|lao|cambodian|malaysian|singaporean|indonesian|"
  + "south african|nigerian|ghanaian|kenyan|ethiopian|egyptian|moroccan|iranian|lebanese|mexican|brazilian|argentin(?:e|ian)|"
  + "chilean|colombian|peruvian|latvian|lithuanian|estonian|croatian|serbian|slovenian";
const COUNTRIES = "uk|u\\.k\\.|united kingdom|england|scotland|ireland|australia|canada|new zealand|germany|france|italy|spain|"
  + "netherlands|belgium|switzerland|austria|sweden|norway|denmark|finland|poland|russia|ukraine|israel|india|china|japan|"
  + "korea|philippines|thailand|vietnam|singapore|malaysia|south africa";
const NATION = new RegExp(String.raw`\b(?:${NATIONS}|${COUNTRIES})\b`, "i");

/** A country or a word named for something other than somebody's nationality, taken out first. */
const IN_PASSING: RegExp[] = [
  /\b(?:south|latin|central|north)[ -]americans?\b/gi,
  /\b(?:U\.?S\.?A?\.?|american)\s+(?:health |medical |travel )?(?:ins(?:urance)?|cover(?:age)?|polic(?:y|ies)|plans?|compan(?:y|ies)|dollars?|hospitals?|express|schools?|standards?|doctors?|embassy|bank|made|visa)\b/gi,
  /\b(?:married to|dating|engaged to|work(?:ing)? for|friends? with)\s+(?:an?\s+)?americans?\b/gi,
  /\b(?:in|to|visit(?:ing)?|outside(?: of)?|excluding|including|except|within|across)\s+(?:the\s+)?(?:U\.?S\.?A?\b\.?|united states(?: of america)?|america)(?![\w])/gi,
  /(?:คุ้มครอง|รักษา|อยู่|ไป|เที่ยว|ที่|ใน)\s*(?:ประเทศ)?(?:สหรัฐ(?:อเมริกา)?|อเมริกา)/g,
];
/** "I'm not American", "not a US citizen": said, and said to be otherwise. */
const NOT_US = new RegExp(String.raw`\b(?:not|never|non|isn['’]?t|no)[\s-]+(?:an?\s+|from\s+|the\s+|holding\s+)*(?:${US}|us\b)(?:\s+(?:citizens?|nationals?|passports?|nationality))?`, "gi");
const NOT_US_TH = /ไม่(?:ใช่|ได้)[^\n]{0,20}(?:อเมริก|สหรัฐ|US)[^\s]*/g;

const LABEL = new RegExp(String.raw`\b(?:nationalit(?:y|ies)|citizenship|citizens? of|nationals? of|passports?)\b([^\n?!]{0,30}?)(?<![A-Za-z])(${US})`, "i");
/** a small "us" only straight after the word: "do you need a passport from us" says nothing */
const LABEL_US = /\b(?:nationality|citizenship|passport)\s*(?:is\b|[:：=\-–])?\s*us\b/i;
/** "US citizen", "American passport"; a small "us" only where a pronoun could not stand. */
const HOLDER = /(?:\b(?:US|U\.S\.|U\.?S\.?A\.?|Us|[Aa]merican)|(?:^|\b(?:an?|my|i|have|hold|holding|with|am)\s+)us)\s+(?:citizens?|passports?|nationals?|nationality|persons?|expats?)\b/m;
const PLURAL = /\bamericans\b/i;
const IS_AMERICAN = /\b(?:i['’]?m|i am|we['’]?re|we are|s?he['’]?s|(?:he|she|wife|husband|partner|mother|father|mom|mum|dad|son|daughter|who) is|as an)\b[^.?!\n]{0,40}\bamerican\b/i;
const FROM_US = /\b(?:i['’]?m|i am|i come|we['’]?re|we are|male|female|man|woman|originally)\b(?![^.?!\n]{0,20}(?:mov|relocat|coming|retir|transfer|arriv|fly|return))[^.?!\n]{0,30}\bfrom (?:the )?(?:U\.?S\.?A?\b|united states|america\b)/i;
/** The line is the country: "USA", "3. USA.", "American - 081…", "USA male". */
const ALONE = new RegExp(String.raw`^(?:${US})\s*(?:$|[.,/|–-]|[([+\d]|(?:male|female|man|woman|m|f)\b)`, "i");
const BARE_LOWER_US = /^us\b/;
const PERSON_THEN_US = /(?:\b[Uu]\.?[Ss]\.?[Aa]\.?|\bUS|\b[Uu]nited [Ss]tates|\b[Aa]merican)\s*[.!]?\s*$/;
const ABOUT_COVER = /cover|travel|territor|trip|worldwide|include|exclude|\?/i;
const TH_US = /(?:สัญชาติ|เชื้อชาติ|พาสปอร์ต|พาสสปอร์ต|หนังสือเดินทาง|ชาว|คน|ฝรั่ง|เป็น)\s*[:：\-]?\s*(?:ของ|ประเทศ)?\s*(?:อเมริก|สหรัฐ|U\.?S\.?A?\b)/i;

function stripped(text: string): string {
  const said = text.replace(NOT_US, " ").replace(NOT_US_TH, " ");
  return IN_PASSING.reduce((t, re) => t.replace(re, " "), said);
}

/** A line's parts: its sentences, and its commas where it is a list of details. */
function parts(text: string): string[] {
  return text.split(/\n+/).flatMap((line) => {
    const bare = line.replace(/^\s*(?:[*•\-–·]|\(?\d{1,2}\s*[.)](?!\d))\s*/, "").trim();
    return bare.split(/(?<=[a-z\d)])[.!]\s+/i)
      .flatMap((s) => (ABOUT_COVER.test(s) ? [s] : s.split(/\s*,\s*/))).map((s) => s.trim()).filter(Boolean);
  });
}

/** The message says somebody's nationality is US, or asks whether one of that nationality may apply. */
export function saysUs(text: string): boolean {
  const t = stripped(text);
  if (TH_US.test(t) || LABEL_US.test(t)) return true;
  const label = LABEL.exec(t);
  // "Nationality: British …" is read as far as it says — unless it says both
  if (label && label[2] !== "us" && (!NATION.test(label[1]) || /(?:\/|&|\band\b|\bor\b|,)\s*$/i.test(label[1]))) return true;
  if (HOLDER.test(t) || PLURAL.test(t) || IS_AMERICAN.test(t) || FROM_US.test(t)) return true;
  return parts(t).some((p) => {
    if (ABOUT_COVER.test(p)) return false;
    if (ALONE.test(p) && !BARE_LOWER_US.test(p)) return true;
    const who = personInEn(p);
    return (who.age !== undefined || who.sex !== undefined) && p.split(/\s+/).length <= 6 && PERSON_THEN_US.test(p);
  });
}

const OTHER_LABEL = /\b(?:nationality|citizenship|passport)\b[\s:：=\-–]*(?:is\s+)?([a-z][a-z ]{2,20})/i;
const OTHER_NATION = new RegExp(String.raw`\b(?:i['’]?m|i am|s?he['’]?s|(?:he|she|wife|husband|partner|mother|father|mom|mum|dad|son|daughter|who) is|as an?|hold(?:ing)?|have|an?|my)\b\s+(?:actually\s+|also\s+)?(?:an?\s+)?(?:${NATIONS})\b(?!\s+(?:privilege|visa|elite|baht|bank|hospital|insurance))`, "i");
const OTHER_TH = /สัญชาติ\s*[:：]?\s*(?!อเมริก|สหรัฐ|US|อะไร|ไหน)[ก-๙]{2,}/;
const SOMEONE_ELSE = /\b(?:wife|husband|partner|girlfriend|boyfriend|mother|father|mom|mum|dad|son|daughter|friend|he|she)\b|ภรรยา|สามี|แฟน|ลูก|พ่อ|แม่|เพื่อน/i;

/** The message says otherwise: not US after all, or another nationality. */
export function saysNotUs(text: string): boolean {
  if (saysUs(text)) return false;
  // a /g pattern's test moves its own place, so search
  if (text.search(NOT_US) >= 0 || text.search(NOT_US_TH) >= 0) return true;
  const label = OTHER_LABEL.exec(text);
  return Boolean(label && NATION.test(label[1])) || OTHER_NATION.test(text) || OTHER_TH.test(text);
}

const DECLINES = /^\s*(?:no|nope|nah)(?:[\s.!]*$|[,.\s]+(?:thank|not\b|i['’]?m (?:good|ok|fine)))|not interested|no,? thank|\bdon['’]?t (?:want|need)|never ?mind|ไม่สนใจ|ไม่เอา|ไม่เป็นไร|ไม่ต้อง/i;
const THANKS = /^\s*(?:(?:ok(?:ay)?|great|alright)[,.!\s]*)?(?:thanks?|thank you|thx|ขอบคุณ|ขอบใจ)\b|^\s*(?:ขอบคุณ)/i;
const FEES = /\b(?:fees?|prices?|premiums?|costs?|how much|quotes?|rates?|information|info|details?|brochure|send|apply|sign up|buy)\b|เบี้ย|ราคา|กี่บาท|เท่าไ|รายละเอียด|ข้อมูล|สมัคร|ส่งมา/i;
const AGREES = /^\s*(?:yes|yeah|yep|yup|sure|ok(?:ay)?|please|of course|definitely)\b|\binterested\b|\bi(?:['’]d| would) (?:like|want)\b|\bgo ahead\b|👍|สนใจ|^\s*(?:ครับ|ค่ะ|คะ|ได้|โอเค|เอา|ขอ|ต้องการ|อยากได้)/i;
const GREETS = /^\s*(?:hi|hello|hey|good (?:morning|afternoon|evening)|สวัสดี)\b/i;
const ASKS = /\?|\b(?:what|how|when|which|where|why|does|do|is|are|can|could|will)\b|ไหม|มั้ย|อะไร|ยังไง|อย่างไร|เมื่อไ|ที่ไหน/i;

const WORDS = {
  en: { fatca: FATCA_EN, wants: US_WANTS_EN, check: US_CHECK_EN, preparing: US_PREPARING_EN, details: US_DETAILS_EN, stall: STALL_EN },
  th: { fatca: FATCA_TH, wants: US_WANTS_TH, check: US_CHECK_TH, preparing: US_PREPARING_TH, details: US_DETAILS_TH, stall: US_STALL_TH },
};

const note = (question: string) => noteAfterAnswer({ question, route: "brain", product: "ihealthy" });

function said(slots: HealthSlots, text: string, lang: ChatLang): AnyAnswer {
  const kept = { ...slots, ...(lang === "en" ? { lang } : {}) };
  if (lang === "th") delete kept.lang;
  return { ...one(text), slots: kept };
}

export interface UsTurn {
  /** the turn's answer, when it is this file's to give */
  answer?: AnyAnswer;
  /** what the ordinary turn carries on from */
  slots: AnySlots | null;
}

/**
 * The turn, when the customer is of US nationality: said now, or said before. Anything else
 * goes the usual way — as does a customer who says they are not, or who asks for somebody of
 * another nationality, whose age is then asked rather than taken from the one who wrote.
 */
export function usTurn(history: ChatMessage[], stored: AnySlots | null): UsTurn {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  const health = stored && "product" in stored && stored.product === "ihealthy" ? stored as HealthSlots : null;
  const before = health?.us;
  const us = saysUs(asked);
  if (!us && !before) return { slots: stored };
  if (before && saysNotUs(asked)) {
    const rest = { ...health! };
    delete rest.us;
    if (SOMEONE_ELSE.test(asked)) {
      delete rest.age;
      delete rest.sex;
      delete rest.plan;
    }
    return { slots: rest };
  }

  // a line with no words of its own ("43", 👍) keeps the conversation's language
  const lang = /[A-Za-z]{2,}/.test(asked) || THAI.test(asked) ? expatLanguage(asked, stored) : languageOf("", health?.lang ?? (stored ? "th" : "en"));
  const w = WORDS[lang];
  const en = personInEn(asked);
  const age = en.age ?? ageIn(asked);
  const sex = en.sex ?? sexIn(asked);
  const slots: HealthSlots = {
    ...(health ?? personOf(stored) ?? { product: "ihealthy", intent: "other" }),
    ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}),
  };
  delete slots.healthAsked;
  delete slots.hospitalAsked;

  if (!before) {
    // the other questions would be answered for a package they cannot have: the admin's
    for (const s of segmentsOf(asked)) if (s.includes("?") && !saysUs(s) && !FEES.test(s)) note(s);
    return { slots: stored, answer: said({ ...slots, us: "told" }, w.fatca, lang) };
  }
  const answer = (text: string, state: "told" | "wants" = before): UsTurn => ({ slots: stored, answer: said({ ...slots, us: state }, text, lang) });

  if (DECLINES.test(asked)) return answer(w.stall, "told");
  if (before === "told") {
    if (THANKS.test(asked) && !FEES.test(asked)) return answer(w.stall);
    if (AGREES.test(asked) || FEES.test(asked) || planNamedInEn(asked)) {
      note(`US nationality — wants AXA Insurance information and fees: ${asked}`);
      return answer(w.wants, "wants");
    }
    if (GREETS.test(asked) || us) return answer(w.fatca);
  } else {
    if (FEES.test(asked) || planNamedInEn(asked) || GREETS.test(asked) || AGREES.test(asked)) return answer(w.preparing);
    if (!ASKS.test(asked)) return answer(THANKS.test(asked) ? w.stall : w.details);
  }
  note(asked);
  return answer(w.check);
}
