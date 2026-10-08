import { beforeEach, describe, expect, it, vi } from "vitest";
import { historyDb } from "../helpers/fake-history-db";

/**
 * A member's history of pictures read into prompts: their thumbnail and prompt, latest 200,
 * theirs alone. What matters is whose rows a call can touch, and that nothing is left half-saved.
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { historyDb: fake } = await import("../helpers/fake-history-db");
  return { supabaseAdmin: () => fake.client };
});

const { HISTORY_MAX, MAX_THUMB_BASE64, clearReadings, deleteReading, isThumbBase64, listReadings, saveReading } =
  await import("@/lib/content/describe-history");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THUMB = "/9j/" + "A".repeat(100);
const reading = (n = 0) => ({ prompt: `Subject: reading ${n}`, summaryTh: "ครอบครัวในสวน", palette: [{ hex: "#C41E3A", share: 38 }], thumbBase64: THUMB });

beforeEach(() => historyDb.reset());

describe("isThumbBase64", () => {
  it("takes a base64 JPEG within the limit", () => {
    expect(HISTORY_MAX).toBe(200);
    expect(isThumbBase64(THUMB)).toBe(true);
  });

  it.each([
    ["a PNG", "iVBORw0KGgo" + "A".repeat(100)],
    ["not a string", 42],
    ["too long", "/9j/" + "A".repeat(MAX_THUMB_BASE64)],
    ["characters that are not base64", "/9j/ AAAA!"],
    ["empty", ""],
  ])("turns away %s", (_name, v) => {
    expect(isThumbBase64(v)).toBe(false);
  });
});

describe("saveReading", () => {
  it("stores the thumbnail under the member's folder, then the row that points at it", async () => {
    const id = await saveReading(A, { ...reading(), summaryTh: "ก".repeat(400) });
    expect([...historyDb.files.keys()]).toEqual([`${A}/${id}.jpg`]);
    expect(historyDb.rows).toHaveLength(1);
    expect(historyDb.rows[0]).toMatchObject({
      id, agent_id: A, prompt: "Subject: reading 0", thumb_path: `${A}/${id}.jpg`, palette: [{ hex: "#C41E3A", share: 38 }],
    });
    expect((historyDb.rows[0].summary_th as string).length).toBe(300);
  });

  it("takes the thumbnail back when the row cannot be written", async () => {
    historyDb.failNext.insert = true;
    await expect(saveReading(A, reading())).rejects.toThrow();
    expect(historyDb.files.size).toBe(0);
    expect(historyDb.rows).toHaveLength(0);
  });

  it("writes no row when the thumbnail cannot be stored", async () => {
    historyDb.failNext.upload = true;
    await expect(saveReading(A, reading())).rejects.toThrow();
    expect(historyDb.rows).toHaveLength(0);
  });

  it("keeps the latest 200 of a member and deletes the oldest, row and file, leaving others alone", async () => {
    for (let i = 0; i < 5; i++) await saveReading(B, reading(i));
    const ids: string[] = [];
    for (let i = 0; i <= HISTORY_MAX; i++) ids.push(await saveReading(A, reading(i)));
    const mine = historyDb.rows.filter((r) => r.agent_id === A);
    expect(mine).toHaveLength(HISTORY_MAX);
    expect(mine.some((r) => r.id === ids[0])).toBe(false);
    expect(mine.some((r) => r.id === ids[HISTORY_MAX])).toBe(true);
    expect(historyDb.files.has(`${A}/${ids[0]}.jpg`)).toBe(false);
    expect([...historyDb.files.keys()].filter((p) => p.startsWith(`${A}/`))).toHaveLength(HISTORY_MAX);
    expect(historyDb.rows.filter((r) => r.agent_id === B)).toHaveLength(5);
    expect([...historyDb.files.keys()].filter((p) => p.startsWith(`${B}/`))).toHaveLength(5);
  });

  it("refuses an agent id that is not a UUID, before any call", async () => {
    await expect(saveReading("not-a-uuid", reading())).rejects.toThrow();
    expect(historyDb.calls).toBe(0);
  });
});

describe("listReadings", () => {
  it("lists only the member's own, newest first, with a link to each thumbnail", async () => {
    const first = await saveReading(A, reading(1));
    await saveReading(B, reading(2));
    const last = await saveReading(A, reading(3));
    const list = await listReadings(A);
    expect(list.map((r) => r.id)).toEqual([last, first]);
    expect(list[0]).toMatchObject({
      prompt: "Subject: reading 3", summaryTh: "ครอบครัวในสวน", palette: [{ hex: "#C41E3A", share: 38 }], thumbUrl: `https://signed.test/${A}/${last}.jpg`,
    });
    expect(typeof list[0].createdAt).toBe("string");
  });

  it("lists an item whose thumbnail file is gone, with no link, and the rest as usual", async () => {
    const one = await saveReading(A, reading(1));
    const two = await saveReading(A, reading(2));
    historyDb.files.delete(`${A}/${one}.jpg`);
    const list = await listReadings(A);
    expect(list.find((r) => r.id === one)?.thumbUrl).toBeNull();
    expect(list.find((r) => r.id === two)?.thumbUrl).toBe(`https://signed.test/${A}/${two}.jpg`);
  });

  it("is empty for a member with no history, and for an agent id that is not a UUID", async () => {
    expect(await listReadings(A)).toEqual([]);
    expect(await listReadings("nope")).toEqual([]);
  });
});

describe("deleteReading and clearReadings", () => {
  it("never reach another member's reading, whatever id they are given", async () => {
    const theirs = await saveReading(B, reading(1));
    await deleteReading(A, theirs);
    await clearReadings(A);
    expect(historyDb.rows).toHaveLength(1);
    expect(historyDb.files.has(`${B}/${theirs}.jpg`)).toBe(true);
  });

  it("deletes one of the member's own, row and file", async () => {
    const keep = await saveReading(A, reading(1));
    const drop = await saveReading(A, reading(2));
    await deleteReading(A, drop);
    expect(historyDb.rows.map((r) => r.id)).toEqual([keep]);
    expect([...historyDb.files.keys()]).toEqual([`${A}/${keep}.jpg`]);
  });

  it("does nothing, and asks nothing, for an id that is not a UUID", async () => {
    await deleteReading(A, "not-a-uuid");
    expect(historyDb.calls).toBe(0);
  });

  it("clears all of the member's own and none of anyone else's", async () => {
    await saveReading(A, reading(1));
    await saveReading(A, reading(2));
    const other = await saveReading(B, reading(3));
    await clearReadings(A);
    expect(historyDb.rows.map((r) => r.id)).toEqual([other]);
    expect([...historyDb.files.keys()]).toEqual([`${B}/${other}.jpg`]);
  });
});
