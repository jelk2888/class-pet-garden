#!/bin/sh
# 群晖：安装依赖（现为纯 JS：express + sql.js，无需编译 better-sqlite3）
# 用法：sed -i 's/\r$//' install-deps.sh && chmod +x install-deps.sh && ./install-deps.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

echo "======== 安装诊断 ========"
echo "当前目录: $DIR"
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"
echo "node: ${NODE_BIN:-未找到} $($NODE_BIN -v 2>/dev/null || true)"
echo "npm:  ${NPM_BIN:-未找到} $($NPM_BIN -v 2>/dev/null || true)"

if [ -z "$NODE_BIN" ] || [ -z "$NPM_BIN" ]; then
  echo "错误: 找不到 node/npm。请先安装 Node.js（Web Station 用的 v20 即可）。"
  exit 1
fi

if [ ! -f "$DIR/package.json" ]; then
  echo "错误: 当前目录没有 package.json"
  exit 1
fi
if ! grep -q '"sql.js"' "$DIR/package.json"; then
  echo "错误: package.json 未含 sql.js，请上传最新部署包"
  exit 1
fi

echo "清理旧的 better-sqlite3 / node_modules…"
rm -rf "$DIR/node_modules" "$DIR/server/node_modules"
rm -f "$DIR/package-lock.json" "$DIR/server/package-lock.json"

echo "npm install（纯 JS，无需 g++）…"
npm install --omit=dev --no-fund --no-audit

echo "======== 检查结果 ========"
if [ -d "$DIR/node_modules/sql.js" ] && [ -d "$DIR/node_modules/express" ]; then
  echo "成功: node_modules 已就绪（sql.js + express）"
  node -e "import('sql.js').then(()=>console.log('sql.js OK under', process.version))"
  echo "请回 Web Station 重新启动应用。"
  exit 0
fi
echo "失败: 请把上方完整输出发回。"
exit 1
