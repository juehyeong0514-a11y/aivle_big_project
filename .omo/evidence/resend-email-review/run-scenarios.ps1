$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$evidence = Resolve-Path $PSScriptRoot
$serverScript = Join-Path $evidence "mock-resend-server.mjs"

function Start-QaServer {
  param(
    [int]$Port,
    [string]$Name,
    [string]$Mode = "success",
    [switch]$ApiKey,
    [switch]$FromEmail,
    [string]$NodeEnv = ""
  )

  $db = Join-Path $evidence "$Name-db.json"
  $resend = Join-Path $evidence "$Name-resend.ndjson"
  $log = Join-Path $evidence "$Name-server.stdout.log"
  $err = Join-Path $evidence "$Name-server.stderr.log"
  Remove-Item -LiteralPath $db, $resend, $log, $err -Force -ErrorAction SilentlyContinue

  $env:PORT = [string]$Port
  $env:QA_DB_PATH = $db
  $env:QA_RESEND_LOG = $resend
  $env:QA_RESEND_MODE = $Mode
  if ($ApiKey) { $env:RESEND_API_KEY = "qa_mock_key" } else { Remove-Item Env:RESEND_API_KEY -ErrorAction SilentlyContinue }
  if ($FromEmail) { $env:RESEND_FROM_EMAIL = "qa@example.com" } else { Remove-Item Env:RESEND_FROM_EMAIL -ErrorAction SilentlyContinue }
  if ($NodeEnv) { $env:NODE_ENV = $NodeEnv } else { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue }

  $process = Start-Process node -ArgumentList @($serverScript) -WorkingDirectory $root -RedirectStandardOutput $log -RedirectStandardError $err -PassThru -WindowStyle Hidden
  $ready = $false
  for ($i = 0; $i -lt 80; $i++) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  if (-not $ready) { throw "server $Name did not become ready" }
  return @{ Process = $process; Db = $db; Resend = $resend; Log = $log; ErrorLog = $err; Port = $Port }
}

function Stop-QaServer {
  param($Server)
  if ($Server.Process -and -not $Server.Process.HasExited) {
    Stop-Process -Id $Server.Process.Id -Force
    Wait-Process -Id $Server.Process.Id -ErrorAction SilentlyContinue
  }
}

function Invoke-Curl {
  param(
    [string]$Name,
    [string[]]$Arguments
  )
  $out = Join-Path $evidence "$Name.curl.txt"
  Remove-Item -LiteralPath $out -Force -ErrorAction SilentlyContinue
  & curl.exe @Arguments | Tee-Object -FilePath $out
  if ($LASTEXITCODE -ne 0) { throw "curl failed for $Name" }
  return $out
}

function Save-Json {
  param([string]$Name, $Value)
  $path = Join-Path $evidence "$Name.json"
  $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $path -Encoding utf8
  return $path
}

$summary = [ordered]@{}

$s = Start-QaServer -Port 43111 -Name "s1"
try {
  $summary.s1 = Invoke-Curl -Name "s1-email-preview" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43111/api/auth/email-verification/send", "-H", "Content-Type: application/json", "--data", '{"email":"qa-preview-20260729@example.com"}')
} finally { Stop-QaServer $s }

$s = Start-QaServer -Port 43112 -Name "s2" -ApiKey -FromEmail
try {
  $summary.s2 = Invoke-Curl -Name "s2-email-sent" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43112/api/auth/email-verification/send", "-H", "Content-Type: application/json", "--data", '{"email":"qa-sent-20260729@example.com"}')
} finally { Stop-QaServer $s }

$s = Start-QaServer -Port 43113 -Name "s3" -ApiKey
try {
  $summary.s3 = Invoke-Curl -Name "s3-email-incomplete-config" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43113/api/auth/email-verification/send", "-H", "Content-Type: application/json", "--data", '{"email":"qa-incomplete-20260729@example.com"}')
  $summary.s3Db = $s.Db
} finally { Stop-QaServer $s }

$s = Start-QaServer -Port 43114 -Name "s4" -ApiKey -FromEmail
try {
  Invoke-Curl -Name "s4-login" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43114/api/auth/login", "-H", "Content-Type: application/json", "--data", '{"email":"supervisor@aivle.com","password":"123","role":"MANAGER"}') | Out-Null
  $loginBody = (Get-Content -Raw (Join-Path $evidence "s4-login.curl.txt")) -split "`r?`n`r?`n" | Select-Object -Last 1 | ConvertFrom-Json
  $token = $loginBody.token
  $summary.s4 = Invoke-Curl -Name "s4-invitation-sent" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43114/api/manager/exams/exam-2026-second-half/invitations/send", "-H", "Content-Type: application/json", "-H", "Authorization: Bearer $token", "--data", '{"candidateIds":["candidate-1"],"expiresInHours":2}')
  $summary.s4List = Invoke-Curl -Name "s4-invitations-list" -Arguments @("-i", "-sS", "http://127.0.0.1:43114/api/manager/invitations", "-H", "Authorization: Bearer $token")
} finally { Stop-QaServer $s }

$s = Start-QaServer -Port 43115 -Name "s5" -Mode "fail" -ApiKey -FromEmail
try {
  Invoke-Curl -Name "s5-login" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43115/api/auth/login", "-H", "Content-Type: application/json", "--data", '{"email":"supervisor@aivle.com","password":"123","role":"MANAGER"}') | Out-Null
  $loginBody = (Get-Content -Raw (Join-Path $evidence "s5-login.curl.txt")) -split "`r?`n`r?`n" | Select-Object -Last 1 | ConvertFrom-Json
  $token = $loginBody.token
  $summary.s5 = Invoke-Curl -Name "s5-invitation-resend-failure" -Arguments @("-i", "-sS", "-X", "POST", "http://127.0.0.1:43115/api/manager/exams/exam-2026-second-half/invitations/send", "-H", "Content-Type: application/json", "-H", "Authorization: Bearer $token", "--data", '{"candidateIds":["candidate-1"],"expiresInHours":2}')
  $summary.s5List = Invoke-Curl -Name "s5-invitations-list" -Arguments @("-i", "-sS", "http://127.0.0.1:43115/api/manager/invitations", "-H", "Authorization: Bearer $token")
} finally { Stop-QaServer $s }

$summaryPath = Join-Path $evidence "scenario-summary.json"
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $summaryPath -Encoding utf8
Write-Output "summary=$summaryPath"
