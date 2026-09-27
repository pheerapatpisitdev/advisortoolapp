import type { Metadata } from "next";
import { Card } from "../ui";
import { facebookStatuses } from "@/lib/facebook/status";
import { pageConnections, readPending } from "@/lib/facebook/connection";
import { inboxIsQuiet, lastCustomerMessageAt } from "@/lib/facebook/inbound";
import { listPages, oauthIsConfigured, SCOPES, SUBSCRIBED_FIELDS } from "@/lib/facebook/oauth";
import { DisconnectButton } from "./DisconnectButton";
import { PagePicker, type Choice } from "./PagePicker";
import { RefreshSubscriptionButton } from "./RefreshSubscriptionButton";
import { siteOrigin } from "@/lib/site-url";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Messenger | advisortool" };

/**
 * A moment as the owner's own clock reads it.
 *
 * The page renders on Vercel, whose clock is UTC, and toLocaleString without a zone formats
 * in the server's zone — so a Page connected at 13:39 in Bangkok used to say 06:39.
 */
const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** "3 ชม. ที่แล้ว", "2 วันที่แล้ว" — how old, which is what the amber is about. */
function ago(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ชม. ที่แล้ว`;
  return `${Math.round(hours / 24)} วันที่แล้ว`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-[var(--bot-line)] py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 text-[var(--bot-ink-mute)]">{label}</span>
      <span className="min-w-0 break-all">{children}</span>
    </div>
  );
}

const OUTCOMES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "เชื่อมต่อเพจเรียบร้อยแล้ว บอทเริ่มตอบข้อความได้ทันที" },
  choose: { tone: "warn", text: "เข้าสู่ระบบ Facebook แล้ว เหลือเลือกเพจที่จะให้บอทตอบ" },
  cancelled: { tone: "warn", text: "ยกเลิกจากหน้า Facebook ยังไม่ได้เชื่อมต่ออะไร" },
  state: { tone: "bad", text: "ลิงก์เชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อใหม่อีกครั้ง" },
  nopages: { tone: "bad", text: "บัญชี Facebook นี้ไม่ได้เป็นแอดมินเพจไหนเลย" },
  unconfigured: { tone: "bad", text: "ยังไม่ได้ตั้งค่า FB_APP_ID กับ FB_APP_SECRET" },
  failed: { tone: "bad", text: "เชื่อมต่อไม่สำเร็จ" },
};

const TONES = {
  ok: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
  warn: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]",
  bad: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]",
};

/**
 * Stands where the connect button would be when this deployment has no OAuth secret.
 *
 * On a developer's machine that is the normal state, not a fault: Meta matches the callback
 * against its allow-list character for character and localhost is not on it, so the
 * connection was never going to start from here however the environment is filled in. What
 * the box used to say — the names of two environment variables — was addressed to somebody
 * who does not set environment variables, and it was a dead end. The live back office, where
 * the button does work, is the thing worth handing over.
 *
 * The variable names stay, small and last, because this box also appears if the live site
 * ever loses its secret, and then they are the whole diagnosis.
 */
function ConnectOnTheLiveSite() {
  return (
    <div className="rounded-md border border-dashed border-[var(--bot-line)] px-3 py-5 text-center">
      <p className="text-sm text-[var(--bot-ink-foot)]">
        ต่อเพจจากเครื่องนี้ไม่ได้ — Facebook ยอมให้ต่อจากเว็บจริงเท่านั้น
      </p>
      <a
        href={`${siteOrigin()}/admin/messenger`}
        className="mt-3 inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0653cc]"
      >
        ไปต่อเพจที่เว็บจริง →
      </a>
      <p className="mt-3 text-xs text-[var(--bot-ink-faint)]">เครื่องนี้ยังไม่ได้ตั้ง FB_APP_ID กับ FB_APP_SECRET</p>
    </div>
  );
}

/**
 * The Pages a half-finished login is waiting to choose between — none once that login is an
 * hour old, which readPending decides.
 */
async function pendingChoices(): Promise<Choice[]> {
  const pending = await readPending();
  if (!pending) return [];
  try {
    return (await listPages(pending.token)).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return [];
  }
}

/**
 * The one line on this screen that cannot be green by mistake: when a customer's message
 * last landed in the database.
 *
 * Said once for all Pages, and says so, because the table it reads keeps the message id and
 * the time but not the Page — a per-Page line would have to invent which Page it was.
 */
function Inbound({ at }: { at: string | null }) {
  const quiet = inboxIsQuiet(at);
  return (
    <div
      className={`mb-4 rounded-md px-3 py-2 text-sm ${quiet ? "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]" : "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]"}`}
    >
      <p>
        {at ? (
          <>ข้อความลูกค้าล่าสุดเข้าเมื่อ <strong>{when(at)}</strong> ({ago(at)})</>
        ) : (
          <>ยังไม่เคยมีข้อความลูกค้าเข้าระบบเลย</>
        )}
      </p>
      <p className="mt-0.5 text-xs">นับรวมทุกเพจ — ระบบยังไม่ได้จดว่าข้อความเข้ามาทางเพจไหน</p>
      {quiet && (
        <p className="mt-1 text-xs">
          ไม่มีข้อความเข้ามาเกิน 24 ชั่วโมงแล้ว ถ้าเพจมีคนทักแต่ตรงนี้ไม่ขยับ แปลว่าข้อความไม่เข้าระบบ —
          ลองทักเพจเองสักข้อความ แล้วเปิดหน้านี้ใหม่ ถ้าเวลาไม่เปลี่ยน บอทไม่ได้รับข้อความ
        </p>
      )}
    </div>
  );
}

export default async function MessengerAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await gatePage("/admin/messenger", "connect");
  const params = await searchParams;
  const outcome = OUTCOMES[String(params.fb ?? "")];
  const detail = typeof params.detail === "string" ? params.detail : undefined;

  const [connections, choices, lastInbound] = await Promise.all([
    pageConnections(),
    pendingChoices(),
    /** undefined when the table could not be read — then the line is left off, not guessed */
    lastCustomerMessageAt().catch(() => undefined),
  ]);
  /**
   * Asked after the list, and asked per Page. Checking one token and calling it "the status"
   * is what let a revoked Page sit behind a green tick while it answered nobody.
   */
  const statuses = await facebookStatuses(connections);
  const revoked = statuses.filter((s) => s.revoked);

  return (
    <>
      {outcome && (
        <div className={`mb-4 rounded-md px-3 py-2 text-sm ${TONES[outcome.tone]}`}>
          <p>{outcome.text}</p>
          {/* Meta's own words, kept because they are the diagnosis — but under a Thai line that
              says what they are, because on their own they read like the page itself broke. */}
          {detail && (
            <p className="mt-1 text-xs">
              ข้อความจาก Facebook (ภาษาอังกฤษ ส่งให้คนดูแลระบบได้เลย): <span className="break-all">{detail}</span>
            </p>
          )}
        </div>
      )}

      {/* Said once at the top as well: the per-Page red is below the fold on a phone, and the
          Page that went dark is the one paying for advertisements today. */}
      {revoked.length > 0 && (
        <p className="mb-4 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">
          เพจ {revoked.map((s) => s.connectedPageName).join(", ")} ถูก Meta ถอนสิทธิ์ ตอบลูกค้าไม่ได้ในตอนนี้ — ดูวิธีแก้ในกล่องข้างล่าง
        </p>
      )}

      {/* The picker is its own card, above the list, and never instead of it. It used to take
          the list's place whenever a login was waiting, so a login abandoned the day before hid
          every connected Page's health — including a revoked one — behind a list of checkboxes. */}
      {choices.length > 0 && (
        <Card title="เลือกเพจจากการเข้าสู่ระบบเมื่อสักครู่" hint="ถ้าไม่ได้เพิ่งกดเชื่อมต่อ กด “ยกเลิก” ได้เลย รายการนี้หายเองใน 1 ชั่วโมง">
          <PagePicker pages={choices} connectedIds={connections.map((c) => c.pageId)} />
        </Card>
      )}

      <Card title="เพจที่บอทตอบให้" hint="สถานะอ่านสดจาก Meta ทุกครั้งที่เปิดหน้านี้">
        {statuses.length > 0 && lastInbound !== undefined && <Inbound at={lastInbound} />}
        {statuses.length > 0 ? (
          /* One block per Page, each carrying what Meta says about that Page right now. It was
             written for exactly one because there could only be one — connecting a second
             overwrote the first without a word. */
          <div className="space-y-5">
            {statuses.map((status) => {
              const connection = connections.find((c) => c.pageId === status.connectedPageId);
              const fields = status.fields ?? connection?.fields ?? [];
              const missingFields = SUBSCRIBED_FIELDS.filter((f) => !fields.includes(f));
              const name = status.connectedPageName || status.pageName || "—";
              const id = status.connectedPageId || status.pageId || "—";
              return (
                <div
                  key={id}
                  className={`rounded-lg border p-3 ${status.revoked ? "border-[var(--bot-red)] bg-[var(--bot-red-soft)]" : "border-[var(--bot-line)]"}`}
                >
                  <Row label="ชื่อเพจ"><span className="font-medium">{name}</span></Row>
                  <Row label="รหัสเพจ">{id}</Row>
                  <Row label="การตอบข้อความ">
                    {status.messagingOk === undefined ? (
                      <span className="text-[var(--bot-sand-ink)]">ตรวจไม่ได้ชั่วคราว</span>
                    ) : status.messagingOk ? (
                      <span className="text-[var(--bot-ok)]">✓ สิทธิ์เชื่อมต่อใช้งานได้ บอทส่งและรับข้อความได้</span>
                    ) : (
                      <span className="text-[var(--bot-red-ink)]">✗ สิทธิ์เชื่อมต่อใช้งานไม่ได้ เพจนี้ตอบใครไม่ได้เลย</span>
                    )}
                  </Row>
                  <Row label="การรับข้อมูล">
                    {status.subscribed === undefined ? "—" : status.subscribed ? (
                      <span className="text-[var(--bot-ok)]">✓ เพจส่งข้อมูลมาที่แอปนี้แล้ว</span>
                    ) : (
                      <span className="text-[var(--bot-red-ink)]">✗ เพจยังไม่ได้ส่งข้อมูลมาที่แอปนี้ บอทจะไม่ได้รับข้อความ</span>
                    )}
                  </Row>
                  <Row label="เหตุการณ์ที่รับ">{fields.length ? fields.join(", ") : "—"}</Row>
                  {connection && (
                    <>
                      <Row label="เชื่อมต่อเมื่อ">
                        {when(connection.connectedAt)}
                      </Row>
                      <Row label="สิทธิ์ที่ได้รับ">{connection.scopes.join(", ") || "—"}</Row>
                    </>
                  )}

                  {status.errors.map((e) => (
                    <p key={e} className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">{e}</p>
                  ))}
                  {/* The one thing that fixes a revoked Page, said where the red is, because
                      the obvious move — connect this Page on its own — is what revoked it. */}
                  {status.revoked && (
                    <p className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">
                      วิธีแก้: กด “เชื่อมต่อเพจเพิ่ม” ข้างล่าง แล้วในหน้าจอเลือกเพจของ Facebook
                      <strong> ติ๊กทุกเพจในรายการนี้พร้อมกัน</strong> ไม่ใช่เฉพาะเพจนี้ —
                      Facebook เขียนทับสิทธิ์ทุกครั้งที่เข้าสู่ระบบ เพจที่ไม่ได้ติ๊กจะถูกถอนสิทธิ์
                    </p>
                  )}
                  {status.notes.map((n) => (
                    <p key={n} className="mt-2 rounded-md bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]">{n}</p>
                  ))}
                  {!status.revoked && missingFields.length > 0 && (
                    <p className="mt-2 rounded-md bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]">
                      ระบบรุ่นนี้ต้องรับเหตุการณ์ {missingFields.join(", ")} ด้วย ไม่งั้นปุ่มคำถามที่ลูกค้ากดจะไม่ถึงบอท
                      <span className="ml-3 inline-block"><RefreshSubscriptionButton pageId={status.connectedPageId} /></span>
                    </p>
                  )}
                  {connection && <div className="pt-3"><DisconnectButton pageId={connection.pageId} /></div>}
                </div>
              );
            })}
            {/* The button, not a sentence pointing at one.
                It only existed on the branch for "no Page connected yet", which is the branch
                nobody with a Page to add is looking at — so the line under the list told the
                reader to press something that was not on the screen. */}
            <div className="border-t border-[var(--bot-line)] pt-4">
              <p className="mb-3 text-sm text-[var(--bot-ink-foot)]">
                ต่อเพจเพิ่มได้ เข้าสู่ระบบด้วยบัญชีที่เป็นแอดมินของเพจนั้น
              </p>
              <p className="mb-3 rounded-md bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]">
                ⚠️ ในหน้าจอเลือกเพจของ Facebook ให้ <strong>ติ๊กทุกเพจที่ต้องการ รวมเพจที่ต่อไว้แล้วข้างบนด้วย</strong>{" "}
                Facebook ไม่ได้รวมสิทธิ์เก่ากับใหม่ แต่เขียนทับทั้งหมด เพจที่ไม่ได้ติ๊กจะถูกถอนสิทธิ์และตอบลูกค้าไม่ได้ทันที
              </p>
              {oauthIsConfigured() ? (
                <a
                  href="/api/facebook/connect"
                  className="inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0653cc]"
                >
                  เชื่อมต่อเพจเพิ่ม
                </a>
              ) : (
                <ConnectOnTheLiveSite />
              )}
            </div>
          </div>
        ) : choices.length > 0 ? (
          <p className="text-sm text-[var(--bot-ink-foot)]">ยังไม่มีเพจที่เชื่อมไว้ — ติ๊กเพจในกล่องข้างบนแล้วกดเชื่อมต่อ</p>
        ) : (
          <div>
            <p className="mb-3 text-sm text-[var(--bot-ink-foot)]">
              กดปุ่มแล้วเข้าสู่ระบบ Facebook ด้วยบัญชีที่เป็นแอดมินเพจ ระบบจะขอสิทธิ์เท่าที่จำเป็น
              เก็บสิทธิ์เชื่อมต่อไว้ให้เอง และสมัครรับข้อความจากเพจให้เสร็จในขั้นตอนเดียว ติ๊กได้หลายเพจพร้อมกัน
            </p>
            {oauthIsConfigured() ? (
              <a
                href="/api/facebook/connect"
                className="inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0653cc]"
              >
                เชื่อมต่อกับ Facebook
              </a>
            ) : (
              <ConnectOnTheLiveSite />
            )}
            <p className="mt-3 text-xs text-[var(--bot-ink-mute)]">สิทธิ์ที่ขอ: {SCOPES.join(", ")}</p>
          </div>
        )}
      </Card>

      <Card title="ใครคุยกับบอทได้บ้าง" hint="ตรวจกับคนนอกจริงแล้วเมื่อ 4 ก.ย. 2569">
        <p className="text-sm text-[var(--bot-ink-foot)]">
          ลูกค้าทุกคนที่ทักเพจนี้ได้รับคำตอบ ไม่ต้องมีบทบาทในแอป เพราะเพจกับแอปเป็นของธุรกิจเดียวกัน
          Meta จึงให้สิทธิ์ระดับมาตรฐานครอบคลุมเพจของตัวเองอยู่แล้ว
        </p>
        <p className="mt-2 text-sm text-[var(--bot-ink-foot)]">
          App Review จำเป็นก็ต่อเมื่อจะเอาบอทไปตอบเพจของธุรกิจอื่น ขั้นตอนทั้งหมดอยู่ในไฟล์{" "}
          <code className="rounded bg-[var(--bot-panel)] px-1">docs/facebook-connect.md</code> ในโปรเจกต์
        </p>
      </Card>

    </>
  );
}
