import { isHeading, type BenefitEntry } from "@/lib/ihealthy-facts";
import type { Lang } from "@/lib/ihealthy-lang";

/**
 * Every line of the benefit sheet, named short, for the picture of the whole table (owner,
 * 2026-10-25, option ก on mockup https://claude.ai/artifact/6Wk2LKxWA5hqojpF2LfnHt).
 *
 * A customer asked for the full table as a picture, all six plans and every category. The
 * contract's own wording runs to three lines a row in a column a picture can spare for it, so
 * the owner chose short names; the printed sheet still carries the company's words.
 *
 * Keyed by the category's number as the Thai sheet writes it, so a translated sheet finds the
 * same name: "1".."28" for the categories, "2.1".."6.2" for the sub-rows, and the two benefit
 * groups and the plan-dependent benefits (the endorsement) as words.
 */
export const FULL_ROW_KEYS = [
  "inpatient", "1", "2", "2.1", "2.2", "2.3", "2.4", "3",
  "4", "4.1", "4.2", "4.3", "4.4", "4.5", "5",
  "outpatient", "6", "6.1", "6.2", "7", "8", "9", "10", "11", "12", "13",
  "endorsement", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28",
] as const;
export type FullRowKey = (typeof FULL_ROW_KEYS)[number];

const KEYS = new Set<string>(FULL_ROW_KEYS);
const keyed = (k: string): FullRowKey | undefined => (KEYS.has(k) ? (k as FullRowKey) : undefined);

/**
 * The key of one line of the Thai sheet, or undefined for a line this list has no name for —
 * which the test over the sheet forbids, so a re-issued contract with a new category fails
 * there rather than drawing a row with no label.
 */
export function fullRowKey(entry: BenefitEntry): FullRowKey | undefined {
  if (isHeading(entry)) {
    // the sheet's two benefit groups are "1. ผลประโยชน์…" and "2. ผลประโยชน์…"
    if (/^1\.\s*ผลประโยชน์/.test(entry.heading)) return "inpatient";
    if (/^2\.\s*ผลประโยชน์/.test(entry.heading)) return "outpatient";
    const m = /^หมวดที่\s*(\d+)/.exec(entry.heading);
    return m ? keyed(m[1]) : undefined;
  }
  if (entry.no !== null) return keyed(String(entry.no));
  const m = /^หมวดย่อยที่\s*(\d+\.\d+)/.exec(entry.title);
  return m ? keyed(m[1]) : undefined;
}

/**
 * The short names, a language to a map. Server-only by use: only the picture's route reads
 * them, so a phone reading the page does not download five languages of row names.
 */
export const FULL_ROW_LABEL: Record<Lang, Record<FullRowKey, string>> = {
  th: {
    inpatient: "ผลประโยชน์กรณีผู้ป่วยใน",
    "1": "1. ค่าห้อง ค่าอาหาร ค่าบริการ รพ.",
    "2": "2. ค่าบริการทางการแพทย์ ค่ายา ค่าพยาบาล",
    "2.1": "2.1 ค่าตรวจวินิจฉัย",
    "2.2": "2.2 ค่าบำบัดรักษา โลหิต การพยาบาล",
    "2.3": "2.3 ค่ายา สารอาหาร เวชภัณฑ์",
    "2.4": "2.4 ยากลับบ้าน (15 วัน/ครั้ง)",
    "3": "3. ค่าแพทย์ตรวจรักษา",
    "4": "4. ค่าผ่าตัดและหัตถการ",
    "4.1": "4.1 ค่าห้องผ่าตัด ห้องหัตถการ",
    "4.2": "4.2 ยา เวชภัณฑ์ อุปกรณ์ผ่าตัด",
    "4.3": "4.3 ค่าแพทย์ผ่าตัด (รวมผู้ช่วย)",
    "4.4": "4.4 ค่าวิสัญญีแพทย์",
    "4.5": "4.5 ผ่าตัดเปลี่ยนอวัยวะ",
    "5": "5. ผ่าตัดใหญ่ไม่ต้องนอน รพ. (Day Surgery)",
    outpatient: "ผลประโยชน์กรณีไม่ต้องนอน รพ.",
    "6": "6. ก่อนและหลังนอน รพ.",
    "6.1": "6.1 ตรวจวินิจฉัย 30 วันก่อน/หลังนอน รพ.",
    "6.2": "6.2 OPD ต่อเนื่อง 30 วัน (2 ครั้ง/การนอน)",
    "7": "7. อุบัติเหตุ OPD ภายใน 24 ชม.",
    "8": "8. เวชศาสตร์ฟื้นฟูหลังนอน รพ.",
    "9": "9. ล้างไตทางเส้นเลือด",
    "10": "10. มะเร็ง รังสีรักษา",
    "11": "11. มะเร็ง เคมีบำบัด",
    "12": "12. รถพยาบาลฉุกเฉิน",
    "13": "13. ผ่าตัดเล็ก",
    endorsement: "ผลประโยชน์เพิ่มตามแผน (เอกสารแนบท้าย)",
    "14": "14. พยาบาลพิเศษใน รพ. / ที่บ้าน",
    "15": "15. ทันตกรรมจากอุบัติเหตุ (7 วัน)",
    "16": "16. ศัลยกรรมในช่องปาก",
    "17": "17. ภาวะแทรกซ้อนก่อน/หลังคลอด (12MWP)",
    "18": "18. ค่าแพทย์และยา OPD",
    "19": "19. กายภาพบำบัด OPD",
    "20": "20. หออภิบาลทารกแรกเกิด",
    "21": "21. แพทย์ทางเลือก ต่อปี",
    "22": "22. ทันตกรรม ต่อปี",
    "23": "23. จิตเวช ผู้ป่วยใน/นอก ต่อปี",
    "24": "24. ตั้งครรภ์และคลอดบุตร (12MWP)",
    "25": "25. ดูแลสายตา ต่อปี",
    "26": "26. ตรวจสุขภาพประจำปี (12MWP)",
    "27": "27. ฉีดวัคซีน ต่อปี",
    "28": "28. ดูแลประคับประคองระยะสุดท้าย (12MWP)",
  },
  en: {
    inpatient: "Inpatient benefits",
    "1": "1. Room, board and hospital services",
    "2": "2. Medical services, drugs and nursing",
    "2.1": "2.1 Diagnostic services",
    "2.2": "2.2 Treatment, blood and nursing",
    "2.3": "2.3 Drugs, IV nutrition and supplies",
    "2.4": "2.4 Take-home drugs (15 days a stay)",
    "3": "3. Doctor's visits",
    "4": "4. Surgery and procedures",
    "4.1": "4.1 Operating and procedure rooms",
    "4.2": "4.2 Surgical drugs, supplies, devices",
    "4.3": "4.3 Surgeon's fee (incl. assistant)",
    "4.4": "4.4 Anaesthetist's fee",
    "4.5": "4.5 Organ transplant",
    "5": "5. Day Surgery",
    outpatient: "Benefits without a hospital stay",
    "6": "6. Before and after a hospital stay",
    "6.1": "6.1 Diagnostics 30 days before/after",
    "6.2": "6.2 Follow-up OPD 30 days (2 a stay)",
    "7": "7. Accident OPD within 24 hrs",
    "8": "8. Rehabilitation after a stay",
    "9": "9. Kidney dialysis",
    "10": "10. Cancer radiotherapy",
    "11": "11. Cancer chemotherapy",
    "12": "12. Emergency ambulance",
    "13": "13. Minor surgery",
    endorsement: "Extra benefits by plan (endorsement)",
    "14": "14. Private nurse in hospital / at home",
    "15": "15. Accidental dental (within 7 days)",
    "16": "16. Oral surgery",
    "17": "17. Pregnancy complications (12MWP)",
    "18": "18. OPD doctor and drugs",
    "19": "19. OPD physiotherapy",
    "20": "20. Newborn intensive care",
    "21": "21. Alternative medicine, a year",
    "22": "22. Dental care, a year",
    "23": "23. Psychiatric care, a year",
    "24": "24. Pregnancy and childbirth (12MWP)",
    "25": "25. Eye care, a year",
    "26": "26. Annual health check (12MWP)",
    "27": "27. Vaccinations, a year",
    "28": "28. Palliative end-of-life care (12MWP)",
  },
  zh: {
    inpatient: "住院保障",
    "1": "1. 房间、餐饮及医院服务",
    "2": "2. 医疗服务、药品及护理",
    "2.1": "2.1 诊断检查",
    "2.2": "2.2 治疗、血液及护理",
    "2.3": "2.3 药品、静脉营养及医疗用品",
    "2.4": "2.4 出院带药(每次住院15天)",
    "3": "3. 医生诊疗费",
    "4": "4. 手术及医疗操作",
    "4.1": "4.1 手术室及操作室",
    "4.2": "4.2 手术药品、用品及器械",
    "4.3": "4.3 手术医生费(含助手)",
    "4.4": "4.4 麻醉医生费",
    "4.5": "4.5 器官移植手术",
    "5": "5. 日间手术 (Day Surgery)",
    outpatient: "无需住院的保障",
    "6": "6. 住院前后",
    "6.1": "6.1 住院前后30天诊断检查",
    "6.2": "6.2 出院后30天门诊复诊(每次住院2次)",
    "7": "7. 意外门诊(24小时内)",
    "8": "8. 住院后康复治疗",
    "9": "9. 血液透析",
    "10": "10. 癌症放射治疗",
    "11": "11. 癌症化疗",
    "12": "12. 急救车",
    "13": "13. 小手术",
    endorsement: "按计划附加保障(批注)",
    "14": "14. 医院/居家特别护理",
    "15": "15. 意外牙科(7天内)",
    "16": "16. 口腔外科手术",
    "17": "17. 妊娠及分娩并发症(12MWP)",
    "18": "18. 门诊医生及药品",
    "19": "19. 门诊物理治疗",
    "20": "20. 新生儿重症监护",
    "21": "21. 替代医学(每年)",
    "22": "22. 牙科治疗(每年)",
    "23": "23. 精神科治疗(每年)",
    "24": "24. 妊娠及分娩(12MWP)",
    "25": "25. 眼科护理(每年)",
    "26": "26. 年度体检(12MWP)",
    "27": "27. 疫苗接种(每年)",
    "28": "28. 临终舒缓护理(12MWP)",
  },
  ru: {
    inpatient: "Стационарное лечение",
    "1": "1. Палата, питание, услуги больницы",
    "2": "2. Медуслуги, лекарства, уход",
    "2.1": "2.1 Диагностика",
    "2.2": "2.2 Лечение, кровь, сестринский уход",
    "2.3": "2.3 Лекарства, в/в питание, расходники",
    "2.4": "2.4 Лекарства домой (15 дней)",
    "3": "3. Осмотры врача",
    "4": "4. Операции и процедуры",
    "4.1": "4.1 Операционная и процедурная",
    "4.2": "4.2 Лекарства и материалы для операции",
    "4.3": "4.3 Хирург (вкл. ассистента)",
    "4.4": "4.4 Анестезиолог",
    "4.5": "4.5 Трансплантация органов",
    "5": "5. Day Surgery",
    outpatient: "Без госпитализации",
    "6": "6. До и после госпитализации",
    "6.1": "6.1 Диагностика за 30 дней до/после",
    "6.2": "6.2 Амбулаторно 30 дней после (2 раза)",
    "7": "7. Травма амбулаторно, 24 ч",
    "8": "8. Реабилитация после стационара",
    "9": "9. Гемодиализ",
    "10": "10. Лучевая терапия рака",
    "11": "11. Химиотерапия рака",
    "12": "12. Скорая помощь",
    "13": "13. Малые операции",
    endorsement: "Доп. покрытие по плану (дополнение)",
    "14": "14. Сиделка в больнице / дома",
    "15": "15. Стоматология при травме (7 дней)",
    "16": "16. Хирургия полости рта",
    "17": "17. Осложнения беременности (12MWP)",
    "18": "18. Врач и лекарства амбулаторно",
    "19": "19. Физиотерапия амбулаторно",
    "20": "20. Интенсивная терапия новорождённых",
    "21": "21. Альтернативная медицина, в год",
    "22": "22. Стоматология, в год",
    "23": "23. Психиатрия, в год",
    "24": "24. Беременность и роды (12MWP)",
    "25": "25. Уход за зрением, в год",
    "26": "26. Ежегодный осмотр (12MWP)",
    "27": "27. Вакцинация, в год",
    "28": "28. Паллиативная помощь (12MWP)",
  },
  my: {
    inpatient: "အတွင်းလူနာ အကျိုးခံစားခွင့်",
    "1": "1. အခန်း၊ အစားအသောက်၊ ဆေးရုံဝန်ဆောင်မှု",
    "2": "2. ဆေးဘက်ဝန်ဆောင်မှု၊ ဆေးဝါး၊ သူနာပြု",
    "2.1": "2.1 ရောဂါရှာဖွေစစ်ဆေးခြင်း",
    "2.2": "2.2 ကုသမှု၊ သွေး၊ သူနာပြုစောင့်ရှောက်မှု",
    "2.3": "2.3 ဆေးဝါး၊ သွေးကြောအာဟာရ၊ ဆေးပစ္စည်း",
    "2.4": "2.4 အိမ်ပြန်ဆေး (15 ရက်)",
    "3": "3. ဆရာဝန် စစ်ဆေးကုသခ",
    "4": "4. ခွဲစိတ်ခြင်းနှင့် လုပ်ထုံးလုပ်နည်း",
    "4.1": "4.1 ခွဲစိတ်ခန်းနှင့် လုပ်ထုံးခန်း",
    "4.2": "4.2 ခွဲစိတ်ဆေးဝါးနှင့် ပစ္စည်းကိရိယာ",
    "4.3": "4.3 ခွဲစိတ်ဆရာဝန်ခ (လက်ထောက်အပါအဝင်)",
    "4.4": "4.4 မေ့ဆေးဆရာဝန်ခ",
    "4.5": "4.5 ကိုယ်တွင်းအင်္ဂါ အစားထိုးခွဲစိတ်ခြင်း",
    "5": "5. Day Surgery",
    outpatient: "ဆေးရုံမတက်ဘဲ အကျိုးခံစားခွင့်",
    "6": "6. ဆေးရုံမတက်မီနှင့် ဆင်းပြီးနောက်",
    "6.1": "6.1 ဆေးရုံတက်မီ/ဆင်းပြီး 30 ရက် စစ်ဆေးမှု",
    "6.2": "6.2 ဆင်းပြီး 30 ရက် ပြင်ပလူနာ (2 ကြိမ်)",
    "7": "7. မတော်တဆ ပြင်ပလူနာ 24 နာရီ",
    "8": "8. ဆေးရုံဆင်းပြီး ပြန်လည်ထူထောင်ရေး",
    "9": "9. ကျောက်ကပ်ဆေးကြောခြင်း",
    "10": "10. ကင်ဆာ ဓာတ်ရောင်ခြည်ကုထုံး",
    "11": "11. ကင်ဆာ ဓာတုကုထုံး",
    "12": "12. အရေးပေါ် လူနာတင်ယာဉ်",
    "13": "13. ခွဲစိတ်မှုငယ်",
    endorsement: "အစီအစဉ်အလိုက် အပိုအကျိုးခံစားခွင့်",
    "14": "14. ဆေးရုံ/အိမ်တွင် အထူးသူနာပြု",
    "15": "15. မတော်တဆ သွားဘက်ဆိုင်ရာ (7 ရက်)",
    "16": "16. ပါးစပ်အတွင်း ခွဲစိတ်မှု",
    "17": "17. ကိုယ်ဝန်ဆောင် နောက်ဆက်တွဲ (12MWP)",
    "18": "18. ပြင်ပလူနာ ဆရာဝန်နှင့်ဆေး",
    "19": "19. ပြင်ပလူနာ ကိုယ်ကာယကုထုံး",
    "20": "20. မွေးကင်းစ အထူးကြပ်မတ်ဆောင်",
    "21": "21. အခြားနည်းလမ်း ကုသမှု (တစ်နှစ်)",
    "22": "22. သွားဘက်ဆိုင်ရာ ကုသမှု (တစ်နှစ်)",
    "23": "23. စိတ်ကျန်းမာရေး ကုသမှု (တစ်နှစ်)",
    "24": "24. ကိုယ်ဝန်နှင့် မွေးဖွားခြင်း (12MWP)",
    "25": "25. မျက်စိစောင့်ရှောက်မှု (တစ်နှစ်)",
    "26": "26. နှစ်စဉ် ကျန်းမာရေးစစ်ဆေးမှု (12MWP)",
    "27": "27. ကာကွယ်ဆေးထိုးခြင်း (တစ်နှစ်)",
    "28": "28. နောက်ဆုံးအဆင့် စောင့်ရှောက်မှု (12MWP)",
  },
};

/**
 * Categories 18 and 19 drawn as one row, the figure once, with this under it (owner, 2026-10-31,
 * option ข on mockup https://claude.ai/artifact/KtniALzMC1rZPxLFWeVy5g): the doctor-and-drugs and
 * the physiotherapy OPD are paid from one yearly limit, and two rows of the same figure read as two.
 */
export const SHARED_OPD: readonly [FullRowKey, FullRowKey] = ["18", "19"];
export const SHARED_LIMIT_NOTE: Record<Lang, string> = {
  th: "วงเงินรวม/ปี",
  en: "shared limit/yr",
  zh: "合计限额/年",
  ru: "общий лимит/год",
  my: "စုပေါင်းကန့်သတ်ငွေ/နှစ်",
};
