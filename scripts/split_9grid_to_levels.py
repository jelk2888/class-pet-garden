# -*- coding: utf-8 -*-
"""将 Gemini 九宫格大图切为 lv0–lv8。"""
from __future__ import annotations

import argparse
from pathlib import Path

from gen_gemini_9grid_configs import split_all, split_grid, SHEETS_DIR, PETS_OUT


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheets_dir", nargs="?", default=str(SHEETS_DIR))
    ap.add_argument("--one", help="单张九宫格路径")
    ap.add_argument("--pet-id", help="配合 --one")
    args = ap.parse_args()
    if args.one:
        if not args.pet_id:
            raise SystemExit("--one 需要 --pet-id")
        split_grid(Path(args.one), args.pet_id, PETS_OUT)
    else:
        split_all(Path(args.sheets_dir))


if __name__ == "__main__":
    main()
