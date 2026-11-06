param([Parameter(Mandatory)][string]$ConfigFile)
$ErrorActionPreference='Stop'
$configPath=(Resolve-Path -LiteralPath $ConfigFile).Path
$config=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json
$job=Get-Content -LiteralPath $config.jobFile -Raw|ConvertFrom-Json
if($job.mode-ne'synthetic_preflight'-or$job.collectionAuthorized-ne$false){throw 'SYNTHETIC_FIXTURE_ONLY'}
$root=Split-Path (Split-Path $configPath -Parent) -Parent
if($root-notlike'*\verification-local\q35-service-integration-*\fixtures\*'){throw 'DEDICATED_FIXTURE_ROOT_REQUIRED'}
foreach($p in @($config.runtimeDirectory,$config.dataDirectory,$config.logDirectory,$config.executable)){
 $full=[IO.Path]::GetFullPath($p)
 if(-not$full.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'FIXTURE_PATH_ESCAPE'}
}
$serviceFile=Join-Path (Split-Path $config.runtimeDirectory -Parent) 'service.cjs'
$name='TimSyS-Q35-Fixture-'+[Guid]::NewGuid().ToString('N')
$scheduler=New-Object -ComObject Schedule.Service;$scheduler.Connect();$folder=$scheduler.GetFolder('\')
$definition=$scheduler.NewTask(0)
$definition.XmlText=[IO.File]::ReadAllText((Join-Path $root 'task-DISABLED.xml'))
$definition.Principal.UserId=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$definition.Principal.LogonType=3 # Fixture uses current interactive account; production template uses dedicated password/batch account.
$definition.Settings.Enabled=$true
$definition.Triggers.Clear() # Boot-trigger registration requires elevation; fixture is manually dispatched only.
$task=$null;$stateFile=Join-Path $config.logDirectory 'service-state.json'
$report=[ordered]@{task=$name;productionTaskChanged=$false;liveValidationStarted=$false;actualOsReboot=$false;recoverySimulation='abrupt fixture supervisor/worker loss followed by independent task start';passed=$false}
function Wait-State([scriptblock]$predicate,[int]$seconds=60){
 $until=[DateTime]::UtcNow.AddSeconds($seconds)
 while([DateTime]::UtcNow-lt$until){
  if(Test-Path -LiteralPath $stateFile){try{$s=Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json;if(&$predicate $s){return $s}}catch{}}
  Start-Sleep -Milliseconds 200
 }
 throw 'FIXTURE_TASK_TIMEOUT'
}
function Stop-FixtureProcess([int]$processId){
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
 if($p-and-not$p.ExecutablePath){Start-Sleep -Milliseconds 1000;$p=Get-CimInstance Win32_Process -Filter "ProcessId=$processId"}
 if($p){if(-not$p.ExecutablePath-or-not$p.ExecutablePath.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'REFUSE_UNVERIFIED_FIXTURE_PROCESS'};Stop-Process -Id $processId -ErrorAction Stop}
}
try{
 $task=$folder.RegisterTaskDefinition($name,$definition,2,$definition.Principal.UserId,$null,3,$null)
 [IO.File]::WriteAllText((Join-Path $root 'fixture-task-readback.xml'),$task.Xml)
 if($task.Definition.Settings.MultipleInstances-ne2-or$task.Definition.Settings.ExecutionTimeLimit-ne'PT0S'-or$task.Definition.Settings.RestartCount-ne3){throw 'TASK_SETTINGS_MISMATCH'}
 $null=$task.Run($null)
 $first=Wait-State {param($s)$s.status-eq'active'-and(Test-Path -LiteralPath (Join-Path $config.dataDirectory 'checkpoint.json'))}
 $report.first=$first
 $startsBefore=@(Get-Content (Join-Path $config.logDirectory 'incidents.ndjson')|ForEach-Object {$_|ConvertFrom-Json}|Where-Object kind -eq service_started).Count
 $null=$task.Run($null);Start-Sleep -Milliseconds 800
 $current=Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json
 if($current.supervisorPid-ne$first.supervisorPid-or$current.workerPid-ne$first.workerPid){throw 'MULTIPLE_INSTANCE_POLICY_FAILED'}
 $report.singleInstanceVerified=$true
 $task.Stop(0);Start-Sleep -Milliseconds 200
 Stop-FixtureProcess $first.supervisorPid;Stop-FixtureProcess $first.workerPid
 $until=[DateTime]::UtcNow.AddSeconds(15)
 while($task.State-eq4-and[DateTime]::UtcNow-lt$until){Start-Sleep -Milliseconds 100}
 $null=$task.Run($null)
 $second=Wait-State {param($s)$s.status-eq'active'-and$s.supervisorPid-ne$first.supervisorPid-and$s.workerPid-ne$first.workerPid}
 $report.second=$second
 if($second.configHash-ne$first.configHash-or$second.ledgerConfigHash-ne$first.ledgerConfigHash){throw 'RECOVERY_IDENTITY_CHANGED'}
 $events=@(Get-Content (Join-Path $config.logDirectory 'incidents.ndjson')|ForEach-Object {$_|ConvertFrom-Json})
 $recovery=@($events|Where-Object kind -eq unclean_supervisor_recovery)
 if($recovery.Count-ne1-or-not$recovery[0].checkpoint.sha256){throw 'UNCLEAN_RECOVERY_EVIDENCE_MISSING'}
 $started=@($events|Where-Object kind -eq service_started)
 foreach($start in $started){if(@($start.ancestry|Where-Object {$_.name-match'timsys.*launcher'}).Count){throw 'LAUNCHER_ANCESTRY_FOUND'}}
 $report.serviceAncestry=$started[-1].ancestry
 $worker=Get-CimInstance Win32_Process -Filter "ProcessId=$($second.workerPid)"
 if($worker.ParentProcessId-ne$second.supervisorPid){throw 'WORKER_ANCESTRY_MISMATCH'}
 $report.workerAncestry=@{pid=$worker.ProcessId;parent=$worker.ParentProcessId;name=$worker.Name}
 $report.taskState=[string]$task.State;$report.recovery=$recovery[0]
 $report.passed=$true
}finally{
 if($task){try{try{$task.Stop(0)}catch{};Start-Sleep -Milliseconds 1000;if(Test-Path -LiteralPath $stateFile){$last=Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json;foreach($id in @($last.supervisorPid,$last.workerPid)){if($id){Stop-FixtureProcess $id}}}}finally{$folder.DeleteTask($name,0)}}
 $report.finishedAt=[DateTime]::UtcNow.ToString('o')
 $report|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $root 'scheduled-task-proof.json')
}
if(-not$report.passed){throw 'SCHEDULED_TASK_VERIFICATION_FAILED'}
$report|ConvertTo-Json -Depth 12
