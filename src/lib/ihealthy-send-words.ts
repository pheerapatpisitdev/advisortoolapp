import type { Lang } from "@/lib/ihealthy-lang";

/**
 * What the page says about the whole-table picture and the phone's PDF, in its five languages
 * (owner, 2026-10-25, mockup https://claude.ai/artifact/6Wk2LKxWA5hqojpF2LfnHt).
 *
 * Beside ihealthy-words.ts rather than in it: that file is part of the drawing code the clips'
 * Remotion image is built from, and these words are never in a clip.
 */
export interface SendWords {
  /** the picture of every category, after the plan's name (src/app/api/ihealthy-card/full) */
  fullTable: string;
  /** what the send panel calls that picture */
  fullTableKit: (plans: number) => string;
  /**
   * The phone's PDF button while the server makes the file, once it is ready to hand to the
   * share sheet, and when it could not be made (src/components/ihealthy/PdfButton.tsx).
   */
  pdfMaking: string;
  pdfReady: string;
  pdfFailed: string;
}

export const SEND_WORDS: Record<Lang, SendWords> = {
  th: {
    fullTable: "ตารางผลประโยชน์ครบทุกหมวด",
    fullTableKit: (n) => `ตารางเต็ม ${n} แผน`,
    pdfMaking: "กำลังทำไฟล์ PDF… ประมาณ 10–20 วินาที",
    pdfReady: "ไฟล์ PDF พร้อมแล้ว แตะเพื่อบันทึก",
    pdfFailed: "ทำไฟล์ PDF ไม่สำเร็จ แตะเพื่อลองใหม่",
  },
  en: {
    fullTable: "Full benefit table",
    fullTableKit: (n) => `Full table, ${n} plans`,
    pdfMaking: "Making the PDF… about 10–20 seconds",
    pdfReady: "PDF ready, tap to save",
    pdfFailed: "Couldn't make the PDF, tap to try again",
  },
  zh: {
    fullTable: "完整保障表",
    fullTableKit: (n) => `完整表格(${n}个计划)`,
    pdfMaking: "正在生成PDF…约10–20秒",
    pdfReady: "PDF已就绪,点击保存",
    pdfFailed: "PDF生成失败,点击重试",
  },
  ru: {
    fullTable: "Полная таблица покрытия",
    fullTableKit: (n) => `Полная таблица, ${n} планов`,
    pdfMaking: "Готовим PDF… около 10–20 секунд",
    pdfReady: "PDF готов — нажмите, чтобы сохранить",
    pdfFailed: "Не удалось сделать PDF — нажмите ещё раз",
  },
  my: {
    fullTable: "အကျိုးခံစားခွင့် ဇယားအပြည့်အစုံ",
    fullTableKit: (n) => `ဇယားအပြည့် (အစီအစဉ် ${n} ခု)`,
    pdfMaking: "PDF ပြုလုပ်နေသည်… စက္ကန့် 10–20 ခန့်",
    pdfReady: "PDF အဆင်သင့်ဖြစ်ပြီ၊ သိမ်းရန် နှိပ်ပါ",
    pdfFailed: "PDF မပြုလုပ်နိုင်ပါ၊ ထပ်စမ်းရန် နှိပ်ပါ",
  },
};
