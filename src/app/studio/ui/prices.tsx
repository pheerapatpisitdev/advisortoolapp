"use client";
import { createContext, useContext } from "react";
import { PAINTERS } from "@/lib/content/models";
import { DEFAULT_PRICES, pictureSatang, priceBaht, type Prices } from "@/lib/wallet/prices";

/**
 * The owner's price list (/admin/wallet), handed down once from Studio's layout so every picker
 * says what a picture costs the agent rather than what it costs the providers (owner,
 * 2026-10-12: they used to read "มาตรฐาน · ฿0.43", which is not what anyone pays).
 */
const PricesContext = createContext<Prices>(DEFAULT_PRICES);

export function PricesProvider({ prices, children }: { prices: Prices; children: React.ReactNode }) {
  return <PricesContext.Provider value={prices}>{children}</PricesContext.Provider>;
}

export const usePrices = (): Prices => useContext(PricesContext);

/** "฿1": a painter's picture price, or null for one that draws nothing */
export function paintPrice(prices: Prices, painterId: string): string | null {
  const satang = pictureSatang(prices, painterId);
  return satang === null ? null : `฿${priceBaht(satang)}`;
}

/** the painter picker's options, each with its price a picture */
export function PainterOptions() {
  const prices = usePrices();
  return (
    <>
      {PAINTERS.map((p) => {
        const price = paintPrice(prices, p.id);
        return <option key={p.id} value={p.id}>{p.label}{price ? ` · ${price} ต่อภาพ` : ""}</option>;
      })}
    </>
  );
}
