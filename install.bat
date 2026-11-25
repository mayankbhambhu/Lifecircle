@echo off
rem LifeCircle - one-time setup on Windows (same as `make install`).
rem Double-click this file, or run `install.bat` from the project folder.
setlocal
cd /d "%~dp0"

echo.
echo === LifeCircle setup ===
echo.

rem ---- Find Python 3.10+ (prefer the py launcher) ----
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo Python was not found.
  echo Install Python 3.10 or newer from https://www.python.org/downloads/
  echo and tick "Add python.exe to PATH" during setup, then run this again.
  goto :fail
)
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 (
  echo Python 3.10 or newer is required. Install it from https://www.python.org/downloads/
  goto :fail
)

rem ---- Check Node.js ----
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node 20 or newer from https://nodejs.org/ and run this again.
  goto :fail
)

rem ---- Backend: private Python environment in backend\.venv ----
if not exist "backend\.venv\Scripts\python.exe" (
  echo Creating the Python environment in backend\.venv ...
  %PY% -m venv backend\.venv
  if errorlevel 1 goto :fail
)
echo Installing backend packages ...
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
"backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :fail

rem ---- Mobile app ----
echo Installing app packages, this can take a few minutes ...
pushd mobile
call npm install
if errorlevel 1 (
  popd
  goto :fail
)
popd

echo.
echo Setup complete.
echo Next: double-click api.bat, then app.bat, and scan the QR code with Expo Go.
if /i not "%~1"=="nopause" pause
exit /b 0

:fail
echo.
echo Setup did not finish - see the message above.
if /i not "%~1"=="nopause" pause
exit /b 1
