@echo off
setlocal ENABLEDELAYEDEXPANSION
set "PROJ=%~dp0..\..\..\..\"  
if exist "%PROJ%package.json" (
  cd /d "%PROJ%"
) else (
  set "PROJ=C:\Users\Narcísius\OneDrive\Área de Trabalho\IC ITA\GARIMPADOR"
  cd /d "%PROJ%"
)
echo === GARIMPADOR — Terminal 2 (UI Streamlit) ===
where python >nul 2>nul || where py >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Python nao encontrado no PATH. Instale Python 3.10+ e tente novamente.
  pause
  goto :eof
)

echo [1/2] Instalando dependencias da UI (streamlit/requests/pandas)...
python -m pip install --upgrade pip
pip install streamlit requests pandas || goto :error

echo [2/2] Abrindo UI em http://localhost:8501 ...
streamlit run src/ui/app.py
goto :eof

:error
echo.
echo Ocorreu um erro ao instalar/rodar a UI. Verifique o Python/pip e tente novamente.
pause

