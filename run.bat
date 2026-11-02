@echo off
title NEXORA AI - Multi AI Agents Platform
echo ========================================================
echo        NEXORA AI - MULTI AI AGENTS PLATFORM
echo ========================================================
echo.

cd /d "%~dp0"

if exist "venv\bin\python.exe" (
    echo [INFO] Dang khoi dong NEXORA AI server voi venv...
    "venv\bin\python.exe" app.py
) else if exist "venv\Scripts\python.exe" (
    echo [INFO] Dang khoi dong NEXORA AI server voi venv Windows...
    "venv\Scripts\python.exe" app.py
) else (
    echo [INFO] Dang khoi dong NEXORA AI server voi Python he thong...
    python app.py
)

pause

