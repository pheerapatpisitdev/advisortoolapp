import { thb, type FrontPrices } from "@/lib/pricing/front";

/**
 * ค่าบริการ, under the sign-in box (owner, 2026-10-20; mockup QEphNuJbqufEhqVJzRKrcC, ก ก ก):
 * what each way in costs, said before anybody signs up. The calculators, ถาม AI and Studio are
 * all for members since that day, trial included, so every package lists them. The top-up box
 * that stood under the packages came out on 2026-10-21 (owner); the amounts stay on Studio's
 * own price list.
 */
export function PriceList({ prices }: { prices: FrontPrices }) {
  const m = prices.member;
  return (
    <section id="prices" aria-labelledby="prices-title" className="w-full max-w-2xl scroll-mt-6">
      <h2 id="prices-title" className="text-center text-xl font-semibold tracking-tight">ค่าบริการ</h2>
      <p className="mt-1 text-center text-sm text-[var(--bot-ink-mute)]">เครื่องคิดเบี้ย ถาม AI และ Studio ใช้ได้เฉพาะสมาชิก รวมคนที่กำลังทดลองใช้</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Plan who="เข้าด้วย Google" name="สมาชิกทั่วไป">
          {m.paid ? (
            <>
              {m.trialDays > 0 && (
                <Tier name="ทดลองใช้" price="ฟรี" per={`${m.trialDays} วัน`}>
                  <Ticks items={[
                    "เครื่องคิดเบี้ยทุกแบบประกัน",
                    "ถาม AI ไม่จำกัด",
                    ...(m.trialCreditThb > 0 ? [`เครดิต Studio ฿${thb(m.trialCreditThb)} ไว้ลองทำโพสต์ รูป คลิป`] : []),
                  ]} />
                </Tier>
              )}
              <Tier name="รายเดือน" price={`฿${thb(m.passThb)}`} per="/ 30 วัน">
                <Ticks items={[
                  "เครื่องคิดเบี้ยทุกแบบประกัน",
                  "ถาม AI ไม่จำกัด",
                  ...(m.passCreditThb > 0 ? [`เครดิต Studio ฿${thb(m.passCreditThb)} ทุกครั้งที่ต่ออายุ`] : []),
                  ...(prices.topUpsThb.length ? ["ใช้เกินเครดิต เติมเงินใช้ต่อได้"] : []),
                  ...(m.referralDays ? [`ชวนเพื่อนสมัคร ได้เพิ่ม ${m.referralDays} วันต่อคน`] : []),
                ]} />
                <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">จ่ายผ่าน PromptPay หรือบัตร · ไม่ตัดเงินอัตโนมัติ{m.passCreditThb > 0 ? " · เครดิตหมดอายุพร้อมรอบ 30 วัน" : ""}</p>
              </Tier>
            </>
          ) : (
            <Tier name="สมัครสมาชิก" price="ฟรี">
              <Ticks items={["เครื่องคิดเบี้ยทุกแบบประกัน", "ถาม AI ไม่จำกัด", "Studio ช่วยทำโพสต์ รูป คลิป"]} />
            </Tier>
          )}
        </Plan>

        <Plan who="เข้าด้วยรหัสตัวแทน 6 หลัก" name="ตัวแทน UnitOS">
          <Tier name="สมาชิกทีมใน UnitOS" price="฿0" per="ค่าเข้าใช้">
            <Ticks items={[
              "เครื่องคิดเบี้ยทุกแบบประกัน",
              "ถาม AI ไม่จำกัด",
              ...(prices.agentStarterThb ? [`เครดิตเริ่มต้น Studio ฿${thb(prices.agentStarterThb)} ครั้งเดียว ไม่มีวันหมดอายุ`] : []),
              ...(prices.topUpsThb.length ? ["ใช้เกินเครดิต เติมเงินใช้ต่อได้"] : []),
              "ใช้รหัสเดียวกับที่เข้า UnitOS",
            ]} />
            <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">
              <span className="mr-1 rounded-full border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-2 py-px font-semibold text-[var(--bot-sand-ink)]">Premium</span>
              บางทีมเปิดให้เฉพาะสมาชิก Premium ของทีม
            </p>
          </Tier>
        </Plan>
      </div>
    </section>
  );
}

function Plan({ who, name, children }: { who: string; name: string; children: React.ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)]">
      <div className="bg-[var(--bot-navy)] px-4 py-3 text-[var(--bot-surface)]">
        <p className="text-xs opacity-80">{who}</p>
        <h3 className="text-lg font-semibold">{name}</h3>
      </div>
      <div className="flex flex-1 flex-col divide-y divide-[var(--bot-line)] px-4">{children}</div>
    </article>
  );
}

function Tier({ name, price, per, children }: { name: string; price: string; per?: string; children: React.ReactNode }) {
  return (
    <div className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{name}</span>
        <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-[var(--bot-navy)]">
          {price}{per && <small className="ml-1 text-sm font-medium text-[var(--bot-ink-mute)]">{per}</small>}
        </span>
      </div>
      {children}
    </div>
  );
}

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 space-y-0.5 text-sm">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span aria-hidden="true" className="text-[var(--bot-ok)]">✓</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
