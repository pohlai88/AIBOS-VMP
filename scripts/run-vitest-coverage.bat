@echo off
REM Vitest Coverage Runner Batch Script for Windows

setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

cd /d "%PROJECT_ROOT%"

call npm run test:coverage %*

endlocal

