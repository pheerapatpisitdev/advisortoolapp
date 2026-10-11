import { describe, expect, it } from "vitest";
import { priceWithRiders, type RiderQuoteInput } from "@/app/ihealthy-ultra/actions";
import { arrangementKey, attachedRiders, withinOffer } from "@/components/ihealthy/rider-request";

const ADULT: Omit<RiderQuoteInput, "riders"> = {
  base: "WLF99H", age: 35, sex: "F", sumAssured: 1_000_000, mode: "annual",
  plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
};
const PACKAGE: Omit<RiderQuoteInput, "riders"> = {
  base: "WLF99HX", age: 35, sex: "F", sumAssured: 50_000, mode: "annual",
  plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
};

const offered = (r: { available: { code: string; eligible: boolean }[] }) =>
  r.available.filter((a) => a.eligible).map((a) => a.code);

describe("priceWithRiders", () => {
  it("offers every rider the company sells with this base", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [] });
    // Thirteen with this base: the health cover is the page itself and HIC is never sold
    // beside it.
    const all = ["PB", "WP", "AP", "ECARE", "MEX", "MEB", "DCI", "PLS", "CPR", "RRSS", "CI123"];
    expect(r.available.map((a) => a.code)).toEqual(all);
    expect(offered(r)).toEqual(all);
  });

  it.each(["HIC"])("will not price %s, however it is asked for", async (code) => {
    const r = await priceWithRiders({ ...ADULT, riders: [{ code, sumAssured: 1_000 }] });
    expect(r.items.some((i) => i.code === code)).toBe(false);
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("offers the package only what the package sells", async () => {
    const r = await priceWithRiders({ ...PACKAGE, riders: [] });
    expect(r.available.map((a) => a.code)).toEqual(["AP", "MEX", "MEB", "DCI", "RRSS"]);
  });

  it("prices PB on the payer typed under it, not on the insured", async () => {
    const man = { ...ADULT, sex: "M" as const };
    const r = await priceWithRiders({ ...man, riders: [{ code: "PB", option: "FIT", payer: { age: 33, sex: "F" } }] });
    const pb = r.items.find((i) => i.code === "PB")!;
    expect(pb.eligible).toBe(true);
    expect(pb.modal).toBe(513_420);
    expect(r.available.find((a) => a.code === "PB")!.payer).toEqual({ relation: "spouse", ageMin: 20, ageMax: 70 });
  });

  it("names a child's payer a parent", async () => {
    const r = await priceWithRiders({ ...ADULT, age: 8, sex: "M", plan: "BRONZE",
      riders: [{ code: "PB", option: "FIT", payer: { age: 38, sex: "M" } }] });
    expect(r.available.find((a) => a.code === "PB")!.payer?.relation).toBe("parent");
    expect(r.items.find((i) => i.code === "PB")!.modal).toBe(30_704);
  });

  it("asks for the payer's age rather than guessing one", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [{ code: "PB", option: "FIT" }] });
    const pb = r.items.find((i) => i.code === "PB")!;
    expect(pb.eligible).toBe(false);
    expect(pb.message).toBe("กรอกอายุผู้ชำระเบี้ย");
    expect(r.extraCodes).not.toContain("PB");
  });

  it("refuses a payer outside the ages the company writes", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [{ code: "PB", option: "FIT", payer: { age: 72, sex: "F" } }] });
    expect(r.items.find((i) => i.code === "PB")!.message).toBe("อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์");
  });

  it("prices CI 123 as one line, its endorsements included", async () => {
    const r = await priceWithRiders({ ...ADULT, riders: [{ code: "CI123", sumAssured: 500_000 }] });
    expect(r.extraCodes).toEqual(["CI123"]);
    expect(r.items.filter((i) => i.code.startsWith("CI123")).map((i) => i.code)).toEqual(["CI123"]);
    const annual = r.extras.find((e) => e.mode === "annual")!.total;
    expect(r.items.find((i) => i.code === "CI123")!.modal).toBe(annual);
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("greys the rider a child is too young for", async () => {
    const r = await priceWithRiders({ ...ADULT, age: 8, sex: "M", riders: [] });
    const greyed = r.available.filter((a) => !a.eligible);
    expect(greyed.map((a) => a.code)).toEqual(["WP", "ECARE", "DCI", "PLS"]);
    // greyed, not gone: the agent asked whether the rider can be added, and "20 - 65 ปี"
    // beside the reason is the answer
    for (const a of greyed) {
      expect(a.reason).toBeTruthy();
      expect(a.ageRange).toMatch(/\d+ - \d+ ปี/);
    }
    expect(offered(r)).toEqual(["PB", "AP", "MEX", "MEB", "CPR", "RRSS", "CI123"]);
  });

  it("keeps the package's riders at age 8, with the one he is too young for greyed", async () => {
    const r = await priceWithRiders({ ...PACKAGE, age: 8, sex: "M", riders: [] });
    expect(r.available.map((a) => a.code)).toEqual(["AP", "MEX", "MEB", "DCI", "RRSS"]);
    expect(offered(r)).toEqual(["AP", "MEX", "MEB", "RRSS"]);
  });

  it("prices an attached rider on top of the base and the health plan", async () => {
    const bare = await priceWithRiders({ ...ADULT, riders: [] });
    const withDci = await priceWithRiders({
      ...ADULT, riders: [{ code: "DCI", sumAssured: 500_000 }],
    });
    expect(withDci.totalModal).toBeGreaterThan(bare.totalModal);
    expect(withDci.items.find((i) => i.code === "DCI")!.eligible).toBe(true);
  });

  it("adds up to exactly the rows it is showing", async () => {
    const r = await priceWithRiders({
      ...ADULT, riders: [{ code: "MEB", plan: 500 }, { code: "DCI", sumAssured: 500_000 }],
    });
    expect(r.totalModal).toBe(r.items.reduce((sum, i) => sum + i.modal, 0));
  });

  it("says which of the two reasons left a ticked rider out", async () => {
    const byPackage = await priceWithRiders({ ...PACKAGE, riders: [{ code: "CI123", sumAssured: 500_000 }] });
    expect(byPackage.items.some((i) => i.code === "CI123")).toBe(false);
    expect(byPackage.warnings.some((w) => w.includes("ไม่ขายกับ package นี้"))).toBe(true);
    expect(byPackage.totalModal).toBe(byPackage.items.reduce((sum, i) => sum + i.modal, 0));

    const byAge = await priceWithRiders({
      ...PACKAGE, age: 8, sex: "M", riders: [{ code: "DCI", sumAssured: 200_000 }],
    });
    expect(byAge.items.some((i) => i.code === "DCI")).toBe(false);
    expect(byAge.warnings).toContain("สัญญาเพิ่มเติมโรคร้ายแรง (DCI) ไม่สามารถซื้อได้ จึงไม่ได้คิดเบี้ยให้");
  });

  it("prices DCI at the sum the package pins it to, whatever it is asked for", async () => {
    const pinned = await priceWithRiders({ ...PACKAGE, riders: [{ code: "DCI", sumAssured: 200_000 }] });
    const greedy = await priceWithRiders({ ...PACKAGE, riders: [{ code: "DCI", sumAssured: 5_000_000 }] });
    const choice = pinned.available.find((a) => a.code === "DCI")!;
    expect(choice.exactSumAssured).toBe(200_000);
    // the sentence the fold prints is the company's own, from the rules
    expect(choice.exactMessage).toBe("ต้องระบุทุน DCI 2 แสนบาทเท่านั้น");
    expect(greedy.items.find((i) => i.code === "DCI")!.eligible).toBe(true);
    expect(greedy.totalModal).toBe(pinned.totalModal);
  });

  it("passes the engine's own objection through to the fold", async () => {
    // Not reachable from the pickers, which only offer sums the base is written for, but the
    // wire is open to anything: the answer is the engine's warning, not a priced arrangement.
    const r = await priceWithRiders({ ...ADULT, sumAssured: 60_000, riders: [] });
    expect(r.warnings).toContain("จำนวนเงินเอาประกันภัยขั้นต่ำ 150,000 บาท");
    expect(r.totalModal).toBe(0);
  });

  it("quotes nothing for a request this page could not have made", async () => {
    // Everything here describes an arrangement rather than a rider: there is nothing to
    // price and nothing to salvage.
    const bad = [
      { ...ADULT, age: 500, riders: [] },
      { ...ADULT, base: "WLCI05", riders: [] },
      { ...ADULT, sumAssured: -1, riders: [] },
      { ...ADULT, riders: "AP" } as unknown as RiderQuoteInput,
      { ...ADULT, mode: "weekly" } as unknown as RiderQuoteInput,
    ];
    for (const input of bad) {
      const r = await priceWithRiders(input as RiderQuoteInput);
      expect(r).toEqual({
        available: [], items: [], totalModal: 0, extraCodes: [],
        extras: [
          { mode: "annual", total: 0 }, { mode: "semi", total: 0 }, { mode: "monthly", total: 0 },
        ],
        warnings: ["คำขอไม่ถูกต้อง"],
      });
    }
  });

  /**
   * The riders travel in the address now, so a mangled one is an ordinary thing to be handed:
   * a chat client that truncated the link, a figure past the engine's ceiling. Voiding the
   * whole quote for it left the fold with nothing on offer, a total of zero and no way back
   * without a reload.
   */
  it("drops a rider it cannot read rather than voiding the whole quote", async () => {
    const r = await priceWithRiders({
      ...ADULT,
      riders: [
        { code: "MEB", plan: 1_000 },
        { code: "AP", sumAssured: Number.MAX_VALUE },
        { code: "นี่ไม่ใช่รหัส", sumAssured: 1 },
      ],
    });
    expect(r.available.map((a) => a.code)).toContain("AP");
    expect(r.extraCodes).toEqual(["MEB"]);
    expect(r.totalModal).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes("อ่านไม่ออก"))).toBe(true);
  });
});

describe("arrangementKey", () => {
  it("changes when anything the engine would price on changes", () => {
    const changes: Partial<RiderQuoteInput>[] = [
      { base: "WLF99L" }, { age: 36 }, { sex: "M" }, { sumAssured: 2_000_000 },
      { mode: "monthly" }, { plan: "SILVER" }, { territory: "เอเชีย" }, { coverage: "Deductible" },
    ];
    for (const change of changes) {
      expect(arrangementKey({ ...ADULT, ...change })).not.toBe(arrangementKey(ADULT));
    }
  });

  it("is the same key for the same arrangement asked twice", () => {
    expect(arrangementKey({ ...ADULT })).toBe(arrangementKey(ADULT));
  });

  it("does not change when only the attached riders do", () => {
    // The answer stays on screen while another is priced, so a tick must not read as a
    // different arrangement; an age change must.
    const ticked: RiderQuoteInput = { ...ADULT, riders: [{ code: "AP", sumAssured: 100_000 }] };
    expect(arrangementKey(ticked)).toBe(arrangementKey(ADULT));
  });
});

describe("attachedRiders", () => {
  it("sends a rider's sum, plan and option as they were picked", () => {
    expect(attachedRiders({
      AP: { sumAssured: 750_000 },
      MEB: { plan: 500 },
      PLS: { option: "PLS10", sumAssured: 300_000 },
    })).toEqual([
      { code: "AP", sumAssured: 750_000 },
      { code: "MEB", plan: 500 },
      { code: "PLS", option: "PLS10", sumAssured: 300_000 },
    ]);
  });

  it("sends no sum at all for a field the agent has emptied", () => {
    const [ap] = attachedRiders({ AP: { sumAssured: "" } });
    expect(ap).toEqual({ code: "AP" });
    expect("sumAssured" in ap).toBe(false);
  });

  it("sends the payer once the age is typed, and not before", () => {
    expect(attachedRiders({ PB: { option: "FIT", payerSex: "F", payerAge: "" } }))
      .toEqual([{ code: "PB", option: "FIT" }]);
    expect(attachedRiders({ PB: { option: "FIT", payerSex: "F", payerAge: 33 } }))
      .toEqual([{ code: "PB", option: "FIT", payer: { age: 33, sex: "F" } }]);
  });

  it("sends nothing when nothing is ticked", () => {
    expect(attachedRiders({})).toEqual([]);
  });
});

describe("a tick the engine will not price", () => {
  /**
   * The company caps the daily cash at five hundred a day up to ten. A tick left over from an
   * older age is a rider that is on offer, at a plan that is not — neither of the two cases
   * the dropped-rider warning was written for, so it used to vanish out of the quote in
   * silence: no premium, no line on the card, and nothing said anywhere.
   */
  it("says so, rather than dropping it without a word", async () => {
    const r = await priceWithRiders({
      ...ADULT, age: 8, sex: "M", plan: "BRONZE", riders: [{ code: "MEB", plan: 1_000 }],
    });
    expect(r.extraCodes).toEqual([]);
    expect(r.extras.every((e) => e.total === 0)).toBe(true);
    expect(r.warnings.some((w) => w.includes("MEB"))).toBe(true);
  });

  it("prices the plan that age may have", async () => {
    const r = await priceWithRiders({
      ...ADULT, age: 8, sex: "M", plan: "BRONZE", riders: [{ code: "MEB", plan: 500 }],
    });
    expect(r.extraCodes).toEqual(["MEB"]);
    expect(r.warnings).toEqual([]);
  });
});

describe("what the family receives", () => {
  it("comes back with the quote, so a rider that pays on death can reach the card", async () => {
    const bare = await priceWithRiders({ ...ADULT, riders: [{ code: "MEB", plan: 1_000 }] });
    const withDci = await priceWithRiders({
      ...ADULT, riders: [{ code: "MEB", plan: 1_000 }, { code: "DCI", sumAssured: 1_000_000 }],
    });
    // ADULT is written for a million, which the base pays double of before 60
    expect(bare.deathBenefit?.sumBefore).toBe(2_000_000);
    expect(withDci.deathBenefit?.sumBefore).toBe(3_000_000);
  });
});

describe("withinOffer", () => {
  const meb = (plans: number[]) => [{
    code: "MEB", name: "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)", ageRange: "6 - 65 ปี",
    eligible: true, plans,
  }];

  /**
   * The company caps the daily cash by age — five hundred a day up to ten, a thousand up to
   * fifteen. A tick carried across an age change used to be sent at the old plan, refused by
   * the engine, and left out of the quote: the card dropped its line, the benefit table
   * printed a dash and the picture said nothing was attached.
   */
  it("walks a pick down to the most this age may have", () => {
    expect(withinOffer({ MEB: { plan: 5_000 } }, meb([500]))).toEqual({ MEB: { plan: 500 } });
    expect(withinOffer({ MEB: { plan: 5_000 } }, meb([500, 1_000]))).toEqual({ MEB: { plan: 1_000 } });
  });

  it("leaves a pick this age may have exactly where it is", () => {
    const chosen = { MEB: { plan: 5_000 } };
    expect(withinOffer(chosen, meb([500, 1_000, 2_000, 5_000]))).toBe(chosen);
  });

  it("takes the smallest on offer when every one of them is larger", () => {
    expect(withinOffer({ MEB: { plan: 100 } }, meb([500, 1_000]))).toEqual({ MEB: { plan: 500 } });
  });

  /**
   * The same object back when nothing moves, so this cannot re-trigger the quote it is called
   * from. When something does move, the next answer offers the plan now ticked, and the
   * second pass is one of these.
   */
  it("settles in a single pass", () => {
    const once = withinOffer({ MEB: { plan: 5_000 } }, meb([500]));
    expect(withinOffer(once, meb([500]))).toBe(once);
  });

  it("has nothing to say about a rider sold by sum assured", () => {
    const chosen = { DCI: { sumAssured: 500_000 } };
    expect(withinOffer(chosen, [{
      code: "DCI", name: "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)", ageRange: "20 - 65 ปี",
      eligible: true, saMin: 100_000,
    }])).toBe(chosen);
  });
});
