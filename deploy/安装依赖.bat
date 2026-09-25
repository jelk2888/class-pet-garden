@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 班级宠物园 - 安装依赖

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)

if not exist "server\package.json" (
  echo [错误] 请将本文件放在部署包根目录后运行。
  pause
  exit /b 1
)

echo 正在安装 server 依赖（omit dev）...
pushd server
call npm install --omit=dev
set ERR=%ERRORLEVEL%
popd

if not "%ERR%"=="0" (
  echo 安装失败。
  pause
  exit /b %ERR%
)

echo.
echo 安装成功。可双击「启动本地.bat」运行。
pause
