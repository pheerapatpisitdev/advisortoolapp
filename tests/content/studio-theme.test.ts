import { describe, expect, it } from "vitest";
import { isThemeChoice, resolveTheme, studioThemeScript, STUDIO_THEME_KEY } from "@/lib/content/studio-theme";

describe("Studio's light and dark", () => {
  it("follows the device on อัตโนมัติ, and holds the owner's pick otherwise", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("takes only the three choices from storage", () => {
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("sepia")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  it("sets the same answer before paint as resolveTheme gives after", () => {
    const run = (stored: string | null, deviceDark: boolean) => {
      const html = { dataset: {} as Record<string, string> };
      const env = {
        localStorage: { getItem: (k: string) => (k === STUDIO_THEME_KEY ? stored : null) },
        matchMedia: () => ({ matches: deviceDark }),
        document: { documentElement: html },
      };
      new Function("localStorage", "matchMedia", "document", studioThemeScript)(env.localStorage, env.matchMedia, env.document);
      return html.dataset.studioTheme;
    };
    expect(run(null, true)).toBe("dark");
    expect(run("auto", false)).toBe("light");
    expect(run("light", true)).toBe("light");
    expect(run("dark", false)).toBe("dark");
  });
});
