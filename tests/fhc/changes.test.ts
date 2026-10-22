import { describe, expect, it } from "vitest";
import { formChanges, gapChanges } from "@/app/fhc/changes";
import { cleanFhc, type FhcInput } from "@/lib/fhc/health";
import type { Gap } from "@/lib/fhc/gaps";

const base = cleanFhc({ age: 38, sex: "M", income: 85_000, expense: 40_000, people: [{ relation: "child", age: 6 }] }) as FhcInput;

describe("formChanges", () => {
  it("is empty when nothing was edited", () => {
    expect(formChanges(base, { ...base, people: [...base.people] })).toEqual([]);
  });

  it("names each edited field in the form's words, money in baht", () => {
    expect(formChanges(base, { ...base, income: 58_000, sex: "F" })).toEqual([
      { label: "เพศ", from: "ชาย", to: "หญิง" },
      { label: "รายได้ต่อเดือน", from: "85,000", to: "58,000" },
    ]);
  });

  it("says ไม่มี for a field cleared to zero", () => {
    expect(formChanges({ ...base, carLoan: 300_000 }, base)).toEqual([{ label: "สินเชื่อรถ", from: "300,000", to: "ไม่มี" }]);
  });

  it("catches a dependant's age moved at the same head count", () => {
    const c = formChanges(base, { ...base, people: [{ relation: "child", age: 7 }] });
    expect(c).toEqual([{ label: "คนในความดูแล", from: "1 คน", to: "1 คน (แก้อายุหรือความสัมพันธ์)" }]);
  });
});

describe("gapChanges", () => {
  const g = (key: Gap["key"], state: Gap["state"]): Gap => ({ key, state, unit: "sum", have: 0, should: 1 });

  it("lists only the covers whose state moved", () => {
    expect(gapChanges([g("life", "short"), g("health", "missing")], [g("life", "missing"), g("health", "missing")]))
      .toEqual([{ label: "ประกันชีวิต", from: "ไม่พอ", to: "ขาด" }]);
  });
});
