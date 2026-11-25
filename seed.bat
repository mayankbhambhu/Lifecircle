@echo off
rem LifeCircle - reset the demo data on Windows (same as `make seed`).
rem Stop api.bat first (Ctrl+C), run this, then start api.bat again.
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo The Python environment is missing. Run install.bat first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m app.seed
if /i not "%~1"=="nopause" pause
