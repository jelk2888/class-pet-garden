# -*- coding: utf-8 -*-
"""
用 Gemini MCP / 浏览器 批量生成九宫格（无参考图上传时用文字描述）。
成功后的大图放入 _ref/gemini_9grid_sheets/{petId}_9grid.png，再执行 split。

本脚本只写 configs；实际生图请用：
  - Cursor MCP gemini_generate_image（推荐，当前环境参考图上传易失败）
  - 或 node D:\\Claw\\gemini_batch_gen1.cjs configs.json sheets_dir

用法:
  python run_gemini_9grid_pipeline.py --write-configs --limit 10
  python run_gemini_9grid_pipeline.py --split
  python run_gemini_9grid_pipeline.py --split-one _ref/gemini_9grid_sheets/my-001_9grid.png --pet-id my-001
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# 复用同目录模块
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_gemini_9grid_configs import (  # noqa: E402
    SHEETS_DIR,
    PETS_OUT,
    list_pets,
    make_prompt,
    OUT_CFG,
    split_grid,
    split_all,
    write_configs,
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-configs", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--split", action="store_true")
    ap.add_argument("--split-one", type=str, default="")
    ap.add_argument("--pet-id", type=str, default="")
    args = ap.parse_args()

    if args.write_configs:
        write_configs(args.limit)
        print("提示: 参考图上传若失败，可对每条 config 用纯文字 prompt 调 MCP 生图，保存为 sheets/{petId}_9grid.png")
        return 0
    if args.split_one:
        if not args.pet_id:
            raise SystemExit("--split-one 需要 --pet-id")
        split_grid(Path(args.split_one), args.pet_id, PETS_OUT)
        return 0
    if args.split:
        split_all(SHEETS_DIR)
        return 0
    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
