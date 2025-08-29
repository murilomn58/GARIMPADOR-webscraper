@echo off
setlocal ENABLEDELAYEDEXPANSION
set "PROJ=%~dp0..\..\..\..\"  
rem Tenta localizar a pasta do projeto automaticamente a partir deste script.
if exist "%PROJ%package.json" (
  cd /d "%PROJ%"
) else (
  rem Fallback para caminho absoluto conhecido (ajuste se necessário):
  set "PROJ=C:\Users\Narcísius\OneDrive\Área de Trabalho\IC ITA\GARIMPADOR"
  cd /d "%PROJ%"
)
echo === GARIMPADOR — Terminal 1 (Backend) ===
if not exist node_modules (
  echo [1/3] Instalando dependencias (npm install)...
  npm install || goto :error
) else (
  echo Dependencias ja instaladas (node_modules existe).
)
echo [2/3] Instalando navegador Playwright (chromium)...
call npx playwright install chromium || goto :error

echo [3/3] Subindo API em http://localhost:8000 ...
call npm run dev
goto :eof

:error
echo.
echo Ocorreu um erro. Verifique se o Node/npm estao instalados e tente novamente.
pause

