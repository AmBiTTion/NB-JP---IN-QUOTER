@echo off
chcp 65001 >nul
title Product Quotation System (Dev Mode)

setlocal enabledelayedexpansion

echo ========================================
echo   Product Quotation System - Dev Mode
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo Please install from https://nodejs.org
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found.
    echo Reinstall Node.js and try again.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Dependency install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting dev mode...
call npm run dev

if !errorlevel! neq 0 (
    echo [ERROR] Dev server failed to start.
    pause
    exit /b 1
)
