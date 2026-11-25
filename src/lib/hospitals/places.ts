import departments from "../../../data/hospitals/departments.json";
import network from "../../../data/hospitals/ktaxa-network.json";
import type { Phones } from "./phones";
import { CARE_LABEL, type Care, type Dept, type Place } from "./rules";

/**
 * Krungthai-AXA Life's list (scripts/fetch_ktaxa_hospitals.py) as โรงพยาบาลในเครือ shows it: the places that
 * take personal health insurance, with the departments' numbers laid over them. Server side: the two files
 * are 260 KB, and the page hands the browser only what it draws.
 *
 * The numbers have two sources. data/hospitals/departments.json was read off the hospitals' own websites; the
 * owner's own, typed in the back office (./store.ts), take the place of a hospital's whole row there — a
 * number the owner left out was left out on purpose.
 */

export interface OwnerPhones extends Phones { /** the Bangkok day they were saved, 2026-11-25 */ day: string }

/** the day the insurer's list was read */
export const NETWORK_DAY: string = network.fetchedAt;

export const thaiDay = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

const FOUND = departments.departments as Record<string, Phones & { th: string; source: string }>;

const only = (p: Phones): Phones => ({ insurance: p.insurance, room: p.room, appointment: p.appointment, reception: p.reception });

function deptOf(id: string, owner: ReadonlyMap<string, OwnerPhones>): Dept | null {
  const mine = owner.get(id);
  if (mine) return { ...only(mine), source: `กรอกโดยผู้ดูแล AdvisorTool (${thaiDay(mine.day)})` };
  const found = FOUND[id];
  return found ? { ...only(found), source: `${found.source} (${thaiDay(departments.checkedAt)})` } : null;
}

/** what the page lists, hospitals before clinics: the file's own order puts every ค before every โ */
const LISTED = network.hospitals.filter((h) => h.personalHealth)
  .sort((a, b) => Number(a.type === "clinic") - Number(b.type === "clinic") || a.th.localeCompare(b.th, "th"));

const CARES = Object.keys(CARE_LABEL) as Care[];

export function places(owner: ReadonlyMap<string, OwnerPhones>): Place[] {
  return LISTED.map((h) => ({
    id: h.id,
    th: h.th,
    en: h.en,
    district: h.district,
    province: h.province,
    clinic: h.type === "clinic",
    care: CARES.filter((c) => h.care.includes(c)),
    phone: h.phone,
    dept: deptOf(h.id, owner),
  }));
}

/** a line of the back office's list: `found` off the hospital's website, `mine` typed over it */
export interface AdminRow { id: string; th: string; en: string; district: string; province: string; phone: string; found: Phones | null; mine: OwnerPhones | null }

export function adminRows(owner: ReadonlyMap<string, OwnerPhones>): AdminRow[] {
  return LISTED.map((h) => ({
    id: h.id, th: h.th, en: h.en, district: h.district, province: h.province, phone: h.phone,
    found: FOUND[h.id] ? only(FOUND[h.id]) : null,
    mine: owner.get(h.id) ?? null,
  }));
}

const NAMES = new Map(LISTED.map((h) => [h.id, h.th]));

/** the name of a place the page lists, or undefined for an id it does not */
export const nameOnList = (id: string): string | undefined => NAMES.get(id);
