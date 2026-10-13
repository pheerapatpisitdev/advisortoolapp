"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Calculator } from "./Calculator";
import { Icon, type IconName } from "./Icon";
import { LangProvider, useLang } from "./lang";

/**
 * ประกันภัยกลุ่ม — three tabs over one tool.
 *
 * The standalone version this came from had a sidebar of its own, which cannot come with it:
 * this app already has one down the left, and two would be a page with two menus disagreeing
 * about where you are. Tabs say the same thing in the space that is left.
 *
 * Both calculators stay mounted while the other is showing. An agent quotes health, the HR
 * manager asks about accident, and the health groups are still there when they come back —
 * unmounting them would be a tidier tree and would throw away ten minutes of the meeting.
 */

/**
 * The registrar's table is its own chunk, fetched the first time its tab is opened.
 *
 * 180KB of trade names against 12KB of rate tables: loading it with the page would make
 * every visit pay for a tab most visits never open. `ssr: false` because there is nothing
 * to prerender — it is a search box over a list, and its first paint is the empty search.
 */
const BusinessTypeTable = dynamic(
  () => import("./BusinessTypeTable").then((m) => m.BusinessTypeTable),
  { ssr: false },
);

type TabKey = "health" | "accident" | "businessType";

const TABS: { key: TabKey; labelKey: "pageHealth" | "pageAccident" | "pageBusinessType"; icon: IconName }[] = [
  { key: "health", labelKey: "pageHealth", icon: "building" },
  { key: "accident", labelKey: "pageAccident", icon: "shieldAlert" },
  { key: "businessType", labelKey: "pageBusinessType", icon: "briefcase" },
];

/** The insurer's own terms, which are the same whatever the premium works out at. */
const CONDITIONS = [
  ["ageRange", "ageDetail"],
  ["applicantCount", "applicantDetail"],
  ["coverageStart", "coverageStartDetail"],
  ["minPremium", "minPremiumDetail"],
  ["paymentMethod", "paymentDetail"],
] as const;

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language" className="inline-flex overflow-hidden rounded-lg border border-[var(--gi-line-strong)]">
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 text-sm font-semibold ${
            lang === l ? "text-white" : "bg-[var(--gi-panel)] text-[var(--gi-ink-soft)]"
          }`}
          style={lang === l ? { background: "var(--gi-navy)" } : undefined}
        >
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}

function HealthPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("healthTitle")}</h1>
          <p className="mt-0.5 text-[var(--gi-mute)]">{t("healthSubtitle")}</p>
        </div>
      </header>
      <Calculator product="health" />
      <p className="mt-12 pb-4 text-center text-xs text-[var(--gi-mute)]">{t("healthFooter")}</p>
    </div>
  );
}

function AccidentPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-col items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("paTitle")}</h1>
          <p className="mt-0.5 text-[var(--gi-mute)]">{t("paSubtitle")}</p>
        </div>
      </header>
      <Calculator product="pa" />

      <section className="mt-6 overflow-hidden rounded-lg border border-[var(--gi-line)] bg-[var(--gi-panel)] shadow-sm">
        <h2 className="border-b border-[var(--gi-line)] bg-[var(--gi-sunken)] px-6 py-4 font-bold">{t("conditions")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--gi-line)] bg-[var(--gi-sunken)]">
                <th scope="col" className="w-48 px-6 py-3.5 font-semibold text-[var(--gi-ink-soft)]">
                  {t("item")}
                </th>
                <th scope="col" className="px-6 py-3.5 font-semibold text-[var(--gi-ink-soft)]">
                  {t("detail")}
                </th>
              </tr>
            </thead>
            <tbody>
              {CONDITIONS.map(([item, detail], i) => (
                <tr key={item} className={i % 2 === 0 ? "bg-[var(--gi-panel)]" : "bg-[var(--gi-sunken)]"}>
                  <th scope="row" className="px-6 py-3.5 text-left font-medium text-[var(--gi-ink-soft)]">
                    {t(item)}
                  </th>
                  <td className="px-6 py-3.5">{t(detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t border-[var(--gi-line)] px-6 py-4">
          <a
            href="https://drive.google.com/drive/folders/1L0lJevyKS-iui0ELeYdD_nwt92stqNqF?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--gi-teal-deep)" }}
          >
            <Icon name="download" className="h-4 w-4" />
            {t("downloadDocuments")}
          </a>
        </div>
      </section>

      <p className="mt-12 pb-4 text-center text-xs text-[var(--gi-mute)]">{t("paFooter")}</p>
    </div>
  );
}

/** The three sentences an employer has to have read before the figure above means anything. */
function Disclaimer() {
  const { t } = useLang();
  return (
    <footer className="mt-10 border-t border-[var(--gi-line)] pt-8">
      <div className="mx-auto max-w-2xl rounded-xl border border-[var(--gi-line)] bg-[var(--gi-sunken)] px-4 py-4">
        <p className="text-xs leading-relaxed text-[var(--gi-mute)] sm:text-sm">{t("disclaimer1")}</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--gi-mute)] sm:text-sm">{t("disclaimer2")}</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--gi-mute)] sm:text-sm">{t("disclaimer3")}</p>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--gi-mute)]">{t("appBy")}</p>
    </footer>
  );
}

function Tabs({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const { t } = useLang();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label={t("groupInsurance")} className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const current = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={current}
              aria-controls={`gi-panel-${item.key}`}
              id={`gi-tab-${item.key}`}
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${
                current
                  ? "border-transparent text-white shadow-sm"
                  : "border-[var(--gi-line-strong)] bg-[var(--gi-panel)] text-[var(--gi-ink-soft)]"
              }`}
              style={current ? { background: "var(--gi-navy)" } : undefined}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <a
          href="https://datawarehouse.dbd.go.th/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--gi-teal-deep)] underline"
        >
          <Icon name="external" className="h-4 w-4" />
          {t("linkDbd")}
        </a>
        <LangToggle />
      </div>
    </div>
  );
}

function Body() {
  const [tab, setTab] = useState<TabKey>("health");
  /**
   * The registrar's table is 180KB of rows, and most visits never open it. So it is built the
   * first time that tab is reached and kept from then on — building it lazily is the point,
   * and throwing it away again on the way back to the calculator would discard the search
   * the agent had just typed.
   */
  const [bizOpened, setBizOpened] = useState(false);
  const goTo = (next: TabKey) => {
    if (next === "businessType") setBizOpened(true);
    setTab(next);
  };
  return (
    <main className="mx-auto max-w-6xl p-4 pt-16 sm:p-6 sm:pt-16 lg:pt-6">
      <Tabs tab={tab} setTab={goTo} />
      {/* hidden rather than unmounted — see the note at the top of this file */}
      <div role="tabpanel" id="gi-panel-health" aria-labelledby="gi-tab-health" hidden={tab !== "health"}>
        <HealthPage />
      </div>
      <div role="tabpanel" id="gi-panel-accident" aria-labelledby="gi-tab-accident" hidden={tab !== "accident"}>
        <AccidentPage />
      </div>
      <div role="tabpanel" id="gi-panel-businessType" aria-labelledby="gi-tab-businessType" hidden={tab !== "businessType"}>
        {bizOpened && <BusinessTypeTable />}
      </div>
      <Disclaimer />
    </main>
  );
}

export function GroupInsurance() {
  return (
    <LangProvider>
      <Body />
    </LangProvider>
  );
}
