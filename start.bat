@echo off
title JKT48 Multi-View Live Server
cd /d "%~dp0"
echo ===================================================
echo   Menjalankan JKT48 Multi-View Live Streaming
echo ===================================================
echo Membuka browser di http://localhost:3000 ...
start http://localhost:3000
node server.js
pause
