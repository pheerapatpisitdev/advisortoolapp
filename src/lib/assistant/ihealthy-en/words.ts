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

export const FORM_DONE_EN = "Thank you! 🙏 I'll check your details and get back to you in this chat.";

export const STALL_EN = "No problem at all — take your time. 🙏 Just message here whenever you're ready.";

export const SHARE_OF_BILL_EN = "There are versions with a deductible or a co-payment — the premium is lower in exchange for "
  + "paying the first part of a bill yourself. Both are sold in Thailand only — let me work out the figures for you. "
  + HAND_OVER_EN;

export const FULL_TABLE_EN = "The full benefit table is on this page, with your age and plan filled in — "
  + "tap English at the top to read it in English.";

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
