@echo off
rem 5AM - stop the website and the database.
rem Double-click this file when you are done working.
rem This file must keep Windows line endings (CRLF): cmd.exe misreads LF-only files.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
if errorlevel 1 pause
