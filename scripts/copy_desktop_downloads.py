# -*- coding: utf-8 -*-
"""将 desktop/dist-exe 产物整理为 Win7 / Win10 下载名，复制到 public/downloads。"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "desktop" / "dist-exe"
OUT = ROOT / "public" / "downloads"
OUT.mkdir(parents=True, exist_ok=True)

# electron-builder portable 常见命名
CANDIDATES = {
    "win7": [
        "班级宠物园-ia32.exe",
        "班级宠物园 1.0.0.exe",
        "班级宠物园.exe",
    ],
    "win10": [
        "班级宠物园-x64.exe",
        "班级宠物园 1.0.0.exe",
        "班级宠物园.exe",
    ],
}

TARGETS = {
    "win7": OUT / "班级宠物园-Win7客户端.exe",
    "win10": OUT / "班级宠物园-Win10客户端.exe",
}


def find_exe(arch_key: str) -> Path | None:
    if not DIST.exists():
        return None
    files = list(DIST.rglob("*.exe"))
    # 优先匹配 artifactName 中的 arch
    prefer = "ia32" if arch_key == "win7" else "x64"
    for f in files:
        name = f.name.lower()
        if prefer in name and "setup" not in name and "安装" not in name:
            return f
    # 回退：任意 portable
    for f in files:
        if "portable" in f.name.lower() or f.stat().st_size > 40_000_000:
            return f
    return files[0] if files else None


def main():
    if not DIST.exists():
        raise SystemExit(f"未找到打包目录: {DIST}，请先在 desktop 下 npm run pack:all")

    printed = list(DIST.rglob("*.exe"))
    print("发现 EXE:")
    for p in printed:
        print(" -", p, p.stat().st_size)

    # 分别找 ia32 / x64
    win7 = None
    win10 = None
    for f in printed:
        n = f.name.lower()
        if "ia32" in n or "i386" in n or "32" in n:
            win7 = f
        if "x64" in n or "amd64" in n:
            win10 = f

    if not win7:
        win7 = find_exe("win7")
    if not win10:
        win10 = find_exe("win10")

    # 若只打出一个包，两份都用它（Electron22 双系统可用）
    if win7 and not win10:
        win10 = win7
    if win10 and not win7:
        win7 = win10

    if not win7 or not win10:
        raise SystemExit("未找到可复制的 exe，请检查 desktop/dist-exe")

    shutil.copy2(win7, TARGETS["win7"])
    shutil.copy2(win10, TARGETS["win10"])
    # 清单
    manifest = OUT / "manifest.json"
    import json, time

    data = {
        "updatedAt": int(time.time() * 1000),
        "items": [
            {
                "id": "win7",
                "name": "Win7 客户端",
                "file": TARGETS["win7"].name,
                "url": "/downloads/" + TARGETS["win7"].name,
                "size": TARGETS["win7"].stat().st_size,
                "note": "Windows 7 SP1 及以上（32位/兼容）",
            },
            {
                "id": "win10",
                "name": "Win10 客户端",
                "file": TARGETS["win10"].name,
                "url": "/downloads/" + TARGETS["win10"].name,
                "size": TARGETS["win10"].stat().st_size,
                "note": "Windows 10 / 11（64位）",
            },
        ],
    }
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("已输出:")
    for k, p in TARGETS.items():
        print(f"  {k}: {p} ({p.stat().st_size} bytes)")
    print("manifest:", manifest)


if __name__ == "__main__":
    main()
