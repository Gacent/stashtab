@echo off
chcp 65001 >nul
title LinkCollector Dev Server
cd /d "%~dp0"

echo ================================
echo   个人收藏工具 - 开发环境
echo ================================
echo.

echo [1/2] Starting backend Worker (port 8787)...
start "Worker" cmd /k "cd /d %~dp0worker && npx wrangler dev --port 8787"

echo [2/2] Starting frontend Vite (port 5173)...
start "Frontend" cmd /k "cd /d %~dp0frontend && npx vite --host 0.0.0.0 --port 5173"

echo.
echo ================================
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8787
echo.
echo   Close this window to stop all services
echo ================================
echo.

:loop
timeout /t 10 /nobreak >nul
goto loop