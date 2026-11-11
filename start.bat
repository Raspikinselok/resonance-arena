@echo off
rem RESONANCE ARENA starten: Doppelklick genuegt.
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
start "" cmd /c "timeout /t 2 >nul & start http://localhost:4173"
node server\index.mjs
pause
