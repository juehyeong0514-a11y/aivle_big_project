$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$aiService = Join-Path $projectRoot "ai-proctor-service"
$backend = Join-Path $projectRoot "backend"
$frontend = Join-Path $projectRoot "frontend"
$venvPython = Join-Path $aiService ".venv\Scripts\python.exe"

Write-Host "[1/3] AI 감독 서비스 가상환경과 패키지를 준비합니다." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $venvPython)) {
  Push-Location $aiService
  try { py -3.12 -m venv .venv } finally { Pop-Location }
}
& $venvPython -m pip install -r (Join-Path $aiService "requirements.txt")

Write-Host "[2/3] 백엔드 패키지를 준비합니다." -ForegroundColor Cyan
Push-Location $backend
try { npm install } finally { Pop-Location }

Write-Host "[3/3] 프런트엔드 패키지를 준비합니다." -ForegroundColor Cyan
Push-Location $frontend
try { npm install } finally { Pop-Location }

Write-Host "로컬 실행 준비가 완료됐습니다. 다음부터 .\start-local.ps1만 실행하세요." -ForegroundColor Green

