@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo  BeatCut Studio Server - Lokal starten
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo FEHLER: Node.js wurde nicht gefunden.
  echo Bitte Node.js 22.5 oder neuer installieren.
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22 || (a===22 && b>=5) ? 0 : 1)"
if errorlevel 1 (
  echo FEHLER: Node.js 22.5 oder neuer wird benoetigt.
  node -v
  pause
  exit /b 1
)

echo BeatCut wird gestartet...
node --disable-warning=ExperimentalWarning backend\src\launcher.js

if errorlevel 1 (
  echo.
  echo BeatCut wurde mit einem Fehler beendet.
  pause
)
