#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""สร้างภาพสถาปัตยกรรมระบบ AdvisorTool (insurance-calc)"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.font_manager as fm

# ---------- fonts ----------
for f in fm.fontManager.ttflist:
    if f.name == "Sarabun":
        FONT = "Sarabun"
        break
else:
    FONT = "Noto Sans Thai"
plt.rcParams["font.family"] = FONT
plt.rcParams["axes.unicode_minus"] = False

# ---------- palette ----------
C = {
    "bg":      "#F7F8FC",
    "user":    "#E3F2FD", "user_e":  "#1E88E5",
    "app":     "#FFF3E0", "app_e":   "#FB8C00",
    "page":    "#FFFFFF",
    "core":    "#E8F5E9", "core_e":  "#43A047",
    "data":    "#F3E5F5", "data_e":  "#8E24AA",
    "ext":     "#E0F7FA", "ext_e":   "#00ACC1",
    "cron":    "#FFFDE7", "cron_e":  "#FDD835",
    "title":   "#1A237E",
    "text":    "#21243D",
}

fig, ax = plt.subplots(figsize=(16.5, 21))
ax.set_xlim(0, 100); ax.set_ylim(0, 132)
ax.axis("off")
fig.patch.set_facecolor(C["bg"])

def box(x, y, w, h, text, fc, ec, fs=11, bold=False, tc=None, lw=1.6, r=0.9):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
        boxstyle=f"round,pad=0,rounding_size={r}",
        facecolor=fc, edgecolor=ec, linewidth=lw, zorder=3))
    ax.text(x + w/2, y + h/2, text, ha="center", va="center",
            fontsize=fs, color=tc or C["text"],
            fontweight="bold" if bold else "normal",
            linespacing=1.35, zorder=4)

def layer(y0, y1, x0, x1, label, color):
    ax.add_patch(FancyBboxPatch((x0, y0), x1-x0, y1-y0,
        boxstyle="round,pad=0,rounding_size=1.4",
        facecolor=color, alpha=0.13, edgecolor="none", zorder=1))
    ax.text(x0+1.2, y1-1.6, label, fontsize=13.5, fontweight="bold",
            color=C["title"], ha="left", va="top", zorder=2)

def arrow(x1, y1, x2, y2, color="#78909C", lw=1.8, style="-|>", shrinkA=2, shrinkB=2,
          ls="-", con="arc3,rad=0"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2),
        arrowstyle=style, mutation_scale=14, lw=lw, color=color,
        shrinkA=shrinkA, shrinkB=shrinkB, linestyle=ls,
        connectionstyle=con, zorder=5))

# ---------- title ----------
ax.text(50, 130.3, "สถาปัตยกรรมระบบ AdvisorTool (insurance-calc)",
        ha="center", fontsize=25, fontweight="bold", color=C["title"])
ax.text(50, 128.2, "Next.js 15 + React 19 + Supabase  ·  Deploy บน Vercel (region sin1)",
        ha="center", fontsize=12.5, color="#5A5F82")

# =========================================================
# L1 ผู้ใช้ & ช่องทางเข้า
# =========================================================
layer(117, 127, 2, 98, "ผู้ใช้ & ช่องทางเข้า", C["user_e"])
box(5,   118.2, 16, 5, "ผู้ใช้ทั่วไป\n(ลูกค้า)", C["page"], C["user_e"], 11.5, True)
box(24,  118.2, 20, 5, "เว็บ / แชท AdvisorTool\nAppShell หน้าแรก", C["page"], C["user_e"], 11)
box(47,  118.2, 17, 5, "Facebook Messenger\nPOST /api/facebook/webhook", C["page"], C["user_e"], 10)
box(67,  118.2, 13, 5, "LINE\n/api/line/webhook", C["page"], C["user_e"], 10.5)
box(83,  118.2, 14, 5, "ทีมงาน\n(/studio · /admin)", C["page"], C["user_e"], 11)

# =========================================================
# L2 Next.js App
# =========================================================
layer(84, 116.5, 2, 98, "แอปพลิเคชัน Next.js 15  (src/app — Pages + API Routes)", C["app_e"])
# pages
ax.text(4, 114.6, "หน้าเว็บ (App Router)", fontsize=11.5, fontweight="bold", color=C["app_e"])
box(4,  105.5, 21, 7.5, "เครื่องคำนวณเบี้ย\n/lifeprotect · /fhc · /easyprotect\n/plb · /ihealthy-ultra · /legacy\n/ishield · /ci123 · /cancer …", C["page"], C["app_e"], 9.8)
box(4,   99,   21, 5, "หน้า Landing\n/home · /bumnan95 · /ask", C["page"], C["app_e"], 10)
box(28, 105.5, 20, 7.5, "สตูดิโอคอนเทนต์ /studio\nwrite · calendar · hooks · people\nrecruit · thumbnail · ads · wallet\nclaim · thanks · showcase …", C["page"], C["app_e"], 9.8)
box(28,  99,   20, 5, "หลังบ้าน /admin\ncrm · messenger · ads · ai\nmembers · knowledge · team", C["page"], C["app_e"], 9.8)
box(51, 105.5, 21, 7.5, "ระบบสมาชิก & เงิน\n/auth/google · /signup\n/studio/wallet · /studio/account\n/admin/topups · Stripe checkout", C["page"], C["app_e"], 9.8)
box(51,  99,   21, 5, "FHC CRM ลูกค้า\n/fhc/customers/[id]", C["page"], C["app_e"], 10)

# api routes
ax.text(4, 96.3, "API Routes (src/app/api)", fontsize=11.5, fontweight="bold", color=C["app_e"])
box(4,  88, 21, 7, "Webhooks บอทแชท\n/api/facebook/webhook\n/api/line/webhook\n/api/stripe/webhook", C["page"], C["app_e"], 9.8)
box(28, 88, 20, 7, "เอกสาร & การ์ด\n/api/quote-pdf · /api/card\n(ihealthy-card, fonts ไทย,\nsatori + Chromium)", C["page"], C["app_e"], 9.8)
box(51, 88, 21, 7, "คอนเทนต์ & วิดีโอ\n/api/content-* (generate, draft,\nposter, video…) · /api/quote-video", C["page"], C["app_e"], 9.8)
box(75, 88, 21, 7, "Public API & อื่น ๆ\n/api/v1 (quote, plans, MCP)\n/api/chat-review · /api/stats\n/api/shell · /api/switches", C["page"], C["app_e"], 9.8)
box(75, 99, 21, 14, "ระบบ AI\n/api/ai-health · /api/meta\nassistant (plb, lifeprotect,\nihealthy, legacy, ishield…)\nlib/ai · lib/copilot · lib/voice", C["page"], C["app_e"], 9.8)
box(75, 105.5, 0.1, 0.1, "", C["bg"], C["bg"])  # noop

# =========================================================
# L3 โมดูลหลัก src/lib
# =========================================================
layer(64, 82.5, 2, 98, "โมดูลหลัก (src/lib)", C["core_e"])
box(4,  70, 22, 10, "เครื่องยนต์คำนวณเบี้ย\nquote · lookup · rules · money\nplb · lifeprotect · ihealthy · legacy\nishield · lifetreasure · pension …", C["page"], C["core_e"], 10)
box(28, 70, 22, 10, "คอนเทนต์ & วิดีโอ\ncontent · video/engines · shotstack\nquote-video · story · prompt-story\nsatori · remotion", C["page"], C["core_e"], 10)
box(52, 70, 22, 10, "CRM & การตลาด\ncrm · members · referrals\nads · facebook · meta\nline · survey · stats", C["page"], C["core_e"], 10)
box(76, 70, 20, 10, "โครงสร้างพื้นฐาน\nauth · supabase · stripe · wallet\nadmin · shell · switches · pricing\nsentry-options · cron-auth", C["page"], C["core_e"], 10)

# =========================================================
# L4 ข้อมูล
# =========================================================
layer(46, 61.5, 2, 63, "ชั้นข้อมูล", C["data_e"])
box(4,  48.5, 27, 10, "Supabase (Postgres)\nsupabase/migrations — ลีด/บทสนทนา,\ncontent, ads, wallet, CRM, staff…\nเข้าถึงด้วย service role (ฝั่งเซิร์ฟเวอร์)", C["page"], C["data_e"], 10)
box(34, 48.5, 26, 10, "ไฟล์ข้อมูลใน repo\ndata/ — rates, rules, cash-values,\nriders, bundles (JSON)\nscripts: extract_rates.py · make_golden.py\n(ไฟล์ .xlsx ต้นฉบับ → golden tests)", C["page"], C["data_e"], 9.6)

# =========================================================
# L5 External services
# =========================================================
layer(46, 61.5, 66, 98, "บริการภายนอก", C["ext_e"])
box(68, 54.5, 13.5, 7, "Stripe\nชำระเงิน / เติมเครดิต", C["page"], C["ext_e"], 9.6)
box(83.5, 54.5, 13.5, 7, "Meta (Facebook)\nMarketing API + Graph API", C["page"], C["ext_e"], 9.6)
box(68, 48.5, 13.5, 4.5, "LINE Messaging API\n+ Messaging CRM", C["page"], C["ext_e"], 9.2)
box(83.5, 48.5, 13.5, 4.5, "Shotstack / Remotion\nเรนเดอร์วิดีโอ", C["page"], C["ext_e"], 9.2)

# =========================================================
# L6 Infra video
# =========================================================
layer(29, 43, 2, 98, "โครงสร้างพื้นฐานวิดีโอ (infra/)", C["ext_e"])
box(4,  31, 28, 9, "AWS Lambda  render ฟีเจอร์ยาว\n(lambda-ffmpeg · Dockerfile · core.mjs)\n@aws-sdk/client-lambda", C["page"], C["ext_e"], 10)
box(35, 31, 28, 9, "Google Cloud Run — FFmpeg\n(cloudrun-ffmpeg · cloudbuild.yaml)\nrender งานหนักแบบ job-based", C["page"], C["ext_e"], 10)
box(66, 31, 30, 9, "Sentry (@sentry/nextjs)\nmonitor error ของแอป", C["page"], C["ext_e"], 10)

# =========================================================
# L7 Cron
# =========================================================
layer(12, 26, 2, 98, "งานตามเวลา (Cron)", C["cron_e"])
box(4,  15, 29, 8, "01:00 — /api/chat-review\nทบทวน ตอบ และส่งต่อบทสนทนาแชท", C["page"], C["cron_e"], 10)
box(36, 15, 29, 8, "03:00 — /api/facebook/ads/sync\nดึงสถิติโฆษณาจาก Meta รายวัน", C["page"], C["cron_e"], 10)
box(68, 15, 28, 8, "04:00 — /api/content-video/sweep\nเช็กสถานะงานเรนเดอร์วิดีโอค้าง", C["page"], C["cron_e"], 10)

# =========================================================
# arrows between layers
# =========================================================
# users -> app
for x in (32, 55.5, 73.5):
    arrow(x, 119.4, x, 116.6, color=C["user_e"])
arrow(90, 119.4, 40, 116.6, color=C["user_e"], con="arc3,rad=-0.15")
# app -> core
for x in (15, 38, 63, 86):
    arrow(x, 88, x, 80.6, color=C["app_e"])
# core -> data
for x in (17.5, 47):
    arrow(x, 70, x, 59.1, color=C["core_e"])
arrow(63, 68, 70, 61.6, color=C["core_e"], con="arc3,rad=-0.1")
# core -> ext
for x in (74.75, 90.25):
    arrow(x, 70, x, 61.9, color=C["ext_e"])
# data <-> ext
arrow(60.5, 53, 67.9, 53, color="#B0BEC5", style="<|-|>")
# app/content-video -> infra
arrow(61.5, 88, 18, 40.2, color="#90A4AE", con="arc3,rad=0.12")
arrow(61.5, 88, 49, 40.2, color="#90A4AE", con="arc3,rad=0.06")
# app -> sentry
arrow(70, 86, 81, 40.2, color="#90A4AE", con="arc3,rad=-0.12")
# cron -> app (dashed up arrows)
arrow(18.5, 23.2, 12, 87.8, color=C["cron_e"], ls="--", con="arc3,rad=0.1")
arrow(50.5, 23.2, 42, 87.8, color=C["cron_e"], ls="--", con="arc3,rad=0.08")
arrow(82, 23.2, 58, 87.8, color=C["cron_e"], ls="--", con="arc3,rad=-0.08")

# legend
box(4, 3.5, 92, 6.5,
    "โฟลว์หลัก: ผู้ใช้ → หน้าเว็บ/Webhook → API Routes → โมดูล src/lib → Supabase / บริการภายนอก      "
    "เส้นประ = cron เรียก API ตามเวลา      "
    "วิดีโอ render นอกเครื่องผ่าน Lambda / Cloud Run (infra/)",
    "#FFFFFF", "#B0BEC5", 11)

plt.savefig("/Users/pheerapatpisit/Documents/APP/advisortoolapp/scripts-arch-diagram/architecture.png",
            dpi=170, bbox_inches="tight", facecolor=C["bg"])
print("saved")
