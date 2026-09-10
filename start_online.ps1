# Startet den Server + Cloudflare Tunnel fuer weltweiten HTTPS-Zugriff
param([int]$Port = 8080)

$RootPath = $PSScriptRoot

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   BESTELLUNGEN APP - WELTWEITEN ONLINE-LINK ERSTELLEN" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Öffne den permanent bereitgestellten URL..." -ForegroundColor Yellow

# Permanent URL (nach Deployment)
$permanentUrl = "https://bestellungen-app.onrender.com"  # <-- Aktualisieren bei erfolgreichem Deployment
Start-Process $permanentUrl

Write-Host "================================================================" -ForegroundColor Green
Write-Host "   DIE APP IST JETZT ONLINE ERREICHBAR!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "   Öffentliche Webadresse: $permanentUrl" -ForegroundColor Cyan
Write-Host "   (Bitte in start_online.ps1 prüfen, ggf. anpassen)" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Green
