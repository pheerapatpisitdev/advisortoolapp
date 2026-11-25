import { describe, expect, it } from "vitest";
import network from "../../data/hospitals/ktaxa-network.json";
import departments from "../../data/hospitals/departments.json";
import { DEPARTMENTS, telOf } from "@/lib/hospitals/phones";
import { NETWORK_DAY, places } from "@/lib/hospitals/places";
import { REGIONS } from "@/lib/hospitals/regions";

/** The insurer's list as the page shows it, with the departments' numbers laid over it */

const none = new Map();
const all = places(none);
const by = (th: string, list = all) => list.find((p) => p.th === th)!;

describe("the places on the page", () => {
  it("are the insurer's list for personal health insurance, every one in a region", () => {
    expect(all).toHaveLength(network.hospitals.filter((h) => h.personalHealth).length);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    const provinces = new Set(REGIONS.flatMap((r) => r.provinces));
    for (const p of all) expect(provinces.has(p.province), `${p.th} ${p.province}`).toBe(true);
    expect(NETWORK_DAY).toBe(network.fetchedAt);
  });
  it("come hospitals first in a province, then clinics, each in Thai dictionary order", () => {
    const bkk = all.filter((p) => p.province === "กรุงเทพมหานคร");
    const firstClinic = bkk.findIndex((p) => p.clinic);
    expect(firstClinic).toBeGreaterThan(0);
    expect(bkk.slice(firstClinic).every((p) => p.clinic)).toBe(true);
    for (const part of [bkk.slice(0, firstClinic), bkk.slice(firstClinic)]) {
      const names = part.map((p) => p.th);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "th")));
    }
  });
  it("say what each treats in one order, ผู้ป่วยใน first", () => {
    expect(by("โรงพยาบาลวิภาวดี").care).toEqual(["ipd", "opd", "dental", "health-check"]);
  });
  it("keep hospital and clinic apart", () => {
    expect(all.some((p) => p.clinic)).toBe(true);
    expect(by("โรงพยาบาลกรุงเทพพัทยา").clinic).toBe(false);
  });
});

describe("the departments' numbers", () => {
  it("belong to hospitals on the list, each with a source and at least one number", () => {
    const ids = new Set(all.map((p) => p.id));
    const rows = Object.entries(departments.departments);
    expect(rows).toHaveLength(63);
    for (const [id, d] of rows) {
      expect(ids.has(id), id).toBe(true);
      expect(d.source, id).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
      expect(DEPARTMENTS.some((k) => d[k.key].length > 0), id).toBe(true);
      for (const k of DEPARTMENTS) for (const line of d[k.key]) expect(line, id).toMatch(/\d/);
    }
  });
  it("say where and when each was read", () => {
    expect(by("โรงพยาบาลวิภาวดี").dept).toEqual({
      insurance: ["Fax Claim 0 2561 1111 ต่อ 2232-3", "UR Nurse 0 2561 1111 ต่อ 4537"],
      room: ["0 2561 1111 ต่อ 4137, 4139"],
      appointment: [],
      reception: ["ลงทะเบียน 0 2561 1111 ต่อ 2105-7"],
      source: "www.vibhavadi.com (24 พ.ย. 2569)",
    });
    expect(all.filter((p) => p.dept)).toHaveLength(63);
    expect(telOf(by("โรงพยาบาลวิภาวดี").dept!.room[0])).toBe("025611111");
  });
  it("give way to the owner's, whole, where the owner has filled them in", () => {
    const id = by("โรงพยาบาลวิภาวดี").id;
    const other = all.find((p) => !p.dept)!.id;
    const mine = { insurance: ["0 2999 9999"], room: [], appointment: [], reception: [], day: "2026-11-25" };
    const list = places(new Map([[id, mine], [other, mine]]));
    const source = "กรอกโดยผู้ดูแล AdvisorTool (25 พ.ย. 2569)";
    for (const x of [id, other]) {
      expect(list.find((p) => p.id === x)!.dept).toEqual({ insurance: ["0 2999 9999"], room: [], appointment: [], reception: [], source });
    }
    expect(list.filter((p) => p.dept)).toHaveLength(64);
  });
});
