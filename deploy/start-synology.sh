#!/bin/sh
# 群晖启动脚本：SQLite 写到独立数据卷，避免 Web 目录权限问题
# 用法：chmod +x start-synology.sh && ./start-synology.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

# —— 按需修改 ——
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4158}"
# 推荐：独立卷存放数据库（请先 mkdir -p 并保证当前用户可写）
export DATA_DIR="${DATA_DIR:-/volume1/class-pet-data}"
# 可选：export DB_PATH=/volume1/class-pet-data/dongguo-pet.db

mkdir -p "$DATA_DIR" 2>/dev/null || true

# 依赖装在项目根（sql.js，纯 JS）
if [ ! -d "$DIR/node_modules/sql.js" ] && [ ! -d "$DIR/server/node_modules/sql.js" ]; then
  echo "正在安装依赖…"
  (cd "$DIR" && npm install --omit=dev) || exit 1
fi

echo "DATA_DIR=$DATA_DIR  PORT=$PORT"
exec node "$DIR/server/index.js"
