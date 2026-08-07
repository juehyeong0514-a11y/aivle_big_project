$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()
chcp 65001 > $null
$projectRoot = $PSScriptRoot
$aiService = Join-Path $projectRoot "ai-proctor-service"
$backend = Join-Path $projectRoot "backend"
$frontend = Join-Path $projectRoot "frontend"
$venvPython = Join-Path $aiService ".venv\Scripts\python.exe"

function Assert-LastCommandSucceeded([string]$message) {
  if ($LASTEXITCODE -ne 0) { throw "$message (exit code: $LASTEXITCODE)" }
}

function Find-PythonLauncher {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    return @{ Command = 'py'; Arguments = @() }
  }
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCommand -and $pythonCommand.Source -notlike "*\Microsoft\WindowsApps\python.exe") {
    return @{ Command = 'python'; Arguments = @() }
  }
  $installedPython = Get-ChildItem -Path (Join-Path $env:LocalAppData "Programs\\Python") -Filter "python.exe" -File -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($installedPython) {
    return @{ Command = $installedPython.FullName; Arguments = @() }
  }
  throw "Python was not found. Install Python 3.11 or newer and try again."
}

Write-Host "[1/3] Preparing the AI proctor virtual environment and packages..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $venvPython)) {
  $pythonLauncher = Find-PythonLauncher
  Push-Location $aiService
  try {
    & $pythonLauncher.Command @($pythonLauncher.Arguments) -m venv .venv
    Assert-LastCommandSucceeded "Failed to create the Python virtual environment."
  } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath $venvPython)) { throw "python.exe was not found after virtual environment creation: $venvPython" }
& $venvPython -m pip install -r (Join-Path $aiService "requirements.txt")
Assert-LastCommandSucceeded "Failed to install AI proctor packages."

Write-Host "[2/3] Preparing backend packages..." -ForegroundColor Cyan
Push-Location $backend
try {
  npm install
  Assert-LastCommandSucceeded "Failed to install backend packages."
} finally { Pop-Location }

Write-Host "[3/3] Preparing frontend packages..." -ForegroundColor Cyan
Push-Location $frontend
try {
  npm install
  Assert-LastCommandSucceeded "Failed to install frontend packages."
} finally { Pop-Location }

Write-Host "Local setup is complete. Run .\start-local.ps1 from now on." -ForegroundColor Green
