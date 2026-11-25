@echo off
title GRT Faculty Data Sheet
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist "node_modules\vite\package.json" goto install
goto start

:install
echo.
echo [1/2] Installing packages - please wait, needs internet...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed

:start
echo.
echo [2/2] Starting... open http://localhost:5173 in your browser. Tap the intro once to start it. Keep this window open.
call npm run dev -- --open
echo.
echo The app stopped. Read the message above.
pause
exit /b 0

:nonode
echo Node.js is not installed. Download the LTS version from https://nodejs.org , install it, then run RUN.bat again.
pause
exit /b 1

:failed
echo.
echo Something failed. Copy the text above and send it for help.
pause
exit /b 1
