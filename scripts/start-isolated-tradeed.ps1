param([Parameter(Mandatory=$true)][string]$Configuration,[Parameter(Mandatory=$true)][string]$Runtime,[switch]$RegisterOnly)
$ErrorActionPreference='Stop'
$Configuration=(Resolve-Path -LiteralPath $Configuration).Path
$Runtime=(Resolve-Path -LiteralPath $Runtime).Path
if($Configuration -match 'timsys-launcher|\\backups\\|\\Temp\\' -or $Runtime -match 'timsys-launcher|\\backups\\|\\Temp\\'){throw 'Use a durable independent runtime and configuration'}
$config=Get-Content -LiteralPath $Configuration -Raw | ConvertFrom-Json
if($config.cwd -notmatch 'tradeed-validation[\\/]runtime-' -or $Runtime -notmatch 'tradeed-validation[\\/]runtime-'){throw 'Prepare a frozen runtime copy under tradeed-validation/runtime-<version> before registration'}
$hostScript=Join-Path (Split-Path -Parent $Runtime) 'isolation-task-host.ps1'
if(-not (Test-Path -LiteralPath $hostScript)){throw 'Deploy isolation-task-host.ps1 beside the watchdog first'}
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "'+$hostScript+'" -Runtime "'+$Runtime+'" -Configuration "'+$Configuration+'"') -WorkingDirectory $config.cwd
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $principal.UserId
$recoveryTrigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'TradeEd-Isolated-Validation' -Action $action -Principal $principal -Settings $settings -Trigger @($trigger,$recoveryTrigger) -Force | Out-Null
if(-not $RegisterOnly){Start-ScheduledTask -TaskName 'TradeEd-Isolated-Validation'}
Write-Output 'Registered independent Task Scheduler ownership: TradeEd-Isolated-Validation'
