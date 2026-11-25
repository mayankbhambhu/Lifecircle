@echo off
rem LifeCircle - start the API on Windows (same as `make api`). Keep this window open.
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo The Python environment is missing. Run install.bat first.
  pause
  exit /b 1
)

echo.
echo === LifeCircle API on port 8000 - press Ctrl+C to stop ===
echo.
echo If Windows Firewall asks about Python, tick "Private networks" and click Allow,
echo otherwise your phone cannot reach this computer.
echo.
echo If the app says it cannot reach the server, tap "Server" on its login screen
echo and enter one of these addresses (use the one for your Wi-Fi adapter):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=*" %%b in ("%%a") do echo     http://%%b:8000
)
echo.

".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
if errorlevel 1 pause
