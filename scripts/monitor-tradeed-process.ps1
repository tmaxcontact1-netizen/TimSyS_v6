param(
  [Parameter(Mandatory=$true)][int]$WorkerPid,
  [Parameter(Mandatory=$true)][int]$DashboardPid,
  [Parameter(Mandatory=$true)][string]$OutputFile
)

$ErrorActionPreference = 'Stop'
'timestamp,role,pid,working_set_bytes,private_bytes,handles,cpu_seconds,event' | Set-Content -LiteralPath $OutputFile -Encoding utf8
while ($true) {
  $worker = Get-Process -Id $WorkerPid -ErrorAction SilentlyContinue
  $dashboard = Get-Process -Id $DashboardPid -ErrorAction SilentlyContinue
  $timestamp = (Get-Date).ToString('o')
  foreach ($entry in @(@('worker',$worker),@('dashboard',$dashboard))) {
    $role = $entry[0]
    $process = $entry[1]
    if ($null -ne $process) {
      "$timestamp,$role,$($process.Id),$($process.WorkingSet64),$($process.PrivateMemorySize64),$($process.Handles),$($process.CPU),sample" | Add-Content -LiteralPath $OutputFile -Encoding utf8
    }
  }
  if ($null -eq $worker) {
    "$timestamp,worker,$WorkerPid,0,0,0,0,process_exited" | Add-Content -LiteralPath $OutputFile -Encoding utf8
    break
  }
  Start-Sleep -Seconds 30
}
