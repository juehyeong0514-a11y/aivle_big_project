$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()
chcp 65001 > $null
$projectRoot = $PSScriptRoot
$aiService = Join-Path $projectRoot "ai-proctor-service"
$backend = Join-Path $projectRoot "backend"
$frontend = Join-Path $projectRoot "frontend"
$venvPython = Join-Path $aiService ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
  throw "Python virtual environment is missing. Run .\setup-local.ps1 first."
}
if (-not (Test-Path -LiteralPath (Join-Path $backend "node_modules"))) {
  throw "Backend packages are missing. Run .\setup-local.ps1 first."
}
if (-not (Test-Path -LiteralPath (Join-Path $frontend "node_modules"))) {
  throw "Frontend packages are missing. Run .\setup-local.ps1 first."
}
if (-not (Test-Path -LiteralPath (Join-Path $aiService "yolo11n.onnx"))) {
  throw "yolo11n.onnx is missing. Run: ai-proctor-service\.venv\Scripts\python.exe ai-proctor-service\export_onnx.py"
}

$aiCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Aivle AI Proctor'
Set-Location -LiteralPath '$aiService'
`$env:AI_PROCTOR_MODEL_PATH = 'yolo11n.onnx'
`$env:AI_PROCTOR_API_KEY = 'local-ai-secret'
`$env:AI_PROCTOR_CONFIDENCE = '0.55'
`$env:AI_PROCTOR_BOOK_DETECTION_ENABLED = 'false'
`$env:OMP_NUM_THREADS = '1'
`$env:OPENBLAS_NUM_THREADS = '1'
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
`$env:AI_SETTINGS_ENCRYPTION_KEY = 'aivle-local-development-ai-settings-key'
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

Write-Host "AI proctor, backend, and frontend terminals were started." -ForegroundColor Green
Write-Host "Frontend:   http://localhost:5173"
Write-Host "Backend:    http://localhost:3000/api/health"
Write-Host "AI proctor: http://127.0.0.1:8001/health"
