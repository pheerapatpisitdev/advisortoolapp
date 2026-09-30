import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLASSIC, type Look } from "@/lib/content/looks";

/** The cheap model picks a look for the picture; the rules are held after it, and a failure draws the original. */

const ai = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), chat: ai.chat }));
const { pickLook } = await import("@/lib/content/look-pick");

const reply = (look: object) => ({ text: JSON.stringify(look), model: "m", costThb: 0.01, outputTokens: 30 });

beforeEach(() => vi.clearAllMocks());

describe("picking a look", () => {
  it("takes the look the model chose for the scene, on the small model", async () => {
    ai.chat.mockResolvedValue(reply({ style: "film", subject: "couple", place: "cafe", light: "golden", mood: "warm", space: "blur" }));
    expect(await pickLook({ scene: "a couple over coffee", person: false, recent: [] }))
      .toEqual({ style: "film", subject: "couple", place: "cafe", light: "golden", mood: "warm", space: "blur" });
    expect(ai.chat).toHaveBeenCalledWith(expect.objectContaining({ tier: "small", task: "content-image-look", json: true }));
    expect(String(ai.chat.mock.calls[0][0].messages[1].content)).toContain("a couple over coffee");
  });

  it("holds the rules the model missed: not the Page's last style, a photograph for a library person", async () => {
    const last: Look = { ...CLASSIC, style: "film" };
    ai.chat.mockResolvedValue(reply({ style: "film", subject: "empty" }));
    const got = await pickLook({ scene: "x", person: true, recent: [last] });
    expect(got.style).not.toBe("film");
    expect(got.subject).toBe("solo");
  });

  it("draws the original when the model fails, and the picture is still drawn", async () => {
    ai.chat.mockRejectedValue(new Error("down"));
    expect(await pickLook({ scene: "x", person: false, recent: [] })).toEqual(CLASSIC);
  });
});
