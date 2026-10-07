import type { Reply } from "./common";

/** What this page sells, as the session records which one a customer came for. */
export type Product = "lifeprotect" | "ihealthy" | "legacy" | "ishield" | "plb";

/**
 * A plan named outright — the only signal strong enough to move a conversation already under
 * way. "ประกันสุขภาพ" is that; a bare "สุขภาพ" is not, because a customer buying life cover is
 * asked to declare their health and then asks about the declaration.
 *
 * The English words are here because an m.me link carries one: `?ref=legacy` arrives as the
 * whole of the customer's first message, and a ref the reader does not know fails the way
 * every silent failure does — the customer is asked which plan, exactly as if the link had
 * never been set. Three of the four already answered to their own English name; this one had
 * none, so it has one. Whatever /admin/ads offers to copy has to be a word this list knows.
 */
const NAMES: [Product, RegExp][] = [
  ["plb", /protection\s*life|\bplb\b|โพรเทคชั่น\s*ไลฟ์|พีแอลบี/i],
  ["ihealthy", /ประกันสุขภาพ|ไอเฮลท์ตี้|ไอเฮลตี้|i\s*-?\s*healthy/i],
  ["legacy", /เบี้ยทิ้ง|มรดกเพื่อครอบครัว|มรดก\s*\+\s*โรคร้าย|\blegacy\b/i],
  ["ishield", /i\s*-?\s*shield|ไอ\s*ชิลด์|ออม/i],
  ["lifeprotect", /life\s*protect|ไลฟ์\s*โพรเทค|ไลฟ์โปรเทค|ประกันชีวิต|เบี้ยไม่ทิ้ง/i],
];

/**
 * The names that mean one plan and nothing else, as against the words several plans answer to
 * ("ประกันชีวิต", "เบี้ยทิ้ง", "ออม"). A conversation settled on Protection Life is moved off it
 * only by one of these.
 */
const EXPLICIT: Partial<Record<Product, RegExp>> = {
  lifeprotect: /life\s*protect|ไลฟ์\s*โพรเทค|ไลฟ์โปรเทค/i,
  legacy: /มรดกเพื่อครอบครัว|มรดก\s*\+\s*โรคร้าย|\blegacy\b/i,
  ishield: /i\s*-?\s*shield|ไอ\s*ชิลด์/i,
  ihealthy: /ประกันสุขภาพ|ไอเฮลท์ตี้|ไอเฮลตี้|i\s*-?\s*healthy/i,
  plb: /protection\s*life|\bplb\b|โพรเทคชั่น\s*ไลฟ์|พีแอลบี/i,
};

/** Whether a message holds the plan's own name rather than a word it shares with others. */
export function namedExplicitly(product: Product, text: string): boolean {
  return EXPLICIT[product]?.test(text) ?? false;
}

/**
 * A message about a company's staff rather than about the person writing it.
 *
 * None of the four plans below is sold this way — they are contracts a person takes out on
 * their own life — and the agency's group cover is a different product with different tables,
 * priced at /group-insurance and answered out of the library.
 *
 * This exists because "ประกันสุขภาพกลุ่มมีไหม" contains "ประกันสุขภาพ", so `NAMES` read it as
 * iHealthy Ultra and a company asking about thirty staff was asked its age and its sex and
 * quoted one person's premium. Wrong, and wrong in a way that looks right — which is worse
 * than the "สนใจแบบไหนครับ" the other group questions got, and is the reason this is a guard
 * on the reading rather than a fifth entry in the list.
 *
 * Deliberately narrow. "กลุ่ม" alone is not enough — a customer asks about กลุ่มโรค and กลุ่ม
 * อาการ — so it has to be the word this business uses for a body of employees, or the word
 * กลุ่ม standing next to an insurance word. Everything here has a case in the test file.
 */
const ABOUT_A_GROUP =
  /ประกัน\s*(?:ภัย)?\s*กลุ่ม|(?:สุขภาพ|อุบัติเหตุ|ชีวิต)\s*กลุ่ม|กลุ่ม\s*พนักงาน|หมู่คณะ|\bgroup\s*(?:health|pa|insurance)\b|พนักงาน(?:ประจำ|บริษัท|ทั้ง)|(?:บริษัท|องค์กร|โรงงาน|ห้างร้าน|นายจ้าง|hr)[^]{0,30}?พนักงาน|พนักงาน[^]{0,20}?\d+\s*คน|\d+\s*คน[^]{0,20}?พนักงาน/i;

/** Whether a message is asking about cover for a company's staff. */
export function aboutAGroup(text: string): boolean {
  return ABOUT_A_GROUP.test(text);
}

/**
 * What a message is about when it says so in as many words, or nothing when it says neither —
 * or both, which is a question about the difference and belongs to whoever is already
 * answering rather than to a switch of brains.
 *
 * Nothing, too, when the message is about a company's staff: see `ABOUT_A_GROUP`. Answering
 * nothing sends the question to the library, which has the group product's own section.
 */
export function productNamedIn(text: string): Product | undefined {
  if (aboutAGroup(text)) return undefined;
  const named = NAMES.filter(([, re]) => re.test(text));
  if (named.some(([product]) => product === "plb")) {
    // the plan's own name wins over the generic words beside it — "Protection Life ประกันชีวิต"
    // names a plan — but not over another plan's own name: that is a comparison, which belongs
    // to whoever is already answering
    return named.some(([product]) => product !== "plb" && namedExplicitly(product, text)) ? undefined : "plb";
  }
  return named.length === 1 ? named[0][0] : undefined;
}

/**
 * What a message is about from its subject alone.
 *
 * Weaker than a name, and only ever consulted before a conversation has settled on a plan: a
 * customer three turns into a health quote who asks "ทุนเท่าไหร่" means the sum on the base
 * contract under it, not a change of subject.
 */
const TOPICS: [Product, RegExp][] = [
  ["ihealthy", /ค่ารักษา|ค่าห้อง|เหมาจ่าย|ค่าหมอ|ผู้ป่วยใน|ผู้ป่วยนอก|\bopd\b|\bipd\b|แอดมิท|นอนโรงพยาบาล|นอน\s*รพ|ค่าผ่าตัด|วงเงินค่ารักษา/i],
  ["lifeprotect", /ทุน\s*\d|ทุนประกัน|\d+\s*ล้าน|\d+\s*แสน|(?:จ่าย|ชำระ)\s*(?:เบี้ย)?\s*\d+\s*ปี|อายุ\s*99|เวนคืน|เสียชีวิต/i],
];

/**
 * The subject of a message, when only one of the two recognises it.
 *
 * A company's staff is nobody's subject here, for the reason `ABOUT_A_GROUP` gives: "ค่าห้อง
 * ของประกันสุขภาพกลุ่ม" is the health *topic* as well as the health *name*, so guarding one
 * reading and not the other would leave the same wrong answer one sentence away.
 */
export function productByTopic(text: string): Product | undefined {
  if (aboutAGroup(text)) return undefined;
  const found = TOPICS.filter(([, re]) => re.test(text));
  return found.length === 1 ? found[0][0] : undefined;
}

/**
 * The words on the buttons.
 *
 * A tapped button arrives as its own title, so each one has to be a message `productNamedIn`
 * reads back — which is why they say what the plan is rather than "อันแรก" and "อันที่สอง".
 *
 * Twenty characters is the whole budget: Messenger cuts a longer title without saying so, and
 * "🛡 มรดกเบี้ยทิ้ง+โรคร้ายแรง" arrives in the inbox as "🛡 มรดกเบี้ยทิ้ง+โร". What the two
 * arrangements actually are is said in the message above them, which has no such limit.
 */
export const CHOOSE_HEALTH = "🏥 ประกันสุขภาพ";
export const CHOOSE_LIFE = "💰 Life Protect";
export const CHOOSE_LEGACY = "🛡 มรดกเพื่อครอบครัว";
export const CHOOSE_ISHIELD = "🌱 iShield";

/** Longer than this and Messenger truncates the title mid-word. */
export const MAX_BUTTON = 20;

/**
 * What the customer is choosing between, said before they are asked to choose.
 *
 * The buttons cannot carry it — twenty characters each — and a customer asked "สนใจแบบไหนครับ"
 * under names they have never seen is being asked to guess. Each one gets a sentence.
 *
 * Three, not four. The health contract is still sold, still priced, and still reached by
 * name, by subject and by advertisement — it is simply not offered to somebody who has said
 * nothing yet. A menu is a question, and the three left are one question: money for the
 * family after. The fourth asked a different one — the bills while you are still here — and
 * a stranger made to choose between the two at once is being asked to sort themselves before
 * they have said a word. It is one sentence away for anybody who wants it.
 *
 * The heading counts this list rather than saying a number, so a door added or taken away
 * cannot leave the greeting claiming a figure it no longer has.
 */
const DOORS: { product: Product; title: string; line: string }[] = [
  {
    product: "lifeprotect",
    title: CHOOSE_LIFE,
    line: "Life Protect — ประกันชีวิต เบี้ยไม่ทิ้ง ขายคืนได้",
  },
  {
    product: "legacy",
    title: CHOOSE_LEGACY,
    line: "มรดกเพื่อครอบครัว — วงเงินใหญ่ เบี้ยเบา เจอโรคร้ายรับเงินก้อน",
  },
  {
    product: "ishield",
    title: CHOOSE_ISHIELD,
    line: "iShield — ประกันโรคร้าย เบี้ยไม่ทิ้ง รับเงินคืนเต็ม",
  },
];

/**
 * The list as it is read out, numbered.
 *
 * The number is counted here rather than typed into each line, because a line that carries
 * its own "2." is a line that says 2 wherever it is moved to.
 */
function numbered(): string {
  return DOORS.map((d, i) => `${i + 1}. ${d.line}`).join("\n");
}

const HEADING = `สวัสดีครับ 🙏 ที่ผมดูแลมี ${DOORS.length} แบบครับ`;

export const CHOICES = `${HEADING}\n\n${numbered()}`;

/** The whole menu message as the bot says it when a Page has not written its own (page-welcome.ts). */
export const MENU_TEXT = `${CHOICES}\n\nสนใจแบบไหนครับ`;

/**
 * The number a customer typed instead of tapping.
 *
 * The list is numbered, so it invites this, and until now it was a dead end: "2" named no
 * plan, was about no plan's subject, and fell through to the menu again — a customer who had
 * chosen shown the same three lines and then offered a person. Numbering a list and not
 * reading the numbers back is the worst of both.
 *
 * A single digit only, and only one within the list. An age is two digits, a sum carries ล้าน
 * or แสน, and a paying term is written with ปี — so nothing else a customer types at this
 * point is a bare 1, 2 or 3. Thai numerals are read too, because a Thai keyboard offers them.
 *
 * Whether the menu was actually on screen is not decided here: the caller knows what it said
 * last, and out of that context a lone "2" is not an answer to anything.
 */
const PICKED =
  /^(?:(?:ขอ|เอา|สนใจ|เลือก)\s*)?(?:(?:ข้อ|แบบที่|แบบ|อันที่|อัน|ตัวที่)\s*)?([1-9๑-๙])\s*[.)]?\s*(?:ครับผม|ครับ|ค่ะ|คะ|ค่า|นะ|จ้า|เลย)?$/;

const THAI_DIGITS = "๑๒๓๔๕๖๗๘๙";

export function pickedFromMenu(text: string): Product | undefined {
  const m = PICKED.exec(text.trim());
  if (!m) return undefined;
  const d = m[1];
  const n = THAI_DIGITS.includes(d) ? THAI_DIGITS.indexOf(d) + 1 : Number(d);
  return DOORS[n - 1]?.product;
}

/**
 * The one question the bot asks before it knows what it is selling.
 *
 * Only when the message itself says nothing: the adverts open with buttons that name the plan
 * and most customers type a sum or a symptom, and a lead the campaign paid for should not have
 * to tap twice to be answered.
 *
 * The same three doors whatever age is on the session. They were narrowed by issue age for a
 * while, which is honest arithmetic and was the wrong screen for it: a man of sixty-six was
 * shown one door and still asked which one he wanted, and a man of eighty-five was handed
 * off before anyone had heard what he came for. The agency sells more than the bot prices,
 * the plans refuse for themselves further in, and a person reads this inbox — so the menu
 * says what is on the shelf and lets the customer speak first.
 */
export function askWhich(lead?: string): Reply {
  const asked = `${HEADING}\n\n${numbered()}`;

  // a customer who asked something first is answered first: "ของอะไร" met with "สนใจแบบไหนครับ"
  // is a question answered with a question, which is how it read in the inbox
  // marked, so a Page that wrote its own menu (page-welcome.ts) can say it in its words instead
  const menu = { text: `${asked}\n\nสนใจแบบไหนครับ`, menu: true };
  const messages = lead ? [{ text: lead }, menu] : [menu];
  return { messages, replies: DOORS.map((d) => d.title) };
}

/**
 * What is said instead of the same menu a second time.
 *
 * The four doors answered twice in a row is a dead end: the customer did not choose, and
 * nothing about repeating the list makes the choice easier. The agency watches this inbox, so
 * the second time the bot says so — and leaves the buttons up, because some customers were
 * only scrolling.
 */
export function askWhichAgain(): Reply {
  const again = askWhich();
  return {
    messages: [{
      text: "เลือกไม่ถูกไม่เป็นไรครับ 🙏 บอกมาคร่าวๆ ก็ได้ว่าอยากได้แบบไหน"
        + " — เก็บเงินไว้ให้ครอบครัว หรือค่ารักษาตอนนอนโรงพยาบาล"
        + "\nหรือจะให้แอดมินช่วยแนะนำก็ได้ครับ บอกอายุกับสิ่งที่กังวลมาได้เลย",
    }],
    replies: again.replies,
  };
}
