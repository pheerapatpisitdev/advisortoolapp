import { describe, expect, it, vi } from "vitest";

/**
 * What the assistant says about ประกันภัยกลุ่ม, which is: that it exists, and here is the
 * page and a person.
 *
 * It briefly said more. The knowledge held the risk classes, the six plans and the cover
 * across all of them, and the owner took that back out — group cover is sold to a company
 * across a meeting-room table, and they want a person in that conversation rather than a chat
 * window. So these tests changed shape with it, and what they now press is the opposite of
 * what they pressed before: not that the facts are right, but that the facts are absent.
 *
 * The routing guard did not change, and neither did its tests. Without it a company asking
 * about thirty staff is read as the individual health plan — "ประกันสุขภาพ" is inside
 * "ประกันสุขภาพกลุ่ม" — and quoted one person's premium. That fault is what this file was
 * opened for and it is still the first thing here.
 */

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

const { assembleKnowledge } = await import("@/lib/copilot/knowledge");
const { aboutAGroup, productByTopic, productNamedIn } = await import("@/lib/assistant/choose");
const { handOverGroup } = await import("@/lib/assistant/common");
const { GI } = await import("@/lib/group-insurance/data");

describe("a question about a company's staff", () => {
  /**
   * The case this whole guard exists for.
   *
   * "ประกันสุขภาพ" is inside "ประกันสุขภาพกลุ่ม", so the individual health plan used to claim
   * it — and a company of thirty was asked its age and its sex and quoted one person's
   * premium. An answer that is wrong and looks right.
   */
  it("is not read as the individual plan whose name it contains", () => {
    expect(productNamedIn("ประกันสุขภาพกลุ่มมีไหม")).toBeUndefined();
    expect(productNamedIn("สนใจประกันชีวิตกลุ่มให้พนักงาน")).toBeUndefined();
    expect(productByTopic("ค่าห้องของประกันสุขภาพกลุ่มเท่าไหร่")).toBeUndefined();
  });

  it("is recognised however the customer happens to phrase it", () => {
    for (const said of [
      "ประกันกลุ่มมีไหม",
      "ประกันภัยกลุ่มคืออะไร",
      "อยากทำประกันอุบัติเหตุกลุ่ม",
      "บริษัทอยากทำให้พนักงานประจำ",
      "ทำประกันให้พนักงาน 30 คน",
      "มี group health ไหม",
      "ประกันแบบหมู่คณะ",
      "กลุ่มพนักงานฝ่ายผลิต",
    ]) {
      expect(aboutAGroup(said), said).toBe(true);
    }
  });

  /**
   * The other half of a guard, and the half that is easy to forget.
   *
   * "กลุ่ม" on its own is a word this business uses for กลุ่มโรค and กลุ่มอาการ, and a guard
   * that swallowed those would take an individual customer mid-quotation and hand them a
   * link to a product for companies.
   */
  it("does not swallow the individual customer who happens to say กลุ่ม", () => {
    for (const said of [
      "โรคร้ายแรงกลุ่มไหนบ้าง",
      "กลุ่มอาการนี้คุ้มครองไหม",
      "ประกันสุขภาพมีไหม",
      "ไลฟ์เทรเชอร์ทุน 1 ล้าน",
      "พนักงานออฟฟิศอายุ 35 ทำได้ไหม",
    ]) {
      expect(aboutAGroup(said), said).toBe(false);
    }
    // and the individual plans still answer to their own names
    expect(productNamedIn("ประกันสุขภาพมีไหม")).toBe("ihealthy");
    expect(productNamedIn("โรคร้ายแรงกลุ่มไหนบ้าง")).toBeUndefined();
  });
});

describe("the handover a company gets", () => {
  /**
   * Written out rather than asked of a model, and this is the test that records why: the
   * version that put the link in a prompt was watched on production writing a perfectly
   * sensible reply with the link left out.
   */
  it("always carries the page, on a bubble of its own so it is one tap", () => {
    const reply = handOverGroup();
    const links = reply.messages.filter((m) => m.text.includes("/group-insurance"));
    expect(links).toHaveLength(1);
    expect(links[0].text.trim()).toMatch(/^https?:\/\/\S+\/group-insurance$/);
  });

  it("says the product exists and hands the details to a person", () => {
    const text = handOverGroup().messages.map((m) => m.text).join("\n");
    expect(text).toContain("ประกันกลุ่ม");
    expect(text).toContain("แอดมิน");
  });

  /**
   * The owner's instruction, as an assertion: no plan, no cover, no head count, no risk
   * class, no premium. A handover that started describing the product would be the thing
   * that was removed, creeping back in through the words of the removal.
   */
  it("describes nothing about the product", () => {
    const text = handOverGroup().messages.map((m) => m.text).join("\n");
    for (const leak of ["แผน 1", "ลักษณะธุรกิจ 1", "10-100", "IPD", "OPD", "Group PA"]) {
      expect(text, leak).not.toContain(leak);
    }
    // no figure at all beyond the ones inside the link
    expect(text.replace(/https?:\/\/\S+/g, "")).not.toMatch(/\d{3}/);
  });
});

describe("what the knowledge says, which is as little as possible", () => {
  it("tells the brains the product exists, so neither denies one the agency sells", async () => {
    const text = await assembleKnowledge("HIC ซื้อคู่กับ MEB ได้ไหม");
    expect(text).toContain("## ประกันภัยกลุ่ม (Group Insurance)");
    expect(text).toContain("ห้ามอธิบายรายละเอียดของประกันกลุ่มทุกกรณี");
  });

  /**
   * The guarantee is the absence, not the instruction. A model cannot repeat a benefit table
   * it was never given, and an instruction is only ever a request.
   */
  it("holds no fact about the product that a brain could improvise from", async () => {
    const text = await assembleKnowledge("ประกันกลุ่มให้พนักงาน 30 คน สุขภาพกับอุบัติเหตุ ค่าห้อง opd me");

    // the benefit wording and the head-count bands are this product's alone, so finding one
    // anywhere in the prompt means the section came back
    for (const row of [...GI.healthBenefits, ...GI.paMainBenefits]) {
      expect(text, row.key).not.toContain(row.label);
    }
    for (const band of [...GI.healthEmployeeRanges, ...GI.paEmployeeRanges]) {
      expect(text, band).not.toContain(band);
    }
    /**
     * `paMeCoverLevels` is deliberately not checked. They are round money — 10,000, 20,000 —
     * and 10,000 is also a rider's minimum sum assured on the individual plans, which is
     * legitimately in this prompt. A figure that generic proves nothing either way.
     */
  });

  /**
   * And no premium, which was true when the section was long and has to stay true now.
   * Matched as whole figures — a plain `includes` finds "150" inside "150,000".
   */
  it("holds not one figure that only the rate tables have", async () => {
    const text = await assembleKnowledge("ประกันกลุ่มพนักงาน เบี้ยเท่าไหร่");

    const premiums = new Set<number>();
    for (const table of [GI.healthIpdPremiums, GI.paMainPremiums, GI.paMePremiums]) {
      for (const biz of Object.values(table)) for (const row of Object.values(biz)) for (const v of row) premiums.add(v);
    }
    for (const row of Object.values(GI.healthOpdPremiums)) for (const v of row) premiums.add(v);

    // six of the 238 are also cover amounts elsewhere in this system, and 3,000 is a policy
    // minimum; the assertion is on the 232 that can only have come from a rate table
    const cover = new Set<number>();
    for (const row of [...GI.healthBenefits, ...GI.paMainBenefits]) {
      for (const v of row.values) cover.add(Number(v.replace(/,/g, "")));
    }
    for (const v of GI.paMeCoverLevels) cover.add(Number(v.replace(/,/g, "")));
    cover.add(3000);

    const appears = (n: number) =>
      new RegExp(`(?<![\\d,])${n.toLocaleString("en-US")}(?![\\d,])`).test(text);
    const premiumOnly = [...premiums].filter((n) => !cover.has(n));
    expect(premiumOnly.length).toBeGreaterThan(200);
    const leaked = premiumOnly.filter(appears);
    expect(leaked, `เบี้ยหลุดเข้า prompt: ${leaked.slice(0, 5).join(", ")}`).toEqual([]);
  });

  /**
   * `## รายชื่อโรค` is the last heading of the document by design — `copilot-diseases` reads
   * every heading after it to see which illness lists a question opened, and this section
   * placed later was counted as four more of them.
   */
  it("sits after the individual plans and before the illness lists", async () => {
    const text = await assembleKnowledge("DCI คุ้มครองโรคอะไรบ้าง");
    const groupAt = text.indexOf("## ประกันภัยกลุ่ม (Group Insurance)");
    expect(groupAt).toBeGreaterThan(0);
    expect(text.lastIndexOf("### สัญญาเพิ่มเติมที่ซื้อกับแบบนี้ได้")).toBeLessThan(groupAt);
    expect(groupAt).toBeLessThan(text.indexOf("## รายชื่อโรค"));
  });

  it("costs every question the same few hundred characters, group question or not", async () => {
    /** the group block alone, from its heading to whatever heading follows it */
    const block = (text: string) => {
      const at = text.indexOf("## ประกันภัยกลุ่ม (Group Insurance)");
      const next = text.indexOf("\n## ", at + 1);
      return text.slice(at, next < 0 ? undefined : next).trim();
    };
    const [unrelated, group] = await Promise.all([
      assembleKnowledge("HIC ซื้อคู่กับ MEB ได้ไหม"),
      assembleKnowledge("ประกันกลุ่มให้พนักงาน 30 คน คุ้มครองอะไรบ้าง"),
    ]);
    // a fixed block: a group question opens nothing extra, because there is nothing to open
    expect(block(group)).toBe(block(unrelated));
    expect(block(group).length).toBeLessThan(700);
  });
});
