import { cookies } from "next/headers";
import { gateCalc } from "@/lib/auth/viewer";
import { PACalculator } from "@/components/PACalculator";
import { CalcTitle } from "@/components/sales/CalcTitle";
import { Rule } from "@/components/sales/Blocks";
import { LangSwitch } from "@/components/ihealthy/LangSwitch";
import { HTML_LANG, parseLang, type Lang } from "@/lib/ihealthy-lang";
import { WORDS } from "@/lib/ihealthy-words";
import { PA_LANG_COOKIE, PA_WORDS } from "@/lib/pa-words";

/** The language the agent picked with the switch; Thai for everyone who has not. */
async function readerLang(): Promise<Lang> {
  return parseLang((await cookies()).get(PA_LANG_COOKIE)?.value);
}

export async function generateMetadata() {
  const w = PA_WORDS[await readerLang()];
  return { title: w.metaTitle, description: w.metaDescription };
}

/**
 * Krungthai-AXA's Personal Accident plans (owner, 2026-11-14, ก ก ก on mockup
 * https://claude.ai/artifact/6RyRCubLaap2YinJGpnzcm): the calculator, every plan of the family
 * in one table, and the copied text. Picture card, bot and clip come in a later round.
 *
 * Read in the five languages of iHealthy Ultra (owner, 2026-11-15, ก ก on mockup
 * https://claude.ai/artifact/SZvzGB3ZFMdjHbCA2G3rzW), with the same switch and its own cookie.
 */
export default async function PaPage() {
  // members only, trial included (owner, 2026-10-20)
  await gateCalc("/pa");
  const lang = await readerLang();
  const w = PA_WORDS[lang];
  // said at the top: a reader who acts on a translated condition is told first which version binds
  const note = WORDS[lang].translationNote;
  return (
    <main lang={HTML_LANG[lang]} className="calc-page mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10 lg:max-w-6xl">
      <LangSwitch lang={lang} label={WORDS[lang].switchLabel} cookie={PA_LANG_COOKIE} path="/pa" />
      {note && (
        <p className="pt-3 text-right text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">{note}</p>
      )}
      <CalcTitle name="PA" kind={w.kind} facts={w.facts} tight />
      <section id="calc" className="scroll-mt-4">
        <PACalculator sticky lang={lang} />
      </section>
      <footer className="pb-10">
        <Rule />
        <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
          <p>{w.footer[0]}</p>
          <p className="mt-2.5">{w.footer[1]}</p>
          <p className="mt-2.5 font-medium text-[var(--lg-white)]">{w.footer[2]}</p>
        </div>
      </footer>
    </main>
  );
}
