"use client";
import { useState, useTransition, type FormEvent } from "react";
import { Field, FormError } from "@/components/auth/fields";
import { INPUT, MUTE, PRIMARY } from "@/components/auth/styles";
import { saveMyContact, saveMyPhoto, type Result } from "./actions";

const CARD = "space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const SIDE = 512;
/** as cleanMore and NAME_MAX in src/lib/quote-video/contact.ts (that file is server-only) */
const MORE_MAX = 80;
const NAME_MAX = 40;

/** the picked photo, cut square from its middle and made small, as a JPEG */
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, SIDE, SIDE);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/jpeg", 0.86));
}

/**
 * ข้อมูลติดต่อในวิดีโอนำเสนอ (owner, 2026-10-11): what a customer sees at the end of a clip.
 * Name and phone are needed to make one; photo, LINE and รายละเอียดเพิ่มเติม (2026-10-14) are not.
 * The name is the account's unless one is typed here for the card (2026-10-18).
 */
export function ContactForm({ accountName, name, phone, line, more, photo }: { accountName: string; name: string; phone: string; line: string; more: string; photo: string | null }) {
  const [typed, setTyped] = useState(name);
  const [moreLen, setMoreLen] = useState([...more].length);
  const [shown, setShown] = useState(photo);
  const [result, setResult] = useState<Result>();
  const [photoError, setPhotoError] = useState<string>();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError(undefined);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("photo", await squareJpeg(file), "photo.jpg");
      const r = await saveMyPhoto(fd);
      if (r.ok) setShown(r.url ?? null);
      else setPhotoError(r.error);
    } catch {
      setPhotoError("อ่านรูปนี้ไม่ได้ ลองรูปอื่น");
    } finally {
      setUploading(false);
    }
  }

  const initial = [...(typed.trim() || accountName.trim())][0] ?? "?";
  return (
    <form method="post" className={CARD} onSubmit={(e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => setResult(await saveMyContact(String(fd.get("name") ?? ""), String(fd.get("phone") ?? ""), String(fd.get("line") ?? ""), String(fd.get("more") ?? ""))));
    }}>
      <div>
        <h2 className="font-semibold">ข้อมูลติดต่อในวิดีโอนำเสนอ</h2>
        <p className={`mt-1 text-sm ${MUTE}`}>ลูกค้าเห็นรูป ชื่อ เบอร์ LINE และรายละเอียดเพิ่มเติมนี้ในช่วงปิดท้ายของวิดีโอ</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ct-soft)] text-2xl font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : initial}
        </div>
        <div>
          <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)]">
            {uploading ? "กำลังอัปโหลด…" : "เลือกรูป"}
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <p className={`mt-1 text-xs ${MUTE}`}>รูปหน้าตรง ระบบตัดเป็นวงกลมให้ ไม่ใส่ก็ได้</p>
        </div>
      </div>
      {photoError && <FormError>{photoError}</FormError>}
      <Field id="contact-name" label="ชื่อที่แสดง" hint={`ชื่อที่ลูกค้าเห็นท้ายวิดีโอ · ไม่เกิน ${NAME_MAX} ตัวอักษร · เว้นว่างไว้ = ใช้ชื่อบัญชี “${accountName}”`}>
        <input id="contact-name" name="name" defaultValue={name} maxLength={NAME_MAX} placeholder={accountName} className={INPUT} onChange={(e) => { setTyped(e.target.value); setResult(undefined); }} />
      </Field>
      <Field id="contact-phone" label="เบอร์โทร">
        <input id="contact-phone" name="phone" type="tel" defaultValue={phone} maxLength={20} placeholder="081-234-5678" className={INPUT} onChange={() => setResult(undefined)} />
      </Field>
      <Field id="contact-line" label="LINE ID (ไม่บังคับ)" hint="ใส่ได้ทั้ง @ไอดี ของ LINE OA หรือไอดีส่วนตัว">
        <input id="contact-line" name="line" defaultValue={line} maxLength={41} placeholder="@yourline" className={INPUT} onChange={() => setResult(undefined)} />
      </Field>
      <Field id="contact-more" label="รายละเอียดเพิ่มเติม (ไม่บังคับ)" hint={`เช่น ตำแหน่ง ใบอนุญาต เพจ Facebook หรือเวลาที่สะดวกให้ติดต่อ · ไม่เกิน 2 บรรทัด · ${moreLen}/${MORE_MAX}`}>
        <textarea id="contact-more" name="more" defaultValue={more} maxLength={MORE_MAX} rows={2} placeholder="ตัวแทนประกันชีวิต กรุงไทย-แอกซ่า" className={INPUT} onChange={(e) => { setMoreLen([...e.target.value].length); setResult(undefined); }} />
      </Field>
      {result && (result.ok ? <p role="status" className="text-sm text-[var(--bot-ok)]">บันทึกแล้ว</p> : <FormError>{result.error}</FormError>)}
      <button disabled={pending} className={PRIMARY}>บันทึกข้อมูลติดต่อ</button>
    </form>
  );
}
