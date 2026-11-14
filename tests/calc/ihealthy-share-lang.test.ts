import { describe, expect, it } from "vitest";
import { iHealthyQuoteText, type IHealthyCtaFacts } from "@/lib/ihealthy-cta";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { cardPath } from "@/lib/ihealthy-link";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { LANGS } from "@/lib/ihealthy-lang";
import { WORDS } from "@/lib/ihealthy-words";

/**
 * The saved card and the copied quote follow the language the page is read in.
 *
 * They used to be Thai whatever the switch said, so a Chinese reader who pressed "copy" or
 * "card" was handed the one thing on the page they could not read.
 */
const THAI = /[฀-๿]/;
const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);
const OPENING = "age=35&sex=F&base=WLF99H&sa=150000&plan=GOLD&area=&cover=&mode=annual";

const facts: IHealthyCtaFacts = {
  arrangement: {
    planName: "Gold", annualMax: 25_000_000, territory: "ประเทศไทย",
    coverage: "Co-Payment", deductible: 50_000,
  },
  copayPercent: 20,
  age: 35,
  sex: "F",
  baseLabel: "Life Protect+ x 2",
  sumAssured: 150_000,
  death: { beforeAge: 60, sumBefore: 300_000, sumFrom: 150_000, alreadyPastAge: false },
  mode: "monthly",
  minMonthly: 1_000,
  shown: {
    base: 213_000, rider: 4_380_000, total: 413_300, belowMinimum: false,
    others: [{ mode: "annual", total: 4_593_000 }],
    refused: ["semi"],
    standard: { label: "ค่าชดเชยรายวัน 1,000 บาท", total: 130_000 },
  },
  standardLabel: "Daily hospital cash 1,000 baht",
  benefits: { room: "9,000 per day", opd: "12,000" },
};

describe("the copied quote", () => {
  it("is in English on the English page, with not one Thai letter left", () => {
    const text = iHealthyQuoteText(facts, WORDS.en)!;
    expect(text).not.toMatch(THAI);
    expect(text).toContain("- Room and board 9,000 per day");
    expect(text).toContain("- Medical expenses 25,000,000 baht/year");
    expect(text).toContain("- OPD 12,000 baht/year (shared with physiotherapy)");
    expect(text).toContain("Monthly 4,133 baht");
    expect(text).toContain("- Daily hospital cash 1,000 baht");
    expect(text).toContain(WORDS.en.translationNote);
  });

  it("is Thai-free in every reading, with the same figures", () => {
    for (const lang of LANGS.filter((l) => l !== "th")) {
      const text = iHealthyQuoteText(facts, WORDS[lang])!;
      expect(text, lang).not.toMatch(THAI);
      expect(text, lang).toContain("4,133");
      expect(text, lang).toContain("45,930");
    }
  });

  it("is the Thai it always was when no language is named", () => {
    const { standardLabel: _, ...bot } = facts;
    expect(iHealthyQuoteText(bot)).toBe(iHealthyQuoteText(bot, WORDS.th));
    expect(iHealthyQuoteText(bot)).toContain("วงเงินค่ารักษา 25,000,000 บาทต่อปี");
  });
});

describe("the card picture", () => {
  it("carries the page's language in its address, and Thai carries nothing", () => {
    expect(cardPath(table, IHEALTHY_OPENING, "zh")).toMatch(/&l=zh$/);
    expect(cardPath(table, IHEALTHY_OPENING)).not.toContain("l=");
  });

  it("is drawn in that language", () => {
    for (const lang of LANGS.filter((l) => l !== "th")) {
      const card = iHealthyCard(new URLSearchParams(`${OPENING}&l=${lang}`), WHILE_CURRENT);
      expect(card.lang).toBe(lang);
      const words = JSON.stringify(card);
      expect(words, lang).not.toMatch(THAI);
    }
  });

  it("reads anything it does not know as Thai", () => {
    expect(iHealthyCard(new URLSearchParams(`${OPENING}&l=xx`), WHILE_CURRENT).lang).toBe("th");
  });
});
