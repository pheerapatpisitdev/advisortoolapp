#!/usr/bin/env python3
"""Extract rate tables from the company Excel proposal files into data/rates/<plan>.json.

Deterministic: running twice on the same Excel files yields byte-identical JSON.
Never edit data/rates/*.json by hand; edit this script and re-run `npm run extract`.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

# The IHU plan numbers live with the benefit table that also ships them, so the rate JSON
# and the benefit JSON the page joins cannot drift apart.
from extract_ihu_benefits import PLAN_NO as IHU_PLAN_NO
from extract_ihu_benefits import extract as extract_ihu_benefits

ROOT = Path(__file__).resolve().parents[1]
# The workbooks are not in git, so a git worktree has none of them. Point this at the real
# checkout to run an extraction from one: XLSX_DIR=/path/to/repo/ไฟล์คำนวน npm run extract
import os
XLSX_DIR = Path(os.environ.get("XLSX_DIR") or ROOT / "ไฟล์คำนวน")
OUT_DIR = ROOT / "data" / "rates"
MODE_MAP = {"รายปี": "annual", "ราย 6 เดือน": "semi", "รายเดือน": "monthly"}


def cell(ws, r, c):
    return ws.cell(r, c).value


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def mode_factors(cal):
    """Cal!I2:J5 — Thai mode label → factor."""
    out = {MODE_MAP[cell(cal, r, 9)]: cell(cal, r, 10) for r in range(2, 6) if cell(cal, r, 9) in MODE_MAP}
    assert set(out) == {"annual", "semi", "monthly"}, out
    return out


def age_class_table(ws, first_row, last_row):
    """Rows first..last: col A = age, cols B..E = occupation classes 1..4."""
    out = {}
    for r in range(first_row, last_row + 1):
        age = cell(ws, r, 1)
        assert isinstance(age, (int, float)), f"{ws.title} row {r}: bad age {age!r}"
        out[str(int(age))] = [cell(ws, r, c) for c in range(2, 6)]
    return out


def meb_table(ws, header_row, first_row, last_row):
    """Header row: plans in B..G; rows: col A = age, B..G = fixed annual premium (0 = not offered)."""
    plans = [cell(ws, header_row, c) for c in range(2, 8)]
    prem = {str(int(cell(ws, r, 1))): [cell(ws, r, c) for c in range(2, 8)] for r in range(first_row, last_row + 1)}
    return plans, prem


# --------------------------------------------------------------------------- PLB
def _plb_terms(formula):
    """The years out of สรุปผลประโยชน์'s nested IF: IF(D19="PLB05",5,IF(...,"PLB10",10,...))."""
    pairs = re.findall(r'"(PLB\d\d)"\s*,\s*(\d+)', formula or "")
    assert len(pairs) == 4, f"expected four packages in {formula!r}, found {pairs}"
    return {code: int(years) for code, years in pairs}


def extract_plb():
    src = XLSX_DIR / "Protection Life (PLB)_A2026-1_01042026.xlsx"
    wb = openpyxl.load_workbook(src, data_only=True)
    wb_formulas = openpyxl.load_workbook(src, data_only=False)
    inp, cal, pm = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"]
    variants = ["PLB05", "PLB10", "PLB12", "PLB15"]
    meta = {
        "planCode": "PLB",
        "planName": f"{inp['E61'].value} (PLB)",
        "version": inp["E59"].value,
        "effectiveText": inp["E58"].value,
        "expiresOn": inp["G58"].value.strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }
    # base rates: Premium&Maturity N1:V59, sheet row == age
    header = {cell(pm, 1, c): c for c in range(14, 23)}
    rates = {}
    for v in variants:
        rates[v] = {}
        for sex in "MF":
            col = header[f"{v}{sex}"]
            table = {}
            for r in range(2, 60):
                val = cell(pm, r, col)
                if val is not None:
                    assert cell(pm, r, 14) == r, f"age column mismatch at row {r}"
                    table[str(r)] = val
            assert len(table) == 40, f"{v}{sex}: expected 40 ages, got {len(table)}"
            rates[v][sex] = table
    # How long each package covers, and how long it is paid for — read out of the workbook's
    # own formula rather than off the product codes, so a company that renames or re-terms a
    # package breaks this instead of quietly shipping the old number.
    #
    # สรุปผลประโยชน์!D36 is ระยะเวลาคุ้มครอง and E36 is ระยะเวลาชำระเบี้ย, and both are the same
    # nested IF over the package code: PLB covers exactly as long as it is paid for.
    terms = wb_formulas["สรุปผลประโยชน์"]
    cover_term = _plb_terms(terms["D36"].value)
    pay_term = _plb_terms(terms["E36"].value)
    assert cover_term == pay_term == {v: int(v[3:]) for v in variants}, (cover_term, pay_term)

    # discount: Cal A27:K31
    disc_header = {cell(cal, 27, c): c for c in range(2, 12)}
    thresholds = [cell(cal, r, 1) for r in range(28, 32)]
    by_variant = {v: [cell(cal, r, disc_header[v]) for r in range(28, 32)] for v in variants}
    ap = age_class_table(wb["AP"], 7, 67)        # ages 0..60
    ecare = age_class_table(wb["ECARE"], 7, 51)  # ages 16..60
    meb_plans, meb = meb_table(wb["MEB"], 6, 7, 75)  # ages 6..74
    assert len(ap) == 61 and len(ecare) == 45 and len(meb) == 69
    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {"variants": variants, "payTerm": pay_term, "coverTerm": cover_term, "rates": rates},
        "discount": {"thresholds": thresholds, "byVariant": by_variant},
        "riders": {
            "AP": {"kind": "ratePerThousandByAgeClass", "rates": ap},
            "ECARE": {"kind": "ratePerThousandByAgeClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
        },
    }
    write_json(OUT_DIR / "plb.json", out)


# ----------------------------------------------------------------------- iShield
ISHIELD_XLSX = "iShield_A2026-1_01042026.xlsx"


def extract_ishield():
    src = XLSX_DIR / ISHIELD_XLSX
    wb = openpyxl.load_workbook(src, data_only=True)
    inp, cal, pm, rr, pb = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"], wb["Rate Rider"], wb["Rate PB"]
    variants = ["WLCI05", "WLCI10", "WLCI15", "WLCI20"]
    meta = {
        "planCode": "ISHIELD",
        "planName": inp["E59"].value,
        "version": inp["E58"].value,
        "effectiveText": inp["E57"].value,
        "expiresOn": inp["G57"].value.strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }
    # base: Premium&Maturity header row 2 cols P..W, sheet row = age + 3
    header = {cell(pm, 2, c): c for c in range(16, 24)}
    rates = {}
    for v in variants:
        rates[v] = {}
        for sex in "MF":
            col = header[f"{v}{sex}"]
            table = {}
            for r in range(3, 69):
                val = cell(pm, r, col)
                if val is not None:
                    assert cell(pm, r, 15) == r - 3, f"age column mismatch at row {r}"
                    table[str(r - 3)] = val
            assert len(table) == 57, (v, sex, len(table))
            rates[v][sex] = table
    # discount Cal A23:R29 (WLCI columns are all zero)
    disc_header = {cell(cal, 23, c): c for c in range(2, 19)}
    thresholds = [cell(cal, r, 1) for r in range(24, 30)]
    by_variant = {v: [cell(cal, r, disc_header[v]) or 0 for r in range(24, 30)] for v in variants}
    # AP / ECARE flat by occupation class: Rate Rider AB3:AD6
    ap = [cell(rr, r, 29) for r in range(3, 7)]
    ecare = [cell(rr, r, 30) for r in range(3, 7)]
    # MEB: Rate Rider A4:G73 (ages 6..74)
    meb_plans, meb = meb_table(rr, 4, 5, 73)
    assert len(meb) == 69
    # PLS: Rate Rider X3:Z257, key "PLS10-35", col Y = M, col Z = F
    pls_variants = ["PLS05", "PLS10", "PLS12", "PLS15"]
    pls = {v: {"M": {}, "F": {}} for v in pls_variants}
    for r in range(3, 258):
        key = cell(rr, r, 24)
        if not isinstance(key, str) or "-" not in key:
            continue
        code, age = key.split("-")
        if code in pls:
            pls[code]["M"][age] = cell(rr, r, 25)
            pls[code]["F"][age] = cell(rr, r, 26)
    for v in pls_variants:
        assert len(pls[v]["M"]) == 40 and len(pls[v]["F"]) == 40, v
    # PB: Rate PB. Parent block rows 5..227 (header row 4), spouse block rows 231..437 (header row 230).
    # Keep waive periods 3..20: pay terms are 5..20 and parent period = MIN(payTerm, 25-age) <= 20.
    def pb_block(first, last, header_row):
        periods = {c: cell(pb, header_row, c) for c in range(6, 87) if isinstance(cell(pb, header_row, c), (int, float))}
        out = {}
        for r in range(first, last + 1):
            code, sex, age = cell(pb, r, 1), cell(pb, r, 2), cell(pb, r, 4)
            if not isinstance(age, (int, float)) or sex not in ("M", "F"):
                continue
            row = {str(int(p)): cell(pb, r, c) for c, p in periods.items() if p <= 20 and cell(pb, r, c) is not None}
            if row:
                out.setdefault(code, {}).setdefault(sex, {})[str(int(age))] = row
        return out

    pb_rates = pb_block(5, 227, 4)
    pb_rates.update(pb_block(231, 437, 230))
    assert set(pb_rates) == {"PBPDD", "PBPDDCI", "PBSDD", "PBSDDCI"}, set(pb_rates)
    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {"variants": variants, "payTerm": {v: int(v[-2:]) for v in variants}, "rates": rates},
        "discount": {"thresholds": thresholds, "byVariant": by_variant},
        "riders": {
            "PB": {
                "kind": "payorBenefit",
                "rates": pb_rates,
                "options": {
                    "FIT": {"name": inp["I68"].value, "parent": inp["K68"].value, "spouse": inp["K70"].value},
                    "BEYOND": {"name": inp["I69"].value, "parent": inp["K69"].value, "spouse": inp["K71"].value},
                },
            },
            "AP": {"kind": "flatRateByClass", "rates": ap},
            "ECARE": {"kind": "flatRateByClass", "rates": ecare},
            "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
            "PLS": {
                "kind": "ratePerThousandByVariantAgeSex",
                "variants": pls_variants,
                "rates": pls,
                "discountThresholds": [500000, 1000000],
                "discountValues": [0.5, 1],
            },
        },
    }
    write_json(OUT_DIR / "ishield.json", out)


# --------------------------------------------------------------------- W family
# The two ไลฟ์ โพรเทค+ products were renamed after the workbook was made ("+50" → "x 1.5",
# "+100" → "x 2"). The Thai name stays as the workbook spells it because make_golden types it
# back into the input sheet; only the English name the app shows is rewritten.
PRODUCT_NAME_EN = {
    "Life Protect+ 50": "Life Protect x 1.5",
    "Life Protect+ 100": "Life Protect x 2",
}

# ไอสมาร์ท 80/6, ไลฟ์เทรเชอร์ and ไลฟ์ โพรเทค+ share one workbook layout: the same
# sheets, the same rider list and the same Cal formulas. Only row positions on the
# input sheet, the Premium&Maturity sheet name and the package list differ, so every
# anchor below is found by label rather than hard-coded.

W_FAMILY = {
    "ISMART": "ไอสมาร์ท 80-6_A2026-1.xlsx",
    "LIFETREASURE": "ไลฟ์เทรเชอร์_A2026-1.xlsx",
    "LIFEPROTECT": "Sales proposal_Life Protect Plus 9 19 99_2026821_update benefit graph.xlsx",
}
IHU_TERRITORY = {"ประเทศไทย": "", "เอเชีย": "A", "ทั่วโลก": "W"}
IHU_COVERAGE = {"Full Coverage": "", "Deductible": "D", "Co-Payment": "C"}
RRSS_PLAN_NO = {"แผน S": 1, "แผน M": 2, "แผน L": 3, "แผน XL": 4}
CI123_COMPONENTS = [
    # (component key in 'Rate CI 123', share of the CI 123 sum assured, cap)
    ("Major CI", 1.0, None),
    ("Critical Care Benefit", 0.25, None),
    ("Juvenile CI", 0.25, None),
    ("Pre-Early CI", 0.20, 100000),
    ("Early to Intermediate CI", 0.25, None),
    ("Special conditions", 0.10, None),
]


def find_row(ws, label, col=1, first=1, last=140):
    for r in range(first, last + 1):
        v = ws.cell(r, col).value
        if isinstance(v, str) and v.strip() == label:
            return r
    raise AssertionError(f"{ws.title}: label {label!r} not found in column {col}")


def keyed_age_table(ws, header_row, first_row, last_row, key_col_offset=0, first_col=2):
    """Header row holds '<key>-<sex>' labels; each following row is one age (row = age + first_row)."""
    out = {}
    for c in range(first_col, ws.max_column + 1):
        head = ws.cell(header_row, c).value
        if not isinstance(head, str) or "-" not in head:
            continue
        key, sex = head.rsplit("-", 1)
        key, sex = key.strip(), sex.strip()
        if sex not in ("M", "F"):
            continue
        table = {}
        for r in range(first_row, last_row + 1):
            v = ws.cell(r, c).value
            if isinstance(v, (int, float)) and v > 0:
                table[str(r - first_row)] = v
        if table:
            out.setdefault(key, {}).setdefault(sex, {}).update(table)
    return out


def rate_rider_key_block(ws, codes):
    """Rate Rider cols X/Y/Z: key '<CODE>-<age>', Y = male rate, Z = female rate."""
    out = {c: {"M": {}, "F": {}} for c in codes}
    for r in range(2, ws.max_row + 1):
        key = ws.cell(r, 24).value
        if not isinstance(key, str) or "-" not in key:
            continue
        code, age = key.rsplit("-", 1)
        if code in out and age.isdigit():
            out[code]["M"][age] = ws.cell(r, 25).value
            out[code]["F"][age] = ws.cell(r, 26).value
    return out


def w_riders(wb, plan_code):
    """
    The rider tables every W-family workbook shares, and 12PL's too: the same sheets, the
    same Cal lookups, the same rows. Returned as the `riders` block of the rates JSON.
    """
    rr, pb, wp = wb["Rate Rider"], wb["Rate PB"], wb["Rate WP"]

    # --- riders ---
    def pb_block(first, last, header_row):
        periods = {c: cell(pb, header_row, c) for c in range(6, 90) if isinstance(cell(pb, header_row, c), (int, float))}
        out = {}
        for r in range(first, last + 1):
            code, sex, age = cell(pb, r, 1), cell(pb, r, 2), cell(pb, r, 4)
            if not isinstance(age, (int, float)) or sex not in ("M", "F"):
                continue
            row = {str(int(p)): cell(pb, r, c) for c, p in periods.items() if cell(pb, r, c) is not None}
            if row:
                out.setdefault(code, {}).setdefault(sex, {})[str(int(age))] = row
        return out

    pb_rates = pb_block(5, 227, 4)
    pb_rates.update(pb_block(231, 437, 230))

    # WP: male block key in col A with periods from col D; female block key in col CH (86) with periods from col CK
    wp_rates = {}
    for key_col, first_period_col in ((1, 4), (86, 89)):
        for r in range(5, wp.max_row + 1):
            key = cell(wp, r, key_col)
            if not isinstance(key, str) or len(key) < 4:
                continue
            code, rest = key[:-3], key[-3:]
            sex, age = rest[0], rest[1:]
            if sex not in ("M", "F") or not age.isdigit():
                continue
            row = {}
            # Walk the contiguous run of numeric period headers; the next block starts where
            # that run ends. A "to age 99" package can need a period well past 60 years.
            for c in range(first_period_col, wp.max_column + 1):
                period = cell(wp, 4, c)
                if not isinstance(period, (int, float)):
                    break
                v = cell(wp, r, c)
                if isinstance(v, (int, float)):
                    row[str(int(period))] = v
            if row:
                wp_rates.setdefault(code, {}).setdefault(sex, {})[age] = row
    assert wp_rates, f"{plan_code}: no WP rates"

    ap = [cell(rr, r, 29) for r in range(3, 7)]
    ecare = [cell(rr, r, 30) for r in range(3, 7)]
    meb_plans, meb = meb_table(rr, 4, 5, 73)
    key_rates = rate_rider_key_block(rr, ["DCI", "PLS05", "PLS10", "PLS12", "PLS15", "CPR", "HIC"])

    # MEX: 'Rate rider_MEX' row 5 = '<sex>-<plan>', rows 6.. = ages
    mex_ws = wb["Rate rider_MEX"]
    mex = {}
    mex_plans = []
    for c in range(2, 12):
        head = cell(mex_ws, 5, c)
        if not isinstance(head, str) or "-" not in head:
            continue
        sex, plan = head.split("-")
        if plan not in mex_plans:
            mex_plans.append(plan)
        for r in range(6, 96):
            age = cell(mex_ws, r, 1)
            v = cell(mex_ws, r, c)
            if isinstance(age, (int, float)) and isinstance(v, (int, float)) and v > 0:
                mex.setdefault(plan, {}).setdefault(sex, {})[str(int(age))] = v

    ihu = keyed_age_table(wb["iHealthy Ultra Rate"], 9, 13, 111)
    rrss = keyed_age_table(wb["CI MED EX RATE"], 9, 13, 111)

    # CI 123: 'Rate CI 123' key in col F, rates from col G (age 0) onwards
    ci_ws = wb["Rate CI 123"]
    ci_rates = {}
    for r in range(2, ci_ws.max_row + 1):
        head = cell(ci_ws, r, 6)
        if not isinstance(head, str) or "-" not in head:
            continue
        comp, sex = head.rsplit("-", 1)
        comp, sex = comp.strip(), sex.strip().upper()
        if sex not in ("M", "F"):
            continue
        table = {}
        for c in range(7, ci_ws.max_column + 1):
            v = cell(ci_ws, r, c)
            if isinstance(v, (int, float)):
                table[str(c - 7)] = v
        if table:
            ci_rates.setdefault(comp.lower(), {}).setdefault(sex, table)
    for comp, _, _ in CI123_COMPONENTS:
        assert comp.lower() in ci_rates, f"{plan_code}: CI 123 component {comp} missing"

    return {
        "PB": {"kind": "premiumBased", "by": "payer", "rates": pb_rates,
               "options": {"FIT": {"name": "สัญญาเพิ่มเติมพีบี ฟิต", "parent": "PBPDD", "spouse": "PBSDD"},
                           "BEYOND": {"name": "สัญญาเพิ่มเติมพีบี บียอนด์", "parent": "PBPDDCI", "spouse": "PBSDDCI"}}},
        "WP": {"kind": "premiumBased", "by": "insured", "rates": wp_rates,
               "options": {"FIT": {"name": "สัญญาเพิ่มเติมดับบลิวพี ฟิต", "parent": "WPTPD", "spouse": "WPTPD"},
                           "BEYOND": {"name": "สัญญาเพิ่มเติมดับบลิวพี บียอนด์", "parent": "WPTPDCI", "spouse": "WPTPDCI"}}},
        "AP": {"kind": "flatRateByClass", "rates": ap},
        "ECARE": {"kind": "flatRateByClass", "rates": ecare},
        "MEB": {"kind": "fixedByAgePlan", "plans": meb_plans, "premiums": meb},
        "MEX": {"kind": "fixedByKeyAge", "keyBy": "plan", "plans": mex_plans, "rates": mex},
        "IHU": {"kind": "fixedByKeyAge", "keyBy": "ihealthyUltra", "rates": ihu,
                "planNo": IHU_PLAN_NO, "territory": IHU_TERRITORY, "coverage": IHU_COVERAGE},
        "RRSS": {"kind": "fixedByKeyAge", "keyBy": "rokeRaiSoShield", "rates": rrss, "planNo": RRSS_PLAN_NO},
        "DCI": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["DCI"], "rates": {"DCI": key_rates["DCI"]},
                "discountThresholds": [], "discountValues": []},
        "PLS": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["PLS05", "PLS10", "PLS12", "PLS15"],
                "rates": {k: key_rates[k] for k in ("PLS05", "PLS10", "PLS12", "PLS15")},
                "discountThresholds": [500000, 1000000], "discountValues": [0.5, 1]},
        "CPR": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["CPR"], "rates": {"CPR": key_rates["CPR"]},
                "discountThresholds": [], "discountValues": []},
        "HIC": {"kind": "ratePerThousandByVariantAgeSex", "variants": ["HIC"], "rates": {"HIC": key_rates["HIC"]},
                "discountThresholds": [], "discountValues": [], "rounding": "round"},
        "CI123": {"kind": "compositeCI", "rates": ci_rates, "minAnnual": 1000,
                  "components": [{"key": k.lower(), "share": s, "cap": c} for k, s, c in CI123_COMPONENTS]},
    }


def extract_w_family(plan_code, filename):
    src = XLSX_DIR / filename
    wb = openpyxl.load_workbook(src, data_only=True)
    inp, cal = wb["กรอกข้อมูล"], wb["Cal"]
    pm_name = next(n for n in wb.sheetnames if n.startswith("Premium&Maturity"))
    pm = wb[pm_name]

    # --- metadata (label anchors, because row positions differ per file) ---
    eff_row = find_row(inp, "Effective Date", col=4, first=40, last=90)
    meta = {
        "planCode": plan_code,
        "planName": cell(inp, eff_row + 2, 5),
        "version": cell(inp, eff_row + 1, 5),
        "effectiveText": cell(inp, eff_row, 5),
        "expiresOn": cell(inp, eff_row, 7).strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }

    # --- packages: the plan's "variants" (Premium Payment Term table) ---
    # ไลฟ์ โพรเทค+ sells the same payment terms under two products ("+50" and "+100"), so the
    # workbook keys its package table on payment-term name + booster. Read that map, and read
    # the Payment Year column as a *formula* because "ครบอายุ 99 ปี" is 99 − age, not a constant.
    inp_f = openpyxl.load_workbook(src)["กรอกข้อมูล"]
    pkg_row = find_row(inp, "Premium Payment Term", col=1, first=40, last=110)
    # The product map (Thai name, English name, booster) sits above the package table; stop
    # before that table, whose own columns G and I would otherwise overwrite these entries.
    boosters = {}
    for r in range(55, pkg_row):
        name, name_en, factor = cell(inp, r, 7), cell(inp, r, 8), cell(inp, r, 9)
        if isinstance(name, str) and isinstance(factor, (int, float)):
            if isinstance(name_en, str):
                name_en = name_en.strip()
                for was, now in PRODUCT_NAME_EN.items():
                    name_en = name_en.replace(was, now)
            else:
                name_en = None
            boosters[factor] = (name.strip(), name_en)
    plancode_to_term = {}
    for r in range(27, 40):
        code, term = cell(cal, r, 14), cell(cal, r, 15)
        if isinstance(code, str) and term is not None:
            plancode_to_term[code] = str(term)
    packages = []
    for r in range(pkg_row + 1, pkg_row + 12):
        name, plancode = cell(inp, r, 1), cell(inp, r, 6)
        if not isinstance(name, str) or not isinstance(plancode, str) or plancode not in plancode_to_term:
            continue
        booster = cell(inp, r, 9)
        term_formula = inp_f.cell(r, 8).value
        pkg = {
            "code": f"{plancode}#{len(packages)}" if any(p["plancode"] == plancode for p in packages) else plancode,
            "plancode": plancode,
            "name": name.strip(),
            "ageMin": cell(inp, r, 3),
            "ageMax": cell(inp, r, 4),
            "seq": cell(inp, r, 5),
            "payTerm": cell(inp, r, 8),
            "rateKey": plancode_to_term[plancode],
        }
        if isinstance(term_formula, str) and term_formula.startswith("="):
            # e.g. "=99-$C$5": the premium-paying term runs to a fixed age
            digits = "".join(ch for ch in term_formula.split("-")[0] if ch.isdigit())
            if digits:
                pkg["payTermToAge"] = int(digits)
        if isinstance(booster, (int, float)):
            pkg["booster"] = booster
            if booster in boosters:
                pkg["productName"], name_en = boosters[booster]
                if name_en:
                    pkg["productNameEn"] = name_en
        packages.append(pkg)
    assert packages, f"{plan_code}: no packages found"

    # --- base rates: Premium&Maturity header row 2 = '<termCode><sex>', sheet row = age + 6 ---
    base_rates = {}
    for c in range(2, pm.max_column + 1):
        head = cell(pm, 2, c)
        if not isinstance(head, str) or len(head) < 2:
            continue
        term, sex = head[:-1], head[-1]
        if sex not in ("M", "F"):
            continue
        table = {}
        for r in range(6, 87):
            v = cell(pm, r, c)
            if isinstance(v, (int, float)):
                table[str(r - 6)] = v
        if table:
            base_rates.setdefault(term, {})[sex] = table
    for p in packages:
        assert p["rateKey"] in base_rates, f"{plan_code}: no base rates for {p['rateKey']}"

    # --- high sum-assured discount: Cal A27:E34, columns keyed by the rate key ---
    disc_header = {str(cell(cal, 27, c)): c for c in range(2, 7) if cell(cal, 27, c) is not None}
    disc_thresholds = [cell(cal, r, 1) for r in range(28, 34)]
    # iSmart hard-codes Cal!F13 = 0, i.e. the discount table is not applied.
    uses_discount = isinstance(openpyxl.load_workbook(src)["Cal"]["F13"].value, str)
    discount = {k: [cell(cal, r, c) or 0 for r in range(28, 34)] for k, c in disc_header.items()} if uses_discount else {}
    # Cal!F13 looks the discount column up by LEFT(rateKey, 2), so "19H" and "19L" share the "19" column.
    discount_prefix = 2

    # Re-key the base rates and the discount by package code so the engine sees the same
    # shape as PLB/iShield: base.rates[variant][sex][age] and discount.byVariant[variant].
    rates_by_variant = {p["code"]: base_rates[p["rateKey"]] for p in packages}
    discount_by_variant = {p["code"]: discount.get(p["rateKey"][:discount_prefix], [0] * len(disc_thresholds)) for p in packages}

    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {
            "variants": [p["code"] for p in packages],
            "packages": packages,
            "payTerm": {p["code"]: p["payTerm"] for p in packages if "payTermToAge" not in p},
            "payTermToAge": {p["code"]: p["payTermToAge"] for p in packages if "payTermToAge" in p},
            "rates": rates_by_variant,
        },
        "discount": {"thresholds": disc_thresholds, "byVariant": discount_by_variant},
        "riders": w_riders(wb, plan_code),
    }
    write_json(OUT_DIR / f"{plan_code.lower()}.json", out)


# ---------------------------------------------------------------------------
# Cash surrender values (ไลฟ์ โพรเทค+ only)
# ---------------------------------------------------------------------------

# The workbook shows the surrender value as ROUND(factor * sumAssured / 1000, 0), where the
# factor comes from TABCV(<sex>) keyed on the package code, the age at issue and the policy
# year. Coverage runs to age 99 and the table's last entry is the age-98 policy year, so a
# a row holds exactly (lastCoveredAge + 1 - age) values; anything past that is filler.
LP_CV_SHEETS = {"M": "TABCV(Male) (as of 220626", "F": "TABCV(Female) (as of 220626)"}
ISHIELD_CV_SHEETS = {"M": "TABCV(Male)", "F": "TABCV(Female)"}
LT_CV_SHEETS = {"M": "TABCV(Male)", "F": "TABCV(Female)"}
ISMART_CV_SHEETS = {"M": "TABCV(Male)", "F": "TABCV(Female)"}


def cash_values(filename, sheets, header, first_value_column, last_covered_age):
    """
    The surrender-value tables of every plan are laid out the same way: one row per
    (variant, sex, issue age), then one factor per policy year across. Only the header and
    where the factors start differ between workbooks, so both are arguments.
    """
    wb = openpyxl.load_workbook(XLSX_DIR / filename, data_only=True)
    factors = {}
    for sex, sheet in sheets.items():
        ws = wb[sheet]
        got = [cell(ws, 1, c) for c in range(1, len(header) + 1)]
        assert got == header, f"{sheet}: {got}"
        plan_col, sex_col, age_col = (header.index(k) for k in ("CVPLAN", "CVSEX", "CVAGE"))
        for row in ws.iter_rows(min_row=2, values_only=True):
            variant, row_sex, age = row[plan_col], row[sex_col], row[age_col]
            # iShield repeats the header between one variant's block and the next
            if variant is None or variant == header[plan_col]:
                continue
            assert row_sex == sex, f"{sheet} row for {variant} says sex {row_sex}"
            assert isinstance(age, int), f"{sheet} row for {variant} has age {age!r}"
            years = last_covered_age + 1 - age
            values = [int(v or 0) for v in row[first_value_column:first_value_column + years]]
            assert len(values) == years, f"{variant} {sex} age {age}: {len(values)} of {years} years"
            factors.setdefault(variant, {}).setdefault(sex, {})[age] = values
    return factors


def extract_lifeprotect_cash_values():
    filename = W_FAMILY["LIFEPROTECT"]
    last_covered_age = 98
    factors = cash_values(filename, LP_CV_SHEETS, ["Key", "CVPLAN", "CVSEX", "CVAGE"], 4, last_covered_age)

    variants = sorted(factors)
    assert variants == ["WLF09H", "WLF09L", "WLF19H", "WLF19L", "WLF99H", "WLF99HX", "WLF99L", "WLF99LX"], variants
    for variant, by_sex in factors.items():
        assert sorted(by_sex) == ["F", "M"], variant
        for sex, by_age in by_sex.items():
            assert sorted(by_age) == list(range(0, 81)), f"{variant} {sex} ages"

    write_json(OUT_DIR.parent / "cash-values" / "lifeprotect.json", {
        "planCode": "LIFEPROTECT",
        "source": filename,
        "lastCoveredAge": last_covered_age,
        "note": "surrender value = round(factor * sumAssured / 1000); factor per policy year, from year 1",
        "factors": factors,
    })


def extract_lifetreasure_cash_values():
    """
    ไลฟ์เทรเชอร์'s table is laid out exactly like Life Protect's — same header, same first
    value column, same age 98 last covered — and its sheets are simply named without the
    "as of" date. Cover runs to 99, so the row for an issue age holds 99 - age factors.
    """
    filename = W_FAMILY["LIFETREASURE"]
    last_covered_age = 98
    factors = cash_values(filename, LT_CV_SHEETS, ["Key", "CVPLAN", "CVSEX", "CVAGE"], 4, last_covered_age)

    assert sorted(factors) == ["H99F06A", "H99F12A", "H99F18A"], sorted(factors)
    for variant, by_sex in factors.items():
        assert sorted(by_sex) == ["F", "M"], variant
        for sex, by_age in by_sex.items():
            assert sorted(by_age) == list(range(0, 71)), f"{variant} {sex} ages"
    # the company's own benefit table for ชาย 30 · ชำระเบี้ย 18 ปี prints 16,140,000 at 80
    # and 20,000,000 at 98 on a sum of 20,000,000
    m30 = factors["H99F18A"]["M"][30]
    assert (m30[50], m30[-1]) == (807, 1000), (m30[50], m30[-1])

    write_json(OUT_DIR.parent / "cash-values" / "lifetreasure.json", {
        "planCode": "LIFETREASURE",
        "source": filename,
        "lastCoveredAge": last_covered_age,
        "note": "surrender value = round(factor * sumAssured / 1000); factor per policy year, from year 1",
        "factors": factors,
    })


def extract_ismart_cash_values():
    """
    iSmart's table, laid out like the rest of the W family but ending far earlier: the plan
    covers to age 80, so the last row of an age-25 policy is the year that starts at 79.

    The sheet is wide — hundreds of columns of extended-term and paid-up figures follow the
    surrender values — and only the first (lastCoveredAge + 1 - age) of them belong to this
    schedule. Reading past that point is what the length assertion below is for.
    """
    filename = W_FAMILY["ISMART"]
    last_covered_age = 79
    factors = cash_values(filename, ISMART_CV_SHEETS, ["Key", "CVPLAN", "CVSEX", "CVAGE"], 4, last_covered_age)

    assert sorted(factors) == ["W80F06"], sorted(factors)
    for variant, by_sex in factors.items():
        assert sorted(by_sex) == ["F", "M"], variant
        for sex, by_age in by_sex.items():
            # the plan is sold from 25 to 65, which is what data/rules/ismart.json states
            assert sorted(by_age) == list(range(25, 66)), f"{variant} {sex} ages"
            for age, values in by_age.items():
                assert len(values) == last_covered_age + 1 - age, f"{variant} {sex} age {age}"
                assert values == sorted(values), f"{variant} {sex} age {age} is not rising"
                # Every schedule ends at maturity, which the rules put at 200% of the sum
                # assured — and above it at the older issue ages, where six years of premium
                # come to more than twice the sum and the 101%-of-premiums floor takes over.
                # A man crosses at 53 and a woman later, her premium being the smaller.
                assert values[-1] >= 2000, f"{variant} {sex} age {age} ends {values[-1]}"

    write_json(OUT_DIR.parent / "cash-values" / "ismart.json", {
        "planCode": "ISMART",
        "source": filename,
        "lastCoveredAge": last_covered_age,
        "note": "surrender value = round(factor * sumAssured / 1000); factor per policy year, from year 1",
        "factors": factors,
    })


def extract_ishield_cash_values():
    """iShield's own table: the KEY column sits after CVAGE, and cover ends at 85, not 99."""
    filename = ISHIELD_XLSX
    last_covered_age = 84
    factors = cash_values(filename, ISHIELD_CV_SHEETS, ["CVPLAN", "CVSEX", "CVAGE", "KEY"], 4, last_covered_age)

    assert sorted(factors) == ["WLCI05", "WLCI10", "WLCI15", "WLCI20"], sorted(factors)
    # the issue ages a term takes differ, and rules/ishield.json is where that is stated
    for variant, by_sex in factors.items():
        assert sorted(by_sex) == ["F", "M"], variant
        for sex, by_age in by_sex.items():
            ages = sorted(by_age)
            assert ages[0] == 0 and ages == list(range(0, ages[-1] + 1)), f"{variant} {sex} ages {ages[:3]}…{ages[-1]}"

    write_json(OUT_DIR.parent / "cash-values" / "ishield.json", {
        "planCode": "ISHIELD",
        "source": filename,
        "lastCoveredAge": last_covered_age,
        "note": "surrender value = round(factor * sumAssured / 1000); factor per policy year, from year 1",
        "factors": factors,
    })


# ---------------------------------------------------------------------------
# The illnesses DCI covers
# ---------------------------------------------------------------------------

# The workbook keeps the whole list in one cell of the rider benefits sheet, numbered inline.
# Every plan that sells DCI carries the same wording, so they are all read and required to
# agree — a list that differed between workbooks would mean one of them is out of date.
DCI_SHEET = "ผลประโยชน์ (Rider)"
DCI_MARKER = "โรคสมองเสื่อมชนิดอัลไซเมอร์"
DCI_COUNT = 31


def _dci_from(path):
    import re
    wb = openpyxl.load_workbook(path, data_only=True)
    if DCI_SHEET not in wb.sheetnames:
        return None
    ws = wb[DCI_SHEET]
    for row in ws.iter_rows(max_col=15):
        for c in row:
            v = c.value
            if isinstance(v, str) and DCI_MARKER in v and len(v) > 500:
                # split on the inline numbering: "1. name 2. name ..."
                parts = re.split(r"(?<![\d])(\d{1,2})\.\s*", v)
                names = []
                for i in range(1, len(parts) - 1, 2):
                    no, text = int(parts[i]), parts[i + 1].strip()
                    assert no == len(names) + 1, f"{path}: numbering jumps at {no}"
                    names.append(" ".join(text.split()))
                return names
    return None


def extract_dci_diseases():
    lists = {}
    for filename in {**W_FAMILY}.values():
        names = _dci_from(XLSX_DIR / filename)
        if names:
            lists[filename] = names
    assert lists, "no workbook carries the DCI list"
    first = next(iter(lists.values()))
    for filename, names in lists.items():
        assert names == first, f"{filename} lists different illnesses from the others"
    assert len(first) == DCI_COUNT, f"expected {DCI_COUNT} illnesses, found {len(first)}"

    write_json(OUT_DIR.parent / "riders" / "dci-diseases.json", {
        "code": "DCI",
        "name": "สัญญาเพิ่มเติมคุ้มครองเสียชีวิตและโรคร้ายแรง (DCI)",
        "sources": sorted(lists),
        "note": "จ่ายเมื่อเสียชีวิต หรือเจ็บป่วยด้วยโรคร้ายแรงในรายการนี้ ตามคำนิยามในกรมธรรม์",
        "diseases": first,
    })


ISHIELD_ILLNESS_BLOCKS = [
    ("early", "โรคร้ายแรงระยะเริ่มต้น", 12, 21, 20),
    ("major", "โรคร้ายแรงระยะรุนแรง", 24, 48, 50),
]


def extract_ishield_diseases():
    """
    The illnesses iShield covers, from the sheet that lists them for the customer. They are
    laid out in two newspaper columns — B and I — and each cell already carries its own
    number, which the page numbers itself, so the number comes off here.
    """
    wb = openpyxl.load_workbook(XLSX_DIR / ISHIELD_XLSX, data_only=True)
    ws = wb["รายชื่อโรคร้ายแรง"]
    out = {}
    for key, heading, first_row, last_row, expected in ISHIELD_ILLNESS_BLOCKS:
        assert heading in " ".join(str(cell(ws, first_row - 1, c) or "") for c in (2, 9)), heading
        names = []
        for column in (2, 9):
            for r in range(first_row, last_row + 1):
                raw = cell(ws, r, column)
                if raw is None or not str(raw).strip():
                    continue
                names.append(re.sub(r"^\s*\d+\s*\.\s*", "", " ".join(str(raw).split())))
        assert len(names) == expected, f"{key}: found {len(names)} of {expected}"
        assert len(set(names)) == expected, f"{key}: duplicate names"
        out[key] = names

    write_json(OUT_DIR.parent / "riders" / "ishield-diseases.json", {
        "planCode": "ISHIELD",
        "source": ISHIELD_XLSX,
        "note": "ระยะเริ่มต้นจ่าย 25% ของทุนต่อโรค ระยะรุนแรงจ่ายสูงสุด 100% ของทุน ตามคำนิยามในกรมธรรม์",
        "early": out["early"],
        "major": out["major"],
    })


# ---------------------------------------------------------------------------
# The illnesses the other two critical-illness riders name
# ---------------------------------------------------------------------------

# CI 123 lists its illnesses on a sheet of its own, in sections — the major stage, the
# children's list, and the three bands the endorsement adds — each a run of numbered cells
# dealt across four columns. RRSS writes its names inside the definitions instead, one
# paragraph per illness, so the name is whatever stands before "หมายถึง".
CI123_SHEET = "รายชื่อโรค CI 123"
CI123_HEAD = re.compile(r"^(โรคร้ายแรง|ความคุ้มครองกรณีวิกฤต)")
CI123_ITEM = re.compile(r"^(\d{1,3})[.\s]\s*(.+)$", re.S)
# what each section should hold, so a workbook that drops or renumbers one is caught here
CI123_COUNTS = [53, 2, 17, 6, 42, 4]

RRSS_SHEET = "นิยามโรค Roke Rai So Shield"
RRSS_ITEM = re.compile(r"^(\d+)\.(\d+)\s+(.+)$", re.S)
RRSS_GROUPS = {"1": "ผู้ใหญ่", "2": "เด็ก (อายุ 1 เดือน – 10 ปี)"}


def _flat(v):
    return re.sub(r"\s+", " ", str(v)).strip()


def extract_ci123_diseases():
    filename = W_FAMILY["ISMART"]
    wb = openpyxl.load_workbook(XLSX_DIR / filename, data_only=True)
    ws = wb[CI123_SHEET]

    groups, cur = [], None
    for row in ws.iter_rows(min_row=4, max_row=52, max_col=6, values_only=True):
        cells = [_flat(v) for v in row if v is not None and _flat(v)]
        if not cells:
            continue
        if len(cells) == 1 and CI123_HEAD.match(cells[0]):
            cur = {"title": cells[0], "numbered": []}
            groups.append(cur)
            continue
        if cur is None:
            continue
        for c in cells:
            m = CI123_ITEM.match(c)
            if m:
                cur["numbered"].append((int(m.group(1)), m.group(2).strip()))

    out = []
    for g in groups:
        # the columns are read across, so the numbers arrive shuffled; the sheet's own
        # numbering is the order, and a gap in it means a cell was missed
        names = [n for _, n in sorted(g["numbered"], key=lambda x: x[0])]
        numbers = sorted(n for n, _ in g["numbered"])
        assert numbers == list(range(1, len(names) + 1)), f"{g['title']}: {numbers}"
        out.append({"title": g["title"], "diseases": names})

    assert [len(g["diseases"]) for g in out] == CI123_COUNTS, [len(g["diseases"]) for g in out]

    write_json(OUT_DIR.parent / "riders" / "ci123-diseases.json", {
        "code": "CI123",
        "name": "สัญญาเพิ่มเติมคุ้มครองโรคร้ายแรง (CI 123)",
        "source": filename,
        "note": "ชื่อโรคตามรายชื่อในกรมธรรม์ คำนิยามของแต่ละโรคเป็นไปตามที่ระบุในกรมธรรม์",
        "groups": out,
    })


def extract_rrss_diseases():
    filename = W_FAMILY["ISMART"]
    wb = openpyxl.load_workbook(XLSX_DIR / filename, data_only=True)
    ws = wb[RRSS_SHEET]

    found = {}
    for row in ws.iter_rows(max_col=13, values_only=True):
        for v in row:
            if not isinstance(v, str):
                continue
            m = RRSS_ITEM.match(_flat(v))
            if not m:
                continue
            group, index = m.group(1), int(m.group(2))
            if group not in RRSS_GROUPS:
                continue
            # the definition follows the name; the contract's wording is not summarised here
            found.setdefault(group, []).append((index, re.split(r"\s+หมายถึง", m.group(3))[0].strip()))

    groups = []
    for key, title in RRSS_GROUPS.items():
        items = sorted(found.get(key, []), key=lambda x: x[0])
        assert [i for i, _ in items] == list(range(1, len(items) + 1)), f"{title}: {[i for i, _ in items]}"
        assert items, f"{title}: nothing found"
        groups.append({"title": title, "diseases": [n for _, n in items]})

    assert [len(g["diseases"]) for g in groups] == [10, 4], [len(g["diseases"]) for g in groups]

    write_json(OUT_DIR.parent / "riders" / "rrss-diseases.json", {
        "code": "RRSS",
        "name": "สัญญาเพิ่มเติมค่ารักษาพยาบาลโรคร้ายโซชิลด์ (MCI)",
        "source": filename,
        "note": "ชื่อโรคตามคำนิยามในกรมธรรม์ คำนิยามเต็มอยู่ในกรมธรรม์",
        "groups": groups,
    })


# --------------------------------------------------------------------------- 12PL
# 12 พีแอล: pay 12 years, cover to 85, a cash back every year from the second, 115% at the
# end, and a dividend the company does not guarantee. Its riders are the W family's (the same
# sheets and Cal lookups), but the base plan has no package table: one term, one rate column
# per sex on Premium&Maturity, and the cash backs and dividend scale on sheets of their own.
TWELVEPL_XLSX = "12PL_A2026-1.xlsm"
TWELVEPL_COVER_TO_AGE = 85


def _per_year_by_age(ws, cover_to_age):
    """A '12PL'-style pivot: row 5 = issue ages from col B, col A = policy year from row 6."""
    ages = {}
    for c in range(2, ws.max_column + 1):
        a = cell(ws, 5, c)
        if isinstance(a, (int, float)):
            ages[int(a)] = c
    years = {}
    for r in range(6, ws.max_row + 1):
        y = cell(ws, r, 1)
        if isinstance(y, (int, float)):
            years[int(y)] = r
    out = {}
    for age, c in ages.items():
        out[age] = [cell(ws, years[y], c) or 0 for y in range(1, cover_to_age - age + 1)]
    return out


def extract_12pl():
    src = XLSX_DIR / TWELVEPL_XLSX
    wb = openpyxl.load_workbook(src, data_only=True)
    wf = openpyxl.load_workbook(src)
    inp, cal, pm = wb["กรอกข้อมูล"], wb["Cal"], wb["Premium&Maturity"]

    eff_row = find_row(inp, "Effective Date", col=4, first=40, last=90)
    plan_code = "12PL"
    assert cell(inp, 15, 1) == plan_code, cell(inp, 15, 1)
    sa_min = cell(inp, 15, 2)
    assert sa_min == 100000, sa_min
    # Cal!B6: the premium is paid for twelve years whatever the issue age
    pay_term = cell(cal, 6, 2)
    assert pay_term == 12, pay_term

    # Premium&Maturity D:F — age, male rate, female rate per 1,000; B — maturity per 1,000
    rates = {"M": {}, "F": {}}
    maturity = set()
    for r in range(3, pm.max_row + 1):
        age = cell(pm, r, 4)
        if not isinstance(age, (int, float)):
            continue
        rates["M"][str(int(age))] = cell(pm, r, 5)
        rates["F"][str(int(age))] = cell(pm, r, 6)
        maturity.add(cell(pm, r, 2))
    ages = sorted(int(a) for a in rates["M"])
    assert ages == list(range(0, 61)), ages
    assert maturity == {1150}, maturity
    # the company's own figure: หญิง 44, 3,000,000 → 200,040 a year
    assert rates["F"]["44"] == 66.68, rates["F"]["44"]

    # Cal!N27:N31 — 12PL takes no high-sum discount
    disc_col = next(c for c in range(2, 16) if cell(cal, 27, c) == plan_code)
    assert all((cell(cal, r, disc_col) or 0) == 0 for r in range(28, 32))

    # '12PL': cash back per 1,000 by policy year — one schedule for every issue age, cut at 85
    cash_back = _per_year_by_age(wb["12PL"], TWELVEPL_COVER_TO_AGE)
    longest = cash_back[0]
    for age, row in cash_back.items():
        assert row == longest[:len(row)], f"12PL cash back differs at age {age}"
    # '12PL+Non-G': the same with the dividend scale on top, per issue age
    non_g = _per_year_by_age(wb["12PL+Non-G"], TWELVEPL_COVER_TO_AGE)
    assert sorted(non_g) == ages, sorted(non_g)

    # ตารางแสดงผลประโยชน์ H/K/M: dividend = (Non-G − cash back) × n / 100, three examples;
    # I/L/N: kept with the company at 0.5% a year
    bt = wf["ตารางแสดงผลประโยชน์"]
    shares = []
    for col in ("H", "K", "M"):
        m = re.search(r"\*(\d+)/100", bt[f"{col}11"].value)
        assert m, bt[f"{col}11"].value
        shares.append(int(m.group(1)))
    assert shares == [0, 75, 90], shares
    assert "0.5%" in bt["I12"].value, bt["I12"].value

    meta = {
        "planCode": plan_code,
        "planName": cell(inp, eff_row + 2, 5),
        "version": cell(inp, eff_row + 1, 5),
        "effectiveText": cell(inp, eff_row, 5),
        # this workbook puts the label "Expire of Sales proposal" beside the date and the date a row down
        "expiresOn": cell(inp, eff_row + 1, 7).strftime("%Y-%m-%d"),
        "sourceFile": src.name,
    }
    package = {
        "code": plan_code, "plancode": plan_code, "name": f"ชำระเบี้ย {pay_term} ปี",
        "ageMin": 0, "ageMax": 60, "seq": 1, "payTerm": pay_term, "rateKey": plan_code,
    }
    out = {
        **meta,
        "modeFactors": mode_factors(cal),
        "base": {
            "variants": [plan_code],
            "packages": [package],
            "payTerm": {plan_code: pay_term},
            "payTermToAge": {},
            "rates": {plan_code: rates},
        },
        "discount": {"thresholds": [cell(cal, r, 1) for r in range(28, 32)], "byVariant": {plan_code: [0, 0, 0, 0]}},
        "riders": w_riders(wb, plan_code),
        "benefits": {
            "coverToAge": TWELVEPL_COVER_TO_AGE,
            "maturityPer1000": 1150,
            "cashBackPer1000": longest,
            "nonGuaranteedPer1000": {str(a): non_g[a] for a in ages},
            "dividendShares": shares,
            "keepRate": 0.005,
        },
    }
    write_json(OUT_DIR / "12pl.json", out)


def extract_12pl_cash_values():
    """TABCV: CVPLAN, CVSEX, CVAGE, then one factor per policy year; cover ends at 85."""
    last_covered_age = TWELVEPL_COVER_TO_AGE - 1
    factors = cash_values(TWELVEPL_XLSX, {"M": "TABCV(Male)", "F": "TABCV(Female)"},
                          ["CVPLAN", "CVSEX", "CVAGE"], 3, last_covered_age)
    assert sorted(factors) == ["12PL"], sorted(factors)
    for sex in ("M", "F"):
        assert sorted(factors["12PL"][sex]) == list(range(0, 61)), sex
    # the company's benefit table for หญิง 44 on 3,000,000: 72,000 in year 2, 3,450,000 at 85
    f44 = factors["12PL"]["F"][44]
    assert (f44[1], f44[-1]) == (24, 1150), (f44[1], f44[-1])
    write_json(OUT_DIR.parent / "cash-values" / "12pl.json", {
        "planCode": "12PL",
        "source": TWELVEPL_XLSX,
        "lastCoveredAge": last_covered_age,
        "note": "surrender value = round(factor * sumAssured / 1000); factor per policy year, from year 1",
        "factors": factors,
    })


EXTRACTORS = {
    "plb": extract_plb,
    "ishield": extract_ishield,
    "ismart": lambda: extract_w_family("ISMART", W_FAMILY["ISMART"]),
    "lifetreasure": lambda: extract_w_family("LIFETREASURE", W_FAMILY["LIFETREASURE"]),
    "lifeprotect": lambda: extract_w_family("LIFEPROTECT", W_FAMILY["LIFEPROTECT"]),
    "lifeprotect-cv": extract_lifeprotect_cash_values,
    "lifetreasure-cv": extract_lifetreasure_cash_values,
    "ishield-cv": extract_ishield_cash_values,
    "ismart-cv": extract_ismart_cash_values,
    "ishield-diseases": extract_ishield_diseases,
    "dci-diseases": extract_dci_diseases,
    "ci123-diseases": extract_ci123_diseases,
    "rrss-diseases": extract_rrss_diseases,
    "ihealthy-ultra": extract_ihu_benefits,
    "12pl": extract_12pl,
    "12pl-cv": extract_12pl_cash_values,
}



def main(argv):
    names = argv or list(EXTRACTORS)
    for n in names:
        if n not in EXTRACTORS:
            sys.exit(f"unknown plan {n}; choose from {list(EXTRACTORS)}")
        EXTRACTORS[n]()


if __name__ == "__main__":
    main(sys.argv[1:])
