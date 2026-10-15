/**
 * The plans คลิปเล่าเรื่อง may borrow a real premium from, and their paying terms as the form
 * offers them. Browser-safe: the form lists them; quote-video/story.ts prices them.
 */

export type StoryPlan = "LIFEPROTECT" | "ISHIELD";
export const STORY_PLANS: { code: StoryPlan; name: string; terms: { variant: string; short: string }[] }[] = [
  { code: "ISHIELD", name: "iShield", terms: [{ variant: "WLCI05", short: "จ่าย 5 ปี" }, { variant: "WLCI10", short: "จ่าย 10 ปี" }, { variant: "WLCI15", short: "จ่าย 15 ปี" }, { variant: "WLCI20", short: "จ่าย 20 ปี" }] },
  { code: "LIFEPROTECT", name: "Life Protect", terms: [{ variant: "WLF09H", short: "จ่าย 9 ปี" }, { variant: "WLF19H", short: "จ่าย 19 ปี" }, { variant: "WLF99H", short: "จ่ายถึงอายุ 99" }] },
];

export const planName = (p: StoryPlan) => STORY_PLANS.find((x) => x.code === p)?.name ?? p;
export const termShort = (f: { plan: StoryPlan; variant: string }) =>
  STORY_PLANS.find((x) => x.code === f.plan)?.terms.find((t) => t.variant === f.variant)?.short ?? "";
