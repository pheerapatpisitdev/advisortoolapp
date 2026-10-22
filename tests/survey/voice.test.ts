import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, bangkokToday } from "@/lib/survey/answers";
import { firstName, LINE_KEYS, scriptLine, spokenDay } from "@/lib/survey/script";

/**
 * บทพูดมีเสียง (owner, 2026-10-22, mockup 6eXVC2yugSk2rhBRok4Kv2 ข): the voice reads only the
 * script, built on the server from a line's key, with the signed-in agent's own name.
 */
const viewer = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
const voice = vi.hoisted(() => ({ surveyVoiceUrl: vi.fn(async () => "https://signed/line.wav") }));
vi.mock("@/lib/survey/voice", () => voice);
vi.mock("@/lib/fhc/customers", () => ({ saveSurveyCustomer: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { speakSurveyLine } = await import("@/app/survey/actions");
const { voicePath, wavOf } = await vi.importActual<typeof import("@/lib/survey/voice")>("@/lib/survey/voice");

const CTX = { female: false, agentName: "เอก", top: null, decider: null, date: "", time: "" };

beforeEach(() => vi.clearAllMocks());

describe("the script", () => {
  it("has a line for every key, in ครับ or ค่ะ", () => {
    for (const k of LINE_KEYS.filter((k) => k !== "close")) {
      expect(scriptLine(k, CTX), k).not.toBe("");
      expect(scriptLine(k, { ...CTX, female: true }), k).not.toMatch(/ครับ|ผม/);
    }
    expect(scriptLine("open", CTX)).toMatch(/^สวัสดีครับ ผมเอก /);
    expect(scriptLine("open", { ...CTX, female: true, agentName: "เอ" })).toMatch(/^สวัสดีค่ะ ดิฉันเอ /);
  });

  it("names the worry, who comes along, and the meeting as it is said aloud", () => {
    expect(scriptLine("budget", { ...CTX, top: "education" })).toContain("ดูแลเรื่องทุนการศึกษาลูกได้");
    expect(scriptLine("place", { ...CTX, decider: "spouse" })).toContain("นั่งคุยพร้อมคู่สมรส");
    expect(scriptLine("close", { ...CTX, date: "2026-10-25", time: "15:00" })).toContain("วันอาทิตย์ที่ 25 ตุลาคม บ่ายสามโมง");
    expect(scriptLine("close", { ...CTX, date: "2026-10-25", time: "" })).toBe("");
    expect(spokenDay("2026-11-02")).toBe("วันจันทร์ที่ 2 พฤศจิกายน");
    expect(firstName("  สุรชัย ใจดี ")).toBe("สุรชัย");
  });
});

describe("the voice of a line", () => {
  it("is kept by its voice and words", () => {
    const a = voicePath("ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้างครับ", false);
    expect(a).toMatch(/^survey-voice\/[0-9a-f]{40}\.wav$/);
    expect(voicePath("ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้างครับ", false)).toBe(a);
    expect(voicePath("ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้างครับ", true)).not.toBe(a);
  });

  it("is a playable WAV of the samples", () => {
    const wav = wavOf(Buffer.alloc(480));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt32LE(40)).toBe(480);
    expect(wav.length).toBe(524);
  });
});

describe("speakSurveyLine", () => {
  it("says nothing to someone signed out", async () => {
    viewer.requireMember.mockRejectedValue(new Error("no"));
    expect(await speakSurveyLine("open", {})).toEqual({ ok: false, error: "เข้าสู่ระบบก่อน" });
    expect(voice.surveyVoiceUrl).not.toHaveBeenCalled();
  });

  it("reads the script with the agent's own name, never text from the browser", async () => {
    viewer.requireMember.mockResolvedValue({ agentId: "a1", name: "สุรชัย ใจดี" });
    const r = await speakSurveyLine("open", { female: false, agentName: "คนอื่น", text: "อะไรก็ได้" });
    expect(r).toEqual({ ok: true, url: "https://signed/line.wav" });
    expect(voice.surveyVoiceUrl).toHaveBeenCalledWith(expect.stringMatching(/^สวัสดีครับ ผมสุรชัย /), false);
    expect(await speakSurveyLine("anything", {})).toEqual({ ok: false, error: "ไม่พบบทพูดนี้" });
  });

  it("makes the closing line only for a day the form offers", async () => {
    viewer.requireMember.mockResolvedValue({ agentId: "a1", name: "เอก" });
    const today = bangkokToday();
    expect(await speakSurveyLine("close", { date: "2001-01-01", time: "15:00" })).toEqual({ ok: false, error: "เลือกวันและเวลานัดก่อน" });
    expect(await speakSurveyLine("close", { date: addDays(today, 3), time: "15:00", female: true })).toMatchObject({ ok: true });
    expect(voice.surveyVoiceUrl).toHaveBeenCalledTimes(1);
    expect(voice.surveyVoiceUrl).toHaveBeenLastCalledWith(expect.stringContaining("บ่ายสามโมง ดิฉันขอเข้าไปเล่าให้ฟังค่ะ"), true);
  });
});
