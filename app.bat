@echo off
rem LifeCircle - start the Expo dev server on Windows (same as `make app`).
rem Scan the QR code with Expo Go. Keep api.bat running in another window.
setlocal
cd /d "%~dp0mobile"

if not exist "node_modules" (
  echo The app packages are missing. Run install.bat first.
  pause
  exit /b 1
)

call npx expo start
if errorlevel 1 pause
