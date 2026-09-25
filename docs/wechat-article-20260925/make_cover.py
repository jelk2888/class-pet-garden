# -*- coding: utf-8 -*-
"""用班宠真实界面截图合成公众号封面（2.35:1）。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(r"d:\天门中学\班级宠物系统\docs\wechat-article-20260925")
SRC = ROOT / "images" / "00-home.png"
OUT = ROOT / "images" / "cover-wordbuddy-banchong.jpg"

W, H = 2350, 1000  # ~2.35:1


def find_font(size):
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def main():
    base = Image.open(SRC).convert("RGB")
    # 裁切顶部导航+卡片区，偏左
    bw, bh = base.size
    crop = base.crop((0, 0, int(bw * 0.72), int(bh * 0.85)))
    crop = ImageEnhance.Color(crop).enhance(1.15)
    crop = ImageEnhance.Contrast(crop).enhance(1.05)

    canvas = Image.new("RGB", (W, H), (255, 247, 240))
    # 背景渐变条
    draw = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / H
        r = int(255 - 20 * t)
        g = int(180 - 40 * t)
        b = int(140 + 40 * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # 左侧放截图
    target_h = int(H * 0.88)
    ratio = target_h / crop.height
    tw = int(crop.width * ratio)
    shot = crop.resize((tw, target_h), Image.Resampling.LANCZOS)
    # 圆角蒙版
    mask = Image.new("L", shot.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, shot.size[0] - 1, shot.size[1] - 1], radius=36, fill=255)
    left = 48
    top = (H - target_h) // 2
    canvas.paste(shot, (left, top), mask)

    # 右侧标题区
    title_font = find_font(96)
    sub_font = find_font(48)
    tip_font = find_font(32)
    tx = int(W * 0.55)
    draw = ImageDraw.Draw(canvas)
    # 白底卡片
    draw.rounded_rectangle([tx - 30, 180, W - 60, H - 180], radius=28, fill=(255, 255, 255, ))
    # pillow RGB only - redraw on overlay
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([tx - 30, 180, W - 60, H - 180], radius=28, fill=(255, 255, 255, 235))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    draw.text((tx + 20, 260), "WordBuddy手搓", font=title_font, fill=(220, 80, 40))
    draw.text((tx + 24, 390), "班级宠物园", font=sub_font, fill=(60, 60, 60))
    draw.text((tx + 24, 480), "用提示词把课堂积分做成可玩系统", font=tip_font, fill=(120, 100, 90))
    draw.text((tx + 24, 560), "东郭工作室", font=tip_font, fill=(240, 120, 80))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, "JPEG", quality=92)
    print("cover ->", OUT, canvas.size)


if __name__ == "__main__":
    main()
