import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A form with no method is a GET when submitted before React hydrates: the PIN would land in the URL.
const FILES = ["src/app/login/LoginForm.tsx", "src/app/signup/SignupForm.tsx", "src/app/studio/account/AccountForm.tsx"];

describe("forms that take a PIN", () => {
  it("are all method=post, five forms in three files", () => {
    let forms = 0;
    for (const f of FILES) {
      for (const tag of readFileSync(f, "utf8").match(/<form\b[^>]*/g) ?? []) {
        forms++;
        expect(tag, f).toContain('method="post"');
      }
    }
    expect(forms).toBe(5);
  });
});
