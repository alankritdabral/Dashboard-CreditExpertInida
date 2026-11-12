#!/usr/bin/env python3
"""
Build data/employerData/employerBankCategories.json from the lender employer
listing workbook ("ALL BANK LISTING (3).xlsx").

Usage:
  python3 scripts/build-employer-bank-categories.py "/path/to/ALL BANK LISTING (3).xlsx"

Each sheet is one lender (first column = employer name, second = category).
Output is a compact JSON consumed by src/app/api/employers/route.ts:

  {
    "banks": [{ "key": "tatacapital", "label": "Tata Capital", "sheet": "TATA" }, ...],
    "cats":  [["Category A", "Category B", ...], ...],   // per bank, same order as banks
    "employers": [["DISPLAY NAME", "0:3;4:12"], ...]     // "bankIdx:catIdx" pairs for the banks
                                                           // that list the employer (catIdx into cats[bank])
  }

Names from data/employerData/searchList.json (the older unified list) are merged
in so that nothing previously searchable disappears.
"""
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "employerData", "employerBankCategories.json")
LEGACY_LIST = os.path.join(ROOT, "data", "employerData", "searchList.json")

# Sheet name -> lender id used by src/lib/lenderEngine.ts (where one exists)
SHEETS = [
    ("TATA", "tatacapital", "Tata Capital"),
    ("HDFC", "hdfc", "HDFC Bank"),
    ("IDFC BANK", "idfc", "IDFC First Bank"),
    ("KOTAK", "kotak", "Kotak Mahindra Bank"),
    ("L&T", "ltfinance", "L&T Finance"),
    ("INDUS", "indusind", "IndusInd Bank"),
    ("AXIS FINANCE", "axisfinance", "Axis Finance"),
    ("YES BANK", "yesbank", "Yes Bank"),
    ("AXIS BANK", "axis", "Axis Bank"),
    ("ICICI BANK", "icici", "ICICI Bank"),
]

BAD_NAMES = {"", "#NAME?", "#N/A", "#REF!", "NAME", "COMPANY NAME"}


def normalize(name: str) -> str:
    """Mirror normalizeEmployerName() in src/app/api/employers/route.ts."""
    n = name.strip().upper()
    n = re.sub(r"\s*(PRIVATE|PVT|LTD|LIMITED|INC|CORP|CORPORATION|COMPANY|CO)\s*\.?\s*", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def clean(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
    by_title = {ws.title.strip().upper(): ws for ws in wb.worksheets}

    banks = []
    cats = []
    # normalized -> [display, [cat-set per bank]]
    employers: dict[str, list] = {}

    for bank_idx, (sheet, key, label) in enumerate(SHEETS):
        ws = by_title.get(sheet)
        if ws is None:
            print(f"!! sheet {sheet!r} not found, skipping")
            continue
        banks.append({"key": key, "label": label, "sheet": sheet})
        cat_index: dict[str, int] = {}
        cats.append([])
        header_cat = None
        rows = 0
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            name = clean(row[0] if row else None)
            cat = clean(row[1] if row and len(row) > 1 else None)
            if i == 0:
                header_cat = cat.upper()
                continue
            if name.upper() in BAD_NAMES or not cat or cat.upper() == header_cat:
                continue
            norm = normalize(name)
            if not norm:
                continue
            rows += 1
            entry = employers.setdefault(norm, [name, [None] * len(SHEETS)])
            slot = entry[1]
            if slot[bank_idx] is None:
                slot[bank_idx] = [cat]
            elif cat not in slot[bank_idx]:
                slot[bank_idx].append(cat)
        print(f"{sheet:13s} rows={rows}")

    # Resolve category strings (joined when a normalized name maps to several)
    for entry in employers.values():
        for bank_idx, values in enumerate(entry[1]):
            if values is None:
                continue
            entry[1][bank_idx] = " / ".join(values)

    # Merge legacy names so the search list never shrinks
    if os.path.exists(LEGACY_LIST):
        with open(LEGACY_LIST, encoding="utf-8") as fh:
            legacy = json.load(fh)
        added = 0
        for name in legacy:
            name = clean(name)
            if name.upper() in BAD_NAMES:
                continue
            norm = normalize(name)
            if norm and norm not in employers:
                employers[norm] = [name, [None] * len(banks)]
                added += 1
        print(f"legacy names merged: {added}")

    # Encode
    cat_maps = [dict() for _ in banks]
    out_employers = []
    for norm in sorted(employers):
        display, slots = employers[norm]
        code = []
        for bank_idx in range(len(banks)):
            cat = slots[bank_idx]
            if cat is None:
                continue
            m = cat_maps[bank_idx]
            if cat not in m:
                m[cat] = len(m)
                cats[bank_idx].append(cat)
            code.append(f"{bank_idx}:{m[cat]}")
        out_employers.append([display, ";".join(code)])

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"banks": banks, "cats": cats, "employers": out_employers}, fh, ensure_ascii=False, separators=(",", ":"))

    print(f"wrote {OUT}: {len(out_employers)} employers, {os.path.getsize(OUT) // 1024 // 1024} MB")
    for b, c in zip(banks, cats):
        print(f"  {b['key']:12s} {len(c):3d} categories: {c[:8]}{' ...' if len(c) > 8 else ''}")


if __name__ == "__main__":
    main()
