@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/2] 启动后端 API :3000 ...
start "班级宠物园-后端" cmd /k "node server\index.js"

timeout /t 2 /nobreak >nul

echo [2/2] 启动前端 :3001 ...
start "班级宠物园-前端" cmd /k "npm run dev"

echo.
echo 浏览器打开: http://localhost:3001/
echo 管理员账号: admin / Claw2026!
echo.
pause
