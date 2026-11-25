import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/hospitals/regions";
import { byType, inProvince, listText, matches, provincesOf, regionCount, type Place } from "@/lib/hospitals/rules";

/** โรงพยาบาลในเครือ: the 7 regions, the filters, the search and the copied list (mockup 2pdzVimrFm1xLhR5uSNfv5) */

const place = (over: Partial<Place>): Place => ({
  id: "x", th: "โรงพยาบาลทดสอบ", en: "Test Hospital", district: "ปทุมวัน", province: "กรุงเทพมหานคร", clinic: false, care: ["ipd", "opd"], phone: "0 2000 0000", dept: null, ...over,
});
const dept = { insurance: ["0 2111 1111", "0 2111 1112"], room: [], appointment: ["1719"], reception: [], source: "www.x.com (24 พ.ย. 2569)" };

const LIST = [
  place({ id: "a", th: "โรงพยาบาลกรุงเทพ", en: "Bangkok Hospital", dept }),
  place({ id: "b", th: "คลินิกสุขใจ", en: "Sukjai Clinic", clinic: true, phone: "" }),
  place({ id: "c", th: "โรงพยาบาลเกษมราษฎร์ บางแค", en: "Kasemrad Bangkae", district: "บางแค" }),
  place({ id: "d", th: "โรงพยาบาลเชียงใหม่ ราม", en: "Chiangmai Ram", district: "เมืองเชียงใหม่", province: "เชียงใหม่" }),
];

describe("the regions", () => {
  it("are seven, and hold each of the 77 provinces once", () => {
    expect(REGIONS.map((r) => r.name)).toEqual(["กรุงเทพฯ และปริมณฑล", "ภาคกลาง", "ภาคเหนือ", "ภาคอีสาน", "ภาคตะวันออก", "ภาคตะวันตก", "ภาคใต้"]);
    const all = REGIONS.flatMap((r) => r.provinces);
    expect(all).toHaveLength(77);
    expect(new Set(all).size).toBe(77);
  });
});

describe("the filters", () => {
  it("shows all, hospitals, clinics, or those with a department's number", () => {
    const ids = (t: Parameters<typeof byType>[1]) => byType(LIST, t).map((p) => p.id);
    expect(ids("all")).toEqual(["a", "b", "c", "d"]);
    expect(ids("hospital")).toEqual(["a", "c", "d"]);
    expect(ids("clinic")).toEqual(["b"]);
    expect(ids("dept")).toEqual(["a"]);
  });
  it("counts a region, and lists its provinces with any place, most first", () => {
    expect(regionCount(LIST, REGIONS[0])).toBe(3);
    expect(regionCount(LIST, REGIONS[2])).toBe(1);
    expect(provincesOf(LIST, REGIONS[0])).toEqual([{ province: "กรุงเทพมหานคร", count: 3 }]);
    expect(provincesOf(LIST, REGIONS[6])).toEqual([]);
    expect(inProvince(LIST, "เชียงใหม่").map((p) => p.id)).toEqual(["d"]);
  });
});

describe("the search", () => {
  const found = (q: string) => LIST.filter((p) => matches(p, q)).map((p) => p.id);
  it("finds by Thai name, English name, district and province", () => {
    expect(found("สุขใจ")).toEqual(["b"]);
    expect(found("bangkok")).toEqual(["a"]);
    expect(found("บางแค")).toEqual(["c"]);
    expect(found("เชียงใหม่")).toEqual(["d"]);
  });
  it("takes รพ. and โรงพยาบาล as nothing, spaces or not, and ฏ as ฎ", () => {
    expect(found("รพ.เกษมราษฎร์บางแค")).toEqual(["c"]);
    expect(found("โรงพยาบาล เกษมราษฏร์")).toEqual(["c"]);
    expect(found("Bangkok Hospital")).toEqual(["a"]);
  });
  it("needs every word typed", () => {
    expect(found("ราม เชียงใหม่")).toEqual(["d"]);
    expect(found("ราม บางแค")).toEqual([]);
  });
  it("is nothing typed when only รพ. is", () => expect(found("รพ.")).toEqual(["a", "b", "c", "d"]));
});

describe("the copied list", () => {
  it("is one line a place: its name, central number, and the insurance department's", () => {
    expect(listText("กรุงเทพมหานคร", LIST.slice(0, 3))).toBe([
      "โรงพยาบาลในเครือ กรุงเทพมหานคร",
      "• โรงพยาบาลกรุงเทพ โทร 0 2000 0000 ประกัน 0 2111 1111 / 0 2111 1112",
      "• คลินิกสุขใจ",
      "• โรงพยาบาลเกษมราษฎร์ บางแค โทร 0 2000 0000",
    ].join("\n"));
  });
});
