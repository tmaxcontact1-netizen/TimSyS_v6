param(
  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\TimSyS Launcher'),
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($InstallDirectory)
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-patch.json') -Raw | ConvertFrom-Json
$target = Join-Path $root 'resources\app.asar'
$payload = Join-Path $PSScriptRoot 'app.asar'
if (!(Test-Path -LiteralPath (Join-Path $root 'TimSyS Launcher.exe'))) { throw 'Launcher installation not found.' }
$current = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($current -eq $manifest.patchedSha256) { Write-Output 'Shutdown fix is already installed.'; return }
if ($current -ne $manifest.baselineSha256) { throw 'This launcher differs from the reviewed baseline. No files changed.' }
if ((Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.patchedSha256) { throw 'Patch checksum mismatch.' }
if ($VerifyOnly) { Write-Output 'Baseline and patch checksums verified. No files changed.'; return }
$launcher = Join-Path $root 'TimSyS Launcher.exe'
$running = @(Get-CimInstance Win32_Process -Filter "Name='TimSyS Launcher.exe'" | Where-Object { $_.ExecutablePath -eq $launcher })
if ($running.Count) { throw 'Close TimSyS Launcher before applying this patch. Independent validation workers must remain running.' }
$backup = Join-Path $root ('resources\app.asar.before-shutdown-fix-' + $manifest.baselineSha256.Substring(0,12))
if (Test-Path -LiteralPath $backup) { throw 'A recovery backup already exists. No files changed.' }
$pending = Join-Path $root ('resources\app.asar.shutdown-' + [guid]::NewGuid().ToString('N') + '.tmp')
try {
  Copy-Item -LiteralPath $payload -Destination $pending
  if ((Get-FileHash -LiteralPath $pending -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.patchedSha256) { throw 'Staged checksum mismatch.' }
  # Replace atomically with a recoverable backup; never touch application data.
  [IO.File]::Replace($pending, $target, $backup)
} finally {
  if (Test-Path -LiteralPath $pending) { Remove-Item -LiteralPath $pending }
}
Write-Output "Native shutdown fix installed. Recovery backup: $backup"
