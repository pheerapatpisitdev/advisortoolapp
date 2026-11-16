import type { NextRequest } from "next/server";
import { GSAVING_CARD_KEYS } from "../canonical";
import { drawGsavingCard, type CardPlan } from "../gsaving-card/draw";
import {
  GS25_AGE_MAX, GS25_AGE_MIN, GS25_CODE, GS25_PREM_YEARS, GS25_TAX_CAP, GS25_TERM, quoteGlobalSaving255,
} from "@/calc/global-saving/engine-25-5";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/**
 * Global Savings Plus 25/5's whole-page card, for its page's ส่งให้ลูกค้า (owner, 2026-11-16):
 * 15/8's drawing (../gsaving-card/draw.tsx) with this plan's figures, its four bonus rows and
 * the surrender value in the yearly table. Asked for by the same keys as 15/8's.
 */
const PLAN: CardPlan = {
  name: "Global Savings Plus 25/5",
  code: GS25_CODE,
  term: GS25_TERM,
  premYears: GS25_PREM_YEARS,
  taxCap: GS25_TAX_CAP,
  ageMin: GS25_AGE_MIN,
  ageMax: GS25_AGE_MAX,
  maturityPct: 501,
  keys: GSAVING_CARD_KEYS,
  quote: quoteGlobalSaving255,
  surrender: true,
  bonusLine: "โบนัสดัชนีจ่ายจริง 4 ครั้ง คือสิ้นปีที่ 10, 15, 20 และตอนครบสัญญา ปีอื่นจึงเว้นว่าง · ดัชนี +2% และ +4% จำลองด้วยสูตรเดียวกับตัวอย่างของบริษัท",
  legalFigures: "เงินการันตี (เงินคืนรายปี 1% ของทุน · ครบสัญญา 501% ของทุน · มูลค่าเวนคืน) ได้รับแน่นอน โบนัสตามดัชนีไม่การันตี จ่ายสิ้นปีที่ 10, 15, 20 และครบสัญญา",
  legalName: "“โกลบอล เซฟวิ่งส์ พลัส 25/5 (อินเด็กซ์ ลิงค์)” ของบริษัท กรุงไทย-แอกซา ประกันชีวิต จำกัด (มหาชน) ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง",
};

export async function GET(req: NextRequest) {
  return drawGsavingCard(req, PLAN);
}
