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

/** What the bot says when only a person can answer. */
export const HAND_OVER_EN = "An agent will continue with you right here in this chat. "
  + "Meanwhile, feel free to ask anything about iHealthy Ultra.";

/**
 * Deciding to apply. No form and no list of documents: the Thai form asks for a Thai ID card,
 * and how a foreigner applies is the agent's to say until the owner writes it down.
 */
export const APPLY_HAND_OVER_EN = "Great! 🙌 An agent will take you through the application right here in this chat "
  + "and let you know which documents you'll need.";

export const FORM_DONE_EN = "Thank you! 🙏 An agent will check your details and get back to you in this chat.";

export const STALL_EN = "No problem at all — take your time. 🙏 Just message here whenever you're ready.";

export const SHARE_OF_BILL_EN = "There are versions with a deductible or a co-payment — the premium is lower in exchange for "
  + "paying the first part of a bill yourself. Both are sold in Thailand only, and an agent will work out the figures for you. "
  + HAND_OVER_EN;

export const FULL_TABLE_EN = "The full benefit table is on this page, with your age and plan filled in — "
  + "tap English at the top to read it in English.";

export const OUT_OF_RANGE_EN = (min: number, max: number, age: number) =>
  `iHealthy Ultra covers ages ${min}–${max}, so age ${age} is outside the range. ${HAND_OVER_EN}`;
export const RATES_EXPIRED_EN = `This rate table has expired — an agent will give you the current premium. ${HAND_OVER_EN}`;
export const NO_PRICE_EN = `I can't price this plan right now — an agent will give you the current premium. ${HAND_OVER_EN}`;

/** The apologies the inbox sends when there is no answer to send. */
export const BUSY_EN = "We're getting a lot of messages right now — please try again in a moment.";
export const BROKEN_EN = "Sorry, something went wrong on our side — an agent will reply here shortly 🙏";
export const OUT_OF_BUDGET_EN = "Our assistant is paused for now — an agent will reply to you here.";
export const CARD_UNSENT_EN = "Your quote is a picture — you can open it here:";

/** Who stands behind the policy. */
export const COMPANY_EN = "iHealthy Ultra is a policy from Krungthai-AXA Life Insurance PCL. "
  + "An agent can share their licence details with you right here in this chat.";

/** After the customer has told us about their condition, as the health answer asked them to. */
export const HEALTH_THANKS_EN = "Thank you for sharing that 🙏 An agent will look at it and give you an honest pre-check "
  + "right here in this chat. We can't promise the insurer's decision, but we'll tell you what to expect.";
