"use client";
import { useEffect, useRef } from "react";

/**
 * Opens the folds around it for as long as the print dialog is up, and closes again the ones
 * that were closed.
 *
 * The stylesheet's answer — `details > div { display: block }` in globals.css — stopped being
 * one when Chrome moved a closed fold's contents behind `::details-content`, which hides them
 * whatever the child's own display says: the full sheet printed every condition as a heading
 * with nothing under it. Opening the fold is the one thing every browser agrees prints its
 * contents. The events fire for the page's own button and for the browser's menu alike.
 */
export function PrintUnfold() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const scope = ref.current?.parentElement;
    if (!scope) return;
    let opened: HTMLDetailsElement[] = [];
    const open = () => {
      opened = Array.from(scope.querySelectorAll<HTMLDetailsElement>("details:not([open])"));
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
  return <span ref={ref} hidden />;
}
