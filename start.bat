@echo off
rem 5AM - start the website and the dashboard.
rem Double-click this file. It starts MySQL, then the site, then opens the browser.
rem The real work is in scripts\start.ps1 (Arabic messages live there, because
rem .bat files are read in the legacy codepage and would mangle them).
rem This file must keep Windows line endings (CRLF): cmd.exe misreads LF-only files.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
if errorlevel 1 pause
