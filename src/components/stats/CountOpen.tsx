"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { calculatorName } from "@/lib/stats/calculators";

/**
 * Tells the server a calculator page was opened, for /admin/stats (owner, 2026-10-14). In the
 * root layout, so client-side moves between pages count too. The server keeps it only for
 * somebody signed in and drops a repeat within ten minutes.
 */
export function CountOpen() {
  const path = usePathname() || "/";
  useEffect(() => {
    if (!calculatorName(path)) return;
    fetch("/api/stats/open", {
      method: "POST", keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  }, [path]);
  return null;
}
