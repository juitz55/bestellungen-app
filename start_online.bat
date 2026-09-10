@echo off
title Bestellungen Handy-App (Weltweiter Online-Zugriff)
cd /d "%~dp0"
echo ===================================================
echo   Starte weltweiten Online-Zugriff...
echo ===================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_online.ps1"
pause
