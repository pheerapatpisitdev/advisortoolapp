/**
 * An in-page yes/no, in place of window.confirm().
 *
 * A browser told once to stop showing dialogs — and the Claude app's own browser pane,
 * always — answers confirm() "no" at once with nothing on screen, which left ลบ, ยกเลิก and
 * โพสต์ตอนนี้ dead (owner, 2026-09-24). This draws its own box, so it asks everywhere.
 * Resolves true only on the ok button; the cancel button, Esc and a tap outside all say no.
 */
export function ask(message: string, okLabel = "ยืนยัน"): Promise<boolean> {
  return new Promise((resolve) => {
    const box = document.createElement("dialog");
    box.setAttribute("aria-label", message);
    Object.assign(box.style, {
      // Tailwind's reset zeroes a dialog's margin, which is what centres it
      margin: "auto",
      maxWidth: "min(26rem, calc(100vw - 2rem))",
      padding: "1.25rem",
      // Studio's palette (theme.css sets it on the page's root, so the top layer has it too),
      // dark included; the deck's own where :has is not understood
      border: "1px solid var(--ct-line, var(--bot-line))",
      borderRadius: "0.75rem",
      background: "var(--ct-panel, var(--bot-surface))",
      color: "var(--ct-ink, var(--bot-ink))",
      // a shadow is black on either ground; the ink's own would glow on the dark one
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.22)",
    });

    const text = document.createElement("p");
    text.textContent = message;
    Object.assign(text.style, { margin: "0", whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: "1.6" });

    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" });

    const button = (label: string, strong: boolean) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      Object.assign(b.style, {
        padding: "0.5rem 1rem",
        minHeight: "2.75rem",
        borderRadius: "0.5rem",
        fontSize: "0.9rem",
        cursor: "pointer",
        border: strong ? "1px solid var(--ct-solid, var(--bot-navy))" : "1px solid var(--ct-line, var(--bot-line))",
        background: strong ? "var(--ct-solid, var(--bot-navy))" : "var(--ct-panel, var(--bot-surface))",
        color: strong ? "var(--ct-solid-ink, var(--bot-surface))" : "var(--ct-ink, var(--bot-ink))",
        fontWeight: strong ? "600" : "400",
      });
      /* the box sits in the top layer, outside .content-page and its focus ring, so it draws its
         own: a ring on a keyboard's focus only, as :focus-visible decides */
      b.addEventListener("focus", () => {
        if (!b.matches(":focus-visible")) return;
        b.style.outline = "3px solid var(--ct-accent, var(--bot-navy))";
        b.style.outlineOffset = "2px";
      });
      b.addEventListener("blur", () => { b.style.outline = ""; b.style.outlineOffset = ""; });
      return b;
    };
    const no = button("ยกเลิก", false);
    const yes = button(okLabel, true);

    let answer = false;
    yes.addEventListener("click", () => { answer = true; box.close(); });
    no.addEventListener("click", () => box.close());
    // a tap on the backdrop lands on the dialog element too, so tell it from the padding by place
    box.addEventListener("click", (e) => {
      if (e.target !== box) return;
      const r = box.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close();
    });
    box.addEventListener("close", () => { box.remove(); resolve(answer); });

    row.append(no, yes);
    box.append(text, row);
    document.body.append(box);
    box.showModal();
    // the safe answer takes the focus, so a stray Enter does not delete or post
    no.focus();
  });
}
