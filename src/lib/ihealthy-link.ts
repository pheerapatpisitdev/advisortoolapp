import type { PayMode } from "@/calc/types";
import type { AttachedRider } from "@/lib/ihealthy-rider-quote";
import type { IHealthyTable } from "@/lib/ihealthy-table";
import type { Lang } from "@/lib/ihealthy-lang";
import { CARD_PALETTE, cardPaletteVersion } from "@/lib/card-theme";
import {
  IHEALTHY_OPENING, baseFor, resolveArrangement, sumFor, type IHealthyInitial,
} from "@/lib/ihealthy-choice";

/**
 * One arrangement written into an address, and read back out of one.
 *
 * This is the third of the three moments ihealthy-choice.ts answers for — first paint, a
 * click, and a link arriving from somewhere else — so it decides nothing of its own. Every
 * value read out of the query goes through `baseFor`, `sumFor` and `resolveArrangement`,
 * which are the same resolvers the other two moments go through; a second copy of the sums,
 * the defaults or the rules about which plan is sold at which age is how a link and a click
 * would come to disagree about the same page.
 *
 * A link is written by whoever is holding it, which makes `?sa=1e308` and `?plan=<script>` as
 * ordinary an input here as a mistyped age. Nothing from the query reaches the pricing
 * without being walked to an arrangement the company sells, and there is no query string at
 * all — including none — that this cannot answer with a real premium.
 *
 * It is its own file, next to the calculator rather than inside it, because the server
 * component parses the address before any of the calculator's code exists: the card is
 * correct in the HTML rather than corrected once React has started.
 */

/** A query string as Next hands one over: a repeated key arrives as an array. */
export type IHealthyQuery = Record<string, string | string[] | undefined>;

/**
 * The first of a repeated key. `?age=8&age=70` is either a mistake or an experiment, and
 * neither earns an answer of its own; the first is what a reader would take the link to say.
 */
function one(query: IHealthyQuery, key: string): string | undefined {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Every value of a repeated key. Riders are the one field a link may carry several of. */
function listOf(query: IHealthyQuery, key: string): string[] {
  const value = query[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** A number the link asked for. An empty value says as little as a missing key does. */
function numberFrom(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Territory and coverage travel as the letter the rate key spells them with — `A` for เอเชีย,
 * `D` for the deductible — rather than as their own labels.
 *
 * Two reasons, both about the link outliving the moment it was copied. A Thai label costs
 * nine bytes a character once a query string has escaped it, and these links are pasted into
 * LINE and Messenger, whose linkifiers end a URL at the first character they do not expect —
 * the letters are ASCII and end nothing. And a label is the company's wording, which a rate
 * revision may re-spell: ihealthy-quote.ts already goes to the trouble of reading the default
 * label out of the table rather than naming it, and a link filed under `area=A` survives a
 * re-spelling that would leave `area=เอเชีย` quietly falling back to Thailand.
 *
 * The default of each pair — ประเทศไทย, Full Coverage — is the one the rate table spells with
 * the empty letter, so it travels as `area=` and reads back the same as silence.
 */
function letterFor(labels: Record<string, string>, label: string): string | undefined {
  return Object.hasOwn(labels, label) ? labels[label] : undefined;
}

function labelFor(labels: Record<string, string>, letter: string | undefined): string | undefined {
  if (letter === undefined) return undefined;
  return Object.keys(labels).find((label) => labels[label] === letter);
}

/**
 * The arrangement a link asks for, as near as the company will sell it.
 *
 * Every field falls back to `IHEALTHY_OPENING` where the link is silent or names something
 * this rate table has never heard of, and the three that depend on one another are settled
 * together rather than one at a time: ask for ซิลเวอร์ at eight and the page lands on สมาร์ท,
 * not on a plan with no territory under it.
 */
export function initialFrom(table: IHealthyTable, query: IHealthyQuery): IHealthyInitial {
  /**
   * An age off either end of the rider's range is pulled onto it rather than thrown away: 3
   * and 99 are both somebody the agent is really quoting, and the nearest age the company
   * insures is closer to what was meant than the opening 35. A value that is not a number at
   * all has said nothing, so the page opens where it always opens.
   */
  const wantedAge = numberFrom(one(query, "age"));
  const age = wantedAge === undefined
    ? IHEALTHY_OPENING.age
    : Math.min(table.ageMax, Math.max(table.ageMin, Math.round(wantedAge)));

  const wantedSex = one(query, "sex");
  const sex = wantedSex === "M" || wantedSex === "F" ? wantedSex : IHEALTHY_OPENING.sex;

  const base = baseFor(table, one(query, "base") ?? IHEALTHY_OPENING.base);
  // `sumFor` is what keeps the package's pinned fifty thousand from being asked for on a base
  // the company will not issue under a hundred and fifty, which the engine would zero.
  const sumAssured = sumFor(base, numberFrom(one(query, "sa")) ?? IHEALTHY_OPENING.sumAssured);

  const { plan, territory, coverage } = resolveArrangement(table, age, {
    plan: one(query, "plan") ?? IHEALTHY_OPENING.plan,
    territory: labelFor(table.territories, one(query, "area")) ?? IHEALTHY_OPENING.territory,
    coverage: labelFor(table.coverages, one(query, "cover")) ?? IHEALTHY_OPENING.coverage,
  });

  /**
   * The modes are the ones the rate table prices, read off `modeFactors` rather than listed
   * again. `Object.hasOwn` and not `in`, because `?mode=constructor` is a name every object
   * answers to.
   */
  const wantedMode = one(query, "mode");
  const mode: PayMode = wantedMode !== undefined && Object.hasOwn(table.modeFactors, wantedMode)
    ? (wantedMode as PayMode)
    : IHEALTHY_OPENING.mode;

  // `has` and not the parsed list: an `r` that spells no rider at all is still the fold
  // saying it is empty, which is a different answer from a link that never mentions riders.
  const riders = Object.hasOwn(query, "r") ? ridersFrom(listOf(query, "r")) : undefined;

  return {
    age,
    sex,
    base: base.variant,
    sumAssured,
    riders,
    // `resolveArrangement` answers with nothing only where the rate table sells nothing at
    // all at this age, which no age inside the rider's own range is. The calculator draws an
    // empty card for that; a link has to hand the form three strings either way, and the
    // opening's own three are the ones the page would have used before the link arrived.
    plan: plan?.code ?? IHEALTHY_OPENING.plan,
    territory: territory ?? IHEALTHY_OPENING.territory,
    coverage: coverage ?? IHEALTHY_OPENING.coverage,
    mode,
  };
}

/**
 * The same arrangement as a query string.
 *
 * What goes in is what the card is pricing and not what the link that opened it asked for, so
 * that copying the address a second time reproduces the screen rather than the request: a
 * link asking for ซิลเวอร์ at eight is written back out as สมาร์ท.
 */
export function queryFrom(table: IHealthyTable, v: IHealthyInitial): string {
  const q = new URLSearchParams({
    age: String(v.age),
    sex: v.sex,
    base: v.base,
    sa: String(v.sumAssured),
    plan: v.plan,
    // A label this rate table cannot spell a letter for is one it cannot price either, so it
    // is written as the default's empty letter rather than as the word `undefined`.
    area: letterFor(table.territories, v.territory) ?? "",
    cover: letterFor(table.coverages, v.coverage) ?? "",
    mode: v.mode,
  });
  appendRiders(q, v.riders);
  return q.toString();
}

/**
 * The fold's answer, written into the address beside the arrangement.
 *
 * An agent who has emptied the fold has said something, and it is not the same thing as never
 * having opened it: a link that read the two alike would put the agency's standard daily cash
 * back into a quote the agent had just taken it out of. So an answered fold always writes an
 * `r`, empty when there is nothing in it, and an unanswered one writes none.
 */
function appendRiders(q: URLSearchParams, riders: AttachedRider[] | undefined): void {
  if (riders === undefined) return;
  const params = riderParams(riders);
  if (params.length === 0) q.append("r", "");
  else for (const r of params) q.append("r", r);
}

/**
 * The riders the agent has attached, written into the same address the arrangement is.
 *
 * One `r` per rider, its fields separated by colons in the order the engine takes them:
 * `r=MEB:1000`, `r=DCI::500000`, and a rider sold in named variants as `r=CODE:::แผน S`.
 * Positional and not named because the card
 * link already carries eight keys and these are three more apiece; an empty field is a field
 * this rider does not have, and trailing ones are simply not written.
 *
 * What it never carries is a premium. The picture is drawn from the engine's answer to these
 * codes, so a link edited by hand can ask for a different arrangement — which the engine
 * will refuse or re-price — and cannot make the agency advertise a figure it never quoted.
 */
export function riderParams(riders: AttachedRider[]): string[] {
  return riders.map((r) => {
    const fields = [r.code, r.plan ?? "", r.sumAssured ?? "", r.option ?? ""].map(String);
    while (fields.length > 1 && fields[fields.length - 1] === "") fields.pop();
    return fields.join(":");
  });
}

/** A whole number a link asked for, or nothing — an empty field and a word both say nothing. */
function countFrom(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/**
 * The most riders a link may name.
 *
 * Well above the two this page offers, and well under the engine's own bound — which refuses
 * the whole request rather than the surplus, so a link with four hundred `r` in it answered
 * with no riders on offer, a total of zero, and a fold the agent could not recover without
 * reloading. The bound is the base plan's rider list and is not this module's to know, so
 * this stays comfortably underneath any of them.
 */
const MOST_RIDERS = 8;

/**
 * The riders a link asks for. Nothing here decides whether they may be bought: the engine
 * measures each against this age and this base and drops the ones it will not write, which
 * is the same pass the fold's own ticks go through.
 *
 * One entry per code, the first of them, because that is what the fold itself holds — a
 * record keyed by code — so a link naming a rider twice opens the fold the way the link that
 * wrote it looked.
 *
 * A colon inside a variant's own code is kept rather than treated as another separator —
 * the option is the last field, so everything after the third colon belongs to it.
 */
export function ridersFrom(raw: string[]): AttachedRider[] {
  const byCode = new Map<string, AttachedRider>();
  for (const one of raw) {
    if (byCode.size >= MOST_RIDERS) break;
    const [code, plan, sum, ...rest] = one.split(":");
    if (code === undefined || code === "" || byCode.has(code)) continue;
    const option = rest.join(":");
    byCode.set(code, {
      code,
      ...(countFrom(plan) === undefined ? {} : { plan: countFrom(plan)! }),
      ...(countFrom(sum) === undefined ? {} : { sumAssured: countFrom(sum)! }),
      ...(option === "" ? {} : { option }),
    });
  }
  return [...byCode.values()];
}

/**
 * The arrangement as a card asks for it: the page's own query, plus the fingerprint of the
 * palette the health cards are drawn in.
 *
 * Only the pictures carry it. `queryFrom` also writes the address bar and the link the
 * assistant sends to the sales page, and neither is cached on its colours — a `v` there would
 * be a parameter the reader has to look at and nothing would ever read.
 */
export function cardQuery(table: IHealthyTable, v: IHealthyInitial): string {
  // Bump this when the card input contract changes. Without a cache key, an image already
  // cached by a browser, Messenger, or a CDN can survive after the calculator has switched
  // from the old 150,000-baht base to the 50,000-baht Health Ultra Package. 7: drawn with
  // satori 0.33, which stacks Thai tone marks (src/lib/draw-png.ts).
  return `${queryFrom(table, v)}&v=${cardPaletteVersion(CARD_PALETTE)}&cv=7`;
}

/**
 * Where the same quote is drawn as a picture: the arrangement on screen, and the riders
 * attached to it, in one address the route can price from scratch.
 *
 * `lang` is the language the page is being read in, so the saved picture says what the
 * screen says. Thai is left out of the address, which keeps every Thai link as it was.
 */
export function cardPath(table: IHealthyTable, v: IHealthyInitial, lang: Lang = "th"): string {
  return `/api/ihealthy-card?${cardQuery(table, v)}${lang === "th" ? "" : `&l=${lang}`}`;
}
