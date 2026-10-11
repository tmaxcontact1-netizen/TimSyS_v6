param([Parameter(Mandatory=$true)][string]$Runtime,[Parameter(Mandatory=$true)][string]$Configuration)
$ErrorActionPreference='Stop'
$isolationConfig=Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Path $isolationConfig.logDirectory -Force | Out-Null
$isolationStatePath=Join-Path $isolationConfig.logDirectory 'watchdog-state.json'
if(Test-Path -LiteralPath $isolationStatePath){
  $isolationState=Get-Content -LiteralPath $isolationStatePath -Raw | ConvertFrom-Json
  $isolationExisting=Get-Process -Id $isolationState.watchdogPid -ErrorAction SilentlyContinue
  if($isolationExisting){Wait-Process -Id $isolationExisting.Id; exit 1}
}
$isolationStamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$isolationChild=Start-Process -FilePath $isolationConfig.executable -ArgumentList @(('"'+$Runtime+'"'),('"'+$Configuration+'"')) -WorkingDirectory $isolationConfig.cwd -WindowStyle Hidden -RedirectStandardOutput (Join-Path $isolationConfig.logDirectory "watchdog-$isolationStamp.stdout.log") -RedirectStandardError (Join-Path $isolationConfig.logDirectory "watchdog-$isolationStamp.stderr.log") -PassThru
$isolationChild.WaitForExit()
exit $isolationChild.ExitCode
