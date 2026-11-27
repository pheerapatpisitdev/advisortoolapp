import { describe, expect, it } from "vitest";
import { allowedNumbers, fallbackLines, lineProblem, numbersIn, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { GROUP_NO_BUDGET, resolveBudget } from "@/lib/quote-video/budget";
import { checked } from "@/lib/quote-video/check-input";
import { carryFigure } from "@/lib/quote-video/carry";
import { GI, PRODUCT_LIMITS, type BizType } from "@/lib/group-insurance/data";
import { computeMultiGroupQuote } from "@/lib/group-insurance/quote";
import { checkedGroup, GROUP_NAME, type GroupKind, type GroupPick, type GroupVideoInput } from "@/lib/quote-video/group";
import { readGroups, writeGroups } from "@/lib/quote-video/group-pick";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { productQas } from "@/lib/quote-video/qa";
import { sayNumbers } from "@/lib/quote-video/say-numbers";
import { pageCaption, personOf, pricedByPlan, quoteVideoFacts, quoteVideoScript } from "@/lib/quote-video/script";
import { stageView } from "@/lib/quote-video/stage-views";
import { extraOf, extraVoice } from "@/lib/quote-video/told";
import { factLines } from "@/lib/quote-video/writer";

/** the mockup's example (owner, 2026-11-26, "gr"): 20 people, business type 1, plan 3 with OPD plan 3 */
const PAGE: GroupVideoInput = { product: "GROUP", kind: "health", groups: [{ biz: "biz1", plan: 3, rider: 3, count: 20 }] };
/** never said: the words the voice keeps out, and nothing of an age or a sex the price does not depend on */
const NEVER = /เบี้ย|เสียชีวิต|ตาย|เวนคืน|ทันที|ภาษี|ออม|ผู้ชาย|ผู้หญิง|อายุ\s*\d/;
const LENGTHS = ["short", "full", "long", "max"] as const;
const BIZ: BizType[] = ["biz1", "biz2", "biz3"];
/** each band's edges, as quote.ts reads them off the whole head count */
const EDGES: Record<GroupKind, number[]> = { health: [10, 25, 26, 50, 51, 100], pa: [5, 19, 20, 49, 50, 99, 100, 199, 200, 999, 1000, 2000] };
const cellOf = (s: string) => Number(s.replace(/[^\d]/g, ""));
const benefit = (rows: { key: string; values: string[] }[], key: string, i: number) => cellOf(rows.find((r) => r.key === key)!.values[i]);
/** the page's own quotation of these groups */
const pageQuote = (kind: GroupKind, groups: GroupPick[]) => computeMultiGroupQuote(kind, groups.map((g, i) => ({
  id: `g${i}`, name: "", bizType: g.biz, planIdx: g.plan - 1, includeRider: g.rider !== undefined, riderIdx: (g.rider ?? 1) - 1, count: String(g.count),
})));

describe("ประกันกลุ่ม in วิดีโอนำเสนอ", () => {
  it("states the mockup's figures, told to the employer, with no one's age or sex", () => {
    const f = quoteVideoFacts(PAGE)!;
    const g = f.group!;
    expect(f.product).toBe("GROUP");
    expect(g).toMatchObject({ kind: "health", bizNo: 1, plan: 3, rider: 3, count: 20, total: 20, groups: 1, band: "10-25", main: 5_382, riderPremium: 3_126, perPerson: 8_508, perMonth: 709, grandTotal: 170_160 });
    expect(g.health).toEqual({ room: 2_000, roomDays: 31, icu: 4_000, icuDays: 7, surgery: 40_000, other: 40_000, emergency: 6_000, life: 300_000, accident: 300_000, opd: 800, opdVisits: 30 });
    // the header: the plan on the left, the business type and the head count where an age and a sex would be
    expect(f.planLine).toBe("สุขภาพกลุ่ม แผน 3 + OPD 3");
    expect(f.insuredWho).toBe("ธุรกิจ 1 · 20 คน");
    expect(f.sex).toBeUndefined();
    expect(pricedByPlan(f)).toBe(true);
    // the opening: the head count, counted in people
    expect(f.lead).toEqual({ label: "ประกันสุขภาพกลุ่ม", amount: "20", baht: 20, unit: "คน" });
    expect(f.leadMark).toBe("แผน 3 + OPD 3");
    expect(f.leadPill).toBe("รับ 10–100 คน");
    // the price: a head a year, about a month, the whole company
    expect(f.priceBig).toEqual({ label: "ตกคนละ", amount: "8,508", unit: "บาท ต่อปี" });
    expect(f.priceMark).toBe("ตกคนละ 8,508 บาทต่อปี");
    expect(f.pills).toEqual(["ประมาณเดือนละ 709 บาท/คน"]);
    expect(f.prices).toEqual([{ label: "ทั้งบริษัท ต่อปี", amount: "170,160", main: true }]);
    expect(f.contactLine).toBe("ทีมอุ่นใจ บริษัทมั่นใจ");
    expect(carryFigure("price", f)).toBe("8,508 บาท/คน");
    expect(carryFigure("cover", f)).toBeNull();
    expect(carryFigure("critical", f)).toBe("300,000 บาท");
    // the writer is told what the price is by, and nothing of an age it covers to
    const facts = factLines(f);
    expect(facts).toContain("ราคาตาม: ธุรกิจ 1 · 20 คน");
    expect(facts).toContain("ประกันสุขภาพกลุ่ม: 20 คน");
    expect(facts.some((l) => /คุ้มครองถึงอายุ/.test(l))).toBe(false);
  });

  it("draws the mockup's scenes of its own", () => {
    const f = quoteVideoFacts(PAGE)!;
    const stay = stageView("cover", f)!;
    expect(stay.kicker).toBe("นอนโรงพยาบาล");
    expect(stay.rows!.map((r) => [r.label, r.sub, r.amount, Boolean(r.on)])).toEqual([
      ["ค่าห้อง ค่าอาหาร ต่อวัน", "สูงสุด 31 วัน", 2_000, true],
      ["ห้อง ICU ต่อวัน", "สูงสุด 7 วัน", 4_000, false],
      ["ค่าแพทย์ผ่าตัด", undefined, 40_000, false],
      ["ค่ารักษาอื่นในโรงพยาบาล", undefined, 40_000, false],
    ]);
    expect(stay.foot).toBeUndefined();
    const opd = stageView("family", f)!;
    expect(opd).toMatchObject({ kicker: "ผู้ป่วยนอก (OPD)", big: { amount: 800, unit: "บาท ต่อครั้ง" } });
    expect(opd.rows!.map((r) => [r.label, r.amount, r.unit])).toEqual([["ปีละสูงสุด", 30, "ครั้ง"], ["อุบัติเหตุฉุกเฉิน", 6_000, undefined]]);
    const life = stageView("critical", f)!;
    expect(life.kicker).toBe("คุ้มครองชีวิตด้วย");
    expect(life.rows!.map((r) => [r.label, r.amount])).toEqual([["ชีวิต และทุพพลภาพถาวร", 300_000], ["อุบัติเหตุ รับเพิ่ม", 300_000]]);
    // without OPD: no such scene, the emergency cover the plan keeps said under the stay
    const bare = quoteVideoFacts({ product: "GROUP", kind: "health", groups: [{ biz: "biz1", plan: 3, count: 20 }] })!;
    expect(stageView("family", bare)).toBeUndefined();
    expect(stageView("cover", bare)!.foot).toBe("+ ค่ารักษาอุบัติเหตุฉุกเฉิน 6,000 บาท");
    expect(stageView("lead", f)).toBeUndefined();
    expect(stageView("price", f)).toBeUndefined();
  });

  it("speaks the mockup's six lines", () => {
    const lines = quoteVideoScript(quoteVideoFacts(PAGE)!, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "family", "critical", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ อยากดูแลพนักงานให้ดี และรักษาคนเก่งไว้กับบริษัท ประกันสุขภาพกลุ่ม สำหรับทีม 20 คน เริ่มได้ตั้งแต่ 10 คนค่ะ");
    expect(lines[1].voice).toBe("ตกคนละ 8,508 บาทต่อปี หรือประมาณเดือนละ 709 บาทต่อคน ทั้งบริษัท ปีละ 170,160 บาทค่ะ");
    expect(lines[2].voice).toBe("ป่วยต้องนอนโรงพยาบาล ค่าห้องวันละ 2,000 บาท ห้องไอซียูวันละ 4,000 บาท ค่าผ่าตัดสูงสุด 40,000 บาทค่ะ");
    expect(lines[3].voice).toBe("ไม่ต้องนอนโรงพยาบาลก็เบิกได้ ผู้ป่วยนอกครั้งละ 800 บาท ปีละ 30 ครั้ง อุบัติเหตุฉุกเฉินอีก 6,000 บาทค่ะ");
    expect(lines[4].voice).toBe("มีคุ้มครองชีวิต 300,000 บาท และถ้าเป็นอุบัติเหตุ ได้เพิ่มอีก 300,000 บาทค่ะ");
    expect(lines[5].voice).toBe("ให้ทีมงานอุ่นใจ บริษัทก็มั่นใจ สนใจ ทักมาขอใบเสนอได้เลยค่ะ");
    expect(sayNumbers(lines[1].voice)).toContain("ปีละ หนึ่งแสนเจ็ดหมื่นหนึ่งร้อยหกสิบ บาท");
    // a man's endings; a named contact asked by name
    expect(quoteVideoScript(quoteVideoFacts(PAGE)!, "", "M").every((l) => !/ค่ะ|คะ/.test(l.voice))).toBe(true);
    const named = quoteVideoScript(quoteVideoFacts(PAGE)!, "สมชาย");
    expect(named[0].voice).toMatch(/^สวัสดีค่ะ คุณสมชาย อยากดูแลพนักงาน/);
    expect(named[5].voice).toBe("ให้ทีมงานอุ่นใจ บริษัทก็มั่นใจ คุณสมชายสนใจ ทักมาขอใบเสนอได้เลยค่ะ");
  });

  it("tells PA groups: what an accident pays, the medical expense where ME is taken", () => {
    const f = quoteVideoFacts({ product: "GROUP", kind: "pa", groups: [{ biz: "biz1", plan: 6, rider: 6, count: 2_000 }] })!;
    const g = f.group!;
    expect(g).toMatchObject({ kind: "pa", band: "1,000-2,000", main: 1_050, riderPremium: 790, perPerson: 1_840, perMonth: 153, grandTotal: 3_680_000 });
    expect(g.pa).toEqual({ death: 1_000_000, loss2: 1_000_000, loss1: 600_000, murder: 1_000_000, motorcycle: 1_000_000, me: 100_000 });
    expect(f.planLine).toBe("PA กลุ่ม P6 + ME 100,000");
    expect(f.insuredWho).toBe("ธุรกิจ 1 · 2,000 คน");
    expect(f.leadPill).toBe("รับ 5–2,000 คน");
    expect(f.footNote).toMatch(/ขั้นต่ำ 3,000 บาทต่อกลุ่ม/);
    const lines = quoteVideoScript(f, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "family", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ อุบัติเหตุเกิดได้ทุกวัน ดูแลพนักงานด้วยประกันอุบัติเหตุกลุ่ม สำหรับทีม 2,000 คน เริ่มได้ตั้งแต่ 5 คนค่ะ");
    expect(lines[2].voice).toBe("ถ้าอุบัติเหตุทำให้จากไป หรือทุพพลภาพถาวร รับ 1 ล้านบาท สูญเสียมือ เท้า หรือสายตา 2 ข้าง รับ 1 ล้านบาท ข้างเดียว รับ 600,000 บาท ขับขี่หรือโดยสารมอเตอร์ไซค์ก็คุ้มครองค่ะ");
    expect(lines[3].voice).toBe("บาดเจ็บจากอุบัติเหตุ เบิกค่ารักษาได้ อุบัติเหตุแต่ละครั้งสูงสุด 100,000 บาทค่ะ");
    const cover = stageView("cover", f)!;
    expect(cover.rows!.map((r) => r.amount)).toEqual([1_000_000, 1_000_000, 600_000, 1_000_000]);
    expect(stageView("family", f)).toMatchObject({ kicker: "ค่ารักษาจากอุบัติเหตุ", big: { amount: 100_000 } });
    expect(stageView("critical", f)).toBeUndefined();
    // without ME: four scenes, no medical scene
    const bare = quoteVideoFacts({ product: "GROUP", kind: "pa", groups: [{ biz: "biz2", plan: 2, count: 5 }] })!;
    expect(quoteVideoScript(bare, "").map((l) => l.key)).toEqual(["lead", "price", "cover", "contact"]);
    expect(stageView("family", bare)).toBeUndefined();
  });

  for (const kind of ["health", "pa"] as const) {
    it(`states the page's own figures for ${kind}: every business type, band edge, plan and rider, and says nothing it should not`, () => {
      const benefits = kind === "health" ? GI.healthBenefits : GI.paMainBenefits;
      for (const biz of BIZ) for (const count of EDGES[kind]) for (let plan = 1; plan <= 6; plan++) {
        for (const rider of [undefined, plan, Math.min(6, plan + 1)]) {
          const at = `${kind} ${biz} ${count} P${plan} R${rider ?? "-"}`;
          const groups: GroupPick[] = [{ biz, plan, ...(rider ? { rider } : {}), count }];
          const f = quoteVideoFacts({ product: "GROUP", kind, groups })!;
          expect(f, at).toBeDefined();
          const g = f.group!;
          const q = pageQuote(kind, groups);
          // the page's own quotation, to the baht
          expect([g.main, g.riderPremium, g.perPerson, g.grandTotal, g.band], at).toEqual([q.groups[0].mainPremium, q.groups[0].riderPremium, q.groups[0].perPerson, q.grandTotal, q.band]);
          expect(f.priceBig!.amount).toBe(q.groups[0].perPerson.toLocaleString("en-US"));
          expect(f.prices[0].amount).toBe(q.grandTotal.toLocaleString("en-US"));
          expect(g.perMonth).toBe(Math.round(q.groups[0].perPerson / 12));
          expect(f.sex).toBeUndefined();
          // the benefit table's own cells
          if (kind === "health") {
            expect([g.health!.room, g.health!.icu, g.health!.surgery, g.health!.other, g.health!.life, g.health!.accident], at)
              .toEqual(["hRoomBoard", "hIcuRoom", "hSurgery", "hOtherMedical", "hDeath", "hDeathAccident"].map((k) => benefit(benefits, k, plan - 1)));
            expect(g.health!.opd, at).toBe(rider ? benefit(benefits, "hOpdPerVisit", rider - 1) : undefined);
          } else {
            expect([g.pa!.death, g.pa!.loss2, g.pa!.loss1, g.pa!.motorcycle], at)
              .toEqual(["paDeathDisability", "paLoss2Limbs", "paLoss1Limb", "paMotorcycle"].map((k) => benefit(benefits, k, plan - 1)));
            expect(g.pa!.me, at).toBe(rider ? cellOf(GI.paMeCoverLevels[rider - 1]) : undefined);
          }
          // the scenes each has: health 5 or 6, PA 4 or 5
          const lines = quoteVideoScript(f, "");
          const keys = lines.map((l) => l.key);
          if (kind === "health") expect(keys, at).toEqual(rider ? ["lead", "price", "cover", "family", "critical", "contact"] : ["lead", "price", "cover", "critical", "contact"]);
          else expect(keys, at).toEqual(rider ? ["lead", "price", "cover", "family", "contact"] : ["lead", "price", "cover", "contact"]);
          // the voice's figures are the screen's
          const said = (k: string) => lines.find((l) => l.key === k)!.voice;
          expect(numbersIn(said("lead"))).toEqual(expect.arrayContaining([count, PRODUCT_LIMITS[kind].min]));
          expect(numbersIn(said("price"))).toEqual(expect.arrayContaining([g.perPerson, g.perMonth, g.grandTotal]));
          if (kind === "health") {
            expect(numbersIn(said("cover"))).toEqual(expect.arrayContaining([g.health!.room, g.health!.icu, g.health!.surgery]));
            expect(numbersIn(said("critical"))).toEqual(expect.arrayContaining([g.health!.life, g.health!.accident]));
            if (rider) expect(numbersIn(said("family"))).toEqual(expect.arrayContaining([g.health!.opd!, 30, g.health!.emergency]));
          } else {
            expect(numbersIn(said("cover"))).toEqual(expect.arrayContaining([g.pa!.loss1]));
            if (rider) expect(numbersIn(said("family"))).toContain(g.pa!.me);
          }
          // the long lengths at the edges of the bands, a woman's and a man's: only the quote's figures, no word kept out
          const allowed = allowedNumbers(f);
          const lengths = plan === 1 || plan === 6 ? LENGTHS : (["full"] as const);
          for (const length of lengths) for (const narrator of ["F", "M"] as const) for (const l of quoteVideoScript(f, "", narrator, length)) {
            expect(l.voice, `${at} ${length} ${l.key}`).not.toMatch(NEVER);
            for (const n of numbersIn(l.voice)) expect(allowed.has(n), `${at} ${length} ${l.key}: ${n}`).toBe(true);
          }
          expect(pageCaption(f)).not.toMatch(/ชาย|หญิง|อายุ\s*\d|เบี้ย/);
        }
      }
    });
  }

  it("tells several groups: the first's plan, everyone's head count and the company's total, and says so", () => {
    const groups: GroupPick[] = [{ biz: "biz1", plan: 3, rider: 3, count: 20 }, { biz: "biz2", plan: 2, count: 15 }, { biz: "biz3", plan: 4, rider: 5, count: 10 }];
    const f = quoteVideoFacts({ product: "GROUP", kind: "health", groups })!;
    const g = f.group!;
    const q = pageQuote("health", groups);
    // 45 people: every group at the 26–50 band, the first group's price from it
    expect(q.band).toBe("26-50");
    expect(g).toMatchObject({ count: 20, total: 45, groups: 3, band: "26-50", perPerson: q.groups[0].perPerson, grandTotal: q.grandTotal });
    expect(g.perPerson).toBe(5_304 + 3_126);
    expect(f.insuredWho).toBe("3 กลุ่ม · 45 คน");
    expect(f.leadPill).toBe("รวม 3 กลุ่ม 45 คน");
    expect(f.leadMark).toBe("กลุ่มแรก แผน 3 + OPD 3");
    expect(f.priceBig!.label).toBe("กลุ่มแรก 20 คน ตกคนละ");
    expect(f.prices).toEqual([{ label: "ทั้งบริษัท ต่อปี", amount: q.grandTotal.toLocaleString("en-US"), main: true }]);
    expect(f.priceNotes).toContain("ทั้งบริษัท 3 กลุ่ม 45 คน");
    expect(stageView("cover", f)!.sub).toMatch(/^กลุ่มแรก แผน 3/);
    const lines = quoteVideoScript(f, "");
    expect(lines[0].voice).toContain("สำหรับทีม 45 คน 3 กลุ่ม");
    expect(lines[1].voice).toBe(`กลุ่มแรก 20 คน ตกคนละ ${q.groups[0].perPerson.toLocaleString("en-US")} บาทต่อปี หรือประมาณเดือนละ ${Math.round(q.groups[0].perPerson / 12)} บาทต่อคน ทั้งบริษัท 3 กลุ่ม ปีละ ${q.grandTotal.toLocaleString("en-US")} บาทค่ะ`);
    expect(lines[2].voice).toMatch(/^แผนของกลุ่มแรก /);
    expect(pageCaption(f)).toContain("ทั้งบริษัท 3 กลุ่ม ปีละ");
    // a group under the minimum alone is quoted at the whole company's band (quote.ts): 6 + 6 PA people are 12, the 5–19 band
    const pa = quoteVideoFacts({ product: "GROUP", kind: "pa", groups: [{ biz: "biz1", plan: 1, count: 3 }, { biz: "biz3", plan: 2, rider: 3, count: 3 }] })!;
    expect(pa.group).toMatchObject({ total: 6, band: "5-19", perPerson: 150, grandTotal: 3 * 150 + 3 * (600 + 861) });
  });

  it("tells the other lengths, the comparison and the questions", () => {
    const f = quoteVideoFacts(PAGE)!;
    const short = quoteVideoScript(f, "", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[0].voice).toBe("สวัสดิการพนักงาน ประกันสุขภาพกลุ่ม สำหรับทีม 20 คนค่ะ");
    expect(short[1].voice).toBe("ตกคนละประมาณเดือนละ 709 บาท ทั้งบริษัท ปีละ 170,160 บาทค่ะ");
    expect(quoteVideoScript(f, "", "F", "max").map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "family", "critical", "versus", "qa", "steps", "contact"]);
    expect(extraOf(f, {}).versus).toEqual({
      left: { label: "ค่าสวัสดิการ ต่อคน ประมาณเดือนละ", amount: "709", unit: "บาท" },
      right: { label: "นอนโรงพยาบาล ค่าห้องวันละ", amount: "2,000", unit: "บาท" },
      note: "ทั้งบริษัท ปีละ 170,160 บาท",
    });
    expect(extraVoice("versus", f, {})).toBe("ค่าสวัสดิการประมาณเดือนละ 709 บาทต่อคน แต่ถ้าพนักงานต้องนอนโรงพยาบาล ได้ค่าห้องถึงวันละ 2,000 บาทค่ะ");
    const pa = quoteVideoFacts({ product: "GROUP", kind: "pa", groups: [{ biz: "biz1", plan: 6, count: 50 }] })!;
    expect(extraVoice("versus", pa, {})).toMatch(/อุบัติเหตุร้ายแรง รับสูงสุดถึง 1,000,000 บาทค่ะ$/);
    expect(extraOf(f, {}).steps).toEqual(["ทักมาคุยกัน", "รับใบเสนอ ส่งรายชื่อพนักงาน", "อนุมัติแล้วเริ่มคุ้มครองวันถัดไป"]);
    for (const kind of ["health", "pa"]) for (const q of productQas("GROUP", kind)) expect(`${q.q} ${q.a}`).not.toMatch(/เบี้ย|เสียชีวิต|ตาย|เวนคืน|ทันที|ภาษี|%|อายุ/);
    expect(productQas("GROUP", "pa").find((q) => q.key === "size")!.a).toContain("5 ถึง 2,000 คน");
    expect(productQas("GROUP", "health").find((q) => q.key === "size")!.a).toContain("10 ถึง 100 คน");
    expect(pageCaption(f)).toBe([
      "ประกันสุขภาพกลุ่ม สวัสดิการพนักงาน · ทีม 20 คน ลักษณะธุรกิจ 1",
      "แผน 3 + OPD 3: ตกคนละ 8,508 บาทต่อปี (ประมาณเดือนละ 709 บาทต่อคน)",
      "ทั้งบริษัท ปีละ 170,160 บาท",
      "ค่าห้องวันละ 2,000 · ICU วันละ 4,000 · ผ่าตัด 40,000 · OPD ครั้งละ 800 (ปีละ 30 ครั้ง) · คุ้มครองชีวิต 300,000 + อุบัติเหตุเพิ่ม 300,000",
      "",
      "ทักแชทขอใบเสนอให้บริษัทของคุณได้เลย",
    ].join("\n"));
  });

  it("has fixed lines that pass its own checks, in both kinds, with and without the rider, one group or several", () => {
    const cases: GroupVideoInput[] = [
      PAGE,
      { product: "GROUP", kind: "health", groups: [{ biz: "biz3", plan: 1, count: 10 }] },
      { product: "GROUP", kind: "pa", groups: [{ biz: "biz1", plan: 6, rider: 6, count: 2_000 }] },
      { product: "GROUP", kind: "pa", groups: [{ biz: "biz2", plan: 1, count: 5 }] },
      { product: "GROUP", kind: "health", groups: [{ biz: "biz1", plan: 3, rider: 3, count: 20 }, { biz: "biz2", plan: 2, count: 15 }] },
    ];
    for (const v of cases) {
      const f = quoteVideoFacts(v)!;
      const at = JSON.stringify(v.groups);
      expect(storiesFor(f).length, at).toBe(3);
      for (const s of storiesFor(f)) for (const hook of WRITTEN_HOOKS) {
        expect(writtenProblems(fallbackLines(f, { hook, story: s.key }), f, { loop: false, story: true }), `${at} ${s.key} ${hook}`).toEqual({});
      }
      // what an agent's own line may not say of a plan priced by plan, business type and head count
      expect(lineProblem("ผู้ชายอายุ 35 ก็ทำได้", f, 150)).toMatch(/เพศหรืออายุ/);
      expect(lineProblem("ออมไว้ให้พนักงาน", f, 150)).toMatch(/ออม/);
      expect(lineProblem("คุ้มครองถึงอายุ 65", f, 150)).toMatch(/อายุ/);
      expect(lineProblem("ลดหย่อนภาษีได้", f, 150)).toMatch(/ภาษี/);
    }
    // the stories each kind has; a rider the plan was not given is never written of
    expect(storiesFor(quoteVideoFacts(PAGE)!).map((s) => s.key)).toEqual(["grteam", "grcost", "grhosp"]);
    expect(storiesFor(quoteVideoFacts(cases[2])!).map((s) => s.key)).toEqual(["grteam", "grcost", "graccident"]);
    expect(lineProblem("มี OPD ด้วยค่ะ", quoteVideoFacts(cases[1])!, 150)).toBe("แผนนี้ไม่มี OPD");
    expect(lineProblem("บาดเจ็บก็เบิกค่ารักษาได้", quoteVideoFacts(cases[3])!, 150)).toBe("แผนนี้ไม่มีค่ารักษา (ME)");
    expect(lineProblem("มี OPD ด้วยค่ะ", quoteVideoFacts(PAGE)!, 150)).toBeNull();
  });

  it("checks what the form sent: the kind's head counts, plans and riders, no age, no sex, no budget", () => {
    const c = checked({ ...PAGE }) as GroupVideoInput;
    expect(c).toMatchObject({ product: "GROUP", kind: "health", groups: [{ biz: "biz1", plan: 3, rider: 3, count: 20 }] });
    expect("age" in c || "sex" in c).toBe(false);
    expect(personOf(c)).toBeUndefined();
    const one = (g: Partial<GroupPick>, kind: GroupKind = "health") => checked({ product: "GROUP", kind, groups: [{ biz: "biz1", plan: 1, count: 20, ...g } as GroupPick] });
    // the head count, over all the groups: health 10–100, PA 5–2,000
    expect(one({ count: 9 })).toBe("ประกันสุขภาพกลุ่ม รับ 10–100 คน (รวมทุกกลุ่ม ตอนนี้ 9 คน)");
    expect(one({ count: 101 })).toBe("ประกันสุขภาพกลุ่ม รับ 10–100 คน (รวมทุกกลุ่ม ตอนนี้ 101 คน)");
    expect(one({ count: 4 }, "pa")).toBe("ประกันอุบัติเหตุกลุ่ม รับ 5–2,000 คน (รวมทุกกลุ่ม ตอนนี้ 4 คน)");
    expect(one({ count: 2_001 }, "pa")).toBe("ประกันอุบัติเหตุกลุ่ม รับ 5–2,000 คน (รวมทุกกลุ่ม ตอนนี้ 2,001 คน)");
    expect(one({ count: 10 })).toMatchObject({ product: "GROUP" });
    expect(one({ count: 100 })).toMatchObject({ product: "GROUP" });
    expect(one({ count: 5 }, "pa")).toMatchObject({ product: "GROUP" });
    expect(one({ count: 2_000 }, "pa")).toMatchObject({ product: "GROUP" });
    expect(checked({ product: "GROUP", kind: "health", groups: [{ biz: "biz1", plan: 1, count: 60 }, { biz: "biz2", plan: 1, count: 41 }] })).toMatch(/ตอนนี้ 101 คน/);
    expect(quoteVideoFacts({ product: "GROUP", kind: "health", groups: [{ biz: "biz1", plan: 1, count: 9 }] })).toBeUndefined();
    // plans, riders, business types, counts the page's own buttons could make
    expect(one({ plan: 0 })).toBe("เลือกแผน 1–6");
    expect(one({ plan: 7 })).toBe("เลือกแผน 1–6");
    expect(one({ plan: 2, rider: 4 })).toBe("OPD สูงกว่าแผนหลักได้ไม่เกิน 1 แผน");
    expect(one({ plan: 2, rider: 4 }, "pa")).toBe("ME สูงกว่าแผนหลักได้ไม่เกิน 1 แผน");
    expect(one({ plan: 2, rider: 3 })).toMatchObject({ product: "GROUP" });
    expect(one({ rider: 0 })).toBe("เลือกOPD 1–6");
    expect(one({ biz: "biz4" as BizType })).toBe("เลือกลักษณะธุรกิจ");
    expect(one({ count: 0 })).toBe("ใส่จำนวนพนักงาน");
    expect(one({ count: 12.5 })).toBe("ใส่จำนวนพนักงาน");
    expect(checked({ product: "GROUP", kind: "health", groups: [] })).toBe("ใส่กลุ่มพนักงาน");
    expect(checked({ product: "GROUP", kind: "life" as GroupKind, groups: PAGE.groups })).toBe("เลือกสุขภาพกลุ่ม หรือ PA กลุ่ม");
    expect(checkedGroup({ product: "GROUP", kind: "health", groups: Array.from({ length: 21 }, () => ({ biz: "biz1" as const, plan: 1, count: 1 })) })).toBe("ใส่กลุ่มพนักงาน");
    // the form offers no budget; an older tab's is refused, not worked out
    expect(checked({ ...PAGE, budget: { baht: 100_000, per: "year" } })).toBe(GROUP_NO_BUDGET);
    expect(resolveBudget(PAGE, { baht: 100_000, per: "year" })).toBe(GROUP_NO_BUDGET);
    // an agent who hid the monthly instalment changes nothing: the company pays by the year
    expect(quoteVideoFacts({ ...PAGE, hide: ["monthly", "semi"] })!.prices).toEqual([{ label: "ทั้งบริษัท ต่อปี", amount: "170,160", main: true }]);
    expect(GROUP_NAME).toBe("ประกันกลุ่ม");
  });

  it("opens from the page with every group", () => {
    const groups: GroupPick[] = [{ biz: "biz1", plan: 3, rider: 3, count: 20 }, { biz: "biz3", plan: 6, count: 1_000 }];
    const href = videoStartHref({ product: "GROUP", kind: "pa", groups });
    expect(href).toBe("/studio/quote-video?product=GROUP&kind=pa&g=1-3-3-20_3-6-0-1000");
    expect(videoStartFrom(Object.fromEntries(new URL(`https://x${href}`).searchParams))).toEqual({ product: "GROUP", kind: "pa", groups });
    for (const kind of ["health", "pa"] as const) for (const biz of BIZ) for (let plan = 1; plan <= 6; plan++) for (const rider of [undefined, plan]) {
      const gs: GroupPick[] = [{ biz, plan, ...(rider ? { rider } : {}), count: EDGES[kind][0] }];
      expect(videoStartFrom(Object.fromEntries(new URL(`https://x${videoStartHref({ product: "GROUP", kind, groups: gs })}`).searchParams))).toEqual({ product: "GROUP", kind, groups: gs });
    }
    expect(readGroups(writeGroups(groups))).toEqual(groups);
    // only what the page's own buttons make is read from an address; one stray group and none are
    expect(videoStartFrom({ product: "GROUP", kind: "pa", g: "1-3-3-20_4-1-0-5" })).toEqual({ product: "GROUP", kind: "pa" });
    expect(videoStartFrom({ product: "GROUP", kind: "pa", g: "1-7-0-5" })).toEqual({ product: "GROUP", kind: "pa" });
    expect(videoStartFrom({ product: "GROUP", kind: "pa", g: "1-1-0-0" })).toEqual({ product: "GROUP", kind: "pa" });
    expect(videoStartFrom({ product: "GROUP", kind: "life", g: "1-1-0-20" })).toEqual({ product: "GROUP", groups: [{ biz: "biz1", plan: 1, count: 20 }] });
    expect(readGroups(Array.from({ length: 21 }, () => "1-1-0-1").join("_"))).toBeUndefined();
    // the kind and the groups are the group plan's only
    expect(videoStartFrom({ product: "PA", kind: "pa", g: "1-1-0-20" })).toEqual({ product: "PA" });
  });
});
