/**
 * What each ledger `task` was, in the words of the person reading /admin/ai.
 *
 * The ledger keeps the code's name for the work — "route", "plan_info_health_en",
 * "content-image-look" — which says nothing to the owner, who asked what the money went on.
 * A task missing here still shows, under its code name: a new caller should not vanish from
 * the bill just because nobody wrote it a label yet.
 */
const LABEL: Record<string, string> = {
  // the chat bots (Messenger / LINE)
  route: "บอทแชท — อ่านว่าลูกค้าถามอะไร",
  route_health: "บอทแชท iHealthy — อ่านว่าลูกค้าถามอะไร",
  route_health_en: "บอทแชทภาษาอังกฤษ — อ่านว่าลูกค้าถามอะไร",
  route_shadow: "บอทแชท — ตัวตัดสินสำรอง (ทดสอบเงียบ)",
  plan_info: "บอทแชท — ตอบเรื่องแบบประกัน",
  plan_info_health: "บอทแชท iHealthy — ตอบเรื่องแบบประกัน",
  plan_info_health_en: "บอทแชทภาษาอังกฤษ — ตอบเรื่องแบบประกัน",
  small_talk: "บอทแชท — คุยทั่วไป",
  smalltalk: "บอทแชท — คุยทั่วไป",
  small_talk_health: "บอทแชท iHealthy — คุยทั่วไป",
  small_talk_health_en: "บอทแชทภาษาอังกฤษ — คุยทั่วไป",
  "chat-review": "ทบทวนแชทจริง (ฝึกบอท)",
  // planning and the financial health check
  "plan-advice": "วางแผนประกัน — เขียนคำแนะนำ",
  "plan-order": "วางแผนประกัน — เรียงลำดับความสำคัญ",
  "fhc-summary": "ตรวจสุขภาพการเงิน — สรุปผล",
  // the agents' assistant and its knowledge
  copilot: "ผู้ช่วยตัวแทน — ตอบคำถาม",
  library: "ผู้ช่วยตัวแทน — ค้นคลังความรู้",
  doc_qa: "ถามตอบจากเอกสาร",
  search: "ค้นหาความรู้ (ฝังเวกเตอร์)",
  "faq-search": "ค้นหา FAQ (ฝังเวกเตอร์)",
  "faq-index": "จัดทำดัชนี FAQ",
  "knowledge-ingest": "นำเข้าความรู้ใหม่",
  // Studio
  content: "Studio — เขียนโพสต์",
  "content-plan": "Studio — วางโครงโพสต์",
  "content-headline": "Studio — เขียนพาดหัว",
  "content-proofread": "Studio — ตรวจคำผิด",
  "content-hook-template": "Studio — แปลงประโยคเปิดเป็นสูตร",
  "content-image": "Studio — สร้างรูป",
  "content-image-brief": "Studio — เขียนบรีฟรูป",
  "content-image-look": "Studio — เลือกสไตล์รูป",
  "content-poster-read": "Studio — อ่านโปสเตอร์",
  "content-showcase-read": "Studio — อ่านรูปผลงาน",
  "content-claim-read": "Studio — อ่านเอกสารเคลม",
  "content-describe-picture": "Studio — อ่านรูปเป็นพรอมต์",
  "content-thumbnail": "Studio — ภาพปกคลิป",
  "content-thumbnail-ideas": "Studio — คิดหัวปกคลิป",
  "content-clip": "Studio — ตัดคลิป (เลือกช่วง)",
  "content-edit": "Studio — เรนเดอร์คลิป",
  // trials and checks
  probe: "ทดสอบกุญแจ",
  "content-bakeoff": "ทดลองเทียบโมเดล",
  "content-claimcheck-test": "ทดลองตรวจคำกล่าวอ้าง",
  "content-image-test": "ทดลองสร้างรูป",
  "typesafe-trial": "ทดลองตัวตัดสิน TypeSafe",
};

/** The owner's words for a ledger task, or the task's own name when nobody has written any. */
export function taskLabel(task: string | null | undefined): string {
  if (!task) return "ไม่ระบุงาน";
  return LABEL[task] ?? task;
}
