@echo off
REM ONE-TIME deploy to Vercel (free account; the first run opens a login page).
cd /d "%~dp0"
call npm install --no-audit --no-fund
call npx --yes vercel@latest deploy --prod --yes
pause
