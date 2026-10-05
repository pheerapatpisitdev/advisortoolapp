import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { iHealthyAdCaution, iHealthyAdFacts } from "./ihealthy-ad";
import { EXPAT_HREF } from "./prompt";
import { contentProduct, type ContentProduct, type Figures } from "./products";
import { lifelong } from "./wording";

/**
 * Everything the model is allowed to know about one product, as one block of Thai.
 *
 * It is also the yardstick for the first check: a number in the finished post that is not
 * somewhere in this text was not handed to the model, and gets flagged.
 */
export interface Brief {
  product: ContentProduct;
  text: string;
  expired: boolean;
  rateVersion: string | null;
}

const NO_PRICES = "- **ตอนนี้ห้ามระบุเบี้ยหรือราคาใดๆ** ตารางเบี้ยกำลังปรับปรุง ให้เขียนโดยไม่ใส่ราคาและชวนทักมาถามแทน";

/**
 * The figures, or none of them when an engine cannot produce them.
 *
 * pensionFacts() throws when its example stops pricing rather than returning an expired flag;
 * treated the same way here, so a broken table costs the post its prices and not the page.
 */
function figuresOf(product: ContentProduct, today: Date): Figures {
  try {
    return product.figures(today);
  } catch (e) {
    console.error(`content figures for ${product.href} failed:`, e);
    return { expired: true, rateVersion: null, facts: [], prices: [] };
  }
}

/** What an English post to expats may say about iHealthy Ultra (owner, 2026-10-02). */
function expatBlock(): string[] {
  const days = iHealthyFacts().terms.outOfTerritoryDays;
  return [
    "",
    "### ข้อมูลสำหรับลูกค้าชาวต่างชาติ (เจ้าของยืนยัน 2026-10-02)",
    "- ชาวต่างชาติที่อาศัยอยู่ในประเทศไทยสมัครได้",
    "- ใช้ประกอบการยื่นขอวีซ่าได้ — ห้ามระบุชื่อหรือประเภทวีซ่า ห้ามบอกว่าใช้กับวีซ่าทุกประเภทหรือรับประกันว่าผ่าน ให้ชวนทักมาเช็กว่าเหมาะกับวีซ่าของเขาไหม",
    "- ตัวแทนดูแลและตอบแชทเป็นภาษาอังกฤษได้",
    `- นอกประเทศไทย คุ้มครองเฉพาะการรักษาฉุกเฉินที่เกิดภายใน ${days} วันนับจากวันเดินทาง (สูงสุดถึงวันที่ ${days}) — ไม่ใช่คุ้มครองทั่วโลก`,
  ];
}

/**
 * `adPlan`: an iHealthy Ultra ad round's headline plan (ihealthy-ad.ts, owner 2026-10-06) — what
 * the yearly limit pays for on that plan goes in after the facts, in the round's language (English
 * with `expat`), and the special waiting period for cancer into the cautions. Ignored for any other
 * product; without it the brief is as it always was.
 */
export function briefFor(href: string, today: Date = new Date(), opts: { expat?: boolean; adPlan?: string } = {}): Brief | null {
  const product = contentProduct(href);
  if (!product) return null;
  const fig = figuresOf(product, today);
  const adLang = opts.expat ? "en" : "th";
  const ad = opts.adPlan && href === EXPAT_HREF ? iHealthyAdFacts(opts.adPlan, adLang) : [];

  // ตลอดชีพ, never "ถึงอายุ 99": the owner's word for these plans in content (wording.ts)
  const text = lifelong([
    `## ${product.name}`,
    `ประเภท: ${product.kind}`,
    `เหมาะกับ: ${product.audience}`,
    "",
    "### จุดขาย (จากหน้าขายของแบบนี้)",
    ...product.points.map((p) => `- ${p}`),
    "",
    "### ข้อเท็จจริงและตัวเลข (คัดลอกได้ตรงตัวเท่านั้น)",
    ...fig.facts,
    ...(fig.expired ? [NO_PRICES] : fig.prices),
    ...ad,
    "",
    "### ข้อควรระวัง (ห้ามเขียนขัดกับข้อนี้)",
    ...product.cautions.map((c) => `- ${c}`),
    ...(ad.length ? [`- ${iHealthyAdCaution(adLang)}`] : []),
    ...(opts.expat && href === EXPAT_HREF ? expatBlock() : []),
  ].join("\n"));

  return { product, text, expired: fig.expired, rateVersion: fig.rateVersion };
}
