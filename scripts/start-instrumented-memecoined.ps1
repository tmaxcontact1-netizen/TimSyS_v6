param(
  [Parameter(Mandatory=$true)][string]$BundleRoot,
  [Parameter(Mandatory=$true)][int]$DatabasePort
)

$ErrorActionPreference = 'Stop'
$dataRoot = Join-Path $env:APPDATA 'timsys-launcher\memecoined'
$configRoot = Join-Path $dataRoot 'config'
$configurationFile = Join-Path $configRoot '.env'
$credentialsFile = Join-Path $dataRoot 'postgres\credentials.json'
$runtimeExecutable = Join-Path $env:LOCALAPPDATA 'Programs\TimSyS Launcher\TimSyS Launcher.exe'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logRoot = Join-Path $dataRoot "instrumentation\$stamp"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

if (-not (Test-Path -LiteralPath $runtimeExecutable)) { throw 'Installed TimSyS runtime was not found' }
if (-not (Test-Path -LiteralPath (Join-Path $BundleRoot 'dist\src\entrypoints\worker.js'))) { throw 'Verified worker bundle was not found' }

foreach ($line in Get-Content -LiteralPath $configurationFile) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
  $separator = $trimmed.IndexOf('=')
  if ($separator -lt 1) { continue }
  $name = $trimmed.Substring(0,$separator).Trim()
  $value = $trimmed.Substring($separator+1).Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1,$value.Length-2)
  }
  if ($value) { [Environment]::SetEnvironmentVariable($name,$value,'Process') }
}

$credentials = Get-Content -Raw -LiteralPath $credentialsFile | ConvertFrom-Json
$adminPassword = [uri]::EscapeDataString([string]$credentials.administratorPassword)
$runtimePassword = [uri]::EscapeDataString([string]$credentials.runtimePassword)
$env:DATABASE_URL = "postgresql://$($credentials.runtime):$runtimePassword@127.0.0.1:$DatabasePort/memecoined"
$env:DATABASE_MIGRATION_URL = "postgresql://$($credentials.administrator):$adminPassword@127.0.0.1:$DatabasePort/memecoined"
$env:MEMECOINED_APP_ROOT = $BundleRoot
$env:MEMECOINED_CONFIG_DIR = $configRoot
$env:MEMECOINED_INSTANCE_ID = 'local-desktop'
$env:MEMECOINED_LOG_LEVEL = if ($env:MEMECOINED_LOG_LEVEL) { $env:MEMECOINED_LOG_LEVEL } else { 'info' }
$env:MEMECOINED_MANAGED_DATABASE = '1'
$env:MEMECOINED_PAPER_PRESET = 'all_profiles'
$env:PAPER_DASHBOARD_PORT = '8080'
$env:NODE_PATH = Join-Path $BundleRoot 'modules-runtime'
$env:ELECTRON_RUN_AS_NODE = '1'
$env:NODE_OPTIONS = "--preserve-symlinks --preserve-symlinks-main --report-on-fatalerror --report-uncaught-exception --report-directory=$logRoot"

$worker = Start-Process -FilePath $runtimeExecutable -ArgumentList @('dist/src/entrypoints/worker.js') -WorkingDirectory $BundleRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'worker.stdout.log') -RedirectStandardError (Join-Path $logRoot 'worker.stderr.log') -PassThru
$dashboard = Start-Process -FilePath $runtimeExecutable -ArgumentList @('dist/src/entrypoints/dashboard.js') -WorkingDirectory $BundleRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'dashboard.stdout.log') -RedirectStandardError (Join-Path $logRoot 'dashboard.stderr.log') -PassThru
$monitorScript = Join-Path $PSScriptRoot 'monitor-memecoined-process.ps1'
$monitor = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$monitorScript,'-WorkerPid',$worker.Id,'-DashboardPid',$dashboard.Id,'-OutputFile',(Join-Path $logRoot 'resource-usage.csv')) -WindowStyle Hidden -PassThru

[ordered]@{
  declaredIntervention = 'instrumentation-only'
  startedAt = (Get-Date).ToString('o')
  bundleRoot = $BundleRoot
  workerPid = $worker.Id
  dashboardPid = $dashboard.Id
  monitorPid = $monitor.Id
  databasePort = $DatabasePort
  nodeDiagnostics = @('fatal-error','uncaught-exception')
  stdoutStderrRedirected = $true
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'processes.json') -Encoding utf8

[ordered]@{ logRoot=$logRoot; workerPid=$worker.Id; dashboardPid=$dashboard.Id; monitorPid=$monitor.Id } | ConvertTo-Json
