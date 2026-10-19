import { describe, expect, it } from "vitest";
import { quoteGlobalSaving } from "@/calc/global-saving/engine";
import { fallbackLines, lineProblem, storiesFor, writtenProblems, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { resolveBudget } from "@/lib/quote-video/budget";
import { checkedGsaving, gsavingVideoFacts, GS_RATES, type GsVideoInput } from "@/lib/quote-video/gsaving";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { gsTableImage, gsTablePlan, GS_VIDEO_COLUMNS } from "@/lib/quote-video/gsaving-table";
import { TABLE } from "@/lib/quote-video/table-geo";
import { productQas } from "@/lib/quote-video/qa";
import { pageCaption, quoteVideoFacts, quoteVideoScript, sceneMotion } from "@/lib/quote-video/script";
import { extraOf, extraVoice } from "@/lib/quote-video/told";

/** the storyboard's example (owner, 2026-10-20): a man of 35 saving 50,000 a year, the index at +3% */
const PAGE: GsVideoInput = { product: "GSAVING", age: 35, sex: "M", premium: 50_000, rate: 3 };
/** the voice's words the other plans never say either */
const NEVER = /เบี้ย|เสียชีวิต|เวนคืน|ทันที/;
const LENGTHS = ["short", "full", "long", "max"] as const;

describe("Global Savings 15/8 in วิดีโอนำเสนอ", () => {
  it("states the page's own figures for ชาย 35, 50,000 a year", () => {
    const f = gsavingVideoFacts(PAGE)!;
    const g = f.gsaving!;
    const page = quoteGlobalSaving({ basis: "premium", amount: 50_000, age: 35 });
    expect(f.product).toBe("GSAVING");
    expect(g).toMatchObject({ premium: 50_000, sa: 50_051, perDay: "137", rate: 3, payYears: 8, term: 15, paid: 400_000 });
    expect(Math.round(g.guaranteed)).toBe(407_916);
    expect(Math.round(g.maturity)).toBe(400_909);
    expect(Math.round(g.deathMax)).toBe(417_926);
    expect(Math.round(g.total)).toBe(Math.round(page.scenarios[2].total));
    expect(Math.round(g.total)).toBe(585_666);
    expect(g.bars.map((b) => [b.rate, Math.round(b.total), b.on])).toEqual([
      [-1, 407_916, false], [0, 407_916, false], [1, 459_779, false], [2, 518_726, false],
      [3, 585_666, true], [4, 661_620, false], [5, 747_726, false],
    ]);
    expect(f.lead).toMatchObject({ label: "รับเงินการันตีรวม", amount: "407,916" });
    expect(f.coverStyle).toBe("payback");
  });

  it("speaks the storyboard's lines", () => {
    const f = quoteVideoFacts(PAGE)!;
    const lines = quoteVideoScript(f, "");
    expect(lines.map((l) => l.key)).toEqual(["lead", "price", "cover", "index", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนออมนี้ให้ฟังสั้นๆ นะคะ คุณผู้ชายอายุ 35 ปี ออมเพียง 8 ปี รับเงินการันตีรวม 407,916 บาท แถมมีโบนัสตามดัชนีโลกด้วยค่ะ");
    expect(lines[1].voice).toBe("ออมแค่วันละ 137 บาท หรือปีละ 50,000 บาท ออมเพียง 8 ปีก็ครบ ยอดออมเท่าเดิมทุกปี แล้วยังนำไปลดหย่อนภาษีได้ด้วยค่ะ");
    expect(lines[2].voice).toBe("ระหว่างทางรับเงินคืน 1% ของทุนทุกปี ครบ 15 ปีรับอีก 400,909 บาท รวมเงินการันตี 407,916 บาท ได้แน่นอนค่ะ ระหว่างนี้ยังคุ้มครองชีวิตสูงสุด 417,926 บาทด้วยค่ะ");
    expect(lines[3].voice).toBe("ที่ชอบที่สุดคือ มีโบนัสตามดัชนีโลก ถ้าดัชนีโตเฉลี่ยปีละ 3% รับโบนัสสิ้นปีที่ 10 ประมาณ 37,143 บาท และตอนครบสัญญาอีกประมาณ 140,608 บาท รวมรับทั้งหมดประมาณ 585,666 บาท ส่วนโบนัสนี้ไม่การันตีนะคะ");
    expect(lines[4].voice).toBe("สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
    expect(quoteVideoScript(f, "", "M")[3].voice).toContain("นะครับ");
    expect(sceneMotion(f, "index")).toEqual({ sweeps: 2, spread: true });
    expect(pageCaption(f)).toContain("Global Savings 15/8");
    expect(pageCaption(f)).toContain("ไม่การันตี");
  });

  it("follows the picked index: an example above 0%, the full guarantee at 0% and below", () => {
    for (const rate of GS_RATES) {
      const f = quoteVideoFacts({ ...PAGE, rate })!;
      const index = quoteVideoScript(f, "").find((l) => l.key === "index")!.voice;
      if (rate > 0) {
        expect(index).toContain(`ถ้าดัชนีโตเฉลี่ยปีละ ${rate}%`);
        expect(index).toContain("ประมาณ");
        expect(index).toContain("ไม่การันตี");
      } else {
        expect(index).toContain("ก็ยังได้เงินการันตี 407,916 บาทเต็มจำนวน");
        expect(index).toContain(rate < 0 ? "ติดลบ" : "ไม่โตเลย");
        expect(f.gsaving!.bonus10 + f.gsaving!.bonus15).toBe(0);
      }
      // the bonus is never said as certain, at any length
      for (const length of LENGTHS) {
        for (const l of quoteVideoScript(f, "สมชาย", "F", length)) {
          expect(l.voice).not.toMatch(NEVER);
          expect(l.voice).not.toMatch(/โบนัส\S*?(?<!ไม่)(ได้)?แน่นอน/);
        }
      }
    }
  });

  it("makes a 15-second clip of three scenes", () => {
    const short = quoteVideoScript(quoteVideoFacts(PAGE)!, "สมชาย", "F", "short");
    expect(short.map((l) => l.key)).toEqual(["lead", "price", "contact"]);
    expect(short[0].voice).toBe("ออมเพียง 8 ปี รับเงินการันตีรวม 407,916 บาท แถมมีโบนัสตามดัชนีโลกด้วยค่ะ");
    expect(short[1].voice).toBe("ออมแค่วันละ 137 บาท เพียง 8 ปี แถมลดหย่อนภาษีได้ค่ะ");
  });

  it("refuses an age, a premium or a return the page does not allow", () => {
    expect(checkedGsaving({ ...PAGE, age: 76 })).toMatch(/0–75/);
    expect(checkedGsaving({ ...PAGE, premium: 19_999 })).toMatch(/20,000/);
    expect(checkedGsaving({ ...PAGE, rate: 6 })).toMatch(/ดัชนี/);
    expect(checkedGsaving({ ...PAGE, rate: 2.5 })).toMatch(/ดัชนี/);
    // from 71 the sum must reach 200,000
    expect(checkedGsaving({ ...PAGE, age: 72, premium: 100_000 })).toMatch(/200,000/);
    expect(checkedGsaving(PAGE)).toEqual(PAGE);
  });

  it("takes a budget as the yearly premium, twelve months of it when monthly", () => {
    const yearly = resolveBudget(PAGE, { baht: 60_000, per: "year" });
    expect(typeof yearly !== "string" && yearly.product === "GSAVING" && yearly.premium).toBe(60_000);
    const monthly = resolveBudget(PAGE, { baht: 5_000, per: "month" });
    if (typeof monthly === "string") throw new Error(monthly);
    expect(monthly.product === "GSAVING" && monthly.premium).toBe(60_000);
    expect(monthly.product === "GSAVING" && monthly.rate).toBe(3);
    expect(resolveBudget(PAGE, { baht: 1_000, per: "month" })).toMatch(/ยังไม่พอ/);
  });

  it("opens the Studio form from the /global-saving shortcut", () => {
    const href = videoStartHref({ product: "GSAVING", age: 35, premium: 50_000 });
    const q = Object.fromEntries(new URL(href, "https://x").searchParams);
    expect(videoStartFrom(q)).toEqual({ product: "GSAVING", age: 35, premium: 50_000 });
    // a premium is read only for this plan
    expect(videoStartFrom({ product: "PLB", premium: "50000" })).toEqual({ product: "PLB" });
  });

  it("sets −1%, +3% and +5% side by side in the classic clip's table, whatever index was picked (ก ก)", () => {
    for (const rate of [-1, 3, 5]) {
      const g = gsavingVideoFacts({ ...PAGE, rate })!.gsaving!;
      expect(g.rows).toHaveLength(15);
      expect(g.totals.map(Math.round)).toEqual([407_916, 585_666, 747_726]);
      // the bonus only in the years it is paid, one figure a return
      expect(g.rows.filter((r) => r.bonus).map((r) => [r.year, r.bonus!.map(Math.round)])).toEqual([[10, [0, 37_143, 67_921]], [15, [0, 140_608, 271_890]]]);
      expect(g.rows[7].premium).toBe(50_000);
      expect(g.rows[8].premium).toBe(0);
      expect(Math.round(g.rows[14].payback)).toBe(400_909);
    }
    expect(GS_VIDEO_COLUMNS.reduce((w, c) => w + c.width, 0)).toBe(TABLE.w);
  });

  it("walks the table down to everything received when the voice says ครบ", () => {
    const f = quoteVideoFacts(PAGE)!;
    const cover = quoteVideoScript(f, "").find((l) => l.key === "cover")!;
    const { height } = gsTableImage(f);
    const { plan, notes } = gsTablePlan(f, cover.voice, 12, TABLE);
    expect(notes).toEqual([]);
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0].to).toBe(height - TABLE.h);
    expect(plan.moves[0].at).toBeGreaterThan(1);
    expect(plan.moves[0].at).toBeLessThan(12);
  });

  it("tells the longer clips with Global Savings' facts only", () => {
    const f = quoteVideoFacts(PAGE)!;
    const max = quoteVideoScript(f, "", "F", "max");
    expect(max.map((l) => l.key)).toEqual(["lead", "story", "price", "cover", "index", "versus", "qa", "steps", "contact"]);
    expect(extraVoice("versus", f, {})).toBe("ออม 8 ปี รวม 400,000 บาท แผนนี้รับคืนการันตี 407,916 บาท ระหว่างนั้นยังคุ้มครองชีวิต และมีโอกาสได้โบนัสตามดัชนีโลกอีกค่ะ");
    expect(extraOf(f, {}).versus.note).toContain("ไม่การันตี");
    for (const q of productQas("GSAVING")) expect(`${q.q} ${q.a}`).not.toMatch(NEVER);
    // every fixed line for a brief passes the same checks a written one must
    for (const g of [f, quoteVideoFacts({ ...PAGE, rate: -1, age: 60, sex: "F" })!, quoteVideoFacts({ ...PAGE, premium: 1_000_000 })!]) {
      for (const s of storiesFor(g)) {
        for (const hook of WRITTEN_HOOKS) {
          const w = fallbackLines(g, { hook, story: s.key });
          expect(writtenProblems(w, g, { loop: false, story: true })).toEqual({});
          expect(writtenProblems(w, g, { loop: true, story: true })).toEqual({});
        }
      }
    }
    // a written line may not promise the bonus, nor say a figure the quote does not
    expect(lineProblem("โบนัสได้แน่นอน", f, 150)).toMatch(/โบนัส/);
    expect(lineProblem("มีโบนัสตามดัชนีโลก แต่โบนัสไม่แน่นอน", f, 150)).toBeNull();
    expect(lineProblem("รับคืนรวม 500,000 บาท", f, 150)).toMatch(/500,000/);
    expect(lineProblem("ออมวันละ 137 บาท แค่ 8 ปี รับคืนรวม 407,916 บาท", f, 150)).toBeNull();
  });
});
