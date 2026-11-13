import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptDeviceName, rewriteScene, writeStory } from "@/lib/prompt-story/writer";
import { checkedPromptStory, REWRITES_DONE, REWRITES_PER_DRAFT } from "@/lib/prompt-story/checked";
import { checkDevice, checkScript, deviceAllowed } from "@/lib/prompt-story/check";
import { FORBIDDEN } from "@/lib/quote-video/brief";
import { DEVICES } from "@/lib/scene-library/devices";

/** health devices picked by the writer, its formats, and one scene written again (Task 9) */

const BRIEF = "ค่าห้องจริงคืนละ 6000 บาท แต่แผนจ่ายแค่ 4000 บาท";
const sc = (o: Record<string, unknown> = {}) => ({ voice: "เข้าโรงพยาบาลทีไรค่าห้องแพงขึ้นทุกปีค่ะ", screen: "ค่าห้องแพงขึ้นทุกปี", picture: "ผู้หญิงนั่งคิดในห้องพักผู้ป่วย", showFigure: false, ...o });
const room = (o: Record<string, unknown> = {}) => ({ layout: "room", title: ["ค่าห้องจริง", "กับที่แผนจ่าย"], plan: 4000, real: 6000, planName: "แผนเดิม", ...o });
const reply = (scenes: unknown[], o: Record<string, unknown> = {}) => JSON.stringify({ onTopic: true, refusal: "", title: "ค่าห้องพอไหม", caption: "ลองเช็กแผนกันค่ะ", scenes, ...o });

describe("writeStory picks devices", () => {
  it("keeps a valid device as given", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc({ picture: "", device: room() }), sc()]));
    const r = await writeStory({ brief: BRIEF, scenes: 3, ask });
    if (!r.ok) throw new Error("not ok");
    expect(r.scenes[1].device).toEqual(room());
    expect(r.scenes[1].picture).toBe("");
    expect(r.notes).toEqual([]);
    expect(r.scenes[0].device).toBeUndefined();
  });

  it("a device number not in the brief: the scene stays a picture scene, its picture from the reply's or the screen words", async () => {
    const ask = vi.fn().mockResolvedValue(reply([
      sc({ picture: "เตียงผู้ป่วยในห้องพัก", device: room({ real: 7000 }) }),
      sc({ screen: "ค่าห้องจริง 6000 บาท", picture: "", device: room({ real: 7000 }) }),
      sc(),
    ]));
    const r = await writeStory({ brief: BRIEF, scenes: 3, ask });
    if (!r.ok) throw new Error("not ok");
    expect(r.scenes[0].device).toBeUndefined();
    expect(r.scenes[0].picture).toBe("เตียงผู้ป่วยในห้องพัก");
    expect(r.scenes[1].device).toBeUndefined();
    expect(r.scenes[1].picture).toContain("ค่าห้องจริง");
    expect(r.scenes[1].picture).not.toMatch(/\d/);
    expect(r.notes).toEqual([]);
  });

  it("more devices than half the scenes: the extra ones become picture scenes", async () => {
    const ask = vi.fn().mockResolvedValue(reply(Array.from({ length: 5 }, () => sc({ device: room() }))));
    const r = await writeStory({ brief: BRIEF, scenes: 5, ask });
    if (!r.ok) throw new Error("not ok");
    expect(r.scenes.filter((s) => s.device)).toHaveLength(2);
    expect(r.scenes[0].device && r.scenes[1].device).toBeTruthy();
    for (const s of r.scenes.slice(2)) {
      expect(s.device).toBeUndefined();
      expect(s.picture).toBeTruthy();
    }
    const three = await writeStory({ brief: BRIEF, scenes: 3, ask: vi.fn().mockResolvedValue(reply([sc({ device: room() }), sc({ device: room() }), sc({ device: room() })])) });
    if (!three.ok) throw new Error("not ok");
    expect(three.scenes.filter((s) => s.device)).toHaveLength(1);
  });

  it("the cap holds across the second ask too", async () => {
    const first = reply([sc({ device: room() }), sc({ voice: "ปีละ 99,999 บาท" }), sc()]);
    const again = reply([sc(), sc({ device: room() }), sc()]);
    const ask = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(again);
    const r = await writeStory({ brief: BRIEF, scenes: 3, ask });
    if (!r.ok) throw new Error("not ok");
    expect(ask).toHaveBeenCalledTimes(2);
    expect(r.scenes.filter((s) => s.device)).toHaveLength(1);
    expect(r.scenes.every((s) => s.device || s.picture)).toBe(true);
  });

  it("the system prompt lists every device, its fields, the half cap, the number and word rules", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc(), sc(), sc(), sc(), sc(), sc()]));
    await writeStory({ brief: BRIEF, scenes: 8, ask });
    const system = ask.mock.calls[0][0] as string;
    for (const d of DEVICES) {
      expect(system).toContain(`${d.key} (${promptDeviceName(d)})`);
      expect(system).toContain(d.when);
      expect(system).toContain(`"layout":"${d.key}"`);
      for (const f of [...d.numberFields, ...d.wordFields]) expect(system).toContain(`"${f}"`);
    }
    expect(system).toContain("ไม่เกิน 4 ฉาก");
    // every device line the model reads is free of the words no script may say (agecost's own name has เบี้ย)
    const deviceLines = system.split("\n").filter((l) => DEVICES.some((d) => l.startsWith(`- ${d.key} (`)));
    expect(deviceLines).toHaveLength(DEVICES.length);
    for (const l of deviceLines) for (const x of FORBIDDEN) expect(x.re.test(l), `${x.why}: ${l}`).toBe(false);
    expect(system).toContain("ค่าประกันสุขภาพต่อปีสูงขึ้นตามช่วงอายุ");
    expect(system).not.toContain("อายุน้อยยิ่งดี");
    expect(system).toMatch(/agecost: ทุกช่องข้อความ \(title และ source\) ห้ามใช้คำว่า เบี้ย/);
    // planName's shape reads as JSON
    expect(system).toContain(`"planName":"ชื่อแผน (ไม่มีให้ใส่ว่าง)"`);
    expect(system).not.toContain(`หรือ ""`);
    expect(system).toContain("ค่าประกันสุขภาพ");
    expect(system).toMatch(/ตัวเลขที่ใช้ในอุปกรณ์ได้: .*4000.*6000|ตัวเลขที่ใช้ในอุปกรณ์ได้: .*6000.*4000/);
  });

  it("the forbidden words, generated from the check's own lists, are told once for every word and the device words", async () => {
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
    await writeStory({ brief: BRIEF, scenes: 3, ask });
    const system = ask.mock.calls[0][0] as string;
    const line = system.split("\n").find((l) => l.includes("ห้ามมีคำเหล่านี้"));
    expect(line).toBeTruthy();
    for (const w of ["เบี้ย", "เสียชีวิต", "ตาย", "เวนคืน", "%", "ผลตอบแทน", "ดอกเบี้ย", "กำไร", "ปันผล", "การันตี", "ไม่มีความเสี่ยง", "ทันที", "Allianz"]) expect(line).toContain(w);
    for (const r of ["ห้ามมีคำทักทาย", "ห้ามใช้เลขไทย", "ห้ามเขียนตัวเลขเป็นคำ", "ห้ามมีลิงก์", "ห้ามมีอีโมจิ", "ห้ามสัญญาว่าไม่ต้องตรวจสุขภาพ"]) expect(line).toContain(r);
    expect(system.split("\n").filter((l) => l.includes("ห้ามมีคำเหล่านี้"))).toHaveLength(1);
    expect(system).toContain("ทำตามกฎเดียวกับคำพูดข้างบนทุกข้อ");
  });

  it("the format's structure: รีวิวเคสเคลม has the five beats and no customer name; ตามโจทย์ neither", async () => {
    const beats = "อาการ → ค่ารักษา → ประกันจ่าย → ส่วนที่จ่ายเอง → บทเรียน";
    const sys = async (format?: "free" | "drama3" | "claimreview") => {
      const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
      await writeStory({ brief: BRIEF, scenes: 3, format, ask });
      return ask.mock.calls[0][0] as string;
    };
    const claim = await sys("claimreview");
    expect(claim).toContain("ห้ามใส่ชื่อลูกค้า");
    expect(claim).toContain(beats);
    for (const s of [await sys("free"), await sys()]) {
      expect(s).not.toContain("ห้ามใส่ชื่อลูกค้า");
      expect(s).not.toContain(beats);
      expect(s).not.toContain("ชีวิตปกติ → เหตุไม่คาดฝัน → ทางออก");
    }
    expect(await sys("drama3")).toContain("ชีวิตปกติ → เหตุไม่คาดฝัน → ทางออก");
    // fewer scenes than its five beats: neighbouring beats merged
    expect(claim).toContain("ถ้าฉากน้อยกว่า 5 ให้รวมช่วงที่ติดกัน");
  });

  it("a device's numbers never take the spoken millions: ทุน 3,000,000 allows 3000000, not 3", async () => {
    const brief = "ทุน 3,000,000";
    const limit = (n: number) => ({ layout: "limit", title: ["วงเงินต่อปี", ""], limit: n, planName: "" });
    expect(typeof checkDevice(limit(3), deviceAllowed(brief))).toBe("string");
    expect(checkDevice(limit(3_000_000), deviceAllowed(brief))).toMatchObject({ limit: 3_000_000 });
    // "3 ล้าน" written in the brief: the device takes 3000000 only; a word may still say "3 ล้าน"
    expect(typeof checkDevice(limit(3), deviceAllowed("ทุน 3 ล้าน"))).toBe("string");
    expect(checkDevice(limit(3_000_000), deviceAllowed("ทุน 3 ล้าน"))).toMatchObject({ limit: 3_000_000 });
    expect(checkDevice({ ...limit(3_000_000), planName: "ทุน 3 ล้าน" }, deviceAllowed(brief))).toMatchObject({ planName: "ทุน 3 ล้าน" });
    // the writer, the script check and the form all hold devices to it; the voice still may say "3 ล้าน"
    const r = await writeStory({ brief, scenes: 3, ask: vi.fn().mockResolvedValue(reply([sc({ voice: "ทุน 3 ล้านค่ะ", device: limit(3) }), sc({ device: limit(3_000_000) }), sc()])) });
    if (!r.ok) throw new Error("not ok");
    expect(r.scenes[0].device).toBeUndefined();
    expect(r.scenes[0].voice).toBe("ทุน 3 ล้านค่ะ");
    expect(r.notes).toEqual([]);
    const bad = [sc({ device: limit(3) }), sc(), sc()] as Parameters<typeof checkScript>[0];
    expect(checkScript(bad, brief).map((p) => p.scene)).toEqual([0]);
    const form = checkedPromptStory({ draftId: "5853e0d0-6fbf-4a38-91d5-474b108a4905", brief, title: "t", caption: "c", scenes: [sc({ device: limit(3) }), sc({ device: limit(3_000_000) }), sc()], style: "paper", painter: "standard" }, "F");
    if (typeof form === "string") throw new Error(form);
    expect(form.scenes[0].device).toBeUndefined();
    expect(form.scenes[1].device).toMatchObject({ limit: 3_000_000 });
    // the model is shown the figures as written
    const ask = vi.fn().mockResolvedValue(reply([sc(), sc(), sc()]));
    await writeStory({ brief, scenes: 3, ask });
    expect((ask.mock.calls[0][0] as string).split("\n")).toContain("- ตัวเลขที่ใช้ในอุปกรณ์ได้: 3000000");
  });
});

describe("rewriteScene", () => {
  const draft = [sc({ voice: "ฉากแรกค่ะ" }), sc({ voice: "ฉากสองค่ะ", device: room() }), sc({ voice: "ฉากสามค่ะ" })];
  it("writes one scene again, the others told to the model", async () => {
    const ask = vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ voice: "ฉากสามแบบใหม่ค่ะ" }) }));
    const r = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 2, ask });
    expect(r).toEqual({ ok: true, scene: { voice: "ฉากสามแบบใหม่ค่ะ", screen: "ค่าห้องแพงขึ้นทุกปี", picture: "ผู้หญิงนั่งคิดในห้องพักผู้ป่วย" } });
    expect(ask.mock.calls[0].join("\n")).toContain("ฉากสองค่ะ");
    expect(ask.mock.calls[0][1]).toContain("ฉากที่ 3");
  });
  it("a device over the half cap, or with a stray number, becomes a picture scene", async () => {
    const over = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 0, ask: vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ device: room() }) })) });
    expect(over.ok && over.scene.device).toBeFalsy();
    const own = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 1, ask: vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ device: room({ plan: 4000, real: 6000 }) }) })) });
    expect(own.ok && own.scene.device).toEqual(room());
    const stray = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 1, ask: vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ picture: "", device: room({ real: 9000 }) }) })) });
    expect(stray.ok && stray.scene.device).toBeFalsy();
    expect(stray.ok && stray.scene.picture).toBe("ค่าห้องแพงขึ้นทุกปี");
  });
  it("tells the model whether THIS scene may hold a device, and keeps its figure card", async () => {
    const said = async (scenes: Record<string, unknown>[], scene: number, figure?: unknown) => {
      const ask = vi.fn().mockResolvedValue(JSON.stringify({ scene: sc() }));
      const r = await rewriteScene({ brief: BRIEF, scenes: scenes as never, scene, figure: figure as never, ask });
      return { user: ask.mock.calls[0][1] as string, r };
    };
    expect((await said(draft, 0)).user).toContain("ฉากนี้ห้ามใช้อุปกรณ์");
    expect((await said(draft, 1)).user).toContain("ฉากนี้ใช้อุปกรณ์ได้");
    const figure = { plan: "LIFEPROTECT", variant: "x", sex: "M", age: 40, sumAssured: 3_000_000, annual: 99_999, monthly: 8_400 };
    const withCard = [sc(), sc({ showFigure: true }), sc()];
    const kept = await said(withCard, 1, figure);
    expect(kept.user).toContain("ฉากนี้เป็นฉากที่โชว์ตัวเลขแผน ให้ showFigure เป็น true");
    expect(kept.r.ok && kept.r.scene.showFigure).toBe(true);
    const other = await said(withCard, 0, figure);
    expect(other.user).toContain("showFigure เป็น false");
    expect(other.r.ok && other.r.scene.showFigure).toBeFalsy();
  });

  it("a scene breaking the rules twice is refused in Thai; the AI down too", async () => {
    const bad = vi.fn().mockResolvedValue(JSON.stringify({ scene: sc({ voice: "รับประกันผลตอบแทน" }) }));
    const r = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 0, ask: bad });
    expect(bad).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(false);
    expect(!r.ok && /[ก-๙]/.test(r.error)).toBe(true);
    const down = await rewriteScene({ brief: BRIEF, scenes: draft, scene: 0, ask: vi.fn().mockRejectedValue(new Error("down")) });
    expect(down.ok).toBe(false);
  });
});

// ---- rewritePromptScene: the server action over an in-memory ins_prompt_drafts ----

const DRAFT = "5853e0d0-6fbf-4a38-91d5-474b108a4905";
type Row = { id: string; agent_id: string; brief: unknown; script: Record<string, unknown>; made_clip_id: string | null };
const db = vi.hoisted(() => ({ rows: [] as Row[] }));
const chat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/client", () => ({ chat: (...a: unknown[]) => chat(...a) }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => ({ kind: "unitos", agentId: "agent-1", name: "ตัวแทน", staff: { owner: true } }) }));
vi.mock("@/lib/prompt-story/access", () => ({ mayPromptStory: () => true, PROMPT_STORY_CLOSED: "ปิด" }));
vi.mock("@/lib/switches/store", () => ({ closedFor: async () => null }));
vi.mock("@/lib/supabase/admin", () => {
  /** a filter on a column or a `script->>key` path */
  const valueAt = (row: Record<string, unknown>, col: string) => {
    const [c, key] = col.split("->>");
    const v = row[c];
    if (key === undefined) return v;
    const x = (v as Record<string, unknown> | null)?.[key];
    return x === undefined || x === null ? null : String(x);
  };
  const query = () => {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let patch: Record<string, unknown> | null = null;
    const run = () => {
      const hit = (db.rows as unknown as Record<string, unknown>[]).filter((r) => filters.every((f) => f(r)));
      if (patch) for (const r of hit) Object.assign(r, structuredClone(patch));
      return structuredClone(hit);
    };
    const q = {
      select: () => q,
      update: (p: Record<string, unknown>) => { patch = p; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => valueAt(r, c) === v); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (valueAt(r, c) ?? null) === v); return q; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
    };
    return q;
  };
  return { supabaseAdmin: () => ({ from: () => query() }) };
});

const { rewritePromptScene } = await import("@/app/studio/prompt-story/actions");

describe("rewritePromptScene", () => {
  beforeEach(() => {
    db.rows = [{ id: DRAFT, agent_id: "agent-1", brief: { brief: BRIEF, scenes: 3, figure: null, format: "claimreview" }, script: { title: "t", caption: "c", scenes: [sc({ voice: "หนึ่งค่ะ" }), sc({ voice: "สองค่ะ" }), sc({ voice: "สามค่ะ" })], notes: [] }, made_clip_id: null }];
    chat.mockReset();
    chat.mockImplementation(async () => ({ text: JSON.stringify({ scene: sc({ voice: "ฉากใหม่ค่ะ" }) }) }));
  });

  it("three per draft, free; the fourth is refused in Thai without asking the AI", async () => {
    expect(REWRITES_PER_DRAFT).toBe(3);
    for (let i = 1; i <= 3; i++) {
      const r = await rewritePromptScene(DRAFT, 1);
      expect(r).toEqual({ ok: true, scene: { voice: "ฉากใหม่ค่ะ", screen: "ค่าห้องแพงขึ้นทุกปี", picture: "ผู้หญิงนั่งคิดในห้องพักผู้ป่วย" }, left: 3 - i });
    }
    expect(chat).toHaveBeenCalledTimes(3);
    expect(await rewritePromptScene(DRAFT, 1)).toEqual({ ok: false, error: "เขียนฉากใหม่ครบ 3 ครั้งแล้ว" });
    expect(REWRITES_DONE).toBe("เขียนฉากใหม่ครบ 3 ครั้งแล้ว");
    expect(chat).toHaveBeenCalledTimes(3);
    // the count and the new scene live in the draft's own script
    expect(db.rows[0].script.rewrites).toBe(3);
    expect((db.rows[0].script.scenes as { voice: string }[])[1].voice).toBe("ฉากใหม่ค่ะ");
    // the draft's format reached the model
    expect(String(chat.mock.calls[0][0].messages[0].content)).toContain("ห้ามใส่ชื่อลูกค้า");
  });

  it("a failed AI rewrite still uses one, and says how many are left", async () => {
    chat.mockImplementation(async () => ({ text: "not json" }));
    const r = await rewritePromptScene(DRAFT, 1);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.left).toBe(2);
    expect(db.rows[0].script.rewrites).toBe(1);
  });

  it("two presses at once take two of the three, never more than three", async () => {
    db.rows[0].script.rewrites = 2;
    const both = await Promise.all([rewritePromptScene(DRAFT, 0), rewritePromptScene(DRAFT, 2)]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(db.rows[0].script.rewrites).toBe(3);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("turns away someone else's draft, a made draft, a bad id or scene", async () => {
    expect((await rewritePromptScene("x", 0)).ok).toBe(false);
    expect((await rewritePromptScene(DRAFT, 3)).ok).toBe(false);
    expect((await rewritePromptScene(DRAFT, -1)).ok).toBe(false);
    db.rows[0].agent_id = "agent-2";
    expect((await rewritePromptScene(DRAFT, 0)).ok).toBe(false);
    db.rows[0].agent_id = "agent-1";
    db.rows[0].made_clip_id = "11111111-1111-1111-1111-111111111111";
    expect((await rewritePromptScene(DRAFT, 0)).ok).toBe(false);
    expect(chat).not.toHaveBeenCalled();
  });
});
