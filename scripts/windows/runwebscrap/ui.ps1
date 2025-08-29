Param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Here = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ConfigPath = Join-Path $Here 'runwebscrap.config.json'

function Get-ProjectPath {
  if (Test-Path $ConfigPath) {
    try {
      $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
      if ($cfg.projectPath -and (Test-Path (Join-Path $cfg.projectPath 'package.json'))) { return $cfg.projectPath }
    } catch {}
  }
  $default = 'C:\Users\Narcísius\OneDrive\Área de Trabalho\IC ITA\GARIMPADOR'
  if (Test-Path (Join-Path $default 'package.json')) { $proj = $default }
  else {
    $proj = Read-Host 'Informe o caminho COMPLETO da pasta do projeto (onde esta o package.json)'
  }
  if (-not (Test-Path (Join-Path $proj 'package.json'))) { throw "Caminho invalido: $proj" }
  @{ projectPath = $proj } | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8
  return $proj
}

$proj = Get-ProjectPath
Write-Host "=== GARIMPADOR — Terminal 2 (UI Streamlit) ===" -ForegroundColor Cyan
Set-Location $proj

# Desbloquear scripts e permitir execucao neste processo
try { Unblock-File -Path (Join-Path $PSScriptRoot '*.ps1'), (Join-Path $PSScriptRoot '*.bat') -ErrorAction SilentlyContinue } catch {}
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force } catch {}

# Liberar porta 8501 se estiver ocupada
Write-Host "Verificando porta 8501..." -ForegroundColor DarkGray
try {
  $conns = Get-NetTCPConnection -LocalPort 8501 -State Listen -ErrorAction SilentlyContinue
  if ($conns) {
    foreach ($c in $conns) { Write-Host "Matando PID $($c.OwningProcess) na porta 8501" -ForegroundColor DarkYellow; taskkill /PID $c.OwningProcess /F 2>$null }
  }
} catch {
  $lines = (cmd /c "netstat -ano | findstr :8501")
  foreach ($ln in $lines) { $pid = ($ln -split '\\s+')[-1]; if ($pid -match '^\d+$') { Write-Host "Matando PID $pid" -ForegroundColor DarkYellow; taskkill /PID $pid /F 2>$null } }
}

Write-Host "[1/2] Instalando dependencias da UI (streamlit/requests/pandas)..." -ForegroundColor Yellow
python -m pip install --upgrade pip
pip install streamlit requests pandas

Write-Host "[2/2] Abrindo UI em http://localhost:8501 ..." -ForegroundColor Yellow
streamlit run src/ui/app.py
