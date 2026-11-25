@echo off
rem LifeCircle - run the backend tests on Windows (same as `make test`).
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo The Python environment is missing. Run install.bat first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m pytest -q
if /i not "%~1"=="nopause" pause
