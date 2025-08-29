@echo off
setlocal
set REPO_URL=https://github.com/murilomn58/GARIMPADOR-webscraper.git
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1" -RepoUrl "%REPO_URL%"

