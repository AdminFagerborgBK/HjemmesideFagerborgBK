"""Dump a fotball.no tournament Excel calendar as deterministic text.

Used by .github/workflows/sports-sync.yml to fingerprint the source data so
the Lovable backend is only contacted when fixtures or results really change.
Excel metadata (generation timestamps etc.) is ignored on purpose.
"""

import sys

import openpyxl


def main() -> None:
    for path in sys.argv[1:]:
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb[wb.sheetnames[0]]
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c) for c in row]
            print(path, "|".join(cells))


if __name__ == "__main__":
    main()
