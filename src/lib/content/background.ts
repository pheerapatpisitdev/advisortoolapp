import { CLASSIC, choiceOf, isClassic, styleKind, type Look } from "./looks";
import { poseText } from "./people";
import type { Layout, PosterSpec, Theme } from "./poster";

/**
 * What the image model is asked for when a poster gets a picture behind it.
 *
 * Maryjane's buildBackgroundPrompt (src/lib/ai/image-prompt.ts), cut to what this site needs.
 * Its two load-bearing rules are kept word for word in spirit: the picture has no text of any
 * kind, because every Thai word on the poster is set afterwards by a real font; and the part of
 * the frame the words will sit on is kept calm, so they can be read.
 *
 * No Thai reaches the model. Image models read Thai badly and, worse, try to draw it — a Thai
 * word in the prompt is how garbled lettering ends up in the picture. The writer's imagePrompt
 * is English by instruction; anything Thai left in it is removed, and the owner's own request,
 * which may well be Thai, is translated before it gets here.
 */

const KEEP_CLEAR: Record<Layout, string> = {
  top: "Keep the top half of the frame calm and uncluttered — simple tones, no busy detail.",
  center: "Keep a calm horizontal band across the middle of the frame — simple tones, no busy detail.",
  bottom: "Keep the bottom half of the frame calm and uncluttered — simple tones, no busy detail.",
};

const PALETTE: Record<Theme, string> = {
  navy: "deep navy blue shadows with warm sand and cream highlights",
  sand: "warm sand, cream and soft beige tones with small touches of deep navy",
  white: "bright, airy whites and soft greys with small touches of deep navy",
  noir: "rich blacks and deep charcoal with warm gold accents, low-key luxurious lighting",
  champagne: "soft champagne, warm ivory and pale gold tones, gentle glowing light",
  emerald: "deep emerald and forest greens with touches of warm gold",
  mint: "fresh mint, pale sea-green and clean white tones, light and airy",
  sky: "clear sky blues, soft white and pale cloud tones, calm daylight",
  royal: "vivid royal blue and deep cobalt with small touches of warm yellow",
  violet: "deep violet and plum shadows with soft lilac highlights",
  lavender: "soft lavender, lilac and pale violet pastels, dreamy light",
  blush: "blush pink, rose and soft cream pastels, tender warm light",
  red: "bold crimson and deep red tones with small touches of warm yellow, energetic",
  orange: "vibrant orange and burnt amber tones, energetic warm light",
  peach: "warm peach, coral and apricot tones, soft golden-hour light",
  sunny: "bright sunny yellows and warm golden light with small touches of charcoal",
  teal: "deep teal and turquoise tones with soft sandy highlights",
  terracotta: "earthy terracotta, rust and warm clay tones with cream highlights",
  charcoal: "modern charcoal and cool slate greys with small touches of soft blue",
  cream: "minimal warm cream, off-white and light beige tones with a touch of amber",
  photo: "the scene's own natural colours, with no colour grading toward any palette; white text will sit on the calm area, so keep it simple and a little darker there",
};

/** what an insurance advertisement must never picture, whatever the scene */
const AVOID = [
  "hospital gore, blood, injuries, needles close-up",
  "funerals, coffins, graves, grieving at a deathbed",
  "piles of cash, gold, gambling imagery",
  "company logos, insurer branding, documents with readable writing",
  "rigid posing, generic corporate stock photography, plastic skin, sterile showroom lighting",
];

/** the longest picture brief taken — room for a full art direction, not only a sentence */
export const MAX_DIRECTION = 2500;

const THAI = /[฀-๿]+/g;

export function stripThai(text: string): string {
  return text.replace(THAI, " ").replace(/\s+/g, " ").trim();
}

/** the part of the frame the words sit on, for a look that fills it with something of its own */
const TEXT_AREA: Record<Layout, string> = {
  top: "the top half of the frame",
  center: "a horizontal band across the middle of the frame",
  bottom: "the bottom half of the frame",
};

/** where the words are not, so the person can stand there */
const PERSON_SIDE: Record<Layout, string> = {
  top: "Place the person in the lower half of the frame, clear of the calm top area.",
  center: "Place the person to one side, above or below the calm middle band, never across it.",
  bottom: "Place the person in the upper half of the frame, clear of the calm bottom area.",
};

/**
 * The person block: the reference photos are the person, kept recognisable. No uniform of
 * any kind — an agent drawn as a doctor or a nurse would be a claim the owner did not make.
 */
/** รีวิวเคลม: the papers cover the left of the lower half, so the person stands to their right */
const PERSON_ASIDE = "Place the person in the right third of the frame, in its lower half, turned slightly toward the left. Keep the left two-thirds of the lower half simple and uncluttered: cards will be laid over it.";

function personLines(pose: string, layout: Layout, aside = false): string[] {
  return [
    "The person:",
    "- The person shown in the reference photos is the main subject. Keep them clearly recognisable: the same face, hairstyle, skin tone and build.",
    `- Pose: ${poseText(pose)}`,
    `- ${aside ? PERSON_ASIDE : PERSON_SIDE[layout]}`,
    "- Ordinary smart-casual clothes unless the owner's request says otherwise; never a doctor's, nurse's or any other uniform.",
    "- No other clearly identifiable faces; anyone else stays in soft focus or turned away.",
  ];
}

export function backgroundPrompt(opts: {
  /** the writer's English scene for this piece */
  scene: string;
  layout: Layout;
  theme: Theme;
  /** the owner's request, already in English */
  request?: string | null;
  /** a person from the reference photos sent with the prompt, and the pose they take */
  person?: { pose: string; aside?: boolean } | null;
  /** the kind of picture (looks.ts); absent or the original draws what every picture was drawn from before */
  look?: Look | null;
}): string {
  // what the owner typed decides the whole picture (owner, 2026-10-01)
  const own = opts.request ? stripThai(opts.request) : "";
  if (own) return ownerPrompt(opts, own);
  const look = opts.look ?? CLASSIC;
  if (!isClassic(look)) return lookPrompt(opts, look);
  const scene = stripThai(opts.scene) || "A believable everyday moment of a Thai family at home, warm and unposed.";
  return [
    "Create a natural, editorial-quality 1:1 square background photograph for a Thai insurance agent's Facebook post.",
    "",
    "Scene:",
    scene,
    ...(opts.person ? ["", ...personLines(opts.person.pose, opts.layout, opts.person.aside)] : []),
    "",
    "Absolute rules:",
    "- NO text, letters, numbers or words, and NO logos, watermarks, signatures or user-interface elements anywhere in the image.",
    `- ${KEEP_CLEAR[opts.layout]}`,
    `- Avoid: ${AVOID.join("; ")}.`,
    "",
    "Visual direction:",
    `- Colour palette: ${PALETTE[opts.theme]}.`,
    "- Thai people in a Thai setting; imperfect natural gestures, believable depth, soft natural light.",
    "- Hopeful and reassuring rather than fearful.",
    "- Thai headline text will be placed on top of the image later, so leave room to breathe.",
  ].join("\n");
}

/**
 * A look other than the original: the same frame and the same rules — no lettering, the words'
 * side kept calm, nothing an insurance advertisement must not show, the theme's colours — with
 * the style, who is in it, the place, the light and the mood the look names.
 */
function lookPrompt(opts: Parameters<typeof backgroundPrompt>[0], look: Look): string {
  const scene = stripThai(opts.scene) || "A believable everyday moment of a Thai family at home, warm and unposed.";
  const objects = styleKind(look.style) === "objects";
  return [
    `Create a 1:1 square background image for a Thai insurance agent's Facebook post, in this style: ${choiceOf("style", look.style).say}.`,
    "",
    "Scene:",
    scene,
    ...(opts.person ? ["", ...personLines(opts.person.pose, opts.layout, opts.person.aside)] : []),
    "",
    "Absolute rules:",
    "- NO text, letters, numbers or words, and NO logos, watermarks, signatures or user-interface elements anywhere in the image.",
    `- Keep ${TEXT_AREA[opts.layout]} calm and simple for the words — ${choiceOf("space", look.space).say}, no busy detail.`,
    `- Avoid: ${AVOID.join("; ")}.`,
    "",
    "Visual direction:",
    `- Colour palette: ${PALETTE[opts.theme]}.`,
    `- In the picture: ${choiceOf("subject", look.subject).say}${objects ? " — nothing that can be read on them" : ""}.`,
    `- Setting: ${choiceOf("place", look.place).say}.`,
    `- Light: ${choiceOf("light", look.light).say}.`,
    `- Mood: ${choiceOf("mood", look.mood).say}, never fearful.`,
    "- Thai headline text will be placed on top of the image later, so leave room to breathe.",
  ].join("\n");
}

/**
 * The owner's own direction, typed in the editor or the round's picture brief: it decides the
 * style, who is in it, the place, the light, the colours and the mood — no scene from the writer,
 * no look, no theme palette. What stays is what keeps the poster readable and the advertisement
 * safe: no lettering, the words' side calm, nothing an insurance advertisement must not show, and
 * a person from the library kept as themselves.
 */
function ownerPrompt(opts: Parameters<typeof backgroundPrompt>[0], direction: string): string {
  return [
    "Create a 1:1 square background image for a Thai insurance agent's Facebook post.",
    "",
    "The page owner's own direction — follow it exactly; it decides the style, subject, setting, light, colours and mood:",
    direction,
    ...(opts.person ? ["", ...personLines(opts.person.pose, opts.layout, opts.person.aside)] : []),
    "",
    "Absolute rules (these hold whatever the direction says):",
    "- NO text, letters, numbers or words, and NO logos, watermarks, signatures or user-interface elements anywhere in the image.",
    `- Keep ${TEXT_AREA[opts.layout]} calm and simple — Thai headline text will be placed there later.`,
    `- Avoid: ${AVOID.join("; ")}.`,
  ].join("\n");
}

const ROLE: Record<string, string> = {
  badge: "Small label",
  headline: "Main headline, the largest words",
  sub: "Supporting line",
  footer: "Small closing line",
};

/**
 * The whole poster, words and all, from the owner's picture brief (owner, 2026-10-01): the model
 * designs it and sets the Thai itself. It is told the words exactly and nothing else may appear;
 * the forbidden list holds, a library person stays themselves, and the lowest strip is left for
 * the insurer's line and the logo the code still lays over it. What it drew is read back and
 * checked (poster-text.ts), and the piece waits for the agent before it may go up.
 */
export function posterPrompt(opts: {
  /** the owner's brief, already in English */
  direction: string;
  poster: Pick<PosterSpec, "blocks">;
  layout: Layout;
  person?: { pose: string; aside?: boolean } | null;
}): string {
  return [
    "Create a finished 1:1 square Facebook post image for a Thai insurance agent: the design, the picture and the Thai lettering together.",
    "",
    "The page owner's own direction — follow it closely; it decides the design, style, colours, layout and mood:",
    stripThai(opts.direction),
    "",
    "The words on the image, in Thai — draw each exactly as written, every character and every digit, in a clean, modern, clearly legible Thai typeface:",
    ...opts.poster.blocks.map((b) => `- ${ROLE[b.kind] ?? "Line"}: ${b.text}`),
    ...(opts.person ? ["", ...personLines(opts.person.pose, opts.layout, opts.person.aside)] : []),
    "",
    "Absolute rules:",
    "- Draw only the words above: no other words, numbers, logos, watermarks, signatures or user-interface elements.",
    "- Keep every Thai word whole and correctly spelled; never split, invent or rearrange characters.",
    "- Leave the bottom strip of the image (its lowest tenth) plain and simple: the insurer's name and the Page's logo are added there later.",
    `- Avoid: ${AVOID.join("; ")}.`,
  ].join("\n");
}
