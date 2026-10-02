/**
 * The address of a plan page, read the way the iHealthy page reads its own.
 *
 * Awaited inside a try for one address only. Next defines every key of the query as a getter
 * on the promise it hands over, and skips only the property names on its own well-known list.
 * `constructor` is not one of them, so `?constructor=1` leaves the promise with a string where
 * its constructor should be and `await` throws in the language itself, above anything a page
 * is in a position to validate. The re-throw is what keeps this from swallowing anything
 * else: an aborted prerender arrives as a throw too, and it does not arrive on a promise whose
 * own constructor has been overwritten.
 */
export type PageQuery = Record<string, string | string[] | undefined>;

export async function readQuery(searchParams: Promise<PageQuery>): Promise<PageQuery> {
  try {
    return await searchParams;
  } catch (thrown) {
    // Tight on the one failure it is for, so a future Next version cannot route something
    // else quietly through this branch.
    if (!(thrown instanceof TypeError) || !Object.hasOwn(searchParams, "constructor")) throw thrown;
    return {};
  }
}
