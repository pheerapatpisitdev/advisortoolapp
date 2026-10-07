import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The editor's AI text check and its finish checklist both reset per piece by a key, and they sit
 * side by side in the editor's section: with the same key (item.id) React warned "two children with
 * the same key" on a สูตรอ่าน-ดูจนจบ post (2026-10-07). Read as text: the editor needs a whole
 * Studio to render.
 */
describe("PieceEditor's keyed panels", () => {
  const src = readFileSync("src/app/studio/PieceEditor.tsx", "utf8");
  const keyOf = (name: string) => new RegExp(`<${name} key=\\{([^}]+)\\}`).exec(src)?.[1];

  it("key the text check and the finish card differently", () => {
    const check = keyOf("AiTextCheck");
    const finish = keyOf("FinishCard");
    expect(check).toBeDefined();
    expect(finish).toBeDefined();
    expect(check).not.toBe(finish);
  });
});
