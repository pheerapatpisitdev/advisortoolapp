/**
 * Every fixed sentence the English health brain says, in one place.
 *
 * Kept together so the owner can have a word changed without anyone reading the brain: the
 * figures are never here — they come from the engine — only the words around them.
 */

/** The words a tapped button sends back, which is how the brain recognises them. Under 20 characters. */
export const SEE_OTHER_PLANS_EN = "See other plans";
export const PLAN_BENEFITS_EN = "Plan benefits";
export const WANTS_IN_EN = "I want to apply";
/** The advertisement's own quick-reply button (the ad's message template), matched whatever its case. */
export const CHECK_PREMIUMS_EN = "Check insurance premiums";

/** The first thing a customer from the advertisement hears. */
export const GREETING_EN = "Hi, thanks for reaching out! 🙏 We help expats in Thailand get iHealthy Ultra health insurance — "
  + "inpatient cover paid as charged, up to the plan's yearly limit.\n"
  + "To show you the premiums, could you tell me your age and gender? (e.g. \"35 male\")";

export const ASK_DETAILS_EN = "Could you tell me your age and gender? I'll work out your premium right away (e.g. \"35 male\").";
export const ASK_AGE_EN = "Could you tell me your age? (e.g. \"35\")";
export const ASK_SEX_EN = "Could you tell me your gender? (male or female)";

/**
 * What the bot says when it cannot answer itself — in the first person, as the one person
 * looking after the Page (owner, 2026-10-02), so the agent who picks the thread up later is
 * the same "I" the customer was already talking to.
 */
export const HAND_OVER_EN = "Let me check that for you — I'll get back to you right here in this chat. "
  + "Meanwhile, feel free to ask anything about iHealthy Ultra.";

/**
 * Deciding to apply: the agency's own form, which has an English part for foreigners (owner,
 * 2026-10-02 — "why doesn't the bot send the form?"). Nothing here promises what the agent
 * will do about documents or payment beyond what the form itself asks.
 */
export const APPLY_STEPS_EN = [
  "Great! 🙌 Applying is all online:",
  "",
  "1️⃣ Open the form below and tap \"For Foreigners\"",
  "2️⃣ Fill in the three parts — your details and health, the health questions, then your beneficiary and documents",
  "3️⃣ Answer the health questions truthfully — it's what keeps your future claims safe",
  "",
  "That's it 🙏",
].join("\n");

export const FORM_NEXT_EN = "When you've sent the form, just let me know here — I'll check it and guide you "
  + "through the next steps and payment.";

export const PREMIUM_FIRST_EN = "If you'd like to see your premium first, just tell me your age and gender (e.g. \"35 male\").";

/** "I want to apply" again, after the form has gone: not the same steps a second time (a customer sent it five times). */
export const APPLY_AGAIN_EN = "The form is just above 👆 If it doesn't open or something is unclear, tell me and I'll help you right here.";

/** Under a reply to several questions, when some of them have no written answer here. */
export const CHECK_REST_EN = "I'll check the rest and get back to you here 🙏";

export const FORM_DONE_EN = "Thank you! 🙏 I'll check your details and get back to you in this chat.";

export const STALL_EN = "No problem at all — take your time. 🙏 Just message here whenever you're ready.";

export const SHARE_OF_BILL_EN = "There are versions with a deductible or a co-payment — the premium is lower in exchange for "
  + "paying the first part of a bill yourself. Both are sold in Thailand only — let me work out the figures for you. "
  + HAND_OVER_EN;

export const FULL_TABLE_EN = "Here is the full benefit table as a PDF, with your age and plan filled in.";

export const OUT_OF_RANGE_EN = (min: number, max: number, age: number) =>
  `iHealthy Ultra covers ages ${min}–${max}, so age ${age} is outside the range. ${HAND_OVER_EN}`;
export const RATES_EXPIRED_EN = `This rate table has expired. ${HAND_OVER_EN}`;
export const NO_PRICE_EN = `I can't price this plan right now. ${HAND_OVER_EN}`;

/** The apologies the inbox sends when there is no answer to send. */
export const BUSY_EN = "We're getting a lot of messages right now — please try again in a moment.";
export const BROKEN_EN = "Sorry, something went wrong on our side — I'll get back to you here shortly 🙏";
export const OUT_OF_BUDGET_EN = "Give me a moment — I'll get back to you right here shortly.";
export const CARD_UNSENT_EN = "Your quote is a picture — you can open it here:";

/** Who stands behind the policy. */
export const COMPANY_EN = "iHealthy Ultra is a policy from Krungthai-AXA Life Insurance PCL. "
  + "Happy to share the licensed agent's details here if you'd like.";

/** After the customer has told us about their condition, as the health answer asked them to. */
export const HEALTH_THANKS_EN = "Thank you for sharing that 🙏 Let me look into it — I'll get back to you right here with an honest pre-check. "
  + "I can't promise the insurer's decision, but I'll tell you what to expect.";

/**
 * A customer of US nationality (./us.ts), in the words the owner approved (2026-11-26). The
 * fees and benefits of AXA Insurance are the admin's to send: none of them is in this system.
 */
export const FATCA_EN = "With reference to FATCA policy, this package is not eligible for US nationality. However, our partner company, "
  + "AXA Insurance Company, can provide a plan that meets your requirements. Let me know if you would like the information and fees.";
export const FATCA_TH = "ตามนโยบาย FATCA แบบประกันนี้ไม่สามารถสมัครได้สำหรับผู้ถือสัญชาติสหรัฐฯ ครับ แต่บริษัทพันธมิตรของเรา AXA Insurance "
  + "มีแบบที่รองรับความต้องการได้ หากสนใจรายละเอียดและค่าเบี้ย แจ้งแอดมินได้เลยครับ";
export const US_WANTS_EN = "Thank you! 🙏 I'll prepare the AXA Insurance information and fees and get back to you right here in this chat.\n"
  + "To help me prepare it, could you share your date of birth, gender, visa type, province, and any pre-existing condition? "
  + "If you've told me some of these already, just the rest is fine.";
export const US_WANTS_TH = "ขอบคุณครับ 🙏 เดี๋ยวแอดมินเตรียมรายละเอียดและค่าเบี้ยของ AXA Insurance แล้วกลับมาตอบในแชทนี้ครับ\n"
  + "รบกวนขอวันเดือนปีเกิด เพศ ประเภทวีซ่า จังหวัดที่อยู่ และโรคประจำตัว (ถ้ามี) ครับ ข้อไหนแจ้งมาแล้ว ไม่ต้องแจ้งซ้ำครับ";
export const US_PREPARING_EN = "I'm preparing the AXA Insurance information and fees — I'll get back to you right here in this chat 🙏";
export const US_PREPARING_TH = "แอดมินกำลังเตรียมรายละเอียดและค่าเบี้ยของ AXA Insurance ให้ครับ เดี๋ยวกลับมาตอบในแชทนี้ครับ 🙏";
export const US_DETAILS_EN = "Thank you! 🙏 I've got it — I'll get back to you right here in this chat with the AXA Insurance information and fees.";
export const US_DETAILS_TH = "ขอบคุณครับ 🙏 รับข้อมูลแล้วครับ เดี๋ยวแอดมินกลับมาตอบพร้อมรายละเอียดและค่าเบี้ยของ AXA Insurance ในแชทนี้ครับ";
export const US_CHECK_EN = "Let me check that for you — I'll get back to you right here in this chat.";
export const US_CHECK_TH = "เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้ครับ";
export const US_STALL_TH = "ได้เลยครับ 🙏 สะดวกเมื่อไหร่ทักมาในแชทนี้ได้เลยครับ";
