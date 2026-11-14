"use client";
import { useState } from "react";
import { loadState, saveState } from "@/lib/tax/storage";
import { useHydrated } from "@/lib/tax/useHydrated";
import { CompanyTab, CompareTab } from "./BusinessTabs";
import { chip } from "./fields";
import { Guide } from "./Guide";
import { PersonalTab } from "./PersonalTab";

/**
 * คำนวณภาษี 2569 (owner, 2026-11-14, ก ก ก ก on mockup U4tvaUqZU5zkTnZF5qi6R8): the four pages
 * of the stand-alone tax app as four tabs of one. Everything typed stays in this browser, so
 * the tabs are drawn only once the browser is there to be read.
 */
const TABS = [
  { id: "personal", label: "บุคคลธรรมดา" },
  { id: "company", label: "บริษัท / หจก." },
  { id: "compare", label: "เทียบสองแบบ" },
  { id: "guide", label: "คู่มือ" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const TAB_KEY = "tax-2569-tab";

export function TaxCalculator() {
  return useHydrated() ? <Tabs /> : <div className="h-96" aria-busy="true" />;
}

function Tabs() {
  const [tab, setTab] = useState<TabId>(() => {
    const saved = loadState<string>(TAB_KEY, "personal");
    return TABS.some((t) => t.id === saved) ? (saved as TabId) : "personal";
  });
  const pick = (id: TabId) => { setTab(id); saveState(TAB_KEY, id); };

  return (
    <>
      <div role="group" aria-label="โหมดคำนวณ" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => pick(t.id)} className={chip(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "personal" && <PersonalTab />}
      {tab === "company" && <CompanyTab />}
      {tab === "compare" && <CompareTab />}
      {tab === "guide" && <Guide />}
    </>
  );
}
