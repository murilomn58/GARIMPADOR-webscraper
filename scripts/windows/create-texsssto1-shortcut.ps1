Param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Caminho do projeto a partir deste script (scripts\windows)
$proj = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$target = Join-Path $proj 'texsssto1.txt'
if (-not (Test-Path $target)) { throw "Arquivo não encontrado: $target" }

# Desktop do usuário atual (respeita acentos/OneDrive)
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Abrir - Deploy GitHub (texsssto1).lnk'

Write-Host "Criando atalho no Desktop:" -ForegroundColor Cyan
Write-Host "  Alvo:  $target"
Write-Host "  Atalho: $lnkPath"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath = 'notepad.exe'
$shortcut.Arguments = '"' + $target + '"'
$shortcut.WorkingDirectory = $proj
$shortcut.WindowStyle = 1
$shortcut.IconLocation = 'notepad.exe,0'
$shortcut.Description = 'Abre o guia de deploy no GitHub (texsssto1.txt)'
$shortcut.Save()

Write-Host "Atalho criado com sucesso." -ForegroundColor Green

