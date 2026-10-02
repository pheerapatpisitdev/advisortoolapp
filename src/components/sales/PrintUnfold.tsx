"use client";
import { useEffect } from "react";

/**
 * Opens the page's folds for as long as the print dialog is up, and closes again the ones
 * that were closed.
 *
 * The stylesheet's answer — `details > div { display: block }` in globals.css — stopped being
 * one when Chrome moved a closed fold's contents behind `::details-content`, which hides them
 * whatever the child's own display says: every sales page printed its conditions and its
 * questions as headings with nothing under them. Opening the fold is the one thing every
 * browser agrees prints its contents. The events fire for the page's own button and for the
 * browser's menu alike.
 *
 * Mounted once, by `SalesTheme`, and it reaches only what is marked `data-fold` — every
 * `Fold`, and the advice under a plan on /fhc — so the other disclosures on the sales pages
 * (the rider pickers on iHealthy) print as they always have.
 * The value-table print is untouched too — it hides its siblings with `display: none`, and an
 * open fold inside a hidden section is still hidden.
 */
export function PrintUnfold() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const open = () => {
      opened = Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-fold]:not([open])"));
      for (const fold of opened) fold.open = true;
    };
    const close = () => {
      for (const fold of opened) fold.open = false;
      opened = [];
    };
    window.addEventListener("beforeprint", open);
    window.addEventListener("afterprint", close);
    return () => {
      window.removeEventListener("beforeprint", open);
      window.removeEventListener("afterprint", close);
    };
  }, []);
  return null;
}
