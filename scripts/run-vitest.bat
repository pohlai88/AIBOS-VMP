@echo off
REM Vitest Runner Batch Script for Windows
REM Helps MCP tools and other processes find npm/npx

setlocal

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

REM Change to project root
cd /d "%PROJECT_ROOT%"

REM Run vitest via npm (more reliable than npx)
call npm run test %*

endlocal

