# Startet den ABOmination lokal unter http://localhost:8765/ (nur auf diesem Rechner erreichbar).
# Noetig fuer Google Drive und OneNote, weil deren Anmeldung eine http-Adresse verlangt.
param([int]$Port = 8765, [switch]$NoBrowser)

$root = Join-Path $PSScriptRoot 'dist'
if (-not (Test-Path (Join-Path $root 'index.html'))) {
    Write-Host "dist\index.html nicht gefunden. Bitte einmal bauen:  npm install  und  npm run build"
    exit 1
}
$rootFull = [IO.Path]::GetFullPath($root)
# Nur diese Dateitypen ausliefern (App, Service Worker, Manifest, Icons)
$types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
    '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'
}

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
            $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
            if ($path -eq '/') { $path = '/index.html' }
            $full = [IO.Path]::GetFullPath((Join-Path $rootFull $path.TrimStart('/')))
            $ext = [IO.Path]::GetExtension($full).ToLower()
            if ($path -eq '/favicon.ico') {
                $res.StatusCode = 204
            } elseif ($full.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar) -and $types.ContainsKey($ext) -and (Test-Path $full -PathType Leaf)) {
                $bytes = [IO.File]::ReadAllBytes($full)                 # bei jeder Anfrage neu lesen
                $res.ContentType = $types[$ext]
                $res.Headers.Add('Cache-Control', 'no-cache')
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
        } catch { $res.StatusCode = 500 }
        finally { $res.Close() }
    }
} finally { $listener.Stop() }
