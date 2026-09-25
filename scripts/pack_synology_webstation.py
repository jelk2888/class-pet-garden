# -*- coding: utf-8 -*-
"""打包群晖 Web Station / Node.js 可上传运行目录。"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"D:\天门中学\班级宠物系统")
OUT = Path(r"D:\天门中学\班级宠物系统_群晖WebStation")

SKIP_SERVER_DIRS = {"node_modules", "__tests__", ".git"}
SKIP_SERVER_FILES = {".DS_Store"}


def run(cmd, cwd):
    print("+", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=str(cwd), shell=False)
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def copy_server(src: Path, dest: Path):
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.name in SKIP_SERVER_DIRS:
            continue
        if item.name in SKIP_SERVER_FILES:
            continue
        if item.name.endswith(".db") or item.name.endswith(".db-journal"):
            # 不带开发库，群晖上首次启动自动建库
            continue
        if item.name.endswith(".backup") or item.name.endswith(".bak"):
            continue
        if item.is_dir():
            if item.name == "scripts":
                # 保留必要运维脚本，跳过临时 _
                d = dest / "scripts"
                d.mkdir(exist_ok=True)
                for f in item.iterdir():
                    if f.name.startswith("_"):
                        continue
                    if f.suffix in {".mjs", ".js", ".md"}:
                        shutil.copy2(f, d / f.name)
                continue
            shutil.copytree(item, dest / item.name, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns("node_modules", "*.db", "__tests__"))
        else:
            if item.suffix in {".test.js", ".test.mjs"}:
                continue
            shutil.copy2(item, dest / item.name)


def main():
    print("OUT =", OUT, flush=True)
    if OUT.exists():
        print("清理旧目录…", flush=True)
        shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)

    # 1) 构建前端（跳过 vue-tsc，加快且避免类型阻断）
    env = os.environ.copy()
    env["NODE_ENV"] = "production"
    print("构建前端 dist…", flush=True)
    r = subprocess.run(
        ["npx", "vite", "build"],
        cwd=str(ROOT),
        env=env,
        shell=True,
    )
    if r.returncode != 0:
        raise SystemExit("vite build failed")

    dist = ROOT / "dist"
    if not dist.exists():
        raise SystemExit("dist missing")

    # 2) 复制结构
    shutil.copytree(dist, OUT / "dist")
    copy_server(ROOT / "server", OUT / "server")

    pets_src = ROOT / "public" / "pets"
    pets_dst = OUT / "public" / "pets"
    if pets_src.exists():
        print("复制宠物图片（较大，请稍候）…", flush=True)
        shutil.copytree(pets_src, pets_dst, dirs_exist_ok=True)
    else:
        pets_dst.mkdir(parents=True, exist_ok=True)
        print("警告: 无 public/pets，图鉴将缺失", flush=True)

    downloads_src = ROOT / "public" / "downloads"
    downloads_dst = OUT / "public" / "downloads"
    if downloads_src.exists():
        print("复制桌面客户端下载包…", flush=True)
        if downloads_dst.exists():
            shutil.rmtree(downloads_dst, ignore_errors=True)
        shutil.copytree(downloads_src, downloads_dst)
    else:
        downloads_dst.mkdir(parents=True, exist_ok=True)

    # 3) 根 package.json：群晖上 npm install && npm start
    (OUT / "package.json").write_text(
        """{
  "name": "class-pet-garden-synology",
  "version": "1.0.0",
  "private": true,
  "description": "东郭工作室·班级宠物园 — 群晖 Web Station / Node.js 部署包",
  "scripts": {
    "start": "node server/index.js",
    "install:server": "npm install --omit=dev --prefix server"
  },
  "engines": {
    "node": ">=18"
  }
}
""",
        encoding="utf-8",
    )

    (OUT / "start-synology.sh").write_text(
        Path(r"D:\天门中学\班级宠物系统\deploy\start-synology.sh").read_text(encoding="utf-8").replace("\r\n", "\n"),
        encoding="utf-8",
    )

    # 4) 安装说明
    (OUT / "安装说明-群晖WebStation.txt").write_text(
        """东郭工作室·班级宠物园 — 群晖部署说明
================================

本目录为「单进程」部署包：Node.js 同时提供网页 + API + 宠物图片。

【关于 pets 两个目录】
- public/pets：运行时图鉴主目录（后端 /pets 静态与管理员上传都写这里）——必须保留。
- dist/pets：前端构建时从 public 复制的副本，内容应与 public/pets 一致。
  单进程部署时以后端 public/pets 为准；两边都保留可避免漏图。不要只留 dist/pets。

【推荐方式：Node.js 套件常驻】
1. 套件中心安装：Node.js v18 / v20（或更新 LTS）、可选 pm2
2. 将本文件夹上传到例如：/volume1/web/class-pet-garden
3. 创建数据目录（SQLite 专用，强烈建议）：
     mkdir -p /volume1/class-pet-data
4. SSH 执行：
     cd /volume1/web/class-pet-garden
     chmod +x start-synology.sh
     ./start-synology.sh
   或：
     cd server && npm install --omit=dev && cd ..
     DATA_DIR=/volume1/class-pet-data PORT=3000 npm start
5. Web Station 反向代理到 http://127.0.0.1:3000
   或直接访问 http://群晖IP:3000

【SQLite 数据库（群晖必读）】
- 引擎：better-sqlite3（必须在群晖 Linux 上 npm install 编译）
- 默认：server/data/dongguo-pet.db（首次自动建库）
- 推荐环境变量：
    DATA_DIR=/volume1/class-pet-data
    或 DB_PATH=/volume1/class-pet-data/dongguo-pet.db
- 已开启 WAL；备份请同时拷贝：
    dongguo-pet.db / dongguo-pet.db-wal / dongguo-pet.db-shm
- readonly / database is locked：检查 DATA_DIR 写权限
- 编译失败：安装 Python3、make、gcc 后再 npm install

【环境变量】
  PORT=3000
  HOST=0.0.0.0
  DATA_DIR=/volume1/class-pet-data
  DB_PATH=...（可选，优先于 DATA_DIR）
  STATIC_DIR=...（可选，默认 ../dist）

【重要】
- 勿从 Windows 拷贝 server/node_modules
- 默认管理员：admin / Claw2026!（请改密）
""",
        encoding="utf-8",
    )


    # 5) .gitignore-ish 提示文件
    (OUT / "server" / ".npmrc").write_text("fund=false\n", encoding="utf-8")

    # 统计
    def du(p: Path) -> int:
        if not p.exists():
            return 0
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())

    total = du(OUT)
    print(f"DONE -> {OUT}")
    print(f"size ~ {total / (1024**3):.2f} GB")
    print("下一步: 上传该目录到群晖，在 server 下 npm install --omit=dev，然后 npm start")


if __name__ == "__main__":
    main()
