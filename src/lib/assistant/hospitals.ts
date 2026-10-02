import network from "../../../data/hospitals/ktaxa-network.json";

/**
 * Krungthai-AXA Life's hospital network, for the question every health customer asks: can I
 * use this hospital?
 *
 * The list is the insurer's own (scripts/fetch_ktaxa_hospitals.py), not AXA Insurance PCL's —
 * a different company with different contracts: Ramathibodi is on this one and not that one,
 * Vajira on that one and not this one. iHealthy Ultra is Krungthai-AXA Life's, so this is the
 * list that says where Fax Claim works.
 *
 * Answered in fixed sentences, never by a model: a hospital wrongly called "in network" is a
 * customer paying a bill at the counter they were told they would not pay.
 */

export interface Hospital {
  id: string;
  th: string;
  en: string;
  district: string;
  province: string;
  provinceEn: string;
  type: string;
  care: string[];
  personalHealth: boolean;
  phone: string;
}

export const HOSPITALS: Hospital[] = network.hospitals;

const LIST_TH = "https://www.krungthai-axa.co.th/customer-service/hospitals";
const LIST_EN = "https://www.krungthai-axa.co.th/en/customer-service/hospitals";

/** What the insurer's page says of Fax Claim: from the ninetieth day of the policy. */
const FAX_CLAIM_DAYS = 90;

/** The words a name carries that every other name carries too. */
const GENERIC_EN = /\b(?:hospitals?|clinics?|medical|cent(?:er|re)|polyclinic|branch|dental|the|of|and)\b/g;
const GENERIC_TH = /โรงพยาบาล|รพ\.?|สหคลินิก|คลินิกเวชกรรม|คลินิกทันตกรรม|คลินิก|สาขา/g;

/** Thai spelled two ways for the same name (ราษฎร์ / ราษฏร์), and no spaces or punctuation. */
function squash(text: string): string {
  return text.toLowerCase().replace(/ฏ/g, "ฎ").replace(/[์ํ]/g, "").replace(/[^a-z0-9฀-๿]/g, "");
}

const core = (text: string) => squash(text.toLowerCase().replace(GENERIC_EN, " ").replace(GENERIC_TH, " "));

const PROVINCES: { th: string; en: string }[] = [
  ...new Map(HOSPITALS.map((h) => [h.province, { th: h.province, en: h.provinceEn }])).values(),
];
const PLACE_WORDS = new Set([
  ...PROVINCES.flatMap((p) => [squash(p.th), squash(p.en)]),
  "กรุงเทพ", "bangkok", "bkk", "central", "muang", "เมือง", "industrial", "นิคมอุตสาหกรรม",
  "doctor", "koh", "เกาะ", "thai", "ไทย",
  // the insurer's own name: "กรุงไทยแอกซ่าใช่ไหม" is about the company, not รพ.กรุงไทย
  "กรุงไทย", "krungthai", "แอกซ่า", "axa",
  // the towns expats live in (TOWNS below): "I live in Pattaya" is a place, not Pattaya Hospital
  "pattaya", "พัทยา", "jomtien", "จอมเทียน", "huahin", "หัวหิน", "samui", "สมุย", "เกาะสมุย",
  "phangan", "พะงัน", "เกาะพะงัน", "sriracha", "ศรีราชา", "korat", "โคราช",
]);

/** English as words, its common words gone: "Bangkok Hospital Phuket" → " bangkok phuket ". */
function wordsEn(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(GENERIC_EN, " ").trim().split(/\s+/).filter(Boolean);
  return words.length ? ` ${words.join(" ")} ` : "";
}

interface Key { key: string; english: boolean }

/**
 * Every way a message can name this one: the name, the name without its common words, and the
 * chain — the first word left, "Samitivej", "พญาไท". English is matched as whole words, so the
 * chain "Bang" (Bang Lamung) is not found inside "Bangkok"; Thai, written without spaces, is
 * matched as a run of letters.
 */
function keysOf(h: Hospital): Key[] {
  const keys: Key[] = [];
  const en = wordsEn(h.en);
  if (en.trim().length >= 3 && !PLACE_WORDS.has(squash(en))) keys.push({ key: en, english: true });
  const chain = en.trim().split(" ")[0] ?? "";
  if (chain.length >= 4 && !PLACE_WORDS.has(chain)) keys.push({ key: ` ${chain} `, english: true });
  for (const th of [core(h.th), core(h.th.replace(GENERIC_TH, " ").trim().split(/\s+/)[0] ?? "")]) {
    if (th.length >= 3 && !PLACE_WORDS.has(th) && !keys.some((k) => k.key === th)) keys.push({ key: th, english: false });
  }
  return keys;
}

const KEYS = HOSPITALS.map((h) => ({ hospital: h, keys: keysOf(h) }));

/**
 * The hospitals a message names: the one it names most precisely, or every branch of the chain
 * it names. "Bangkok Hospital Phuket" is one hospital; "Samitivej" is twelve.
 */
export function hospitalsIn(text: string): Hospital[] {
  const english = wordsEn(text);
  const thai = core(text);
  let best = 0;
  let found: Hospital[] = [];
  for (const { hospital, keys } of KEYS) {
    for (const { key, english: isEnglish } of keys) {
      if (!(isEnglish ? english.includes(key) : thai.includes(key))) continue;
      const length = key.trim().length;
      if (length > best) { best = length; found = [hospital]; }
      else if (length === best && !found.includes(hospital)) found.push(hospital);
    }
  }
  return found;
}

interface Place { th: string; en: string; district?: string }

/**
 * Where expats say they live, which is a town more often than a province: Pattaya is Chonburi,
 * Hua Hin is Prachuap Khiri Khan. The district is the town's, so its hospitals come first.
 */
const TOWNS: [RegExp, string, string?][] = [
  [/pattaya|jomtien|พัทยา|จอมเทียน|บางละมุง/i, "Chonburi", "บางละมุง"],
  [/sri\s*racha|ศรีราชา/i, "Chonburi", "ศรีราชา"],
  [/hua\s*hin|หัวหิน/i, "Prachuap Khiri Khan", "หัวหิน"],
  [/samui|สมุย/i, "Surat Thani", "เกาะสมุย"],
  [/phangan|พะงัน/i, "Surat Thani", "เกาะพะงัน"],
  [/korat|โคราช/i, "Nakhon Ratchasima"],
  [/ayutthaya|อยุธยา/i, "Phra Nakhon Si Ayutthaya"],
  [/\bbkk\b|กรุงเทพ|กทม/i, "Bangkok"],
];

/** A province the message names, in either language, or the province of a town it names. */
function provinceIn(text: string): Place | undefined {
  for (const [town, en, district] of TOWNS) {
    const province = PROVINCES.find((p) => p.en === en);
    if (town.test(text) && province) return { ...province, ...(district ? { district } : {}) };
  }
  const said = squash(text);
  const named = PROVINCES.filter((p) => said.includes(squash(p.th)) || said.includes(squash(p.en)));
  // the longest name wins: "Nakhon Si Thammarat" over a shorter one it happens to contain
  return named.sort((a, b) => b.en.length - a.en.length)[0];
}

/**
 * Asking where cover can be used — not what it covers. "Does it cover hospital stays?" and
 * "ค่าห้องโรงพยาบาลเท่าไหร่" are about the benefit, and the benefit's answer is elsewhere.
 */
const ASKS_EN = /\b(?:which|what|any|list of)\s+(?:hospitals?|clinics?)|(?:hospitals?|clinics?)\s+(?:near|in|around|close to)\b|network|panel|fax\s*claim|cashless|direct\s*bill|\b(?:can|could)\s+i\s+(?:use|go\s+to)\b|where\s+can\s+i\s+(?:go|get\s+treated|use)/i;
const ASKS_TH = /(?:โรงพยาบาล|รพ\.?|คลินิก)\s*(?:ไหน|อะไร|ที่ไหน|ใกล้|แถว|ใน|คู่สัญญา|ในเครือ)|เครือข่าย|คู่สัญญา|แฟกซ์|fax\s*claim|ไม่ต้องสำรองจ่าย|ใช้\s*(?:โรงพยาบาล|รพ)/i;

const usable = (h: Hospital) => h.personalHealth;
const inpatient = (h: Hospital) => h.type === "hospital" && h.care.includes("ipd");

/** The best-known names, for a customer who has not said which hospital they mean. */
const WELL_KNOWN = ["bumrungrad-hospital", "bnh-hospital", "samitivej-sukhumvit-hospital", "vejthani-hospital", "phuket-hospital"];

const FAX_EN = `Once your policy has been in force for ${FAX_CLAIM_DAYS} days you can use Fax Claim there, `
  + "so you don't pay upfront for covered treatment.";
const FAX_TH = `เมื่อกรมธรรม์มีผลครบ ${FAX_CLAIM_DAYS} วัน ใช้ Fax Claim ได้ ไม่ต้องสำรองจ่ายค่ารักษาที่อยู่ในความคุ้มครอง`;
const CHECK_EN = `Networks can change, so please check with us before a planned admission. Full list: ${LIST_EN}`;
const CHECK_TH = `เครือข่ายอาจมีการเปลี่ยนแปลง ก่อนนัดเข้ารักษาแจ้งเราให้เช็กอีกครั้งนะครับ ดูรายชื่อทั้งหมด: ${LIST_TH}`;

function bulletsEn(list: Hospital[], max = 6): string {
  return list.slice(0, max).map((h) => `• ${h.en} (${h.provinceEn})`).join("\n");
}
function bulletsTh(list: Hospital[], max = 6): string {
  return list.slice(0, max).map((h) => `• ${h.th} (${h.district ? `${h.district} ` : ""}${h.province})`).join("\n");
}

/** A province's list, at most this long; the rest are counted and linked. */
const PROVINCE_LIST = 10;

function namedEn(found: Hospital[]): string {
  const ok = found.filter(usable);
  if (ok.length === 0) {
    return `${found[0].en} is in Krungthai-AXA's network, but not for individual health insurance — `
      + "an agent will confirm what applies to you here in this chat.";
  }
  if (ok.length === 1) {
    const h = ok[0];
    return `Yes — ${h.en} (${h.provinceEn}) is in Krungthai-AXA's hospital network for individual health insurance. `
      + `${FAX_EN}\n${CHECK_EN}`;
  }
  const sorted = [...ok.filter(inpatient), ...ok.filter((h) => !inpatient(h))];
  return `Yes — ${ok.length} of them are in Krungthai-AXA's network for individual health insurance, including:\n`
    + `${bulletsEn(sorted)}\n${FAX_EN}\n${CHECK_EN}`;
}

function namedTh(found: Hospital[]): string {
  const ok = found.filter(usable);
  if (ok.length === 0) {
    return `${found[0].th} อยู่ในเครือข่ายของกรุงไทย-แอกซ่า แต่ไม่ใช่สำหรับประกันสุขภาพส่วนบุคคลครับ เดี๋ยวตัวแทนเช็กให้ในแชทนี้`;
  }
  if (ok.length === 1) {
    const h = ok[0];
    return `${h.th} อยู่ในเครือข่ายโรงพยาบาลของกรุงไทย-แอกซ่า สำหรับประกันสุขภาพส่วนบุคคลครับ\n${FAX_TH}\n${CHECK_TH}`;
  }
  const sorted = [...ok.filter(inpatient), ...ok.filter((h) => !inpatient(h))];
  return `อยู่ในเครือข่ายของกรุงไทย-แอกซ่า ${ok.length} แห่งครับ เช่น\n${bulletsTh(sorted)}\n${FAX_TH}\n${CHECK_TH}`;
}

function inProvince(place: Place, lang: "en" | "th"): string {
  const rank = (h: Hospital) => {
    const known = WELL_KNOWN.indexOf(h.id);
    return (place.district && h.district === place.district ? 0 : 100) + (known >= 0 ? known : 50);
  };
  const here = HOSPITALS
    .filter((h) => h.province === place.th && usable(h) && inpatient(h))
    .sort((a, b) => rank(a) - rank(b));
  const more = here.length - PROVINCE_LIST;
  if (lang === "en") {
    if (!here.length) {
      return `I can't find a network hospital in ${place.en} — an agent will check the nearest one for you. Full list: ${LIST_EN}`;
    }
    return `Krungthai-AXA has ${here.length} network hospitals in ${place.en} for individual health insurance:\n`
      + `${bulletsEn(here, PROVINCE_LIST)}\n${more > 0 ? `…and ${more} more on the full list.\n` : ""}`
      + `${FAX_EN.replace(" there", " at any of them")}\n${CHECK_EN}`;
  }
  if (!here.length) {
    return `ยังไม่เจอโรงพยาบาลในเครือข่ายที่${place.th}ครับ เดี๋ยวตัวแทนเช็กแห่งที่ใกล้ที่สุดให้ ดูรายชื่อทั้งหมด: ${LIST_TH}`;
  }
  return `โรงพยาบาลในเครือข่ายกรุงไทย-แอกซ่าที่${place.th}มี ${here.length} แห่งครับ\n`
    + `${bulletsTh(here, PROVINCE_LIST)}\n${more > 0 ? `…และอีก ${more} แห่งในรายชื่อทั้งหมด\n` : ""}${FAX_TH}\n${CHECK_TH}`;
}

/** A general question is answered with the network's size and a question back: which province? */
function askProvince(lang: "en" | "th"): string {
  const hospitals = HOSPITALS.filter((h) => usable(h) && inpatient(h)).length;
  const clinics = HOSPITALS.filter((h) => usable(h) && !inpatient(h)).length;
  return lang === "en"
    ? `iHealthy Ultra comes with Krungthai-AXA's network of ${hospitals} hospitals and ${clinics} clinics across Thailand, `
      + `with Fax Claim (no upfront payment for covered treatment) from ${FAX_CLAIM_DAYS} days after your policy starts.\n`
      + "Which province do you live in? I'll send you the network hospitals there 🏥"
    : `iHealthy Ultra ใช้เครือข่ายของกรุงไทย-แอกซ่า โรงพยาบาล ${hospitals} แห่ง และคลินิก ${clinics} แห่งทั่วประเทศครับ `
      + `ใช้ Fax Claim ได้ไม่ต้องสำรองจ่าย เมื่อกรมธรรม์มีผลครบ ${FAX_CLAIM_DAYS} วัน\n`
      + "ลูกค้าอยู่จังหวัดไหนครับ เดี๋ยวส่งรายชื่อโรงพยาบาลในเครือข่ายที่จังหวัดนั้นให้ 🏥";
}

/** An answer about the network, and whether it ended by asking which province. */
export interface HospitalAnswer {
  text: string;
  asksProvince?: true;
}

/**
 * The answer to a question about the network, or undefined when the message is not one.
 *
 * A hospital named outright is answered whatever else the message says. A general question is
 * asked back which province (owner, 2026-10-02), and `awaitingProvince` — set when the last
 * answer asked — lets a bare "Phuket" or "เชียงใหม่" be the reply it is.
 */
export function hospitalReply(text: string, lang: "en" | "th", awaitingProvince = false): HospitalAnswer | undefined {
  const found = hospitalsIn(text);
  if (found.length) return { text: lang === "en" ? namedEn(found) : namedTh(found) };
  const place = provinceIn(text);
  if (awaitingProvince && place) return { text: inProvince(place, lang) };
  if (!ASKS_EN.test(text) && !ASKS_TH.test(text)) return undefined;
  return place ? { text: inProvince(place, lang) } : { text: askProvince(lang), asksProvince: true };
}
