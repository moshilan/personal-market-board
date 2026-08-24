@echo off
cd /d "%~dp0"
start "个人行情看板服务" /b node scripts\serve-dashboard.mjs
timeout /t 1 /nobreak > nul
start "个人行情看板" http://localhost:8787
