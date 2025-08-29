Param(
  [string]$RepoUrl = "",
  [string]$Token = ""
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Ensure-Git() {
  git --version | Out-Null
}

Ensure-Git

# Detect current repo
$root = git rev-parse --show-toplevel
Set-Location $root

# Normalize branch to main
git branch -M main

if (-not $RepoUrl) {
  Write-Host "Informe a URL do repositório remoto (ex.: https://github.com/<user>/<repo>.git)" -ForegroundColor Yellow
  $RepoUrl = Read-Host "RepoUrl"
}

if (-not $Token) {
  Write-Host "Informe o seu GitHub Personal Access Token (com permissão repo)" -ForegroundColor Yellow
  $Token = Read-Host -AsSecureString "Token"
  $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Token))
}

# Configurar credenciais para este remote usando token
git remote remove origin 2>$null
git remote add origin $RepoUrl

# Define credential helper temporário (env var) no processo
$env:GIT_ASKPASS = ''
$env:GIT_TERMINAL_PROMPT = '0'

Write-Host "Fazendo push para $RepoUrl (branch main)..." -ForegroundColor Cyan

# Monta URL com token (apenas para este push); alternativa é usar git credential store
$u = $RepoUrl -replace '^https://', ''
$authUrl = "https://x-oauth-basic:$Token@$u"

git push --set-upstream $authUrl main

Write-Host "Push concluido. Confirme no GitHub se o repositorio esta PRIVATE e adicione colaborador pelo email do seu amigo." -ForegroundColor Green

