@echo off
title Bestellungen Handy-App Server
cd /d "%~dp0"
echo ===================================================
echo   Starte Bestellungen Handy-App...
echo ===================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
