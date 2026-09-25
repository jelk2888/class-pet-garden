# -*- coding: utf-8 -*-
"""增量更新群晖部署目录（保留 public/pets，刷新代码与前端）。"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(r"D:\天门中学\班级宠物系统")
OUT = Path(r"D:\天门中学\班级宠物系统_群晖WebStation")
DEPLOY = ROOT / "deploy"


def copy_server(src: Path, dest: Path):
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    skip_dirs = {"node_modules", "__tests__", ".git"}
    for item in src.iterdir():
        if item.name in skip_dirs:
            continue
        if item.suffix in {".db", ".bak"} or ".db" in item.name:
            continue
        if item.is_dir():
            if item.name == "scripts":
                d = dest / "scripts"
                d.mkdir()
                for f in item.iterdir():
                    if f.name.startswith("_"):
                        continue
                    if f.suffix in {".mjs", ".js", ".md"}:
                        shutil.copy2(f, d / f.name)
                continue
            shutil.copytree(
                item,
                dest / item.name,
                ignore=shutil.ignore_patterns("node_modules", "*.db", "__tests__", "*.bak*"),
            )
        else:
            if item.name.endswith(".test.js") or item.name == "vitest.config.js":
                continue
            shutil.copy2(item, dest / item.name)
    (dest / "data").mkdir(exist_ok=True)
    (dest / "data" / ".gitkeep").write_text("", encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("构建前端…", flush=True)
    r = subprocess.run(["npx", "vite", "build"], cwd=str(ROOT), shell=True)
    if r.returncode != 0:
        raise SystemExit("vite build failed")

    if (OUT / "dist").exists():
        shutil.rmtree(OUT / "dist")
    shutil.copytree(ROOT / "dist", OUT / "dist")
    print("更新 server…", flush=True)
    copy_server(ROOT / "server", OUT / "server")

    pets_src, pets_dst = ROOT / "public" / "pets", OUT / "public" / "pets"
    if not pets_dst.exists() and pets_src.exists():
        print("复制 pets（首次）…", flush=True)
        shutil.copytree(pets_src, pets_dst)
    else:
        print("保留已有 public/pets", flush=True)

    (OUT / "package.json").write_text(
        """{
  "name": "class-pet-garden-synology",
  "version": "1.0.0",
  "private": true,
  "description": "东郭工作室·班级宠物园 — 群晖 / 本地部署包",
  "scripts": {
    "start": "node server/index.js",
    "install:server": "npm install --omit=dev --prefix server"
  },
  "engines": { "node": ">=18" }
}
""",
        encoding="utf-8",
    )

    for name in [
        "启动本地.bat",
        "安装依赖.bat",
        "本地使用说明书.txt",
        "start-synology.sh",
    ]:
        src = DEPLOY / name if (DEPLOY / name).exists() else OUT / name
        if (DEPLOY / name).exists():
            shutil.copy2(DEPLOY / name, OUT / name)
            print("sync", name)
        elif (OUT / name).exists():
            print("keep", name)

    # sync bats from synology pack originals if deploy missing
    for name in ["启动本地.bat", "安装依赖.bat", "本地使用说明书.txt"]:
        src = OUT / name
        if not src.exists() and (ROOT / "deploy" / name).exists():
            shutil.copy2(ROOT / "deploy" / name, OUT / name)

    print("DONE", OUT)


if __name__ == "__main__":
    main()
