import type { Phones } from "./phones";
import type { Region } from "./regions";

/**
 * What โรงพยาบาลในเครือ shows and how it is narrowed: by part of the country, by province, by kind, by what
 * is typed (owner chose ก ×5, 2026-11-25, mockup https://claude.ai/artifact/2pdzVimrFm1xLhR5uSNfv5).
 * Browser-safe: the list itself is ./places.ts, read on the server.
 */

export type Care = "ipd" | "opd" | "dental" | "health-check";
export const CARE_LABEL: Record<Care, string> = { ipd: "ผู้ป่วยใน", opd: "ผู้ป่วยนอก", dental: "ทันตกรรม", "health-check": "ตรวจสุขภาพ" };

/** `source`: whose word the numbers are, and the day, as the page prints it */
export interface Dept extends Phones { source: string }

export interface Place {
  id: string;
  th: string;
  en: string;
  district: string;
  province: string;
  clinic: boolean;
  care: Care[];
  /** the central number on the insurer's list, "" when it has none */
  phone: string;
  dept: Dept | null;
}

export const TYPES = [
  { key: "all", label: "ทั้งหมด" },
  { key: "hospital", label: "โรงพยาบาล" },
  { key: "clinic", label: "คลินิก" },
  { key: "dept", label: "มีเบอร์แผนก" },
] as const;
export type TypeKey = (typeof TYPES)[number]["key"];

const IS: Record<TypeKey, (p: Place) => boolean> = {
  all: () => true,
  hospital: (p) => !p.clinic,
  clinic: (p) => p.clinic,
  dept: (p) => p.dept !== null,
};

export const byType = (list: Place[], type: TypeKey) => list.filter(IS[type]);
export const inProvince = (list: Place[], province: string) => list.filter((p) => p.province === province);
export const regionCount = (list: Place[], region: Region) => list.filter((p) => region.provinces.includes(p.province)).length;

/** a region's provinces that have a place, the most first */
export function provincesOf(list: Place[], region: Region): { province: string; count: number }[] {
  return region.provinces
    .map((province) => ({ province, count: inProvince(list, province).length }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, "th"));
}

/** as typed and as listed, made alike: no spaces or dots, ฏ as ฎ, without the words every name carries */
const squash = (text: string) => text.toLowerCase().replace(/ฏ/g, "ฎ").replace(/โรงพยาบาล|รพ\.?(?=[\s฀-๿]|$)|\bhospitals?\b/g, " ").replace(/[^a-z0-9฀-๿]/g, "");

const words = (q: string) => q.split(/\s+/).map(squash).filter(Boolean);
export const isSearch = (q: string) => words(q).length > 0;

/** every word typed is somewhere in the place's Thai name, English name, district or province */
export function matches(place: Pick<Place, "th" | "en" | "district" | "province">, q: string): boolean {
  const hay = [place.th, place.en, place.district, place.province].map(squash).join(" ");
  return words(q).every((w) => hay.includes(w));
}

/** a province's list as it is sent to a customer on LINE */
export function listText(province: string, list: Place[]): string {
  return [
    `โรงพยาบาลในเครือ ${province}`,
    ...list.map((p) => `• ${p.th}${p.phone ? ` โทร ${p.phone}` : ""}${p.dept?.insurance.length ? ` ประกัน ${p.dept.insurance.join(" / ")}` : ""}`),
  ].join("\n");
}
