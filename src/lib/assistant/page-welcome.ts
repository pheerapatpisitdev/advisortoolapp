import type { Product } from "./choose";

/**
 * A Page that sells one plan, and how it greets a customer who opens with nothing.
 *
 * LuckyPlanner advertises Life Protect and nothing else (owner, 2026-10-04), so a customer who
 * writes "สวัสดี" there is not asked to choose between three plans the Page is not selling:
 * they are shown the agent and the plan, and asked the one thing a premium needs. After that
 * the Page's plan stands in for an advertisement that named none — the weakest signal, so a
 * customer who names another plan or asks about another subject is still answered about it.
 */
export interface PageWelcome {
  product: Product;
  /** paths on this site, sent in order before the words */
  pictures: string[];
  text: string;
}

const WELCOMES: Record<string, PageWelcome> = {
  "105982528649026": { // LuckyPlanner โชคดีที่มีแพลน
    product: "lifeprotect",
    pictures: [
      // the agent's licence card. Names and licence numbers were taken out of the bot's words
      // on 2026-09-23; the owner put this one back on purpose, on this Page only (2026-10-04)
      "/welcome/luckyplanner/agent.jpg",
      // the Page's own Life Protect advertisement
      "/welcome/luckyplanner/lifeprotect.jpg",
    ],
    text: "สวัสดีครับ 🙏 Life Protect — ประกันชีวิต เบี้ยไม่ทิ้ง ขายคืนได้\n"
      + "ขอทราบเพศกับอายุหน่อยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น ช 35)",
  },
};

export function welcomeOf(pageId?: string): PageWelcome | undefined {
  return pageId ? WELCOMES[pageId] : undefined;
}
