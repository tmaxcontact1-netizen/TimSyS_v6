// Read-only integrity checks against frozen outputs. Never substitutes revised results.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('./playbook-measurements.cjs'),{atomic}=require('./validation-watchdog.cjs');
const root=path.resolve(process.argv[2]),manifest=JSON.parse(fs.readFileSync(path.join(root,'dataset-manifest.json')));
const raw=JSON.parse(fs.readFileSync(path.join(root,'02-pivot-report.json'))),start=Date.parse(manifest.config.analysisStart),end=Date.parse(manifest.config.end);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const issues=[],boundaryCases=[],rowsByKey={},pageMismatches=[];
for(const p of manifest.pages){const text=fs.readFileSync(path.join(root,'pages',p.filename));if(hash(text)!==p.sha256)pageMismatches.push(p.filename);const key=p.symbol+':'+p.interval;(rowsByKey[key]??=[]).push(...JSON.parse(text));}
for(const symbol of manifest.config.symbols)for(const interval of ['15m','1h']){
 const rows=rowsByKey[symbol+':'+interval],counts={};
 for(let i=4;i<rows.length;i++){
  const inclusiveClose=rows[i][1],nextBoundary=inclusiveClose+1;
  const sides=M.pivotAt(rows,i-2);if(!sides.length)continue;
  if(inclusiveClose>=start&&inclusiveClose<end){const month=new Date(inclusiveClose).toISOString().slice(0,7);counts[month]=(counts[month]||0)+sides.length;}
  if((nextBoundary>=start&&nextBoundary<end)&&(new Date(inclusiveClose).getUTCDate()!==new Date(nextBoundary).getUTCDate())){
   boundaryCases.push({symbol,interval,centerOpen:new Date(rows[i-2][0]).toISOString(),inclusiveClose:new Date(inclusiveClose).toISOString(),availabilityBoundary:new Date(nextBoundary).toISOString(),sides,monthChanged:new Date(inclusiveClose).getUTCMonth()!==new Date(nextBoundary).getUTCMonth()});
  }
 }
 for(const cell of raw.cells.filter(c=>c.symbol===symbol&&c.interval===interval)){
  const monthStart=Math.max(start,Date.parse(cell.month+'-01T00:00:00Z')),nextMonth=new Date(cell.month+'-01T00:00:00Z');nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
  const trueDays=(Math.min(end,nextMonth.valueOf())-monthStart)/M.DAY;
  if(cell.completeUtcDays!==trueDays)issues.push({kind:'exposure-denominator',symbol,interval,month:cell.month,reported:cell.completeUtcDays,calendarDaysInAnalysis:trueDays});
  if(cell.pivots['12']!==(counts[cell.month]||0))issues.push({kind:'confirmation-month-attribution',symbol,interval,month:cell.month,reported:cell.pivots['12'],inclusiveNativeCloseAuditCount:counts[cell.month]||0});
 }
}
const confirmation=JSON.parse(fs.readFileSync(path.join(root,'01-confirmation-report.json'))),vol=JSON.parse(fs.readFileSync(path.join(root,'03-volatility-report.json')));
const events=fs.readFileSync(path.join(root,'confirmation-events.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
const histSum=Object.values(confirmation.pooled.histogram).reduce((a,b)=>a+b,0);
const out={auditorSha256:hash(fs.readFileSync(__filename)),datasetManifestSha256:hash(fs.readFileSync(path.join(root,'dataset-manifest.json'))),pageHashMismatches:pageMismatches,rows:manifest.pages.reduce((a,p)=>a+p.count,0),confirmation:{eventRows:events.length,reportedEvents:confirmation.pooled.events,histogramSum:histSum,p90Recomputed:M.arrivalQuantile(events.map(e=>e.arrivalBars),.9)},volatility:Object.fromEntries(manifest.config.symbols.map(s=>[s,{dailyRows:vol.daily.filter(x=>x.symbol===s).length,p40Recomputed:M.quantile(vol.daily.filter(x=>x.symbol===s).map(x=>x.rangeBps),.4)}])),pivotIntegrityIssues:issues,monthBoundaryCases:boundaryCases.filter(x=>x.monthChanged),status:issues.length||pageMismatches.length?'STOP_FOR_REVIEW':'verified',originalReportsChanged:false,policy:'No re-run or replacement of frozen derivation outputs; audit values diagnose integrity only.'};
atomic(path.join(root,'derivation-integrity-audit.json'),out);console.log(JSON.stringify(out,null,2));
