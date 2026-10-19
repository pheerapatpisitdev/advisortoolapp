import { describe, expect, it } from "vitest";
import { alertText, fresh, GEMINI_VOICE, lasted, reason, step, voiceDue, type Health } from "@/lib/ai/health-rules";

const T0 = "2026-10-19T07:30:00Z"; // 14:30 in Bangkok
const T1 = "2026-10-19T08:00:00Z";
const T2 = "2026-10-19T09:00:00Z"; // 16:00
const LINK = "https://www.advisortool.app/admin/ai";
const ok = (provider: string): Health => ({ ...fresh(provider), lastChecked: T1 });

describe("one provider's standing", () => {
  it("tells nobody about a single failed check", () => {
    const { next, event } = step(fresh("google"), { ok: false, error: "x 429: quota" }, T0);
    expect(event).toBeNull();
    expect(next).toMatchObject({ ok: false, fails: 1, downSince: T0, alerted: false });
  });

  it("tells the owner on the second failure in a row, dated from the first", () => {
    const once = step(fresh("google"), { ok: false, error: "a" }, T0).next;
    const { next, event } = step(once, { ok: false, error: "x 429: quota" }, T1);
    expect(event).toEqual({ kind: "down", provider: "google", since: T0, error: "x 429: quota" });
    expect(next.alerted).toBe(true);
  });

  it("does not tell again while it stays down", () => {
    let h = fresh("google");
    for (const t of [T0, T1]) h = step(h, { ok: false, error: "e" }, t).next;
    expect(step(h, { ok: false, error: "e" }, T2).event).toBeNull();
  });

  it("says it came back only when the down message went out", () => {
    const once = step(fresh("google"), { ok: false, error: "e" }, T0).next;
    expect(step(once, { ok: true }, T1).event).toBeNull();
    const twice = step(once, { ok: false, error: "e" }, T1).next;
    const back = step(twice, { ok: true }, T2);
    expect(back.event).toEqual({ kind: "up", provider: "google", since: T0, at: T2 });
    expect(back.next).toMatchObject({ ok: true, fails: 0, downSince: null, alerted: false });
  });
});

describe("Gemini's voice", () => {
  const now = Date.parse(T2);
  it("is asked on the first run, every two hours, and every run while failing", () => {
    expect(voiceDue(undefined, now)).toBe(true);
    expect(voiceDue({ ...fresh(GEMINI_VOICE), lastChecked: "2026-10-19T08:30:00Z" }, now)).toBe(false);
    expect(voiceDue({ ...fresh(GEMINI_VOICE), lastChecked: "2026-10-19T07:02:00Z" }, now)).toBe(true);
    expect(voiceDue({ ...fresh(GEMINI_VOICE), lastChecked: "2026-10-19T08:30:00Z", fails: 1 }, now)).toBe(true);
  });
});

describe("the reason in the owner's words", () => {
  it("reads an empty balance as top up, before its status", () => {
    expect(reason("api.anthropic.com 400: Your credit balance is too low")).toMatch(/^เงินในบัญชี.*\(400\)$/);
    expect(reason("api.openai.com 429: insufficient_quota")).toMatch(/^เงินในบัญชี/);
  });
  it("reads keys, quotas, outages and silence", () => {
    expect(reason("api.z.ai 401: invalid")).toBe("กุญแจใช้ไม่ได้หรือหมดอายุ ต้องใส่กุญแจใหม่ (401)");
    expect(reason("generativelanguage.googleapis.com 429: RESOURCE_EXHAUSTED")).toBe("เกินโควตา หรือเครดิตหมด (429)");
    expect(reason("openrouter.ai 503: busy")).toBe("ฝั่งผู้ให้บริการล่ม รอเขาแก้ (503)");
    expect(reason("ไม่ตอบภายใน 15 วินาที")).toBe("ไม่ตอบภายใน 15 วินาที");
  });
});

describe("how long it lasted", () => {
  it("counts hours and minutes", () => {
    expect(lasted(T0, T2)).toBe("1 ชม. 30 นาที");
    expect(lasted(T0, T1)).toBe("30 นาที");
    expect(lasted(T0, "2026-10-21T10:30:00Z")).toBe("2 วัน 3 ชม.");
  });
});

describe("the LINE message", () => {
  const googleDown: Health = { ...fresh("google"), ok: false, fails: 2, downSince: T0, lastChecked: T1, alerted: true };

  it("says nothing when nothing changed", () => {
    expect(alertText([], [ok("anthropic")], LINK)).toBeNull();
  });

  it("names the provider, the reason, the time, and who answers instead", () => {
    const text = alertText(
      [{ kind: "down", provider: "google", since: T0, error: "x 429: quota" }],
      [ok("anthropic"), ok("openai"), googleDown, ok("elevenlabs")], LINK,
    )!;
    expect(text).toContain("⚠️ AI ใช้ไม่ได้\nGoogle (Gemini)\nสาเหตุ: เกินโควตา หรือเครดิตหมด (429)\nตั้งแต่ 14:30 น. · ตรวจไม่ผ่าน 2 รอบติด");
    expect(text).toContain("บอทยังตอบลูกค้าได้ ใช้ Anthropic, OpenAI แทน");
    expect(text.endsWith(LINK)).toBe(true);
  });

  it("says the voice falls back to ElevenLabs when only the voice is down", () => {
    const voiceDown: Health = { ...googleDown, provider: GEMINI_VOICE };
    const text = alertText([{ kind: "down", provider: GEMINI_VOICE, since: T0, error: "429" }], [ok("google"), voiceDown, ok("elevenlabs")], LINK)!;
    expect(text).toContain("เสียงพากย์ Gemini");
    expect(text).toContain("เสียงพากย์คลิปจะเปลี่ยนไปใช้ ElevenLabs");
    expect(text).not.toContain("บอทยังตอบ");
  });

  it("shouts when every writer is down", () => {
    const down = (p: string): Health => ({ ...googleDown, provider: p });
    const text = alertText(
      [{ kind: "down", provider: "anthropic", since: T0, error: "500" }],
      [down("anthropic"), down("openai"), down("google"), ok("elevenlabs")], LINK,
    )!;
    expect(text).toMatch(/^🚨 AI ตอบไม่ได้ทุกเจ้า\nAnthropic · OpenAI · Google \(Gemini\)\nบอทตอบลูกค้าไม่ได้/);
    expect(text).not.toContain("⚠️");
  });

  it("says when it came back, with no link", () => {
    const text = alertText([{ kind: "up", provider: "google", since: T0, at: T2 }], [ok("google")], LINK)!;
    expect(text).toBe("✅ AI กลับมาใช้ได้แล้ว\nGoogle (Gemini)\nใช้ไม่ได้ 1 ชม. 30 นาที (14:30–16:00 น.)");
  });
});
