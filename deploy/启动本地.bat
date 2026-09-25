@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title 班级宠物园 - 本地启动
echo ========================================
echo   东郭工作室·班级宠物园  本地运行
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未检测到 Node.js。
  echo 请先安装 Node.js 18 或更高版本：
  echo   https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo Node.js: %NODE_VER%
echo.

if not exist "server\package.json" (
  echo [错误] 找不到 server\package.json，请确认本 bat 位于部署包根目录。
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo [警告] 找不到 dist\index.html，网页可能无法打开。
)

REM 本地数据目录（SQLite），与代码分离，便于备份
if not exist "data" mkdir "data"
set "DATA_DIR=%~dp0data"
set "HOST=0.0.0.0"
set "PORT=3000"

if not exist "server\node_modules\better-sqlite3" (
  echo 首次运行：正在安装服务端依赖（需联网，约 1～3 分钟）...
  pushd server
  call npm install --omit=dev
  if errorlevel 1 (
    echo [错误] npm install 失败。请检查网络，或手动执行：
    echo   cd server ^&^& npm install --omit=dev
    popd
    pause
    exit /b 1
  )
  popd
  echo 依赖安装完成。
  echo.
)

echo 数据目录: %DATA_DIR%
echo 访问地址: http://127.0.0.1:%PORT%
echo 按 Ctrl+C 可停止服务。
echo.
echo 正在启动...
echo.

REM 延迟打开浏览器
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:%PORT%/"

node server\index.js
set EXITCODE=%ERRORLEVEL%

echo.
if not "%EXITCODE%"=="0" (
  echo [提示] 进程已退出，代码 %EXITCODE%。若端口被占用，可先关闭占用 3000 的程序，
  echo 或设置环境变量 PORT 后重试，例如：set PORT=3001
)
echo.
pause
endlocal
exit /b %EXITCODE%
