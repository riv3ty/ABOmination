# Startet den ABOmination lokal unter http://localhost:8765/ (nur auf diesem Rechner erreichbar).
# Noetig fuer Google Drive und OneNote, weil deren Anmeldung eine http-Adresse verlangt.
param([int]$Port = 8765, [switch]$NoBrowser)

$file = Join-Path $PSScriptRoot 'abo-manager.html'
if (-not (Test-Path $file)) { Write-Host "abo-manager.html nicht gefunden: $file"; exit 1 }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch { Write-Host "Port $Port ist nicht verfuegbar (laeuft der ABOmination schon?): $($_.Exception.Message)"; exit 1 }

Write-Host "ABOmination laeuft auf http://localhost:$Port/"
Write-Host "Dieses Fenster offen lassen. Zum Beenden schliessen oder Strg+C druecken."
if (-not $NoBrowser) { Start-Process "http://localhost:$Port/" }

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            $path = $ctx.Request.Url.AbsolutePath
            if ($path -eq '/' -or $path -eq '/index.html') {
                $bytes = [IO.File]::ReadAllBytes($file)          # bei jeder Anfrage neu lesen
                $res.ContentType = 'text/html; charset=utf-8'
                $res.Headers.Add('Cache-Control', 'no-store')
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } elseif ($path -eq '/favicon.ico') {
                $res.StatusCode = 204
            } else {
                $res.StatusCode = 404
            }
        } catch { $res.StatusCode = 500 }
        finally { $res.Close() }
    }
} finally { $listener.Stop() }
