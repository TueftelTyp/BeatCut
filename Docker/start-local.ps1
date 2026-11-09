$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js wurde nicht gefunden. Node.js 22.5 oder neuer installieren." }
$versionParts = ((& node -p "process.versions.node").Trim()).Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 5)) { throw "Node.js 22.5 oder neuer wird benoetigt." }

& node --disable-warning=ExperimentalWarning backend/src/launcher.js
if ($LASTEXITCODE -ne 0) { throw "BeatCut wurde mit Exitcode $LASTEXITCODE beendet." }
