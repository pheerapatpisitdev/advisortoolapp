"use client";
import { useEffect } from "react";
import { playClick } from "@/lib/shell/click-sound";

/** what counts as pressing something: a button, a tick-box, a choice among several */
const PRESSED = 'button, summary, [role="tab"], [role="switch"], input[type="checkbox"], input[type="radio"]';

/** the calculators: the sales pages' `#calc` section, and the others mark their own with the attribute */
const CALCULATOR = "#calc, [data-click-sound]";

/**
 * The tick under a press inside a calculator (owner's ask, 2026-10-03), the same one the menu
 * makes.
 *
 * One listener on the document rather than an `onClick` on every control of a dozen
 * calculators: a control added to one later makes the sound without anybody remembering to ask
 * it to, and the calculators stay as they were. What is a calculator is decided by where the
 * press lands, so the menu, the Studio and the back office — which ask for nothing of the
 * kind — stay as quiet as they were.
 *
 * A drop-down opens on a press and settles on a change, and the tick belongs to the settling:
 * it is the moment something was chosen.
 */
export function CalculatorSounds() {
  useEffect(() => {
    const inCalculator = (el: Element) => el.closest(CALCULATOR) !== null;
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const control = e.target.closest(PRESSED);
      if (!control || !inCalculator(control)) return;
      if (control instanceof HTMLButtonElement && control.disabled) return;
      playClick();
    };
    const onChange = (e: Event) => {
      if (e.target instanceof HTMLSelectElement && inCalculator(e.target)) playClick();
    };
    // heard on the way down, before the page's own handler: a choice that redraws the form
    // (a different plan) takes the control out of the page, and where it was is then unknowable
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, []);
  return null;
}
