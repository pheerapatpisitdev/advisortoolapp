import { GI, PLAN_COUNT, PRODUCT_LIMITS } from "@/lib/group-insurance/data";
import { computeMultiGroupQuote, type GroupInput } from "@/lib/group-insurance/quote";
import { GROUP_BIZ, GROUP_MAX_GROUPS, type BizType, type GroupKind, type GroupPick } from "./group-pick";
import type { CoverRow, QuoteVideoFacts, VideoInput } from "./script";

/**
 * ประกันกลุ่ม in วิดีโอนำเสนอ (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "gr"; owner
 * chose ข): the fourteenth plan, the /group-insurance page's — group health (IPD, OPD as its rider) or group PA (ME as
 * its rider) — told to the EMPLOYER: what it costs a head a year, about a month, and the whole company. Priced by plan,
 * business type and head count, never by a person (script.ts personOf, pricedByPlan): no face, no age, no sex.
 *
 * The page quotes several employee groups at once, priced at the band of the total head count (quote.ts). The input
 * carries every group the page had, so the figures are computeMultiGroupQuote's own; the clip tells the first group's
 * plan and benefits and gives the head count and the company's total over all of them, saying so on the screen.
 *
 * Its scenes: health — the hospital stay ("cover"), OPD ("family", only with OPD), the life cover ("critical");
 * PA — what it pays ("cover"), the medical expense ("family", only with ME). Every figure is a cell of
 * data/group-insurance/premiums.json, read as the page reads it.
 */

export type GroupVideoInput = Extract<VideoInput, { product: "GROUP" }>;
export { GROUP_BIZ, GROUP_MAX_GROUPS, type GroupKind, type GroupPick };

/** the plan as the Studio names it */
export const GROUP_NAME = "ประกันกลุ่ม";
/** each kind as the page's tabs name it */
export const GROUP_KIND_NAME: Record<GroupKind, string> = { health: "ประกันสุขภาพกลุ่ม", pa: "ประกันอุบัติเหตุกลุ่ม" };
/** the form's two buttons */
export const GROUP_KIND_SHORT: Record<GroupKind, string> = { health: "สุขภาพกลุ่ม", pa: "PA กลุ่ม" };
/** OPD's days and visits, the rate sheet's own words (premiums.json healthBenefits) */
const ROOM_DAYS = 31;
const ICU_DAYS = 7;
const OPD_VISITS = 30;
/** the PA page's conditions (translations.ts minPremiumDetail) */
const PA_MIN_PER_GROUP = 3_000;

export interface GroupVideoFacts {
  kind: GroupKind;
  kindName: string;
  /** the first group's */
  biz: BizType;
  bizNo: number;
  /** "สำนักงาน ค้าปลีก": health's own words for its business types; none for PA */
  bizDesc?: string;
  plan: number;
  rider?: number;
  /** the first group's head count, everyone's, and how many groups */
  count: number;
  total: number;
  groups: number;
  /** the band the total falls in ("10-25"), and what the kind writes */
  band: string;
  min: number;
  max: number;
  /** the first group's, a head a year: the main cover, the rider, both; about a month; the group's whole */
  main: number;
  riderPremium: number;
  perPerson: number;
  perMonth: number;
  subtotal: number;
  /** every group's, a year */
  grandTotal: number;
  health?: {
    room: number; roomDays: number; icu: number; icuDays: number; surgery: number; other: number;
    /** emergency accident OPD: the main plan's, OPD or not */
    emergency: number;
    life: number; accident: number;
    /** per visit, OPD's own plan; none without OPD */
    opd?: number; opdVisits: number;
  };
  pa?: {
    death: number; loss2: number; loss1: number; murder: number; motorcycle: number;
    /** medical expense per accident, the ME level; none without ME */
    me?: number;
  };
}

const money = (n: number) => n.toLocaleString("en-US");
const cell = (s: string | undefined) => Number((s ?? "").replace(/[^\d]/g, "")) || 0;
const healthRow = (key: string, idx: number) => cell(GI.healthBenefits.find((b) => b.key === key)?.values[idx]);
const paRow = (key: string, idx: number) => cell(GI.paMainBenefits.find((b) => b.key === key)?.values[idx]);
const isLevel = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= PLAN_COUNT;

/** the groups as the page's calculator takes them */
const inputsOf = (groups: GroupPick[]): GroupInput[] => groups.map((g, i) => ({
  id: `g${i + 1}`, name: "", bizType: g.biz, planIdx: g.plan - 1, includeRider: g.rider !== undefined, riderIdx: (g.rider ?? 1) - 1, count: String(g.count),
}));

/** "แผน 3 + OPD 3", "P3 + ME 30,000": a group's plan as the page names it */
export function groupPlanWord(kind: GroupKind, g: Pick<GroupPick, "plan" | "rider">): string {
  if (kind === "pa") return `P${g.plan}${g.rider ? ` + ME ${GI.paMeCoverLevels[g.rider - 1]}` : ""}`;
  return `แผน ${g.plan}${g.rider ? ` + OPD ${g.rider}` : ""}`;
}

/** What the form sent, checked; the words for what is wrong otherwise. */
export function checkedGroup(v: GroupVideoInput): GroupVideoInput | string {
  const kind = v.kind;
  if (kind !== "health" && kind !== "pa") return "เลือกสุขภาพกลุ่ม หรือ PA กลุ่ม";
  const raw: unknown[] = Array.isArray(v.groups) ? v.groups : [];
  if (!raw.length || raw.length > GROUP_MAX_GROUPS) return "ใส่กลุ่มพนักงาน";
  const rider = kind === "pa" ? "ME" : "OPD";
  const groups: GroupPick[] = [];
  for (const r of raw) {
    const g = (r ?? {}) as Partial<GroupPick>;
    if (!GROUP_BIZ.includes(g.biz as BizType)) return "เลือกลักษณะธุรกิจ";
    if (!isLevel(g.plan)) return `เลือกแผน 1–${PLAN_COUNT}`;
    if (g.rider !== undefined && !isLevel(g.rider)) return `เลือก${rider} 1–${PLAN_COUNT}`;
    // the insurer lets a rider run one step ahead of its plan and no further (GroupCard.tsx)
    if (g.rider !== undefined && g.rider > g.plan + 1) return `${rider} สูงกว่าแผนหลักได้ไม่เกิน 1 แผน`;
    if (!Number.isInteger(g.count) || (g.count as number) < 1) return "ใส่จำนวนพนักงาน";
    groups.push({ biz: g.biz as BizType, plan: g.plan, ...(g.rider !== undefined ? { rider: g.rider } : {}), count: g.count as number });
  }
  const { min, max } = PRODUCT_LIMITS[kind];
  const total = groups.reduce((n, g) => n + g.count, 0);
  if (total < min || total > max) return `${GROUP_KIND_NAME[kind]} รับ ${money(min)}–${money(max)} คน (รวมทุกกลุ่ม ตอนนี้ ${money(total)} คน)`;
  return { product: "GROUP", kind, groups };
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function groupVideoFacts(v: GroupVideoInput): QuoteVideoFacts | undefined {
  const ok = checkedGroup(v);
  if (typeof ok === "string") return undefined;
  const { kind, groups } = ok;
  const q = computeMultiGroupQuote(kind, inputsOf(groups));
  if (!q.withinLimit) return undefined;
  const first = groups[0];
  const fq = q.groups[0];
  const i = first.plan - 1;
  const several = groups.length > 1;
  const bizNo = GROUP_BIZ.indexOf(first.biz) + 1;
  const bizDesc = kind === "health" ? GI.healthBizTypes.find((b) => b.value === first.biz)?.desc?.replace(/,\s*/g, " ") : undefined;
  const g: GroupVideoFacts = {
    kind, kindName: GROUP_KIND_NAME[kind], biz: first.biz, bizNo, ...(bizDesc ? { bizDesc } : {}),
    plan: first.plan, ...(first.rider ? { rider: first.rider } : {}),
    count: first.count, total: q.totalCount, groups: groups.length, band: q.band, min: q.min, max: q.max,
    main: fq.mainPremium, riderPremium: fq.riderPremium, perPerson: fq.perPerson, perMonth: Math.round(fq.perPerson / 12),
    subtotal: fq.subtotal, grandTotal: q.grandTotal,
    ...(kind === "health"
      ? {
        health: {
          room: healthRow("hRoomBoard", i), roomDays: ROOM_DAYS, icu: healthRow("hIcuRoom", i), icuDays: ICU_DAYS,
          surgery: healthRow("hSurgery", i), other: healthRow("hOtherMedical", i), emergency: healthRow("hEmergencyOpd", i),
          life: healthRow("hDeath", i), accident: healthRow("hDeathAccident", i),
          ...(first.rider ? { opd: healthRow("hOpdPerVisit", first.rider - 1) } : {}), opdVisits: OPD_VISITS,
        },
      }
      : {
        pa: {
          death: paRow("paDeathDisability", i), loss2: paRow("paLoss2Limbs", i), loss1: paRow("paLoss1Limb", i),
          murder: paRow("paMurder", i), motorcycle: paRow("paMotorcycle", i),
          ...(first.rider ? { me: cell(GI.paMeCoverLevels[first.rider - 1]) } : {}),
        },
      }),
  };
  const plan = groupPlanWord(kind, first);
  const cover: CoverRow[] = g.health
    ? [
      { label: `ค่าห้อง ค่าอาหาร ต่อวัน (สูงสุด ${ROOM_DAYS} วัน)`, amount: money(g.health.room), mark: true },
      { label: `ห้อง ICU ต่อวัน (สูงสุด ${ICU_DAYS} วัน)`, amount: money(g.health.icu), mark: false },
      { label: "ค่าแพทย์ผ่าตัด", amount: money(g.health.surgery), mark: false },
      { label: "ค่ารักษาอื่นในโรงพยาบาล", amount: money(g.health.other), mark: false },
      ...(g.health.opd ? [{ label: `ผู้ป่วยนอก ต่อครั้ง (ปีละ ${OPD_VISITS} ครั้ง)`, amount: money(g.health.opd), mark: false }] : []),
      { label: "อุบัติเหตุฉุกเฉิน", amount: money(g.health.emergency), mark: false },
      { label: "ชีวิต และทุพพลภาพถาวร", amount: money(g.health.life), mark: false },
      { label: "อุบัติเหตุ รับเพิ่ม", amount: money(g.health.accident), mark: false },
    ]
    : [
      { label: "จากไป หรือทุพพลภาพถาวร", amount: money(g.pa!.death), mark: true },
      { label: "สูญเสียมือ เท้า สายตา 2 ข้าง", amount: money(g.pa!.loss2), mark: false },
      { label: "สูญเสียมือ เท้า สายตา 1 ข้าง", amount: money(g.pa!.loss1), mark: false },
      { label: "ถูกฆาตกรรม ลอบทำร้าย", amount: money(g.pa!.murder), mark: false },
      { label: "ขับขี่ โดยสารมอเตอร์ไซค์", amount: money(g.pa!.motorcycle), mark: false },
      ...(g.pa!.me ? [{ label: "ค่ารักษาต่ออุบัติเหตุ (ME)", amount: money(g.pa!.me), mark: false }] : []),
    ];
  const heads = `${money(q.totalCount)} คน`;
  return {
    product: "GROUP",
    planLine: `${GROUP_KIND_SHORT[kind]} ${plan}`,
    // where the others name the insured, what the price is by (owner, 2026-11-26): the business type and the head count
    insuredWho: several ? `${groups.length} กลุ่ม · ${heads}` : `ธุรกิจ ${bizNo} · ${heads}`,
    insuredLine: several ? `กลุ่มแรก ธุรกิจ ${bizNo} · ${money(first.count)} คน` : `สวัสดิการพนักงาน ${heads}`,
    // the youngest the group plan takes (the PA page's conditions, 16–64): never shown or said (script.ts pricedByPlan)
    age: 16,
    lead: { label: g.kindName, amount: money(q.totalCount), baht: q.totalCount, unit: "คน" },
    leadMark: several ? `กลุ่มแรก ${plan}` : plan,
    leadPill: several ? `รวม ${groups.length} กลุ่ม ${heads}` : `รับ ${money(q.min)}–${money(q.max)} คน`,
    contactLine: "ทีมอุ่นใจ บริษัทมั่นใจ",
    // the classic clip's highlighted line, a head's price a year (the Motion one says it big, priceBig)
    priceMark: `ตกคนละ ${money(g.perPerson)} บาทต่อปี`,
    priceBig: { label: several ? `กลุ่มแรก ${money(first.count)} คน ตกคนละ` : "ตกคนละ", amount: money(g.perPerson), unit: "บาท ต่อปี" },
    priceTitle: "ค่าสวัสดิการ",
    // short, beside a figure in the millions; the head count is in the header
    prices: [{ label: "ทั้งบริษัท ต่อปี", amount: money(q.grandTotal), main: true }],
    spokenPrice: { per: "ปีละ", amount: money(g.perPerson) },
    pills: [`ประมาณเดือนละ ${money(g.perMonth)} บาท/คน`],
    priceNotes: [
      `อัตรากลุ่ม ${q.band} คน (รวมทุกกลุ่ม) · ลักษณะธุรกิจ ${bizNo}`,
      ...(several ? [`ทั้งบริษัท ${groups.length} กลุ่ม ${heads}`] : []),
    ],
    coverTitle: kind === "health" ? "คุ้มครองอะไรบ้าง" : "คุ้มครองอุบัติเหตุ",
    cover,
    coverStyle: "rows",
    coverNote: plan,
    // the oldest the PA page's conditions cover to, never said (a group plan is renewed by the employer)
    coverToAge: 65,
    footNote: kind === "pa"
      ? `อัตรารวมอากรแสตมป์ (ประมาณการ) · ขั้นต่ำ ${money(PA_MIN_PER_GROUP)} บาทต่อกลุ่ม · พนักงานประจำ อายุ 16–64 ปี`
      : "อัตรารวมอากรแสตมป์ (ประมาณการ) · เงื่อนไขตามกรมธรรม์",
    group: g,
  };
}

/** a figure said aloud: a sum in the millions as "1 ล้านบาท", else "600,000 บาท" */
type Said = (baht: number) => string;
const many = (g: GroupVideoFacts) => g.groups > 1;

/** "สำหรับทีม 20 คน" / "สำหรับทีม 45 คน 3 กลุ่ม" */
const team = (g: GroupVideoFacts) => `สำหรับทีม ${money(g.total)} คน${many(g) ? ` ${g.groups} กลุ่ม` : ""}`;

/** the opening, after the greeting: why an employer buys it, what it is, for how many, from how few */
export const grLeadLine = (g: GroupVideoFacts): string => (g.kind === "health"
  ? `อยากดูแลพนักงานให้ดี และรักษาคนเก่งไว้กับบริษัท ประกันสุขภาพกลุ่ม ${team(g)} เริ่มได้ตั้งแต่ ${money(g.min)} คนค่ะ`
  : `อุบัติเหตุเกิดได้ทุกวัน ดูแลพนักงานด้วยประกันอุบัติเหตุกลุ่ม ${team(g)} เริ่มได้ตั้งแต่ ${money(g.min)} คนค่ะ`);

/** the opening after a written hook: no reason, the plan itself */
export const grLeadFact = (g: GroupVideoFacts): string => `แผนนี้ ${g.kindName} ${team(g)} เริ่มได้ตั้งแต่ ${money(g.min)} คนค่ะ`;

/** "ตกคนละ 8,508 บาทต่อปี หรือประมาณเดือนละ 709 บาทต่อคน ทั้งบริษัท ปีละ 170,160 บาทค่ะ" */
export const grPriceLine = (g: GroupVideoFacts): string =>
  `${many(g) ? `กลุ่มแรก ${money(g.count)} คน ` : ""}ตกคนละ ${money(g.perPerson)} บาทต่อปี หรือประมาณเดือนละ ${money(g.perMonth)} บาทต่อคน ทั้งบริษัท${many(g) ? ` ${g.groups} กลุ่ม` : ""} ปีละ ${money(g.grandTotal)} บาทค่ะ`;

/** the hospital stay (health's "cover") */
export const grStayLine = (g: GroupVideoFacts): string => {
  const h = g.health!;
  return `${many(g) ? "แผนของกลุ่มแรก " : ""}ป่วยต้องนอนโรงพยาบาล ค่าห้องวันละ ${money(h.room)} บาท ห้องไอซียูวันละ ${money(h.icu)} บาท ค่าผ่าตัดสูงสุด ${money(h.surgery)} บาทค่ะ`;
};

/** OPD (health's "family"); undefined without it */
export function grOpdLine(g: GroupVideoFacts): string | undefined {
  const h = g.health;
  if (!h?.opd) return undefined;
  return `ไม่ต้องนอนโรงพยาบาลก็เบิกได้ ผู้ป่วยนอกครั้งละ ${money(h.opd)} บาท ปีละ ${h.opdVisits} ครั้ง อุบัติเหตุฉุกเฉินอีก ${money(h.emergency)} บาทค่ะ`;
}

/** the life cover (health's "critical") */
export const grLifeLine = (g: GroupVideoFacts, said: Said): string =>
  `มีคุ้มครองชีวิต ${said(g.health!.life)} และถ้าเป็นอุบัติเหตุ ได้เพิ่มอีก ${said(g.health!.accident)}ค่ะ`;

/** what PA pays (PA's "cover") */
export const grPaCoverLine = (g: GroupVideoFacts, said: Said): string => {
  const p = g.pa!;
  return `ถ้าอุบัติเหตุทำให้จากไป หรือทุพพลภาพถาวร รับ ${said(p.death)} สูญเสียมือ เท้า หรือสายตา 2 ข้าง รับ ${said(p.loss2)} ข้างเดียว รับ ${said(p.loss1)} ขับขี่หรือโดยสารมอเตอร์ไซค์ก็คุ้มครองค่ะ`;
};

/** the medical expense (PA's "family"); undefined without ME */
export function grMeLine(g: GroupVideoFacts): string | undefined {
  const me = g.pa?.me;
  if (!me) return undefined;
  return `บาดเจ็บจากอุบัติเหตุ เบิกค่ารักษาได้ อุบัติเหตุแต่ละครั้งสูงสุด ${money(me)} บาทค่ะ`;
}

/** the closing: the employer is asked for the quotation */
export const grContactLine = (name: string): string =>
  `ให้ทีมงานอุ่นใจ บริษัทก็มั่นใจ ${name ? `คุณ${name}` : ""}สนใจ ทักมาขอใบเสนอได้เลยค่ะ`;
