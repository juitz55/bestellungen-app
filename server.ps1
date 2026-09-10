# PowerShell HTTP Server für Bestellungen Handy-App
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$RootPath = $PSScriptRoot

# 1. Lokale IP-Adresse ermitteln
$bestIp = "127.0.0.1"
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp, Manual -ErrorAction SilentlyContinue | 
        Where-Object { 
            $_.IPAddress -notlike "127.*" -and 
            $_.IPAddress -notlike "169.254.*" -and 
            $_.InterfaceAlias -notmatch "vEthernet|WSL|VirtualBox|VMware|Default Switch"
        }
    if ($ips) {
        $bestIp = ($ips | Select-Object -First 1).IPAddress
    } else {
        $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }
        if ($fallback) { $bestIp = ($fallback | Select-Object -First 1).IPAddress }
    }
} catch {
    $bestIp = "localhost"
}

# 2. MIME Types
$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
}

# 3. TcpListener starten
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
try {
    $listener.Start()
} catch {
    Write-Host "Port $Port konnte nicht geoeffnet werden: $_" -ForegroundColor Red
    exit 1
}

$pcUrl = "http://localhost:$Port"
$phoneUrl = "http://$($bestIp):$Port"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   BESTELLUNGEN HANDY-APP SERVER LAEUFT" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " [PC]    Im Browser:       $pcUrl" -ForegroundColor White
Write-Host " [HANDY] Im WLAN-Browser:  $phoneUrl" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Tipp: Im PC-Browser auf das Handy-Symbol tippen fuer den QR-Code!"
Write-Host " Beenden mit Strg + C"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $NoBrowser) {
    try { Start-Process $pcUrl } catch {}
}

$ordersFile = [System.IO.Path]::Combine($RootPath, "orders.json")

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $stream.ReadTimeout = 4000
        $stream.WriteTimeout = 4000

        $mem = [System.IO.MemoryStream]::new()
        $buf = [byte[]]::new(4096)
        $headerEndPos = -1

        # Header bis \r\n\r\n einlesen
        while ($true) {
            $read = $stream.Read($buf, 0, $buf.Length)
            if ($read -le 0) { break }
            $mem.Write($buf, 0, $read)
            $bytes = $mem.ToArray()

            for ($i = 0; $i -le $bytes.Length - 4; $i++) {
                if ($bytes[$i] -eq 13 -and $bytes[$i+1] -eq 10 -and $bytes[$i+2] -eq 13 -and $bytes[$i+3] -eq 10) {
                    $headerEndPos = $i
                    break
                }
            }
            if ($headerEndPos -ge 0 -or $mem.Length -gt 65536) { break }
        }

        if ($headerEndPos -ge 0) {
            $headerBytes = $bytes[0..($headerEndPos - 1)]
            $headerStr = [System.Text.Encoding]::ASCII.GetString($headerBytes)
            $headerLines = $headerStr -split "`r`n"
            $firstLine = $headerLines[0]
            $parts = $firstLine.Split(" ")

            if ($parts.Length -ge 2) {
                $method = $parts[0].ToUpper()
                $urlPath = $parts[1].Split("?")[0]

                # CORS Preflight OPTIONS
                if ($method -eq "OPTIONS") {
                    $corsResp = "HTTP/1.1 204 No Content`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nAccess-Control-Max-Age: 86400`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
                    $corsBytes = [System.Text.Encoding]::ASCII.GetBytes($corsResp)
                    $stream.Write($corsBytes, 0, $corsBytes.Length)
                    $stream.Flush()
                }
                elseif ($urlPath -eq "/api/orders") {
                    if ($method -eq "GET") {
                        # Aktuelle Bestellungen liefern
                        $ordersJson = "[]"
                        if ([System.IO.File]::Exists($ordersFile)) {
                            $ordersJson = [System.IO.File]::ReadAllText($ordersFile, [System.Text.Encoding]::UTF8)
                        }
                        $respBytes = [System.Text.Encoding]::UTF8.GetBytes($ordersJson)
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nAccess-Control-Allow-Origin: *`r`nCache-Control: no-cache, no-store, must-revalidate`r`nContent-Length: $($respBytes.Length)`r`nConnection: close`r`n`r`n"
                        $hBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($hBytes, 0, $hBytes.Length)
                        $stream.Write($respBytes, 0, $respBytes.Length)
                        $stream.Flush()
                    }
                    elseif ($method -eq "POST") {
                        # Body einlesen
                        $contentLength = 0
                        if ($headerStr -match "(?i)content-length:\s*(\d+)") {
                            $contentLength = [int]$matches[1]
                        }

                        $bodyStart = $headerEndPos + 4
                        $bodyAlreadyRead = $bytes.Length - $bodyStart

                        $bodyMem = [System.IO.MemoryStream]::new()
                        if ($bodyAlreadyRead -gt 0) {
                            $bodyMem.Write($bytes, $bodyStart, [Math]::Min($bodyAlreadyRead, $contentLength))
                        }

                        while ($bodyMem.Length -lt $contentLength) {
                            $toRead = [Math]::Min(4096, ($contentLength - $bodyMem.Length))
                            $r = $stream.Read($buf, 0, $toRead)
                            if ($r -le 0) { break }
                            $bodyMem.Write($buf, 0, $r)
                        }

                        $bodyBytes = $bodyMem.ToArray()
                        $bodyStr = [System.Text.Encoding]::UTF8.GetString($bodyBytes)

                        $success = $false
                        try {
                            # Prüfen ob valides JSON
                            $parsed = ConvertFrom-Json $bodyStr -ErrorAction Stop
                            if ($parsed) {
                                [System.IO.File]::WriteAllText($ordersFile, $bodyStr, [System.Text.Encoding]::UTF8)
                                $success = $true
                            }
                        } catch {
                            $success = $false
                        }

                        $resJson = if ($success) { '{"success":true}' } else { '{"success":false,"error":"Invalid data"}' }
                        $resBytes = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nAccess-Control-Allow-Origin: *`r`nContent-Length: $($resBytes.Length)`r`nConnection: close`r`n`r`n"
                        $hBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($hBytes, 0, $hBytes.Length)
                        $stream.Write($resBytes, 0, $resBytes.Length)
                        $stream.Flush()
                    }
                }
                elseif ($urlPath -eq "/api/ip") {
                    $json = "{`"ip`":`"$bestIp`",`"port`":$Port}"
                    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                    $header = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nAccess-Control-Allow-Origin: *`r`nContent-Length: $($jsonBytes.Length)`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($jsonBytes, 0, $jsonBytes.Length)
                    $stream.Flush()
                }
                else {
                    # Statische Datei ausliefern
                    if ($urlPath -eq "/" -or $urlPath -eq "") {
                        $urlPath = "/index.html"
                    }

                    $relPath = $urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
                    $fullPath = [System.IO.Path]::Combine($RootPath, $relPath)

                    if ([System.IO.File]::Exists($fullPath)) {
                        $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                        $contentType = "application/octet-stream"
                        if ($MimeTypes.ContainsKey($ext)) {
                            $contentType = $MimeTypes[$ext]
                        }

                        $fileBytes = [System.IO.File]::ReadAllBytes($fullPath)
                        $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($fileBytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($fileBytes, 0, $fileBytes.Length)
                        $stream.Flush()
                    } else {
                        $msg = "404 Not Found"
                        $msgBytes = [System.Text.Encoding]::ASCII.GetBytes($msg)
                        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($msgBytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                        $stream.Write($headerBytes, 0, $headerBytes.Length)
                        $stream.Write($msgBytes, 0, $msgBytes.Length)
                        $stream.Flush()
                    }
                }
            }
        }
        $client.Close()
    } catch {
        # Fehler ignorieren und weiterlaufen
    }
}
