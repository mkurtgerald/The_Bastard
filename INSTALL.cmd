@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\Install.ps1"
if errorlevel 1 (
  echo.
  echo Installation did not complete successfully.
  pause
  exit /b 1
)
echo.
echo Installation complete.
pause
