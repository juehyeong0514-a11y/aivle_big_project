$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$aiService = Join-Path $projectRoot "ai-proctor-service"
$backend = Join-Path $projectRoot "backend"
$frontend = Join-Path $projectRoot "frontend"
$venvPython = Join-Path $aiService ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
  throw "Python 가상환경이 없습니다. 먼저 프로젝트 루트에서 .\setup-local.ps1을 실행하세요."
}
if (-not (Test-Path -LiteralPath (Join-Path $backend "node_modules"))) {
  throw "백엔드 패키지가 없습니다. 먼저 프로젝트 루트에서 .\setup-local.ps1을 실행하세요."
}
if (-not (Test-Path -LiteralPath (Join-Path $frontend "node_modules"))) {
  throw "프런트엔드 패키지가 없습니다. 먼저 프로젝트 루트에서 .\setup-local.ps1을 실행하세요."
}

$aiCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Aivle AI Proctor'
Set-Location -LiteralPath '$aiService'
`$env:AI_PROCTOR_MODEL_PATH = 'yolo11n.pt'
`$env:AI_PROCTOR_API_KEY = 'local-ai-secret'
`$env:AI_PROCTOR_CONFIDENCE = '0.55'
`$env:AI_PROCTOR_BOOK_DETECTION_ENABLED = 'false'
& '$venvPython' -m uvicorn main:app --host 127.0.0.1 --port 8001
"@

$backendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Aivle Backend'
Set-Location -LiteralPath '$backend'
`$env:AI_PROCTOR_URL = 'http://127.0.0.1:8001'
`$env:AI_PROCTOR_API_KEY = 'local-ai-secret'
`$env:AI_PROCTOR_CONFIDENCE = '0.55'
`$env:AI_PROCTOR_CONSECUTIVE_HITS = '2'
`$env:AI_PROCTOR_WARNING_COOLDOWN_SECONDS = '60'
`$env:AI_PROCTOR_BOOK_DETECTION_ENABLED = 'false'
npm run dev
"@

$frontendCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Aivle Frontend'
Set-Location -LiteralPath '$frontend'
npm run dev
"@

Start-Process powershell.exe -ArgumentList @('-NoExit', '-Command', $aiCommand)
Start-Sleep -Seconds 2
Start-Process powershell.exe -ArgumentList @('-NoExit', '-Command', $backendCommand)
Start-Process powershell.exe -ArgumentList @('-NoExit', '-Command', $frontendCommand)

Write-Host "AI 감독, 백엔드, 프런트엔드 터미널을 실행했습니다." -ForegroundColor Green
Write-Host "프런트엔드: http://localhost:5173"
Write-Host "백엔드:     http://localhost:3000/api/health"
Write-Host "AI 감독:    http://127.0.0.1:8001/health"

