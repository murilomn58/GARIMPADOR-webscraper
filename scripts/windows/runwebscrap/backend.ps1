Param(
  [switch]$Headless = $false
)

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
Write-Host "=== GARIMPADOR — Terminal 1 (Backend) ===" -ForegroundColor Cyan
Set-Location $proj

# Desbloquear scripts e permitir execucao neste processo
try { Unblock-File -Path (Join-Path $PSScriptRoot '*.ps1'), (Join-Path $PSScriptRoot '*.bat') -ErrorAction SilentlyContinue } catch {}
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force } catch {}

# Liberar porta 8000 se estiver ocupada
Write-Host "Verificando porta 8000..." -ForegroundColor DarkGray
try {
  $conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if ($conns) {
    foreach ($c in $conns) { Write-Host "Matando PID $($c.OwningProcess) na porta 8000" -ForegroundColor DarkYellow; taskkill /PID $c.OwningProcess /F 2>$null }
  }
} catch {
  $lines = (cmd /c "netstat -ano | findstr :8000")
  foreach ($ln in $lines) { $pid = ($ln -split '\\s+')[-1]; if ($pid -match '^\d+$') { Write-Host "Matando PID $pid" -ForegroundColor DarkYellow; taskkill /PID $pid /F 2>$null } }
}

if (-not (Test-Path 'node_modules')) {
  Write-Host "[1/3] Instalando dependencias (npm install)..." -ForegroundColor Yellow
  npm install
} else { Write-Host "Dependencias ja instaladas (node_modules existe)." -ForegroundColor Green }

Write-Host "[2/3] Instalando navegador Playwright (chromium)..." -ForegroundColor Yellow
npx playwright install chromium

Write-Host "[3/3] Subindo API em http://localhost:8000 ..." -ForegroundColor Yellow
npm run dev
