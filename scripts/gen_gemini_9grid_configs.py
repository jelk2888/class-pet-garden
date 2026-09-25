# -*- coding: utf-8 -*-
"""
用 Gemini 一张参考图生成九宫格进化形态，再切分为 lv0–lv8。
依赖: D:\\Claw\\gemini_batch_gen1.cjs

步骤:
  1. python gen_gemini_9grid_configs.py --limit 3   # 生成 configs
  2. node D:\\Claw\\gemini_batch_gen1.cjs configs.json 输出目录
  3. python split_9grid_to_levels.py 输出目录

若 Gemini 失败，继续用 build_my_pets_9levels.py 本地合成。
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SRC = Path(r"D:\天门中学\宠物图片\我的宠物")
OUT_CFG = Path(r"D:\天门中学\班级宠物系统\_ref\gemini_my_pets_9grid_configs.json")
SHEETS_DIR = Path(r"D:\天门中学\班级宠物系统\_ref\gemini_9grid_sheets")
PETS_OUT = Path(r"D:\天门中学\班级宠物系统\public\pets")

NAME_RE = re.compile(r"^(\d+)_(.+)_(蛋|幼年|青年|成年)\.png$", re.I)


def list_pets():
    pets = {}
    for f in SRC.glob("*.png"):
        m = NAME_RE.match(f.name)
        if not m:
            continue
        num, name, stage = int(m.group(1)), m.group(2), m.group(3)
        pid = f"my-{num:03d}"
        pets.setdefault(pid, {"id": pid, "num": num, "name": name, "files": {}})
        pets[pid]["files"][stage] = str(f)
    return sorted(pets.values(), key=lambda x: x["num"])


def make_prompt(name: str) -> str:
    return (
        f"请根据我上传的「{name}」宠物参考图，生成【一张】九宫格拼图（3行×3列，均匀分割，无缝白线分隔）：\n"
        "从左到右、从上到下依次为教室积分宠物养成的 9 个等级：\n"
        "Lv0 蛋形态（精美纹样宠物蛋） | Lv1 破壳幼体 | Lv2 幼年初期\n"
        "Lv3 幼年 | Lv4 少年 | Lv5 青年\n"
        "Lv6 准成年 | Lv7 成年 | Lv8 满级传说形态\n\n"
        "要求：\n"
        "1. 角色身份、配色、装饰风格全程一致，可爱 3D 国风/萌宠风格；\n"
        "2. 每一格背景必须不同：暖巢 / 晨光草地 / 校园花园 / 溪谷 / 云端 / 金晖庭院 / 殿前 / 星空神殿；\n"
        "3. 每格正方形，角色居中，高清，不要文字水印和编号；\n"
        "4. 只输出这一张九宫格大图。"
    )


def write_configs(limit: int = 0):
    pets = list_pets()
    if limit:
        pets = pets[:limit]
    configs = []
    for p in pets:
        # 优先用成年+蛋作参考说明（脚本侧若支持 upload 需另接；此处 prompt 单图生成）
        ref = p["files"].get("成年") or p["files"].get("青年") or p["files"].get("幼年")
        configs.append(
            {
                "prompt": make_prompt(p["name"]),
                "outputName": f"{p['id']}_9grid.png",
                "petId": p["id"],
                "petName": p["name"],
                "referenceImage": ref,
            }
        )
    OUT_CFG.parent.mkdir(parents=True, exist_ok=True)
    OUT_CFG.write_text(json.dumps(configs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(configs)} configs -> {OUT_CFG}")
    return configs


def split_grid(sheet_path: Path, pet_id: str, out_root: Path = PETS_OUT):
    from PIL import Image

    im = Image.open(sheet_path).convert("RGB")
    w, h = im.size
    # 允许细白线：三等分
    cell_w, cell_h = w // 3, h // 3
    dest = out_root / pet_id
    dest.mkdir(parents=True, exist_ok=True)
    for idx in range(9):
        row, col = divmod(idx, 3)
        # 若有白线，向内缩 2%
        pad_x = max(2, cell_w // 50)
        pad_y = max(2, cell_h // 50)
        left = col * cell_w + pad_x
        top = row * cell_h + pad_y
        right = (col + 1) * cell_w - pad_x
        bottom = (row + 1) * cell_h - pad_y
        cell = im.crop((left, top, right, bottom))
        cell = cell.resize((768, 768), Image.Resampling.LANCZOS)
        cell.save(dest / f"lv{idx}.png", "PNG", optimize=True)
    print(f"split {sheet_path.name} -> {dest}/lv0..lv8.png")


def split_all(sheets_dir: Path):
    sheets_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(sheets_dir.glob("*_9grid.png")):
        pet_id = f.name.replace("_9grid.png", "")
        split_grid(f, pet_id)
        n += 1
    print(f"split done: {n}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--write-configs", action="store_true")
    ap.add_argument("--split", action="store_true")
    ap.add_argument("--sheets-dir", type=str, default=str(SHEETS_DIR))
    args = ap.parse_args()
    if args.write_configs or not (args.split):
        write_configs(args.limit)
    if args.split:
        split_all(Path(args.sheets_dir))


if __name__ == "__main__":
    main()
