import type { LibraryItem, LibraryProduct, LibraryType } from "./catalog";

/**
 * คลังแอนิเมชัน's เลือกดู: the search and the three chip rows (spec 2026-11-14, "The page").
 * "any" is the chip ทั้งหมด / ทุกสินค้า; a product chip keeps only that product's pieces, as the
 * mockup does (the general ones sit under ทุกสินค้า).
 */
export type LibraryState = "ready" | "soon" | "all";
export interface LibraryFilter {
  q: string;
  type: LibraryType | "any";
  product: Exclude<LibraryProduct, "all"> | "any";
  state: LibraryState;
}

/** marks from other scripts a word may carry (é typed as e + ´), and the invisible characters a keyboard leaves */
const STRAY = /[̀-ͯ­​-‍⁠﻿]/g;

/**
 * Text as the search compares it: the compatibility forms folded (สระอำ typed as นิคหิต + สระอา), the
 * marks above and below a Thai letter put in one order (a tone mark typed before ุ), stray marks and
 * zero-width spaces gone, lower case. Thai tone marks stay: คาหอง is not ค่าห้อง.
 */
export function searchText(s: string): string {
  return s.normalize("NFKD").replace(STRAY, "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function filterLibrary(items: readonly LibraryItem[], f: LibraryFilter): LibraryItem[] {
  const words = searchText(f.q).split(" ").filter(Boolean);
  return items.filter((i) =>
    (f.type === "any" || i.type === f.type)
    && (f.product === "any" || i.product === f.product)
    && (f.state === "all" || (f.state === "ready") === i.ready)
    && (!words.length || words.every((w) => searchText(`${i.name} ${i.tells}`).includes(w))));
}
