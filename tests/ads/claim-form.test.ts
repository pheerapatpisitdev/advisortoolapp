import { describe, expect, it } from "vitest";
import { claimPutForm, claimReady, paperOrder, type ClaimPut } from "@/lib/ads/claim-form";
import type { ClaimFacts } from "@/lib/content/claim";

describe("when the รีวิวเคลม press opens", () => {
  it("wants 1–6 photos, the consent tick and a done read", () => {
    expect(claimReady({ files: 0, consent: true, read: true })).toBe(false);
    expect(claimReady({ files: 7, consent: true, read: true })).toBe(false);
    expect(claimReady({ files: 2, consent: false, read: true })).toBe(false);
    expect(claimReady({ files: 2, consent: true, read: false })).toBe(false);
    for (const files of [1, 2, 3, 4, 5, 6]) expect(claimReady({ files, consent: true, read: true })).toBe(true);
  });
});

describe("which papers go on the ad", () => {
  it("puts the approval letters first, the rest in the order given, at most three", () => {
    expect(paperOrder(["bill", "approval", "chat", "approval"])).toEqual([1, 3, 0]);
    expect(paperOrder(["bill", "chat"])).toEqual([0, 1]);
    expect(paperOrder([])).toEqual([]);
  });
});

const facts: ClaimFacts = {
  kind: "ipd", illness: "ไข้เลือดออก", nights: "3", billTotal: "45,000", paid: "45,000", selfPaid: "0", daysToApprove: "", who: "ผู้หญิง วัย 40+", note: "",
};
const blob = (s: string) => new Blob([s], { type: "image/jpeg" });
const base: ClaimPut = {
  campaign: "c-1", facts, count: 2, angle: "amount", custom: "", reader: "คุณแม่",
  table: false, papers: [{ blob: blob("a"), ratio: 0.75 }, { blob: blob("b"), ratio: 1.4 }],
};
/** the form's text fields, in order; the papers as their names */
const fields = (f: FormData) => [...f.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "<file>"]);

describe("the รีวิวเคลม PUT", () => {
  it("without the table: no table, age, sex or row", () => {
    const f = claimPutForm({ ...base, age: 40, sex: "M", rung: 2 });
    expect(fields(f)).toEqual([
      ["consent", "on"], ["campaign", "c-1"], ["facts", JSON.stringify(facts)], ["count", "2"],
      ["angle", "amount"], ["custom", ""], ["reader", "คุณแม่"],
      ["paper", "<file>"], ["ratio", "0.75"], ["paper", "<file>"], ["ratio", "1.4"],
    ]);
    expect(f.has("table")).toBe(false);
  });

  it("with the table: table=on and the age, sex and row", () => {
    const f = claimPutForm({ ...base, table: true, age: 40, sex: "M", rung: 2 });
    expect(f.get("consent")).toBe("on");
    expect(f.get("campaign")).toBe("c-1");
    expect(f.get("table")).toBe("on");
    expect(f.get("age")).toBe("40");
    expect(f.get("sex")).toBe("M");
    expect(f.get("rung")).toBe("2");
  });

  it("with the table and no row picked: the row is left out for the middle one", () => {
    const f = claimPutForm({ ...base, table: true, age: 30, sex: "F" });
    expect(f.get("table")).toBe("on");
    expect(f.get("sex")).toBe("F");
    expect(f.has("rung")).toBe(false);
  });

  it("sends three papers at most", () => {
    const four = [1, 2, 3, 4].map((i) => ({ blob: blob(String(i)), ratio: 1 }));
    const f = claimPutForm({ ...base, papers: four });
    expect(f.getAll("paper")).toHaveLength(3);
    expect(f.getAll("ratio")).toHaveLength(3);
  });
});
