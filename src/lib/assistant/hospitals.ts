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

/** A province the message names, in either language. */
function provinceIn(text: string): { th: string; en: string } | undefined {
  const said = squash(text);
  const named = PROVINCES.filter((p) => said.includes(squash(p.th)) || said.includes(squash(p.en)));
  if (said.includes("กรุงเทพ") || /\bbkk\b/i.test(text)) {
    const bkk = PROVINCES.find((p) => p.en === "Bangkok");
    if (bkk && !named.includes(bkk)) named.push(bkk);
  }
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

function bulletsEn(list: Hospital[]): string {
  return list.slice(0, 6).map((h) => `• ${h.en} (${h.provinceEn})`).join("\n");
}
function bulletsTh(list: Hospital[]): string {
  return list.slice(0, 6).map((h) => `• ${h.th} (${h.district ? `${h.district} ` : ""}${h.province})`).join("\n");
}

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

function inProvince(province: { th: string; en: string }, lang: "en" | "th"): string {
  const here = HOSPITALS.filter((h) => h.province === province.th && usable(h) && inpatient(h));
  if (lang === "en") {
    return here.length
      ? `Krungthai-AXA has ${here.length} network hospitals in ${province.en} for individual health insurance, for example:\n`
        + `${bulletsEn(here)}\n${FAX_EN.replace(" there", " at any of them")}\n${CHECK_EN}`
      : `I can't find a network hospital in ${province.en} — an agent will check the nearest one for you. Full list: ${LIST_EN}`;
  }
  return here.length
    ? `โรงพยาบาลในเครือข่ายกรุงไทย-แอกซ่าที่${province.th}มี ${here.length} แห่งครับ เช่น\n${bulletsTh(here)}\n${FAX_TH}\n${CHECK_TH}`
    : `ยังไม่เจอโรงพยาบาลในเครือข่ายที่${province.th}ครับ เดี๋ยวตัวแทนเช็กแห่งที่ใกล้ที่สุดให้ ดูรายชื่อทั้งหมด: ${LIST_TH}`;
}

function general(lang: "en" | "th"): string {
  const hospitals = HOSPITALS.filter((h) => usable(h) && inpatient(h)).length;
  const clinics = HOSPITALS.filter((h) => usable(h) && !inpatient(h)).length;
  const known = WELL_KNOWN.map((id) => HOSPITALS.find((h) => h.id === id && usable(h))).filter((h): h is Hospital => Boolean(h));
  if (lang === "en") {
    return `iHealthy Ultra comes with Krungthai-AXA's network of ${hospitals} hospitals and ${clinics} clinics across Thailand — `
      + `including ${known.map((h) => h.en).join(", ")}. `
      + `After ${FAX_CLAIM_DAYS} days you can use Fax Claim at any of them, with no upfront payment for covered treatment.\n`
      + "Which hospital or area do you have in mind? If yours isn't on the list, an agent can explain how claims work there. "
      + `Full list: ${LIST_EN}`;
  }
  return `iHealthy Ultra ใช้เครือข่ายของกรุงไทย-แอกซ่า โรงพยาบาล ${hospitals} แห่ง และคลินิก ${clinics} แห่งทั่วประเทศครับ `
    + `เช่น ${known.map((h) => h.th).join(", ")}\n`
    + `เมื่อกรมธรรม์มีผลครบ ${FAX_CLAIM_DAYS} วัน ใช้ Fax Claim ได้ทุกแห่ง ไม่ต้องสำรองจ่ายค่ารักษาที่อยู่ในความคุ้มครอง\n`
    + `สนใจโรงพยาบาลไหนหรือแถวไหนบอกได้เลยครับ ถ้าไม่อยู่ในรายชื่อ ตัวแทนอธิบายวิธีเคลมให้ได้ ดูรายชื่อทั้งหมด: ${LIST_TH}`;
}

/**
 * The answer to a question about the network, or undefined when the message is not one.
 *
 * A hospital named outright is answered whatever else the message says; a province or the
 * network in general only when the message is asking about hospitals.
 */
export function hospitalReply(text: string, lang: "en" | "th"): string | undefined {
  const found = hospitalsIn(text);
  if (found.length) return lang === "en" ? namedEn(found) : namedTh(found);
  const asks = lang === "en" ? ASKS_EN.test(text) || ASKS_TH.test(text) : ASKS_TH.test(text) || ASKS_EN.test(text);
  if (!asks) return undefined;
  const province = provinceIn(text);
  return province ? inProvince(province, lang) : general(lang);
}
