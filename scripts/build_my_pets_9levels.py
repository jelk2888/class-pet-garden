# -*- coding: utf-8 -*-
"""
将「我的宠物」四阶段（蛋/幼年/青年/成年）扩展为系统九级 lv0–lv8，
并为每级合成明显不同的场景背景。输出到班级宠物系统 public/pets/{id}/。

中间等级用阶段混合（alpha blend）+ 缩放/光效拉开差异；
若后续有 Gemini 九宫格，可用 split_9grid_to_levels.py 覆盖对应目录。

用法:
  python build_my_pets_9levels.py              # 全部
  python build_my_pets_9levels.py --limit 5    # 先跑 5 只
  python build_my_pets_9levels.py --force      # 覆盖已有
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC = Path(r"D:\天门中学\宠物图片\我的宠物")
OUT = Path(r"D:\天门中学\班级宠物系统\public\pets")
CATALOG = Path(r"D:\天门中学\班级宠物系统\server\data\my-pets-catalog.json")
SIZE = 768

# 九级：主阶段、辅阶段、混合比例、缩放、背景主题
# blend: 0=纯主阶段, 1=纯辅阶段
LEVEL_PLAN = {
    0: {
        "primary": "egg",
        "secondary": "egg",
        "blend": 0.0,
        "scale": 0.86,
        "theme": "nest",
        "label": "蛋·暖巢",
    },
    1: {
        "primary": "egg",
        "secondary": "juvenile",
        "blend": 0.55,
        "scale": 0.72,
        "theme": "dawn",
        "label": "破壳·晨光",
    },
    2: {
        "primary": "juvenile",
        "secondary": "juvenile",
        "blend": 0.0,
        "scale": 0.82,
        "theme": "meadow",
        "label": "幼年初期·草地",
    },
    3: {
        "primary": "juvenile",
        "secondary": "youth",
        "blend": 0.25,
        "scale": 0.95,
        "theme": "campus",
        "label": "幼年·校园",
    },
    4: {
        "primary": "juvenile",
        "secondary": "youth",
        "blend": 0.55,
        "scale": 0.88,
        "theme": "valley",
        "label": "少年·溪谷",
    },
    5: {
        "primary": "youth",
        "secondary": "youth",
        "blend": 0.0,
        "scale": 0.98,
        "theme": "cloud",
        "label": "青年·云端",
    },
    6: {
        "primary": "youth",
        "secondary": "adult",
        "blend": 0.45,
        "scale": 0.92,
        "theme": "gold",
        "label": "准成·金晖",
    },
    7: {
        "primary": "adult",
        "secondary": "adult",
        "blend": 0.0,
        "scale": 1.00,
        "theme": "palace",
        "label": "成年·殿前",
    },
    8: {
        "primary": "adult",
        "secondary": "adult",
        "blend": 0.0,
        "scale": 1.08,
        "theme": "star",
        "label": "满级·星宫",
    },
}

STAGE_MAP = {
    "egg": "蛋",
    "juvenile": "幼年",
    "youth": "青年",
    "adult": "成年",
}

NAME_RE = re.compile(r"^(\d+)_(.+)_(蛋|幼年|青年|成年)\.png$", re.I)


def parse_pets(src: Path) -> dict[str, dict]:
    pets: dict[str, dict] = {}
    for f in src.glob("*.png"):
        m = NAME_RE.match(f.name)
        if not m:
            continue
        num, name, stage_cn = m.group(1), m.group(2), m.group(3)
        stage = {v: k for k, v in STAGE_MAP.items()}[stage_cn]
        pid = f"my-{int(num):03d}"
        pets.setdefault(pid, {"id": pid, "num": int(num), "name": name, "files": {}})
        pets[pid]["files"][stage] = f
    return dict(sorted(pets.items(), key=lambda x: x[1]["num"]))


def category_of(num: int, name: str) -> str:
    mythical_kw = (
        "龙|凤|麒|麟|貔|貅|蛟|鲲|鹏|朱雀|玄武|青龙|白虎|穷奇|梼杌|天狗|烛龙|"
        "应龙|毕方|重明|青鸾|金乌|帝江|英招|狻猊|睚眦|螭|狴犴|负屃|椒图|囚牛|"
        "蒲牢|赑屃|食梦|甪端|犼|腾蛇|蜃|年兽|山魈|玄蜂|玄鸟|鲛人|白泽|鲲鹏|"
        "九婴|火光|山罴|辟邪|天禄|鹓|蛮蛮|玄豹|赤鱬|驺吾|天马|巴蛇|文鳐|螭龙|"
        "夔牛|锦鲤仙子|石狮子|旋龟|龙马|三足金蟾"
    )
    if re.search(mythical_kw, name) or num <= 40 or 81 <= num <= 100:
        return "mythical"
    return "normal"


def _lerp(a, b, t):
    return int(a + (b - a) * t)


def make_background(size: int, theme: str, level: int) -> Image.Image:
    """每级差异明显的场景底图（渐变 + 几何装饰）。"""
    palettes = {
        "nest": ((255, 232, 200), (255, 180, 120), (255, 210, 160)),
        "dawn": ((180, 230, 255), (255, 210, 160), (200, 240, 255)),
        "meadow": ((170, 240, 190), (120, 200, 140), (210, 255, 220)),
        "campus": ((255, 245, 200), (180, 220, 160), (255, 230, 170)),
        "valley": ((160, 210, 255), (100, 160, 220), (200, 230, 255)),
        "cloud": ((220, 210, 255), (160, 150, 230), (240, 230, 255)),
        "gold": ((255, 220, 150), (255, 160, 80), (255, 200, 120)),
        "palace": ((255, 200, 160), (200, 120, 80), (255, 180, 120)),
        "star": ((30, 20, 70), (90, 40, 140), (50, 30, 100)),
    }
    top, bottom, accent = palettes.get(theme, palettes["meadow"])
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        # 轻微抛物线过渡，避免纯线性
        t2 = t * t * (3 - 2 * t)
        r = _lerp(top[0], bottom[0], t2)
        g = _lerp(top[1], bottom[1], t2)
        b = _lerp(top[2], bottom[2], t2)
        for x in range(size):
            wobble = int(12 * math.sin((x / size) * math.pi * 2 + level))
            px[x, y] = (
                max(0, min(255, r + wobble // 2)),
                max(0, min(255, g)),
                max(0, min(255, b - wobble // 3)),
            )

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if theme == "nest":
        # 暖色窝巢弧线
        for i in range(5):
            y0 = size - 40 - i * 18
            draw.arc([60, y0 - 80, size - 60, y0 + 80], 200, 340, fill=(*accent, 70), width=10)
        for i in range(8):
            cx = 80 + i * 80
            cy = size - 90
            draw.ellipse([cx - 12, cy - 8, cx + 12, cy + 8], fill=(255, 200, 140, 90))
    elif theme == "dawn":
        # 太阳 + 光晕
        draw.ellipse([size - 220, 40, size - 60, 200], fill=(255, 230, 150, 120))
        draw.ellipse([size - 200, 60, size - 80, 180], fill=(255, 250, 200, 160))
        for i in range(6):
            ang = i * 30
            x1 = size - 140 + int(90 * math.cos(math.radians(ang)))
            y1 = 120 + int(50 * math.sin(math.radians(ang)))
            draw.line([(size - 140, 120), (x1, y1)], fill=(255, 240, 180, 80), width=4)
    elif theme == "meadow":
        for i in range(12):
            x = 40 + i * 60
            h = 40 + (i * 17) % 50
            draw.polygon([(x, size - 30), (x + 10, size - 30 - h), (x + 20, size - 30)], fill=(80, 180, 100, 100))
        for i in range(9):
            cx, cy = 70 + i * 75, 120 + (i % 3) * 40
            draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 255, 200, 110))
    elif theme == "campus":
        # 简约校门/旗帜感
        draw.rectangle([size // 2 - 90, 80, size // 2 + 90, 200], outline=(*accent, 140), width=6)
        draw.polygon(
            [(size // 2 - 100, 80), (size // 2, 40), (size // 2 + 100, 80)],
            fill=(*accent, 90),
        )
        draw.rectangle([120, size - 160, 180, size - 40], fill=(180, 140, 90, 100))
        draw.ellipse([100, size - 200, 200, size - 120], fill=(60, 160, 80, 90))
    elif theme == "valley":
        for i, pts in enumerate(
            [
                [(0, size - 80), (200, size - 220), (400, size - 100), (0, size)],
                [(250, size), (450, size - 260), (700, size - 90), (size, size)],
            ]
        ):
            draw.polygon(pts, fill=(90 + i * 30, 140 + i * 20, 180, 70 + i * 20))
        for i in range(5):
            y = 180 + i * 50
            draw.arc([100, y, size - 100, y + 60], 0, 180, fill=(200, 230, 255, 60), width=3)
    elif theme == "cloud":
        for cx, cy, r in [(120, 140, 70), (200, 120, 55), (280, 150, 65), (500, 100, 80), (620, 130, 60)]:
            draw.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=(255, 255, 255, 90))
        draw.ellipse([size // 2 - 40, 60, size // 2 + 40, 140], fill=(255, 255, 220, 70))
    elif theme == "gold":
        for i in range(8):
            y = 100 + i * 55
            draw.arc([80, y, size - 80, y + 100], 200, 340, fill=(255, 220, 120, 50), width=8)
        draw.ellipse([size - 180, 50, size - 50, 180], fill=(255, 230, 120, 100))
        draw.polygon(
            [(size // 2, size - 40), (size // 2 - 120, size - 120), (size // 2 + 120, size - 120)],
            fill=(255, 200, 100, 70),
        )
    elif theme == "palace":
        # 台阶 + 柱
        for i in range(4):
            y = size - 50 - i * 28
            inset = 40 + i * 30
            draw.rectangle([inset, y, size - inset, y + 22], fill=(220, 160, 100, 80 + i * 15))
        for x in (140, size - 180):
            draw.rectangle([x, 160, x + 40, size - 140], fill=(255, 210, 160, 100))
            draw.ellipse([x - 10, 130, x + 50, 180], fill=(255, 220, 150, 120))
    elif theme == "star":
        for i in range(40):
            cx = (i * 97 + level * 13) % (size - 20) + 10
            cy = (i * 53 + 17) % (size // 2) + 10
            r = 1 + (i % 3)
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 140 + (i % 80)))
        # 月牙
        draw.ellipse([size - 200, 40, size - 60, 180], fill=(255, 250, 210, 100))
        draw.ellipse([size - 170, 50, size - 40, 170], fill=(40, 25, 80, 255))
        # 光环
        draw.ellipse(
            [size // 2 - 160, size // 2 - 160, size // 2 + 160, size // 2 + 160],
            outline=(200, 160, 255, 70),
            width=6,
        )

    # 通用底台柔光
    for i in range(50):
        alpha = int(45 * (1 - i / 50))
        y0 = size - 70 + i
        if 0 <= y0 < size:
            draw.line([(50, y0), (size - 50, y0)], fill=(255, 255, 255, alpha))

    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def load_stage(files: dict, stage: str) -> Image.Image:
    path = files.get(stage) or files.get("juvenile") or files.get("adult") or files.get("egg")
    if not path or not Path(path).exists():
        raise FileNotFoundError(f"缺少阶段图 {stage}")
    return Image.open(path).convert("RGBA")


def fit_rgba(src: Image.Image, canvas_size: int, scale: float) -> Image.Image:
    im = src.convert("RGBA")
    target = max(32, int(canvas_size * 0.92 * scale))
    im.thumbnail((target, target), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - im.width) // 2
    y = (canvas_size - im.height) // 2 + int(canvas_size * 0.02)
    layer.paste(im, (x, y), im)
    return layer


def blend_layers(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    """两层同尺寸 RGBA 按透明度混合角色。"""
    t = max(0.0, min(1.0, t))
    if t <= 0.01:
        return a
    if t >= 0.99:
        return b
    return Image.blend(a, b, t)


def enhance_for_level(im: Image.Image, level: int) -> Image.Image:
    if level >= 8:
        im = ImageEnhance.Contrast(im).enhance(1.14)
        im = ImageEnhance.Color(im).enhance(1.18)
        im = ImageEnhance.Brightness(im).enhance(1.04)
        # 淡金边光
        glow = im.filter(ImageFilter.GaussianBlur(2))
        im = Image.blend(im, glow, 0.15)
    elif level >= 6:
        im = ImageEnhance.Color(im).enhance(1.1)
        im = ImageEnhance.Contrast(im).enhance(1.06)
    elif level == 1:
        im = ImageEnhance.Brightness(im).enhance(1.08)
        im = ImageEnhance.Color(im).enhance(0.96)
    elif level == 0:
        im = ImageEnhance.Brightness(im).enhance(1.05)
        im = ImageEnhance.Color(im).enhance(0.98)
    return im


def compose_level(files: dict, level: int, size: int = SIZE) -> Image.Image:
    plan = LEVEL_PLAN[level]
    bg = make_background(size, plan["theme"], level)
    primary = load_stage(files, plan["primary"])
    secondary = load_stage(files, plan["secondary"])
    layer_a = fit_rgba(primary, size, plan["scale"])
    layer_b = fit_rgba(secondary, size, plan["scale"])
    layer = blend_layers(layer_a, layer_b, plan["blend"])
    if level == 0:
        layer = layer.filter(ImageFilter.SMOOTH)
    elif level == 1:
        # 破壳：略缩小 + 轻模糊模拟刚破壳
        layer = layer.filter(ImageFilter.SMOOTH_MORE)
    out = Image.alpha_composite(bg.convert("RGBA"), layer)
    return enhance_for_level(out.convert("RGB"), level)


def process_one(meta: dict, force: bool = False) -> tuple[str, bool, str]:
    pid = meta["id"]
    dest = OUT / pid
    dest.mkdir(parents=True, exist_ok=True)
    try:
        for lv in range(9):
            out_path = dest / f"lv{lv}.png"
            if out_path.exists() and out_path.stat().st_size > 1000 and not force:
                continue
            img = compose_level(meta["files"], lv)
            img.save(out_path, "PNG", optimize=True)
        return pid, True, "ok"
    except Exception as e:
        return pid, False, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    pets = parse_pets(SRC)
    print(f"发现宠物 {len(pets)} 只", flush=True)
    items = list(pets.values())
    if args.limit:
        items = items[: args.limit]

    catalog = []
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(process_one, m, args.force) for m in items]
        for i, fut in enumerate(as_completed(futs), 1):
            pid, success, msg = fut.result()
            meta = pets[pid]
            if success:
                ok += 1
                catalog.append(
                    {
                        "id": pid,
                        "name": meta["name"],
                        "category": category_of(meta["num"], meta["name"]),
                        "num": meta["num"],
                        "builtin": False,
                    }
                )
            else:
                fail += 1
                print(f"FAIL {pid}: {msg}", flush=True)
            if i % 20 == 0 or i == len(futs):
                print(f"进度 {i}/{len(futs)} ok={ok} fail={fail}", flush=True)

    catalog.sort(key=lambda x: x["num"])
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"DONE ok={ok} fail={fail} catalog={len(catalog)} -> {CATALOG}", flush=True)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
