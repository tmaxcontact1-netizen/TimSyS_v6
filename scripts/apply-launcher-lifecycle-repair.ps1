param([string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs/TimSyS Launcher'))
$ErrorActionPreference='Stop'
$proof=Get-Content (Join-Path $PSScriptRoot 'repair-verification.json') -Raw | ConvertFrom-Json
$target=Join-Path $InstallRoot 'resources/app.asar'
$source=Join-Path $PSScriptRoot 'app.asar'
if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $proof.repairSha256){throw 'Repair archive hash mismatch'}
$current=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if($current -eq $proof.repairSha256){Write-Output 'Repair already installed';exit 0}
if($current -ne $proof.baseSha256){throw 'Installed launcher differs from this tested repair. No files changed.'}
$exe=Join-Path $InstallRoot 'TimSyS Launcher.exe'
if(Get-CimInstance Win32_Process -Filter "Name='TimSyS Launcher.exe'" | Where-Object {$_.ExecutablePath -eq $exe}){throw 'Close TimSyS Launcher before applying this repair. Independent TradeEd validation must remain running.'}
$backup=$target+'.before-update-lifecycle-repair'
if(!(Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $target -Destination $backup}
$temporary=$target+'.repair-pending'
Copy-Item -LiteralPath $source -Destination $temporary -Force
[IO.File]::Replace($temporary,$target,$backup)
if((Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $proof.repairSha256){throw 'Installed repair hash mismatch'}
Write-Output 'Launcher repair installed; original archive retained. No database or application data modified.'

