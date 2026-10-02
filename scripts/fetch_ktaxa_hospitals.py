"""Krungthai-AXA Life's hospital network, read off its own public page into data/hospitals.

iHealthy Ultra is a Krungthai-AXA Life contract, so this list — not AXA Insurance PCL's, which
is a different company with its own contracts — is the one that says where Fax Claim works.

The page embeds the whole network in its __NEXT_DATA__. Its English names and districts are
misaligned on about half the rows (Bumrungrad's English name reads "Mongkutwattana Hospital"),
so the page's English name is kept only where it shares a word with the uid, and otherwise the
name is rebuilt from the uid; Thai fields and the province link are taken as they are.

Run: python3 scripts/fetch_ktaxa_hospitals.py
"""

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://www.krungthai-axa.co.th/customer-service/hospitals"
OUT = Path(__file__).resolve().parent.parent / "data" / "hospitals" / "ktaxa-network.json"

# words that are part of a uid but not of a name a customer would recognise as English
SMALL = {"of", "and", "the", "at"}


def english_name(uid: str) -> str:
    words = [w for w in uid.split("-") if w]
    # an initialism has no vowel in it (BNH, MRT); every other word is a word (Don, Koh)
    return " ".join(w if w in SMALL else w.upper() if not re.search(r"[aeiouy]", w) else w.capitalize() for w in words)


GENERIC = {"hospital", "clinic", "medical", "branch", "the", "international"}


def tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", (text or "").lower()) if len(t) > 2 and t not in GENERIC}


def name_en(uid: str, given: str | None) -> str:
    """The page's own English name where it agrees with the uid, the uid's words where it does not."""
    given = (given or "").strip()
    return given if given and tokens(given) & tokens(uid) else english_name(uid)


def uids(group: list | None, key: str) -> list[str]:
    out = []
    for item in group or []:
        uid = (item.get(key) or {}).get("uid")
        if uid and uid not in out:
            out.append(uid)
    return out


def main() -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    raw = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not raw:
        raise SystemExit("no __NEXT_DATA__ on the page — the page has changed")
    props = json.loads(raw.group(1))["props"]["pageProps"]

    provinces = {
        p["id"]: (p["data"]["province_name_th"], p["data"]["province_name_en"]) for p in props["province"]
    }

    records = []
    for doc in props["hospital"]:
        d = doc["data"]
        province = provinces.get((d.get("hospital_province_th") or {}).get("id"), ("", ""))
        records.append({
            "id": doc["uid"],
            "th": (d.get("hospital_name_th") or "").strip(),
            "en": name_en(doc["uid"], d.get("hospital_name_en")),
            "district": (d.get("hospital_address_district_th") or "").strip(),
            "province": province[0],
            "provinceEn": province[1],
            "type": (d.get("hospital_type_th") or {}).get("uid") or "",
            "care": uids(d.get("group_hospital_treatment_th"), "hospital_treatment_th"),
            "personalHealth": "personal-health-insurance" in uids(d.get("group_hospital_service_th"), "hospital_service_th"),
            "phone": (d.get("hospital_phone_th") or "").strip(),
        })
    records.sort(key=lambda r: (r["province"], r["th"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": URL,
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "hospitals": records,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(records)} hospitals and clinics → {OUT}")


if __name__ == "__main__":
    main()
