import type { NextRequest } from "next/server";
import { GSAVING_CARD_KEYS } from "../canonical";
import { drawGsavingCard, type CardPlan } from "./draw";
import {
  GS_AGE_MAX, GS_AGE_MIN, GS_CODE, GS_PREM_YEARS, GS_TAX_CAP, GS_TERM, quoteGlobalSaving,
} from "@/calc/global-saving/engine";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** Global Savings Plus 15/8's whole-page card (./draw.tsx, which 25/5's card shares). */
const PLAN: CardPlan = {
  name: "Global Savings Plus 15/8",
  code: GS_CODE,
  term: GS_TERM,
  premYears: GS_PREM_YEARS,
  taxCap: GS_TAX_CAP,
  ageMin: GS_AGE_MIN,
  ageMax: GS_AGE_MAX,
  maturityPct: 801,
  keys: GSAVING_CARD_KEYS,
  quote: quoteGlobalSaving,
  surrender: false,
  bonusLine: "โบนัสดัชนีจ่ายจริง 2 ครั้ง คือสิ้นปีที่ 10 และตอนครบสัญญา ปีอื่นจึงเว้นว่าง",
  legalFigures: "เงินการันตี (เงินคืนรายปี 1% ของทุน · ครบสัญญา 801% ของทุน · มูลค่าเวนคืน) ได้รับแน่นอน โบนัสตามดัชนีไม่การันตี จ่ายสิ้นปีที่ 10 และครบสัญญา",
  legalName: "“โกลบอล เซฟวิ่งส์ พลัส 15/8 (อินเด็กซ์ ลิงค์)” ของบริษัท กรุงไทย-แอกซา ประกันชีวิต จำกัด (มหาชน) ผู้ขอเอาประกันภัยควรศึกษาเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง",
};

export async function GET(req: NextRequest) {
  return drawGsavingCard(req, PLAN);
}
