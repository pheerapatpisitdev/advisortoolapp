import { figure, type Lang } from "@/lib/ihealthy-lang";

/**
 * The room a customer can really stay in under each plan, per day: a line under หมวด 1 of the
 * benefit table (owner, 2026-11-18, mockup https://claude.ai/artifact/2RnfYaWGrhtjeWJJy3Lq89,
 * answers ก ก ข ก).
 *
 * The contract writes one figure a day for the room, food and hospital service (1,500 for
 * สมาร์ท). The rooms a hospital actually lets on that plan run higher, and agents sell on that
 * range. The ranges are the owner's, from the sales sheet the owner sent; they are not in the
 * company's benefit sheet, which is why they live here and not in data/riders.
 *
 * Shown on the page table, the 4-plan compare page, both whole-table pictures and the PDFs.
 * Left out of the copied text and the bot (owner's ข). An agent can switch the line off on
 * the page; the picture and the PDF follow through `room=0` in their address.
 */
export const REAL_ROOM: Record<string, readonly [number, number]> = {
  SMART: [1_500, 2_500],
  BRONZE: [3_000, 4_000],
  SILVER: [5_500, 7_000],
  GOLD: [9_000, 11_000],
  DIAMOND: [15_000, 18_000],
  PLATINUM: [21_000, 30_000],
};

/** The address key a picture or PDF reads: `room=0` leaves the line out; on is the default. */
export const ROOM_KEY = "room";

/** Off only where the address says so: a link without the key is the default, which is on. */
export function roomShown(value: string | string[] | null | undefined): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  return v !== "0";
}

/** What one plan's cell says, "1,500 – 2,500", or a dash for a plan with no range. */
export function realRoomText(code: string, lang: Lang = "th"): string {
  const range = REAL_ROOM[code];
  return range ? `${figure(range[0], lang)} – ${figure(range[1], lang)}` : "-";
}

export interface RealRoomWords {
  /** the row's name on the wide table and the pictures */
  label: string;
  /** under the name: what the range is made of */
  note: string;
  /** the row's name on a phone, beside the bed of row 1 */
  phone: string;
  /** the switch beside the table */
  toggle: string;
}

export const REAL_ROOM_WORDS: Record<Lang, RealRoomWords> = {
  th: {
    label: "1.1 ค่าห้องที่เข้าพักได้จริง ต่อวัน",
    note: "ห้อง + อาหาร + ค่าบริการ รพ. โดยประมาณ",
    phone: "ห้องที่เข้าพักได้จริง",
    toggle: "แสดงค่าห้องที่เข้าพักได้จริง",
  },
  en: {
    label: "1.1 Room you can actually stay in, per day",
    note: "Room, meals and hospital service, approx.",
    phone: "Real room rate",
    toggle: "Show real room rates",
  },
  zh: {
    label: "1.1 实际可入住房价（每日）",
    note: "房费、餐费及医院服务费，约数",
    phone: "实际房价",
    toggle: "显示实际房价",
  },
  ru: {
    label: "1.1 Реальная палата, в день",
    note: "Палата, питание и услуги больницы, примерно",
    phone: "Реальная палата",
    toggle: "Показать реальную стоимость палаты",
  },
  my: {
    label: "1.1 တကယ်နေနိုင်သော အခန်းခ (တစ်ရက်)",
    note: "အခန်း၊ အစားအသောက်နှင့် ဆေးရုံဝန်ဆောင်ခ ခန့်မှန်း",
    phone: "တကယ့်အခန်းခ",
    toggle: "တကယ့်အခန်းခ ပြရန်",
  },
  fr: {
    label: "1.1 Chambre réellement accessible, par jour",
    note: "Chambre, repas et services de l’hôpital, environ",
    phone: "Chambre réelle",
    toggle: "Afficher le prix réel des chambres",
  },
  de: {
    label: "1.1 Tatsächlich mögliches Zimmer, pro Tag",
    note: "Zimmer, Verpflegung und Klinikleistungen, ca.",
    phone: "Tatsächliches Zimmer",
    toggle: "Tatsächliche Zimmerpreise zeigen",
  },
};
