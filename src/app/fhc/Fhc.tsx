"use client";
import { useRef, useState } from "react";
import { Choice, Field, HEALTH_NOW, INPUT, LABEL, MoneyField, n, PANEL, type Money } from "@/components/plan/fields";
import {
  DEFAULT_EXPECTANCY, EVENTS, MAX_PEOPLE, RELATION_LABEL, WORK_ABILITY_LABEL, type Relation, type WorkAbility,
} from "@/lib/fhc/assumptions";
import { figures, type FhcInput } from "@/lib/fhc/health";
import {
  HOSPITAL_LABEL, LIFE_EXPECTANCY, LIFE_WANT_LABEL, PLANNER_AGE, RETIRE_AGES, type Hospital, type LifeWant, type RetireAge,
} from "@/lib/plan/assumptions";
import { defaultBudget, defaultRetireMonthly, type HealthNow } from "@/lib/plan/needs";
import Link from "next/link";
import { explainFhc, runFhc, type FhcReply, type FhcWords } from "./actions";
import { saveFhcCustomer } from "./customers/actions";
import { FhcResult } from "./FhcResult";

/**
 * The agency's FHC questionnaire as a form, for an agent sitting with a customer (owner,
 * 2026-10-10: the customer-on-their-own mode is gone) — with the เฉลย reveals the paper
 * version teaches with, names, and the interviewer's line for the print-out. Names stay in this
 * component's state; the form sent to the server carries relations and ages only.
 */

interface Row {
  relation: Relation;
  age: Money;
  name: string;
}

const baht = (v: number) => Math.round(v).toLocaleString("en-US");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

function Calc({ label, value, unit = "บาท" }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-sm bg-[var(--lg-raise)] px-3 py-2 text-sm">
      <span className="text-[var(--lg-mute)]">{label}</span>
      <span className="tabular-nums text-[var(--lg-white)]">
        <span className="lg-figure font-medium text-[var(--lg-gold)]">{value}</span> {unit}
      </span>
    </div>
  );
}

/** Behind a เฉลย button for the agent to reveal while teaching. */
function Reveal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return (
    <button
      type="button" onClick={() => setOpen(true)}
      className="rounded-full border border-[var(--lg-gold)] px-4 py-1 text-sm text-[var(--lg-gold)]"
    >
      เฉลย
    </button>
  );
}

function Circle({ label, value, strong }: { label: string; value: number | ""; strong?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-[var(--lg-mute)]">{label}</span>
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border text-base tabular-nums ${
          strong ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-white)]"
        }`}
      >
        {value === "" || value === 0 ? "?" : value}
      </span>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${PANEL} ${className}`}>
      <h2 className="text-base font-medium text-[var(--lg-white)]">{title}</h2>
      {children}
    </section>
  );
}

export function Fhc() {

  const [age, setAge] = useState(35);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [retireAge, setRetireAge] = useState("60");
  const [expectancy, setExpectancy] = useState(String(DEFAULT_EXPECTANCY));
  const [work, setWork] = useState<WorkAbility>("full");
  const [expense, setExpense] = useState<Money>("");
  const [income, setIncome] = useState<Money>("");
  const [cash, setCash] = useState<Money>("");
  const [fixed, setFixed] = useState<Money>("");
  const [otherSaving, setOtherSaving] = useState<Money>("");
  const [homeLoan, setHomeLoan] = useState<Money>("");
  const [carLoan, setCarLoan] = useState<Money>("");
  const [otherDebt, setOtherDebt] = useState<Money>("");
  const [taxFund, setTaxFund] = useState<Money>("");
  const [stocks, setStocks] = useState<Money>("");
  const [people, setPeople] = useState<Row[]>([]);
  const [lifeCover, setLifeCover] = useState<Money>("");
  const [ciCover, setCiCover] = useState<Money>("");
  const [healthNow, setHealthNow] = useState<HealthNow>("public");
  const [healthRoom, setHealthRoom] = useState<Money>("");
  const [premiumsNow, setPremiumsNow] = useState<Money>("");
  const [pensionHave, setPensionHave] = useState<Money>("");
  const [retireMonthly, setRetireMonthly] = useState<Money>("");
  const [retireTouched, setRetireTouched] = useState(false);
  const [hospital, setHospital] = useState<Hospital>("private");
  const [lifeWant, setLifeWant] = useState<LifeWant>("cover");
  const [budget, setBudget] = useState<Money>("");
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [interviewer, setInterviewer] = useState("");
  const [idate, setIdate] = useState(today);
  // the customer kept in the signed-in agent's list: what they gave, their consent, and how the save went
  const [saveName, setSaveName] = useState("");
  const [saveContact, setSaveContact] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [savedAs, setSavedAs] = useState<{ id: string; name: string } | null>(null);
  const [saveError, setSaveError] = useState("");
  // asked of the customer only once this check has not already been kept
  const keeping = !savedAs;

  const [result, setResult] = useState<Extract<FhcReply, { ok: true }> | null>(null);
  const [words, setWords] = useState<FhcWords | null>(null);
  const [editing, setEditing] = useState(true);
  const [error, setError] = useState("");
  // its own flag, not useTransition: React ties every pending transition together, so the
  // words' server call would keep the button busy long after the figures are in
  const [pending, setPending] = useState(false);
  const seq = useRef(0);

  const shownRetire = retireTouched ? retireMonthly : defaultRetireMonthly(n(expense)) || "";
  const shownBudget = budgetTouched ? budget : defaultBudget(n(income), n(premiumsNow)) || "";

  // what the server gets: no names, no interviewer
  const input: FhcInput = {
    age, sex, income: n(income), expense: n(expense), lifeCover: n(lifeCover), ciCover: n(ciCover),
    healthNow, healthRoom: n(healthRoom), premiumsNow: n(premiumsNow), hospital, lifeWant,
    retireAge: Number(retireAge) as RetireAge, retireMonthly: n(shownRetire), pensionHave: n(pensionHave),
    budget: n(shownBudget), expectancy: Number(expectancy), work,
    cash: n(cash), fixed: n(fixed), otherSaving: n(otherSaving), homeLoan: n(homeLoan), carLoan: n(carLoan),
    otherDebt: n(otherDebt), taxFund: n(taxFund), stocks: n(stocks),
    people: people.map((p) => ({ relation: p.relation, age: n(p.age) })),
  };
  const g = figures(input);

  /** `save`: also keep the customer in the agent's list, once the check has come back */
  function submit(save = false) {
    // a row without an age would drop out of the plan unseen
    if (people.some((p) => p.age === "")) {
      setError("ใส่อายุของคนในความดูแลให้ครบ หรือลบแถวที่ไม่ใช้ออก");
      return;
    }
    if (save && (!saveName.trim() || !consent)) {
      setError(!saveName.trim() ? "ใส่ชื่อลูกค้าก่อนเก็บเข้ารายชื่อ" : "ติ๊กยืนยันว่าลูกค้ายินยอมก่อนเก็บชื่อ");
      return;
    }
    const form = input;
    setError("");
    setSaveError("");
    setWords(null);
    const mine = ++seq.current;
    setPending(true);
    void (async () => {
      const reply = await runFhc(form).catch(() => ({ ok: false as const, error: "ตรวจไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }));
      if (mine !== seq.current) return;
      setPending(false);
      if (!reply.ok) { setError(reply.error); return; }
      setResult(reply);
      setEditing(false);
      if (save) {
        const kept = await saveFhcCustomer(form, reply.plan.order, {
          name: saveName, contact: saveContact, note: saveNote, consent,
        }).catch(() => ({ ok: false as const, error: "เก็บรายชื่อไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }));
        if (mine !== seq.current) return;
        if (kept.ok) setSavedAs({ id: kept.id, name: saveName.trim() });
        else setSaveError(kept.error);
      }
      requestAnimationFrame(() => document.getElementById("fhc-result")?.scrollIntoView({ behavior: "smooth" }));
      // not awaited: the words come later, and the form must not stay busy waiting for them
      explainFhc(form, reply.plan.order)
        .then((w) => { if (mine === seq.current) setWords(w); })
        .catch(() => {});
    })();
  }


  if (result && !editing) {
    return (
      <div id="fhc-result" className="scroll-mt-20">
        {savedAs && (
          <p role="status" className="mb-4 rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] p-3 text-sm text-[var(--lg-white)] print:hidden">
            เก็บคุณ{savedAs.name}เข้ารายชื่อของคุณแล้ว{" "}
            <Link href={`/fhc/customers/${savedAs.id}`} className="text-[var(--lg-gold)] underline">ดูสรุปว่าขาดอะไร</Link>
          </p>
        )}
        {saveError && (
          <p role="alert" className="mb-4 rounded-sm border border-[var(--bot-red)] p-3 text-sm text-[var(--lg-white)] print:hidden">
            ตรวจเสร็จแล้ว แต่ยังไม่ได้เก็บรายชื่อ: {saveError}
          </p>
        )}
        <FhcResult
          result={result} words={words} interviewer={interviewer} idate={idate}
          names={people.map((p) => p.name.trim())}
          onEdit={() => { setEditing(true); window.scrollTo({ top: 0 }); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="ข้อมูลอายุ" className="sm:col-span-2">
          <div className="flex items-end justify-center gap-3">
            <Circle label="อายุปัจจุบัน" value={age} />
            <span className="mb-7 h-0.5 w-6 bg-[var(--lg-gold)]" />
            <Circle label="อายุเกษียณ" value={Number(retireAge)} strong />
            <span className="mb-7 h-0.5 w-6 bg-[var(--lg-gold)]" />
            <Circle label="อายุเฉลี่ย" value={Number(expectancy)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Calc label="ปีที่ทำงาน" value={String(g.workYears)} unit="ปี" />
            <Calc label="ปีที่ต้องใช้เงิน" value={String(g.moneyYears)} unit="ปี" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="อายุปัจจุบัน (ปี)">
              <select className={INPUT} value={age} onChange={(e) => setAge(Number(e.target.value))}>
                {Array.from({ length: PLANNER_AGE.max - PLANNER_AGE.min + 1 }, (_, i) => PLANNER_AGE.min + i).map((a) => (
                  <option key={a} value={a}>{a} ปี</option>
                ))}
              </select>
            </Field>
            <div>
              <span className={LABEL}>เพศ</span>
              <Choice value={sex} onChange={setSex} options={[["M", "ชาย"], ["F", "หญิง"]]} />
            </div>
            <div>
              <span className={LABEL}>อายุเกษียณ</span>
              <Choice value={retireAge} onChange={setRetireAge} options={RETIRE_AGES.map((a): [string, string] => [String(a), `${a} ปี`])} />
            </div>
            <Field label="อายุเฉลี่ย (ปี)">
              <select className={INPUT} value={expectancy} onChange={(e) => setExpectancy(e.target.value)}>
                {Array.from({ length: LIFE_EXPECTANCY.max - LIFE_EXPECTANCY.min + 1 }, (_, i) => LIFE_EXPECTANCY.min + i).map((a) => (
                  <option key={a} value={a}>{a} ปี</option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <span className={LABEL}>ความสามารถในการทำงาน</span>
            <Choice value={work} onChange={setWork} options={Object.entries(WORK_ABILITY_LABEL) as [WorkAbility, string][]} />
          </div>
        </Card>

        <Card title="ค่าใช้จ่าย & รายได้">
          <MoneyField label="ค่าใช้จ่ายต่อเดือน (บาท)" value={expense} onChange={setExpense} />
          <MoneyField label="รายได้ต่อเดือน (บาท)" value={income} onChange={setIncome} />
          <Calc label="รายได้ต่อปี" value={baht(g.incomeYear)} />
          <Calc label="เงินเหลือสุทธิต่อเดือน" value={baht(g.netMonth)} />
          <Calc label="ค่าความสามารถในการทำงาน" value={baht(g.lifetimeIncome)} />
        </Card>

        <Card title="เงินเก็บ">
          <MoneyField label="เงินสด / ออมทรัพย์ (บาท)" value={cash} onChange={setCash} />
          <MoneyField label="เงินฝากประจำ (บาท)" value={fixed} onChange={setFixed} />
          <MoneyField label="อื่นๆ (บาท)" value={otherSaving} onChange={setOtherSaving} />
          <Calc label="รวมเงินเก็บ" value={baht(g.savings)} />
        </Card>

        <Card title="หนี้สิน">
          <MoneyField label="สินเชื่อบ้าน (บาท)" value={homeLoan} onChange={setHomeLoan} />
          <MoneyField label="สินเชื่อรถ (บาท)" value={carLoan} onChange={setCarLoan} />
          <MoneyField label="บัตรเครดิต / อื่นๆ (บาท)" value={otherDebt} onChange={setOtherDebt} />
          <Calc label="รวมหนี้สิน" value={baht(g.debts)} />
        </Card>

        <Card title="กองทุน / การลงทุน">
          <MoneyField label="กองทุน LTF / RMF / SSF (บาท)" value={taxFund} onChange={setTaxFund} hint="นับเป็นเงินเพื่อเกษียณ" />
          <MoneyField label="หุ้น / สินทรัพย์อื่นๆ (บาท)" value={stocks} onChange={setStocks} />
          <Calc label="รวมการลงทุน" value={baht(g.invest)} />
          <Calc label="สินทรัพย์สุทธิ" value={baht(g.netWorth)} />
        </Card>

        <Card title="ทรัพย์สินมี 2 ประเภท">
          <Reveal>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[var(--lg-mute)]">ทรัพย์สินที่มองเห็น</p>
                <p className="mt-1 leading-relaxed text-[var(--lg-white)]">บ้าน · รถ · ที่ดิน</p>
              </div>
              <div>
                <p className="text-xs text-[var(--lg-mute)]">ทรัพย์สินที่มองไม่เห็น</p>
                <p className="mt-1 text-[var(--lg-white)]">ค่าความสามารถในการทำงาน</p>
                <p className="lg-figure mt-1 tabular-nums text-[var(--lg-gold)]">{baht(g.lifetimeIncome)} บาท</p>
              </div>
            </div>
          </Reveal>
        </Card>

        <Card title="บุคคลที่อยู่ภายใต้การดูแล">
          <div className="space-y-2">
            {people.map((p, i) => (
              <div key={i} className="space-y-2 rounded-sm border border-[var(--lg-panel-line)] p-3">
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`ความสัมพันธ์คนที่ ${i + 1}`} className={`${INPUT} mt-0 min-w-0 flex-1`} value={p.relation}
                    onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, relation: e.target.value as Relation } : x)))}
                  >
                    {(Object.keys(RELATION_LABEL) as Relation[]).map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
                  </select>
                  <input
                    type="text" inputMode="numeric" aria-label={`อายุคนที่ ${i + 1}`} placeholder="อายุ"
                    className={`${INPUT} mt-0 !w-20 shrink-0`} value={p.age}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "");
                      setPeople(people.map((x, j) => (j === i ? { ...x, age: d === "" ? "" : Math.min(Number(d), 100) } : x)));
                    }}
                  />
                  <button
                    type="button" onClick={() => setPeople(people.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-sm border border-[var(--lg-panel-line)] px-3 py-2.5 text-sm text-[var(--lg-mute)]"
                  >
                    ลบ
                  </button>
                </div>
                <input
                  type="text" aria-label={`ชื่อคนที่ ${i + 1}`} placeholder="ชื่อ (ไม่บันทึกเข้าระบบ)"
                  className={`${INPUT} mt-0 text-base`} value={p.name}
                  onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
              </div>
            ))}
            {people.length < MAX_PEOPLE && (
              <button
                type="button" onClick={() => setPeople([...people, { relation: "child", age: "", name: "" }])}
                className="w-full rounded-sm border border-dashed border-[var(--lg-panel-line)] py-2.5 text-sm text-[var(--lg-mute)]"
              >
                + เพิ่มคนในความดูแล
              </button>
            )}
          </div>
        </Card>

        <Card title="5 เหตุการณ์ที่ควบคุมไม่ได้">
          <ol className="space-y-2.5">
            {EVENTS.map((e, i) => (
              <li key={e.key} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--lg-gold)] text-xs text-[var(--lg-gold)]">
                  {i + 1}
                </span>
                <Reveal><span className="text-[var(--lg-white)]">{e.name}</span></Reveal>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[var(--lg-mute)]">ผลตรวจจะบอกว่าแต่ละเหตุการณ์กระทบคุณแค่ไหน และแบบประกันไหนรับมือได้</p>
        </Card>

        <Card title="ประกันที่มีและความต้องการ" className="sm:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="ทุนประกันชีวิตรวมทุกกรมธรรม์ (บาท)" value={lifeCover} onChange={setLifeCover} />
            <MoneyField label="ทุนประกันโรคร้ายแรงรวม (บาท)" value={ciCover} onChange={setCiCover} />
            <MoneyField label="เบี้ยประกันที่จ่ายอยู่ทุกกรมธรรม์ (บาท/ปี)" value={premiumsNow} onChange={setPremiumsNow} />
            <MoneyField
              label="บำนาญที่คาดว่าจะได้แล้ว เดือนละ (บาท)" value={pensionHave} onChange={setPensionHave}
              hint="เช่น บำนาญข้าราชการ ประกันสังคม ประกันบำนาญที่มีอยู่"
            />
            <MoneyField
              label="หลังเกษียณอยากมีเงินใช้เดือนละ (บาท)" value={shownRetire}
              onChange={(v) => { setRetireTouched(true); setRetireMonthly(v); }}
              hint="ตั้งไว้ให้ที่ 70% ของค่าใช้จ่ายตอนนี้ แก้ได้"
            />
            <MoneyField
              label="งบเบี้ยที่เพิ่มได้ เดือนละไม่เกิน (บาท)" value={shownBudget}
              onChange={(v) => { setBudgetTouched(true); setBudget(v); }}
              hint="ตั้งไว้ให้ที่ 10% ของรายได้ หักเบี้ยที่จ่ายอยู่แล้ว"
            />
          </div>
          <div>
            <span className={LABEL}>ค่ารักษาพยาบาลตอนนี้ใช้สิทธิ์อะไร</span>
            <Choice value={healthNow} options={HEALTH_NOW} onChange={setHealthNow} />
          </div>
          {healthNow === "private" && <MoneyField label="ค่าห้องที่ประกันสุขภาพจ่าย (บาท/วัน)" value={healthRoom} onChange={setHealthRoom} />}
          <div>
            <span className={LABEL}>ถ้าต้องนอนโรงพยาบาล อยากใช้ที่ไหน</span>
            <Choice value={hospital} onChange={setHospital} options={(Object.keys(HOSPITAL_LABEL) as Hospital[]).map((h) => [h, HOSPITAL_LABEL[h]])} />
          </div>
          <div>
            <span className={LABEL}>ประกันชีวิต อยากได้แบบไหนมากกว่ากัน</span>
            <Choice
              value={lifeWant} onChange={setLifeWant}
              options={(Object.keys(LIFE_WANT_LABEL) as LifeWant[]).map((w) => [w, LIFE_WANT_LABEL[w].title])}
            />
          </div>
        </Card>

        {keeping && (
          <Card title="เก็บเข้ารายชื่อลูกค้าของฉัน" className="sm:col-span-2">
            <p className="text-xs leading-relaxed text-[var(--lg-mute)]">
              ชื่อ ข้อมูลที่กรอก และผลตรวจนี้จะถูกเก็บไว้ในบัญชีของคุณ เห็นเฉพาะคุณ ไม่ติ๊กก็ตรวจอย่างเดียวได้ ไม่มีอะไรถูกเก็บ
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ชื่อลูกค้า">
                <input type="text" id="fhc-save-name" maxLength={100} className={`${INPUT} text-base`} value={saveName} onChange={(e) => setSaveName(e.target.value)} />
              </Field>
              <Field label="เบอร์โทร หรือ LINE (ไม่บังคับ)">
                <input type="text" id="fhc-save-contact" maxLength={100} className={`${INPUT} text-base`} value={saveContact} onChange={(e) => setSaveContact(e.target.value)} />
              </Field>
            </div>
            <Field label="โน้ตของตัวแทน (ไม่บังคับ)">
              <input type="text" id="fhc-save-note" maxLength={300} className={`${INPUT} text-base`} value={saveNote} onChange={(e) => setSaveNote(e.target.value)} />
            </Field>
            <label className="flex items-start gap-3 text-sm text-[var(--lg-white)]" htmlFor="fhc-save-consent">
              <input id="fhc-save-consent" type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                ลูกค้ายินยอมให้เก็บชื่อ ข้อมูลที่กรอก และผลตรวจนี้ไว้กับตัวแทนผู้ดูแล เพื่อติดต่อและเสนอแบบประกัน ลูกค้าขอลบได้ทุกเมื่อ
              </span>
            </label>
          </Card>
        )}

        <Card title="ผู้ทำแบบสอบถาม" className="sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล (ไม่บันทึกเข้าระบบ)">
              <input type="text" className={`${INPUT} text-base`} value={interviewer} onChange={(e) => setInterviewer(e.target.value)} />
            </Field>
            <Field label="วันที่">
              <input type="date" className={`${INPUT} text-base`} value={idate} onChange={(e) => setIdate(e.target.value)} />
            </Field>
          </div>
        </Card>
      </div>

      {error && <p className="text-center text-sm text-[var(--lg-gold)]">{error}</p>}
      {keeping ? (
        <>
          <button
            type="button" onClick={() => submit(true)} disabled={pending}
            className="lg-metal-face w-full rounded-sm border border-[var(--lg-gold)] py-3.5 text-base font-medium disabled:opacity-60"
          >
            {pending ? "กำลังตรวจ…" : "ตรวจสุขภาพการเงิน และเก็บเข้ารายชื่อ"}
          </button>
          <button
            type="button" onClick={() => submit(false)} disabled={pending}
            className="w-full rounded-sm border border-[var(--lg-panel-line)] py-3 text-sm text-[var(--lg-mute)] disabled:opacity-60"
          >
            ตรวจอย่างเดียว ไม่เก็บชื่อ
          </button>
        </>
      ) : (
        <button
          type="button" onClick={() => submit(false)} disabled={pending}
          className="lg-metal-face w-full rounded-sm border border-[var(--lg-gold)] py-3.5 text-base font-medium disabled:opacity-60"
        >
          {pending ? "กำลังตรวจ…" : "ตรวจสุขภาพการเงิน"}
        </button>
      )}
    </div>
  );
}
