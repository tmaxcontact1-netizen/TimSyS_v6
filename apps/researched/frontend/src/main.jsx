import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.reason || data.issues?.[0]?.message || String(data.error||"Request failed").replaceAll("_"," "));
  return data;
};
function Field({ label, children, hint }) {
  return (
    <label>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
const labelize=(value)=>String(value).replaceAll("-"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());
function MetricView({value}){return <div className="result-metrics">{Object.entries(value).map(([key,item])=><div key={key}><strong>{typeof item==="number"?item.toLocaleString():String(item)}</strong><small>{labelize(key)}</small></div>)}</div>}
function ResultView({result}){
  const envelope=result.value||{},value=envelope.interpretation??envelope,deterministic=envelope.deterministic,type=result.analysis_type;
  if(type==="syntax"||type==="readability")return <MetricView value={value}/>;
  if(type==="semantics")return <div className="result-summary"><p>{value.summary}</p><h4>Likely purposes</h4><ul>{value.intents?.map(item=><li key={item}>{item}</li>)}</ul><h4>Key messages</h4><ul>{value.keyMessages?.map(item=><li key={item}>{item}</li>)}</ul></div>;
  if(type==="sentiment")return <div className="result-summary"><span className={`tone ${value.overall}`}>{value.overall}</span><p>{value.rationale}</p><ul>{value.signals?.map((item,index)=><li key={`${item.label}-${index}`}>{item.label} — {item.polarity}</li>)}</ul></div>;
  if(type==="themes")return <div className="result-grid">{value.themes?.map((item,index)=><div key={`${item.name}-${index}`}><b>{item.name}</b><p>{item.description}</p><small>Present across {item.sourceIds.length} source(s)</small></div>)}</div>;
  if(type==="entities")return <div className="result-table">{value.entities?.map((item,index)=><div key={`${item.name}-${index}`}><b>{item.name}</b><span>{labelize(item.type)}</span><p>{item.context}</p></div>)}</div>;
  if(type==="terminology")return <div className="result-summary"><p>{value.summary}</p><div className="result-grid">{value.terms?.map((item,index)=><div key={`${item.term}-${index}`}><b>{item.term}</b><p>{item.meaning}</p><small>{item.importance}</small></div>)}</div>{deterministic?.terms&&<details><summary>Measured term frequency</summary><MetricView value={Object.fromEntries(deterministic.terms.slice(0,12).map(item=>[item.term,item.count]))}/></details>}</div>;
  if(type==="claims")return <div className="result-list">{value.claims?.map((item,index)=><div key={index}><span className={`support ${item.support}`}>{labelize(item.support)}</span><b>{item.claim}</b>{item.qualification&&<p>{item.qualification}</p>}</div>)}</div>;
  if(type==="comparison")return <div className="result-list">{value.comparisons?.map((item,index)=><div key={index}><b>{item.topic}</b><ul>{item.observations.map((observation,i)=><li key={i}>{observation.summary}</li>)}</ul><p>{item.interpretation}</p></div>)}</div>;
  if(type==="contradictions")return <div className="result-list warnings">{value.contradictions?.map((item,index)=><div key={index}><b>Potential contradiction</b><p>“{item.statementA}” compared with “{item.statementB}”</p><small>{item.explanation}</small></div>)}</div>;
  if(type==="bias-framing")return <div className="result-columns"><div><h4>Frames</h4><ul>{value.frames?.map(item=><li key={item}>{item}</li>)}</ul></div><div><h4>Signals</h4><ul>{value.indicators?.map(item=><li key={item}>{item}</li>)}</ul></div><div><h4>Cautions</h4><ul>{value.cautions?.map(item=><li key={item}>{item}</li>)}</ul></div></div>;
  if(type==="completeness")return <div className="result-table">{value.fields?.map(item=><div key={item.field} className={item.found?"found":"missing"}><b>{item.field}</b><span>{item.found?"Found":"Missing"}</span>{item.evidence&&<p>{item.evidence}</p>}</div>)}</div>;
  if(type==="custom-questions")return <div className="result-list">{value.answers?.map((item,index)=><div key={index}><b>{item.question}</b><p>{item.answer}</p></div>)}</div>;
  if(type==="custom-extraction")return <dl className="result-fields">{Object.entries(value.fields||{}).map(([key,item])=><React.Fragment key={key}><dt>{key}</dt><dd>{Array.isArray(item)?item.join(", "):typeof item==="object"?JSON.stringify(item):String(item??"Not found")}</dd></React.Fragment>)}</dl>;
  return <pre>{JSON.stringify(value,null,2)}</pre>;
}
const NAV_ITEMS = [
  ["overview", "Home"],
  ["study", "Study setup"],
  ["corpus", "Sources"],
  ["structure", "Study structure"],
  ["review", "Evidence"],
  ["analysis", "Analysis"],
  ["insights", "Insights"],
  ["reports", "Reports"],
];
function App() {
  const [studies, setStudies] = useState([]),
    [dashboard, setDashboard] = useState({}),
    [capabilities, setCapabilities] = useState(null),
    [active, setActive] = useState(""),
    [sources, setSources] = useState([]),
    [types, setTypes] = useState([]),
    [entities, setEntities] = useState([]),
    [codes, setCodes] = useState([]),
    [evidence, setEvidence] = useState([]),
    [analysis, setAnalysis] = useState(null),
    [findings, setFindings] = useState([]),
    [reports, setReports] = useState([]),
    [readiness, setReadiness] = useState(null),
    [audit, setAudit] = useState([]),
    [discovered, setDiscovered] = useState([]),
    [queue, setQueue] = useState([]),
    [analysisTypes, setAnalysisTypes] = useState([]),
    [aiProviders, setAiProviders] = useState(null),
    [aiProfiles, setAiProfiles] = useState(null),
    [aiDiagnostic, setAiDiagnostic] = useState(null),
    [aiUsage, setAiUsage] = useState(null),
    [analysisPlans, setAnalysisPlans] = useState([]),
    [analysisTemplates, setAnalysisTemplates] = useState([]),
    [analysisStep, setAnalysisStep] = useState(1),
    [analysisDraft, setAnalysisDraft] = useState({name:"",sourceMode:"all",sourceIds:[],analysisTypes:[],customQuestions:"",expectedFields:""}),
    [webCaptureSettings, setWebCaptureSettings] = useState({expandInteractiveContent:true,maximumInteractions:40,sameOrigin:true,maximumLinks:100}),
    [analysisRuns, setAnalysisRuns] = useState([]),
    [insights, setInsights] = useState(null),
    [runResults, setRunResults] = useState(null),
    [review, setReview] = useState(null),
    [capture, setCapture] = useState(null),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("overview");
  const load = async () => {
    const [studyResponse, totals, available, availableAnalysis, providers, templates, usage] = await Promise.all([
      api("/api/studies"),
      api("/api/dashboard"),
      api("/api/capabilities"),
      api("/api/analysis-types"),
      api("/api/ai/providers"),
      api("/api/analysis-templates"),
      api("/api/ai/usage"),
    ]);
    const s = studyResponse.items;
    setStudies(s);
    setDashboard(totals);
    setCapabilities(available);
    setAnalysisTypes(availableAnalysis.items);
    setAiProviders(providers);
    setAnalysisTemplates(templates.items);
    setAiUsage(usage);
    if (!active && s[0]) setActive(s[0].id);
  };
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    window.electronAPI?.researchedAi?.listProfiles().then(setAiProfiles).catch((e)=>setMessage(`Secure provider profiles unavailable: ${e.message}`));
  }, []);
  useEffect(() => {
    if (!active) return;
    Promise.all([
      api(`/api/sources?studyId=${active}`),
      api(`/api/entity-types?studyId=${active}`),
      api(`/api/entities?studyId=${active}`),
      api(`/api/research-codes?studyId=${active}`),
      api(`/api/evidence?studyId=${active}`),
      api(`/api/analysis?studyId=${active}`),
      api(`/api/findings?studyId=${active}`),
      api(`/api/reports?studyId=${active}`),
      api(`/api/studies/${active}/readiness`),
      api(`/api/audit?studyId=${active}`),
      api(`/api/discovered-links?studyId=${active}&status=pending`),
      api(`/api/acquisition-queue?studyId=${active}`),
      api(`/api/analysis-plans?studyId=${active}`),
      api(`/api/analysis-runs?studyId=${active}`),
      api(`/api/insights?studyId=${active}`),
    ])
      .then(([s, t, entityItems, c, e, a, f, r, ready, history, links, queued, plans, runs, insightData]) => {
        setSources(s.items);
        setTypes(t.items);
        setEntities(entityItems.items);
        setCodes(c.items);
        setEvidence(e.items);
        setAnalysis(a);
        setFindings(f.items);
        setReports(r.items);
        setReadiness(ready);
        setAudit(history.items);
        setDiscovered(links.items);
        setQueue(queued.items);
        setAnalysisPlans(plans.items);
        setAnalysisRuns(runs.items);
        setInsights(insightData);
      })
      .catch((e) => setMessage(e.message));
  }, [active]);
  useEffect(()=>{if(!active||tab!=="analysis")return;const refresh=async()=>{try{const runs=(await api(`/api/analysis-runs?studyId=${active}`)).items;setAnalysisRuns(runs);if(runResults&&runs.some(run=>run.id===runResults.id&&["queued","running","paused"].includes(run.status)))setRunResults(await api(`/api/analysis-runs/${runResults.id}`));}catch{}};const timer=setInterval(refresh,2000);return()=>clearInterval(timer);},[active,tab,runResults?.id,runResults?.status]);
  useEffect(()=>{if(active&&tab==="insights")api(`/api/insights?studyId=${active}`).then(setInsights).catch(error=>setMessage(`Insights could not be refreshed: ${error.message}`));},[active,tab]);
  const submit = (handler) => async (e) => {
    e.preventDefault();
    setMessage("Saving…");
    try {
      await handler(Object.fromEntries(new FormData(e.currentTarget)));
      e.currentTarget.reset();
      await load();
      if (active) {
        const [sourceItems, typeItems, entityItems] = await Promise.all([
          api(`/api/sources?studyId=${active}`),
          api(`/api/entity-types?studyId=${active}`),
          api(`/api/entities?studyId=${active}`),
        ]);
        setSources(sourceItems.items);
        setTypes(typeItems.items);
        setEntities(entityItems.items);
      }
      setMessage("Saved");
    } catch (x) {
      setMessage(x.message);
    }
  };
  const fetchSource = async (id) => {
    setMessage("Fetching and preserving source…");
    try {
      const result = await api(`/api/sources/${id}/fetch`, {
        method: "POST",
        body: "{}",
      });
      setSources((await api(`/api/sources?studyId=${active}`)).items);
      setMessage(
        result.outcome === "unchanged"
          ? "Source checked: no change"
          : "New immutable snapshot preserved",
      );
    } catch (error) {
      setMessage(`Fetch failed: ${error.message}`);
    }
  };
  const decideSource = async (source, corpusStatus) => {
    const reason =
      corpusStatus === "excluded"
        ? window.prompt(
            "Why should this source be excluded from the study corpus?",
          )
        : null;
    if (corpusStatus === "excluded" && !reason?.trim()) {
      setMessage(
        "Exclusion cancelled: a reason is required for the audit trail",
      );
      return;
    }
    setMessage(
      `${corpusStatus === "included" ? "Including" : "Excluding"} source…`,
    );
    try {
      await api(`/api/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          corpusStatus,
          reason: reason?.trim() || null,
          actor: "local-researcher",
        }),
      });
      setSources((await api(`/api/sources?studyId=${active}`)).items);
      setMessage(
        corpusStatus === "included"
          ? "Source included in the corpus"
          : "Source excluded with its reason preserved",
      );
    } catch (error) {
      setMessage(`Decision failed: ${error.message}`);
    }
  };
  const extractSource = async (source, useOcr = false) => {
    setMessage(
      useOcr
        ? "Running local OCR; this can take several minutes…"
        : "Preparing source text for review…",
    );
    try {
      const snapshots = (await api(`/api/sources/${source.id}/snapshots`))
        .items;
      if (!snapshots[0]) {
        setMessage("Fetch the source before extracting its text");
        return;
      }
      const extraction = await api(
        `/api/snapshots/${snapshots[0].id}/extraction${useOcr ? "?ocr=true" : ""}`,
        {
          method: "POST",
          body: "{}",
        },
      );
      setReview({ source, extraction });
      setSources((await api(`/api/sources?studyId=${active}`)).items);
      setMessage(
        extraction.status === "completed"
          ? `Text prepared: ${extraction.character_count.toLocaleString()} characters in ${extraction.segments.length} traceable sections`
          : extraction.warnings?.[0] || "No text could be extracted",
      );
    } catch (error) {
      setMessage(`Extraction failed: ${error.message}`);
    }
  };
  const fetchRenderedSource = async (source) => {
    setMessage("Rendering the page in the system browser…");
    try {
      const result = await api(`/api/sources/${source.id}/render-fetch`, {
        method: "POST",
        body: JSON.stringify({expandInteractiveContent:webCaptureSettings.expandInteractiveContent,maximumInteractions:Number(webCaptureSettings.maximumInteractions)}),
      });
      setSources((await api(`/api/sources?studyId=${active}`)).items);
      setMessage(
        result.outcome === "unchanged"
          ? "Rendered page checked: no change"
          : `Rendered page snapshot preserved${result.metadata?.interactionCount?` after opening ${result.metadata.interactionCount} expandable section(s)`:""}`,
      );
    } catch (error) {
      setMessage(`Rendered fetch failed: ${error.message}`);
    }
  };
  const addBatchSources=submit(async(value)=>{
    const urls=String(value.urls).split(/[\n,]+/).map((item)=>item.trim()).filter(Boolean);
    const result=await api("/api/sources/batch",{method:"POST",body:JSON.stringify({studyId:active,urls,authority:value.authority,corpusStatus:"pending"})});
    setMessage(`${result.created.length} source(s) added${result.failures.length?`; ${result.failures.length} require attention`:""}`);
  });
  const uploadDocuments=async(event)=>{
    event.preventDefault(); const input=event.currentTarget.elements.files,files=[...input.files];
    if(!files.length) return setMessage("Choose at least one document");
    setMessage(`Uploading ${files.length} document(s)…`); let completed=0,failed=0;
    for(const file of files){try{const response=await fetch(`/api/studies/${active}/uploads?filename=${encodeURIComponent(file.name)}`,{method:"POST",headers:{"content-type":file.type||"application/octet-stream"},body:file}); if(!response.ok) throw new Error((await response.json()).error); completed++;}catch{failed++;}}
    setSources((await api(`/api/sources?studyId=${active}`)).items); event.currentTarget.reset(); setMessage(`${completed} uploaded${failed?`; ${failed} failed and were not hidden`:""}`);
  };
  const draftLines=(value)=>String(value||"").split("\n").map(item=>item.trim()).filter(Boolean);
  const updateAnalysisDraft=(key,value)=>setAnalysisDraft(current=>({...current,[key]:value}));
  const toggleDraftItem=(key,id)=>setAnalysisDraft(current=>({...current,[key]:current[key].includes(id)?current[key].filter(item=>item!==id):[...current[key],id]}));
  const analysisDraftIssues=()=>{const issues=[];if(!analysisDraft.name.trim())issues.push("Give the analysis a name");if(analysisDraft.sourceMode==="selected"&&!analysisDraft.sourceIds.length)issues.push("Choose at least one source");if(!analysisDraft.analysisTypes.length)issues.push("Choose at least one analysis type");if(analysisDraft.analysisTypes.includes("custom-extraction")&&!draftLines(analysisDraft.expectedFields).length)issues.push("List the fields you want extracted");if(analysisDraft.analysisTypes.includes("custom-questions")&&!draftLines(analysisDraft.customQuestions).length)issues.push("Add at least one question");if(analysisDraft.analysisTypes.some(type=>["themes","comparison","contradictions"].includes(type))&&(analysisDraft.sourceMode==="selected"?analysisDraft.sourceIds.length:sources.filter(source=>source.corpus_status==="included").length)<2)issues.push("Cross-source analysis needs at least two included sources");return issues;};
  const advanceAnalysisStep=()=>{const issues=analysisStep===1?analysisDraftIssues().filter(issue=>/name|source/i.test(issue)):analysisStep===2?analysisDraftIssues().filter(issue=>/analysis type|two included/i.test(issue)):analysisDraftIssues().filter(issue=>/fields|question/i.test(issue));if(issues.length)return setMessage(issues.join(". "));setAnalysisStep(step=>Math.min(4,step+1));setMessage("");};
  const createAnalysisPlan=async(event)=>{event.preventDefault();const issues=analysisDraftIssues();if(issues.length)return setMessage(issues.join(". "));try{const plan=await api("/api/analysis-plans",{method:"POST",body:JSON.stringify({studyId:active,name:analysisDraft.name.trim(),analysisTypes:analysisDraft.analysisTypes,sourceIds:analysisDraft.sourceMode==="all"?[]:analysisDraft.sourceIds,customQuestions:draftLines(analysisDraft.customQuestions),expectedFields:draftLines(analysisDraft.expectedFields),options:{sourceMode:analysisDraft.sourceMode}})});setAnalysisPlans((await api(`/api/analysis-plans?studyId=${active}`)).items);setAnalysisStep(1);setAnalysisDraft({name:"",sourceMode:"all",sourceIds:[],analysisTypes:[],customQuestions:"",expectedFields:""});setMessage(`Analysis plan “${plan.name}” saved`);}catch(error){setMessage(`Plan was not saved: ${error.message}`);}};
  const saveAnalysisTemplate=async()=>{const issues=analysisDraftIssues().filter(issue=>!issue.toLowerCase().includes("source"));if(issues.length)return setMessage(issues.join(". "));const description=window.prompt("Optional: describe when this template should be used")||null;try{await api("/api/analysis-templates",{method:"POST",body:JSON.stringify({name:analysisDraft.name.trim(),description,analysisTypes:analysisDraft.analysisTypes,customQuestions:draftLines(analysisDraft.customQuestions),expectedFields:draftLines(analysisDraft.expectedFields),options:{}})});setAnalysisTemplates((await api("/api/analysis-templates")).items);setMessage("Reusable analysis template saved");}catch(error){setMessage(`Template was not saved: ${error.message}`);}};
  const applyAnalysisTemplate=(template)=>{setAnalysisDraft(current=>({...current,name:template.name,analysisTypes:template.analysis_types,customQuestions:template.custom_questions.join("\n"),expectedFields:template.expected_fields.join("\n")}));setAnalysisStep(1);setMessage(`Template “${template.name}” loaded. Choose its sources.`);};
  const deleteAnalysisTemplate=async(template)=>{if(!window.confirm(`Remove the reusable template “${template.name}”?`))return;try{await api(`/api/analysis-templates/${template.id}`,{method:"DELETE"});setAnalysisTemplates((await api("/api/analysis-templates")).items);setMessage("Template removed");}catch(error){setMessage(`Template was not removed: ${error.message}`);}};
  const runAnalysisPlan=async(id)=>{setMessage("Queuing evidence-grounded analysis…"); try{const result=await api(`/api/analysis-plans/${id}/run`,{method:"POST",body:"{}"}); setRunResults({...result,results:[],items:[]}); setAnalysisRuns((await api(`/api/analysis-runs?studyId=${active}`)).items); setMessage("Analysis queued. You can leave this screen while it runs.");}catch(error){setMessage(`Analysis could not be queued: ${error.message}`);}};
  const openAnalysisRun=async(id)=>{try{setRunResults(await api(`/api/analysis-runs/${id}`));}catch(error){setMessage(`Could not open results: ${error.message}`);}};
  const exportAnalysisRun=(format)=>{if(!runResults?.id)return;window.location.assign(`/api/analysis-runs/${runResults.id}/export?format=${format}`);setMessage(`${labelize(format)} export requested`);};
  const controlAnalysisRun=async(run,action)=>{if(action==="cancel"&&!window.confirm("Cancel this analysis run? Completed results will remain available."))return;try{await api(`/api/analysis-runs/${run.id}/${action}`,{method:"POST",body:"{}"});const updated=await api(`/api/analysis-runs/${run.id}`);setRunResults(updated);setAnalysisRuns((await api(`/api/analysis-runs?studyId=${active}`)).items);setMessage(`Analysis ${action==="pause"?"paused":action==="resume"?"resumed":action==="retry"?"queued for retry":"cancelled"}`);}catch(error){setMessage(`Analysis control failed: ${error.message}`);}};
  const reviewAnalysisResult=async(result,status)=>{const reason=window.prompt(status==="accepted"?"Why do you accept this result?":"Explain why this result should be rejected"); if(!reason?.trim()) return; try{await api(`/api/analysis-results/${result.id}`,{method:"PATCH",body:JSON.stringify({status,reason:reason.trim()})}); setRunResults(await api(`/api/analysis-runs/${runResults.id}`)); setMessage(`Result ${status}`);}catch(error){setMessage(`Review failed: ${error.message}`);}};
  const providerValue=(form)=>{const value=Object.fromEntries(new FormData(form));return{protocol:value.protocol,model:value.model,baseUrl:value.baseUrl,apiKey:value.apiKey||undefined}};
  const inspectAi=async(event)=>{const form=event.currentTarget.form;setMessage("Checking provider and loading its model catalogue…");setAiDiagnostic(null);try{const result=await api("/api/ai/inspect",{method:"POST",body:JSON.stringify(providerValue(form))});setAiDiagnostic(result);setMessage(result.status==="available"?"Provider connection verified":result.detail);}catch(error){setAiDiagnostic({status:"unavailable",models:[],detail:error.message});setMessage(`Provider check failed: ${error.message}`);}};
  const connectAi=async(event)=>{event.preventDefault();const form=event.currentTarget,value=Object.fromEntries(new FormData(form));setMessage("Saving AI provider…");try{if(window.electronAPI?.researchedAi){await window.electronAPI.researchedAi.saveProfile({name:value.profileName||`${value.protocol} · ${value.model}`,...providerValue(form)});setMessage("Provider saved securely. Restarting Research’Ed to apply it…");await window.electronAPI.researchedAi.apply();return;}await api("/api/ai/connection",{method:"POST",body:JSON.stringify(providerValue(form))});await load();form.reset();setMessage("AI provider connected for this app session");}catch(error){setMessage(`Provider was not saved: ${error.message}`);}};
  const disconnectAi=async()=>{await api("/api/ai/connection",{method:"DELETE"});await load();setMessage("AI provider disconnected");};
  const activateAiProfile=async(id)=>{try{await window.electronAPI.researchedAi.activateProfile(id);setMessage("Applying provider profile…");await window.electronAPI.researchedAi.apply();}catch(error){setMessage(`Provider could not be applied: ${error.message}`);}};
  const removeAiProfile=async(id)=>{if(!window.confirm("Remove this saved provider profile? The encrypted credential will also be removed."))return;try{setAiProfiles(await window.electronAPI.researchedAi.removeProfile(id));setMessage("Provider profile removed");}catch(error){setMessage(`Provider profile was not removed: ${error.message}`);}};
  const useRulesOnly=async()=>{try{await window.electronAPI.researchedAi.activateProfile(null);setMessage("Restarting Research’Ed without an AI provider…");await window.electronAPI.researchedAi.apply();}catch(error){setMessage(`Rules-only mode could not be applied: ${error.message}`);}};
  const reviewSource = async (source) => {
    if (!source.latest_snapshot_id) return;
    setMessage("Opening extracted evidence…");
    try {
      const extraction = await api(
        `/api/snapshots/${source.latest_snapshot_id}/extraction`,
      );
      setReview({ source, extraction });
      setTab("review");
      setMessage("");
    } catch (error) {
      setMessage(`Review unavailable: ${error.message}`);
    }
  };
  const saveEvidence = submit(async (value) => {
    await api("/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        studyId: active,
        segmentId: capture.id,
        evidenceType: value.evidenceType,
        interpretation: value.interpretation,
        confidence: value.confidence,
        notes: value.notes || null,
        codeIds: codes
          .filter((code) => value[`code-${code.id}`])
          .map((code) => code.id),
        actor: "local-researcher",
      }),
    });
    setEvidence((await api(`/api/evidence?studyId=${active}`)).items);
    setAnalysis(await api(`/api/analysis?studyId=${active}`));
    setCapture(null);
  });
  const createCode = submit(async (value) => {
    await api("/api/research-codes", {
      method: "POST",
      body: JSON.stringify({
        studyId: active,
        label: value.label,
        description: value.description || null,
        colour: value.colour,
      }),
    });
    setCodes((await api(`/api/research-codes?studyId=${active}`)).items);
  });
  const createFinding = submit(async (value) => {
    const evidenceIds = evidence
      .filter((item) => value[`evidence-${item.id}`])
      .map((item) => item.id);
    if (!evidenceIds.length)
      throw new Error("Select at least one evidence item for this finding");
    await api("/api/findings", {
      method: "POST",
      body: JSON.stringify({
        studyId: active,
        title: value.title,
        conclusion: value.conclusion,
        confidence: value.confidence,
        limitations: value.limitations || null,
        evidenceIds,
        actor: "local-researcher",
      }),
    });
    setFindings((await api(`/api/findings?studyId=${active}`)).items);
  });
  const createReport = submit(async (value) => {
    await api("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        studyId: active,
        title: value.title,
        findingIds: findings
          .filter((finding) => value[`finding-${finding.id}`])
          .map((finding) => finding.id),
        includeMethodology: Boolean(value.includeMethodology),
        includeCorpus: Boolean(value.includeCorpus),
        includeEvidenceTable: Boolean(value.includeEvidenceTable),
        actor: "local-researcher",
      }),
    });
    setReports((await api(`/api/reports?studyId=${active}`)).items);
  });
  const transition = async (kind, id, targetStatus, needsReason = false) => {
    const reason = needsReason
      ? window.prompt(`Reason for changing this ${kind} to ${targetStatus}:`)
      : null;
    if (needsReason && !reason?.trim()) {
      setMessage("Status change cancelled: a reason is required");
      return;
    }
    setMessage("Updating status…");
    try {
      await api(`/api/${kind === "study" ? "studies" : kind}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          targetStatus,
          reason: reason?.trim() || null,
          actor: "local-researcher",
        }),
      });
      await load();
      setEvidence((await api(`/api/evidence?studyId=${active}`)).items);
      setFindings((await api(`/api/findings?studyId=${active}`)).items);
      setReadiness(await api(`/api/studies/${active}/readiness`));
      setAudit((await api(`/api/audit?studyId=${active}`)).items);
      setMessage(`Status changed to ${targetStatus}`);
    } catch (error) {
      setMessage(`Status change failed: ${error.message.replaceAll("_", " ")}`);
    }
  };
  const searchEvidence = async (event) => {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.currentTarget));
    const query = new URLSearchParams({
      studyId: active,
      q: value.query,
      type: value.type,
      status: value.status,
    });
    setEvidence((await api(`/api/evidence?${query}`)).items);
  };
  const discoverFromSource = async (source) => {
    setMessage("Discovering same-site links from the latest snapshot…");
    try {
      const result = await api(`/api/sources/${source.id}/discover`, {
        method: "POST",
        body: JSON.stringify({ sameOrigin: webCaptureSettings.sameOrigin, maximumLinks: Number(webCaptureSettings.maximumLinks) }),
      });
      setDiscovered(
        (await api(`/api/discovered-links?studyId=${active}&status=pending`))
          .items,
      );
      setMessage(
        `Discovery complete: ${result.added} new, ${result.duplicates} already known`,
      );
    } catch (error) {
      setMessage(`Discovery failed: ${error.message.replaceAll("_", " ")}`);
    }
  };
  const decideDiscovered = async (link, action) => {
    const reason =
      action === "dismiss"
        ? window.prompt("Why should this link be dismissed?")
        : null;
    if (action === "dismiss" && !reason?.trim())
      return setMessage("Dismissal cancelled: a reason is required");
    try {
      await api(`/api/discovered-links/${link.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          label: link.link_text,
          reason: reason?.trim() || null,
          actor: "local-researcher",
        }),
      });
      setDiscovered(
        (await api(`/api/discovered-links?studyId=${active}&status=pending`))
          .items,
      );
      setSources((await api(`/api/sources?studyId=${active}`)).items);
      setMessage(
        action === "add"
          ? "Link added as a pending source"
          : "Link dismissed with reason recorded",
      );
    } catch (error) {
      setMessage(`Decision failed: ${error.message}`);
    }
  };
  const queueSource = async (source) => {
    try {
      await api("/api/acquisition-queue", {
        method: "POST",
        body: JSON.stringify({
          studyId: active,
          sourceIds: [source.id],
          maximumAttempts: 3,
        }),
      });
      setQueue((await api(`/api/acquisition-queue?studyId=${active}`)).items);
      setMessage("Source queued for acquisition");
    } catch (error) {
      setMessage(`Queueing failed: ${error.message}`);
    }
  };
  const runQueue = async () => {
    setMessage("Processing acquisition queue…");
    try {
      const result = await api("/api/acquisition-queue/run", {
        method: "POST",
        body: JSON.stringify({ studyId: active, maximumItems: 5 }),
      });
      setQueue((await api(`/api/acquisition-queue?studyId=${active}`)).items);
      setSources((await api(`/api/sources?studyId=${active}`)).items);
      setMessage(`Queue processed ${result.processed} item(s)`);
    } catch (error) {
      setMessage(`Queue failed: ${error.message}`);
    }
  };
  const cancelQueueItem = async (id) => {
    try {
      await api(`/api/acquisition-queue/${id}/cancel`, {
        method: "POST",
        body: "{}",
      });
      setQueue((await api(`/api/acquisition-queue?studyId=${active}`)).items);
      setMessage("Queued acquisition cancelled");
    } catch (error) {
      setMessage(`Cancellation failed: ${error.message}`);
    }
  };
  const selectedStudy = studies.find((study) => study.id === active);
  const needsStudy = new Set(["corpus", "structure", "review", "analysis", "insights", "reports"]);
  const pageTitle = NAV_ITEMS.find(([id]) => id === tab)?.[1] ?? "Research'Ed";
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <b>Research'Ed</b>
          <span>Auditable research workspace</span>
        </div>
        <span className="nav-label">WORKSPACE</span>
        {NAV_ITEMS.map(([x, label]) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
            disabled={needsStudy.has(x) && !active}
            title={needsStudy.has(x) && !active ? "Create or select a study first" : label}
          >
            {label}
          </button>
        ))}
        <button type="button" className="launcher" onClick={()=>window.electronAPI?.returnToLauncher?.() ?? window.close()}>
          Return to launcher
        </button>
      </aside>
      <main>
        <header>
          <div>
            <small>RESEARCH PLATFORM</small>
            <h1>{pageTitle}</h1>
            {selectedStudy&&<span className="context-line">Working in: {selectedStudy.title}</span>}
          </div>
          <div className="header-actions">
          {tab!=="overview"&&<button type="button" className="secondary" onClick={()=>setTab("overview")}>← Back to home</button>}
          <select aria-label="Current study" value={active} onChange={(e) => setActive(e.target.value)} disabled={!studies.length}>
            <option value="">{studies.length?"Select a study":"No studies yet"}</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          </div>
        </header>
        {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
        {tab === "overview" && (
          <>
            <section className="hero">
              <small>{studies.length?"CONTINUE YOUR WORK":"WELCOME TO RESEARCH'ED"}</small>
              <h2>{studies.length?"Evidence first. Conclusions later.":"Set up your first research workspace"}</h2>
              <p>{studies.length?"Choose a study, add and preserve its sources, then run evidence-grounded analysis.":"Research'Ed keeps your sources, evidence, analysis and reports connected and auditable. Start by giving your study a clear question."}</p>
              <button onClick={() => setTab(studies.length?active?"corpus":"study":"study")}>{studies.length?active?"Continue to sources":"Select a study":"Create your first study"}</button>
            </section>
            {!studies.length&&<section className="getting-started"><h2>How it works</h2><div className="step-grid"><article><span>1</span><h3>Define the study</h3><p>State the research question, purpose and boundaries.</p></article><article><span>2</span><h3>Add sources</h3><p>Paste links or upload PDF, Word, text and HTML files in batches.</p></article><article><span>3</span><h3>Choose analysis</h3><p>Select rules-based or AI-assisted methods and review every result.</p></article><article><span>4</span><h3>Use the evidence</h3><p>Capture evidence, confirm findings and export traceable reports.</p></article></div><div className="notice">AI is optional. Rules-based analysis and the complete evidence workflow work immediately.</div></section>}
            <div className="cards">
              <article>
                <strong>{dashboard.studies ?? studies.length}</strong>
                <span>Studies</span>
              </article>
              <article>
                <strong>{dashboard.sources ?? sources.length}</strong>
                <span>Sources across studies</span>
              </article>
              <article>
                <strong>{dashboard.evidence ?? 0}</strong>
                <span>Active evidence items</span>
              </article>
              <article>
                <strong>{dashboard.findings ?? 0}</strong>
                <span>Current findings</span>
              </article>
            </div>
            {capabilities && (
              <section className="capability-panel">
                <h2>Research capabilities</h2>
                <div className="readiness-list">
                  <div
                    className={
                      capabilities.browserRendering.available
                        ? "passed"
                        : "warning"
                    }
                  >
                    <span>
                      {capabilities.browserRendering.available ? "✓" : "!"}
                    </span>
                    <p>
                      JavaScript page rendering:{" "}
                      {capabilities.browserRendering.available
                        ? capabilities.browserRendering.engine
                        : "No compatible system browser found"}
                    </p>
                  </div>
                  <div className={capabilities.aiAnalysis.available?"passed":"warning"}>
                    <span>{capabilities.aiAnalysis.available?"✓":"!"}</span>
                    <p>Interpretive AI analysis: {capabilities.aiAnalysis.available?`${capabilities.aiAnalysis.provider} · ${capabilities.aiAnalysis.model}`:"not configured; rules analysis remains available"}{capabilities.aiAnalysis.available&&<small>{`This session: ${capabilities.aiAnalysis.usage.succeeded} succeeded, ${capabilities.aiAnalysis.usage.failed} failed${capabilities.aiAnalysis.usage.averageLatencyMs===null?"":`, ${capabilities.aiAnalysis.usage.averageLatencyMs} ms average`}`}</small>}</p>
                  </div>
                  <div className="passed">
                    <span>✓</span>
                    <p>PDF OCR: local {capabilities.pdfOcr.language} model</p>
                  </div>
                  <div
                    className={
                      capabilities.backgroundAcquisition.available
                        ? "passed"
                        : "warning"
                    }
                  >
                    <span>
                      {capabilities.backgroundAcquisition.available ? "✓" : "!"}
                    </span>
                    <p>
                      Background acquisition:{" "}
                      {capabilities.backgroundAcquisition.available
                        ? `checks every ${capabilities.backgroundAcquisition.intervalSeconds} seconds`
                        : "inactive"}
                    </p>
                  </div>
                </div>
                <details className="codebook"><summary>AI provider settings</summary><p>Research'Ed uses the same evidence contract with every provider. In the desktop launcher, credentials are encrypted by Windows and remain outside the Research'Ed database. In a normal browser, a connection lasts only until the app closes.</p>{aiUsage&&<div className="cards"><article><strong>{aiUsage.requests}</strong><span>AI requests this session</span></article><article><strong>{aiUsage.failures}</strong><span>Failed requests</span></article><article><strong>{aiUsage.averageLatencyMs??"—"}</strong><span>Average response time (ms)</span></article><article><strong>{aiUsage.model??"Rules only"}</strong><span>Active model</span></article></div>}<form onSubmit={connectAi}>{aiProfiles&&<Field label="Profile name"><input name="profileName" required placeholder="My OpenAI account" /></Field>}<div className="row"><Field label="API type"><select name="protocol" defaultValue="openai-responses">{aiProviders?.items.map(provider=><option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></Field><Field label="Model name"><input name="model" required placeholder="gpt-5-mini or local model name" /></Field></div><Field label="Provider address"><input name="baseUrl" type="url" required defaultValue="https://api.openai.com" /></Field><Field label="API key" hint={aiProfiles?"Encrypted by the operating system; leave blank when replacing only non-secret settings.":"Optional for a local model; held only in memory."}><input name="apiKey" type="password" autoComplete="off" /></Field><div className="source-actions"><button type="button" className="secondary" onClick={inspectAi}>Test and find models</button><button>{aiProfiles?"Save securely and apply":"Connect for this session"}</button>{capabilities.aiAnalysis.available&&!aiProfiles&&<button type="button" className="danger" onClick={disconnectAi}>Disconnect</button>}{aiProfiles&&capabilities.aiAnalysis.available&&<button type="button" className="secondary" onClick={useRulesOnly}>Use rules only</button>}</div></form>{aiDiagnostic&&<div className={`provider-diagnostic ${aiDiagnostic.status}`}><b>{aiDiagnostic.status==="available"?"Connection verified":aiDiagnostic.status==="unsupported"?"Ready for analysis-time validation":"Connection failed"}</b><p>{aiDiagnostic.detail}</p>{aiDiagnostic.latencyMs!==null&&<small>Response time: {aiDiagnostic.latencyMs} ms</small>}{aiDiagnostic.models?.length>0&&<div className="model-list">{aiDiagnostic.models.slice(0,100).map(model=><code key={model}>{model}</code>)}</div>}</div>}{aiProfiles?.profiles?.length>0&&<div className="saved-profiles"><h3>Saved profiles</h3>{aiProfiles.profiles.map(profile=><article key={profile.id} className={profile.active?"active":""}><div><b>{profile.name}</b><small>{profile.protocol} · {profile.model}{profile.hasApiKey?" · credential saved":" · no credential"}</small></div><div className="source-actions">{!profile.active&&<button type="button" onClick={()=>activateAiProfile(profile.id)}>Use profile</button>}<button type="button" className="danger" onClick={()=>removeAiProfile(profile.id)}>Remove</button></div></article>)}</div>}<div className="captured-list">{aiProviders?.items.map(provider=><article key={provider.id}><b>{provider.name}</b><small>{provider.id}</small><p>{provider.description}</p>{provider.defaultBaseUrl&&<small>Default address: {provider.defaultBaseUrl}</small>}</article>)}</div><small>Hosted providers require HTTPS. Local HTTP is restricted to this computer. Environment variables remain supported for managed deployments.</small></details>
              </section>
            )}
          </>
        )}
        {tab==="insights"&&<section><h2>Research insights</h2><p>These prompts are calculated from recorded workflow and validated analysis results. They direct your attention; they do not decide what the evidence means.</p>{!active||!insights?<div className="empty">Select a study to see its insights.</div>:<><div className="cards"><article><strong>{insights.summary.attention}</strong><span>Require attention</span></article><article><strong>{insights.summary.warnings}</strong><span>Need review</span></article><article><strong>{insights.summary.information}</strong><span>Useful prompts</span></article><article><strong>{insights.metrics.confirmedFindings}</strong><span>Confirmed findings</span></article></div><div className="insight-list">{insights.items.map(item=><article key={item.id} className={item.severity}><div><small>{item.severity}</small><h3>{item.title}</h3><p>{item.message}</p><span>Evidence: {Object.entries(item.evidence).map(([key,value])=>`${labelize(key)} ${value}`).join(" · ")}</span></div><button onClick={()=>setTab(item.action.tab)}>{item.action.label}</button></article>)}{!insights.items.length&&<div className="empty">No recorded issues currently require attention.</div>}</div><div className="notice">{insights.interpretation}</div></>}</section>}
        {tab === "study" && (
          <section>
            <h2>Study Designer</h2>
            <p>
              Define the question and methodological boundaries before
              collecting evidence.
            </p>
            <form
              onSubmit={submit((v) =>
                api("/api/studies", {
                  method: "POST",
                  body: JSON.stringify({
                    title: v.title,
                    researchQuestion: v.question,
                    description: v.description || null,
                    methodology: v.methodology || null,
                    inclusionRules: [],
                    exclusionRules: [],
                  }),
                }),
              )}
            >
              <Field label="Study title">
                <input name="title" required />
              </Field>
              <Field label="Research question">
                <textarea name="question" required />
              </Field>
              <Field label="Description">
                <textarea name="description" />
              </Field>
              <Field label="Methodology">
                <textarea name="methodology" />
              </Field>
              <button>Create study</button>
            </form>
            {active && (
              <div className="lifecycle-panel">
                <h3>Selected study lifecycle</h3>
                <p>
                  Status:{" "}
                  <b>{studies.find((study) => study.id === active)?.status}</b>
                </p>
                <div className="source-actions">
                  {studies.find((study) => study.id === active)?.status ===
                    "draft" && (
                    <button
                      onClick={() => transition("study", active, "active")}
                    >
                      Start study
                    </button>
                  )}
                  {studies.find((study) => study.id === active)?.status ===
                    "active" && (
                    <button
                      disabled={!readiness?.readyToLock}
                      title={
                        readiness?.readyToLock
                          ? "Lock this completed study"
                          : "Complete the blocking readiness checks first"
                      }
                      onClick={() => transition("study", active, "locked")}
                    >
                      Lock completed study
                    </button>
                  )}
                  {studies.find((study) => study.id === active)?.status ===
                    "locked" && (
                    <button
                      className="secondary"
                      onClick={() =>
                        transition("study", active, "active", true)
                      }
                    >
                      Reopen study
                    </button>
                  )}
                  {studies.find((study) => study.id === active)?.status !==
                    "archived" && (
                    <button
                      className="danger"
                      onClick={() =>
                        transition("study", active, "archived", true)
                      }
                    >
                      Archive study
                    </button>
                  )}
                  {studies.find((study) => study.id === active)?.status ===
                    "archived" && (
                    <button
                      onClick={() => transition("study", active, "draft")}
                    >
                      Reinstate as draft
                    </button>
                  )}
                </div>
                {readiness && (
                  <div className="readiness-list">
                    {readiness.checks.map((check) => (
                      <div
                        className={
                          check.passed
                            ? "passed"
                            : check.blocking
                              ? "blocked"
                              : "warning"
                        }
                        key={check.id}
                      >
                        <span>
                          {check.passed ? "✓" : check.blocking ? "×" : "!"}
                        </span>
                        <p>{check.message}</p>
                      </div>
                    ))}
                  </div>
                )}
                <details className="codebook">
                  <summary>Recent change history ({audit.length})</summary>
                  <div className="captured-list">
                    {audit.map((event) => (
                      <article key={event.id}>
                        <b>{event.action.replaceAll("_", " ")}</b>
                        <small>
                          {event.entity_kind} ·{" "}
                          {new Date(event.occurred_at).toLocaleString()} ·{" "}
                          {event.actor}
                        </small>
                        {event.reason && <p>{event.reason}</p>}
                      </article>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>
        )}
        {tab === "corpus" && (
          <section>
            <h2>Corpus Manager</h2>
            <p>
              Add an explicit source. It remains pending until you make a corpus
              decision.
            </p>
            {!active ? (
              <div className="empty">Select or create a study first.</div>
            ) : (
              <>
                <form
                  onSubmit={submit((v) =>
                    api("/api/sources", {
                      method: "POST",
                      body: JSON.stringify({
                        studyId: active,
                        label: v.label,
                        originalUrl: v.url,
                        sourceType: v.type,
                        authority: v.authority,
                        corpusStatus: "pending",
                        completeness: "unassessed",
                        notes: v.notes || null,
                      }),
                    }),
                  )}
                >
                  <Field label="Source label">
                    <input name="label" required />
                  </Field>
                  <Field label="URL">
                    <input name="url" type="url" required />
                  </Field>
                  <div className="row">
                    <Field label="Source format">
                      <select name="type">
                        <option value="webpage">Webpage</option>
                        <option value="pdf">PDF</option>
                        <option value="document">Document</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field label="Authority">
                      <select name="authority">
                        <option value="unknown">Not assessed</option>
                        <option value="primary">Primary source</option>
                        <option value="secondary">Secondary source</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea name="notes" />
                  </Field>
                  <button>Add pending source</button>
                </form>
                <div className="corpus-operations">
                  <article>
                    <h3>Add a batch of links</h3><p>Paste one URL per line. Every failed or duplicate item is reported.</p>
                    <form onSubmit={addBatchSources}><Field label="URLs"><textarea name="urls" rows="6" required placeholder="https://example.org/page\nhttps://example.org/report.pdf" /></Field><Field label="Authority"><select name="authority" defaultValue="unknown"><option value="unknown">Not assessed</option><option value="primary">Primary source</option><option value="secondary">Secondary source</option></select></Field><button>Add batch as pending</button></form>
                  </article>
                  <article>
                    <h3>Upload documents</h3><p>PDF, Word, text and HTML files are preserved before extraction. You can select several files.</p>
                    <form onSubmit={uploadDocuments}><Field label="Documents"><input name="files" type="file" multiple accept=".pdf,.docx,.txt,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html" required /></Field><button>Upload selected documents</button></form>
                  </article>
                  <article>
                    <h3>Web capture settings</h3><p>Rendered capture can open expandable sections before preserving the page. Link discovery stays on the same website by default.</p>
                    <div className="choice-row"><label><input type="checkbox" checked={webCaptureSettings.expandInteractiveContent} onChange={event=>setWebCaptureSettings(current=>({...current,expandInteractiveContent:event.target.checked}))}/> Open expandable content</label><label><input type="checkbox" checked={webCaptureSettings.sameOrigin} onChange={event=>setWebCaptureSettings(current=>({...current,sameOrigin:event.target.checked}))}/> Keep discovered links on this website</label></div>
                    <div className="row"><Field label="Maximum page interactions"><input type="number" min="0" max="100" value={webCaptureSettings.maximumInteractions} onChange={event=>setWebCaptureSettings(current=>({...current,maximumInteractions:event.target.value}))}/></Field><Field label="Maximum discovered links"><input type="number" min="1" max="200" value={webCaptureSettings.maximumLinks} onChange={event=>setWebCaptureSettings(current=>({...current,maximumLinks:event.target.value}))}/></Field></div>
                  </article>
                </div>
                <div className="list">
                  {sources.map((s, i) => (
                    <article key={s.id}>
                      <span>{i + 1}</span>
                      <div>
                        <b>{s.label}</b>
                        <small>{s.original_url}</small>
                        <small>
                          {(s.retrieval_status || "not_fetched").replaceAll(
                            "_",
                            " ",
                          )}
                        </small>
                      </div>
                      <em>{s.corpus_status}</em>
                      <div className="source-actions">
                        <button onClick={() => fetchSource(s.id)}>Fetch</button>
                        {s.source_type === "webpage" && (
                          <button
                            className="secondary"
                            onClick={() => fetchRenderedSource(s)}
                          >
                            Fetch rendered page
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={!Number(s.snapshot_count)}
                          onClick={() => discoverFromSource(s)}
                        >
                          Discover links
                        </button>
                        <button
                          className="secondary"
                          onClick={() => queueSource(s)}
                        >
                          Queue
                        </button>
                        <button
                          className="secondary"
                          disabled={!Number(s.snapshot_count)}
                          onClick={() => extractSource(s)}
                        >
                          Extract text
                        </button>
                        {s.source_type === "pdf" && (
                          <button
                            className="secondary"
                            disabled={!Number(s.snapshot_count)}
                            onClick={() => extractSource(s, true)}
                          >
                            Run OCR
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={s.extraction_status !== "completed"}
                          onClick={() => reviewSource(s)}
                        >
                          Review
                        </button>
                        <button
                          className="secondary"
                          disabled={s.corpus_status === "included"}
                          onClick={() => decideSource(s, "included")}
                        >
                          Include
                        </button>
                        <button
                          className="danger"
                          disabled={s.corpus_status === "excluded"}
                          onClick={() => decideSource(s, "excluded")}
                        >
                          Exclude
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="corpus-operations">
                  <article>
                    <div className="panel-heading">
                      <div>
                        <h3>Acquisition queue</h3>
                        <small>
                          Persistent retries use increasing delays and stop
                          after the configured limit.
                        </small>
                      </div>
                      <button onClick={runQueue}>Process next 5</button>
                    </div>
                    <div className="captured-list">
                      {queue.slice(0, 20).map((item) => (
                        <article key={item.id}>
                          <span>
                            {item.status} · attempt {item.attempts}/
                            {item.maximum_attempts}
                          </span>
                          <b>{item.label}</b>
                          {item.last_error && (
                            <small>
                              {item.last_error.replaceAll("_", " ")}
                            </small>
                          )}
                          {["queued", "failed"].includes(item.status) && (
                            <button
                              className="danger"
                              onClick={() => cancelQueueItem(item.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </article>
                      ))}
                      {!queue.length && (
                        <div className="empty">No queued acquisitions.</div>
                      )}
                    </div>
                  </article>
                  <article>
                    <div className="panel-heading">
                      <div>
                        <h3>Discovered links</h3>
                        <small>
                          Nothing enters the corpus until you approve it.
                        </small>
                      </div>
                      <span>{discovered.length} pending</span>
                    </div>
                    <div className="captured-list">
                      {discovered.map((link) => (
                        <article key={link.id}>
                          <b>{link.link_text || "Untitled link"}</b>
                          <small>{link.discovered_url}</small>
                          <small>Found from {link.parent_source_label}</small>
                          <div className="source-actions">
                            <button
                              onClick={() => decideDiscovered(link, "add")}
                            >
                              Add as source
                            </button>
                            <button
                              className="danger"
                              onClick={() => decideDiscovered(link, "dismiss")}
                            >
                              Dismiss
                            </button>
                          </div>
                        </article>
                      ))}
                      {!discovered.length && (
                        <div className="empty">
                          No pending discovered links.
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </>
            )}
          </section>
        )}
        {tab === "structure" && (
          <section>
            <h2>Entity Modelling</h2>
            <p>
              Define the kinds of things this study examines. Research'Ed does
              not impose a subject-specific hierarchy.
            </p>
            {!active ? (
              <div className="empty">Select a study first.</div>
            ) : (
              <>
                <form
                  onSubmit={submit((v) =>
                    api("/api/entity-types", {
                      method: "POST",
                      body: JSON.stringify({
                        studyId: active,
                        name: v.name,
                        description: v.description || null,
                        fieldSchema: {},
                      }),
                    }),
                  )}
                >
                  <Field
                    label="Entity type name"
                    hint="Examples: organisation, policy, programme, person or publication"
                  >
                    <input name="name" required />
                  </Field>
                  <Field label="Description">
                    <textarea name="description" />
                  </Field>
                  <button>Add entity type</button>
                </form>
                <div className="chips">
                  {types.map((t) => (
                    <span key={t.id}>{t.name}</span>
                  ))}
                </div>
                {!!types.length && <form onSubmit={submit((v)=>api("/api/entities",{method:"POST",body:JSON.stringify({studyId:active,entityTypeId:v.entityTypeId,parentId:v.parentId||null,label:v.label,attributes:{}})}))}>
                  <h3>Add something to the study structure</h3>
                  <div className="row"><Field label="Name" hint="The organisation, programme, policy, person or other item you are studying"><input name="label" required /></Field><Field label="Type"><select name="entityTypeId" required>{types.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></Field></div>
                  <Field label="Parent item" hint="Optional. Use this to build a hierarchy, such as a programme within an organisation."><select name="parentId" defaultValue=""><option value="">No parent</option>{entities.map(entity=><option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></Field>
                  <button>Add to structure</button>
                </form>}
                <div className="captured-list">{entities.map(entity=><article key={entity.id}><b>{entity.label}</b><small>{entity.entity_type}{entity.parent_id?` · inside ${entities.find(item=>item.id===entity.parent_id)?.label??"another item"}`:" · top level"}</small></article>)}{!entities.length&&<div className="empty">No study structure items yet. Create a type, then add the organisations, programmes, publications or other items you need.</div>}</div>
              </>
            )}
          </section>
        )}
        {tab === "review" && (
          <section>
            <h2>Evidence Review</h2>
            <p>
              Read extracted material in source order. Every section retains its
              snapshot, position and content hash for later citation.
            </p>
            {!review ? (
              <div className="empty">
                Extract a source in Corpus Manager, then choose Review.
              </div>
            ) : (
              <>
                <div className="review-heading">
                  <div>
                    <b>{review.source.label}</b>
                    <small>{review.source.original_url}</small>
                  </div>
                  <span>
                    {review.extraction.character_count.toLocaleString()}{" "}
                    characters
                  </span>
                </div>
                <details className="codebook">
                  <summary>Manage this study’s evidence codes</summary>
                  <form onSubmit={createCode}>
                    <Field label="Code name">
                      <input name="label" required />
                    </Field>
                    <Field label="Description">
                      <input name="description" />
                    </Field>
                    <Field label="Colour">
                      <input
                        name="colour"
                        type="color"
                        defaultValue="#59b8a8"
                      />
                    </Field>
                    <button>Create code</button>
                  </form>
                </details>
                {capture && (
                  <form className="capture-form" onSubmit={saveEvidence}>
                    <h3>Capture section {capture.ordinal} as evidence</h3>
                    <blockquote>{capture.content}</blockquote>
                    <div className="row">
                      <Field label="Evidence type">
                        <select name="evidenceType" defaultValue="claim">
                          {[
                            "claim",
                            "fact",
                            "observation",
                            "definition",
                            "requirement",
                            "method",
                            "counterevidence",
                            "other",
                          ].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Confidence">
                        <select name="confidence" defaultValue="unassessed">
                          <option value="unassessed">Not assessed</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="What does this passage establish?">
                      <textarea name="interpretation" required />
                    </Field>
                    <Field label="Reviewer notes">
                      <textarea name="notes" />
                    </Field>
                    {!!codes.length && (
                      <fieldset>
                        <legend>Evidence codes</legend>
                        <div className="code-options">
                          {codes.map((code) => (
                            <label key={code.id}>
                              <input type="checkbox" name={`code-${code.id}`} />
                              <span>{code.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    <div className="source-actions">
                      <button>Save evidence</button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setCapture(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                <div className="evidence-segments">
                  {review.extraction.segments.map((segment) => (
                    <article key={segment.ordinal}>
                      <span>§ {segment.ordinal}</span>
                      <p>{segment.content}</p>
                      <small title={segment.content_hash}>
                        Evidence fingerprint:{" "}
                        {segment.content_hash.slice(0, 16)}…
                      </small>
                      <button
                        className="secondary"
                        onClick={() => setCapture(segment)}
                      >
                        Capture as evidence
                      </button>
                    </article>
                  ))}
                </div>
                <h3>Captured evidence ({evidence.length})</h3>
                <form className="filter-bar" onSubmit={searchEvidence}>
                  <input name="query" placeholder="Search evidence or source" />
                  <select name="type">
                    <option value="">All evidence types</option>
                    {[
                      "claim",
                      "fact",
                      "observation",
                      "definition",
                      "requirement",
                      "method",
                      "counterevidence",
                      "other",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <select name="status">
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="superseded">Superseded</option>
                  </select>
                  <button>Filter</button>
                </form>
                <div className="captured-list">
                  {evidence.map((item) => (
                    <article key={item.id}>
                      <span>
                        {item.evidence_type} · {item.confidence} confidence ·{" "}
                        {item.status}
                      </span>
                      <b>{item.interpretation}</b>
                      <p>{item.captured_text}</p>
                      <small>
                        {item.source_label} · snapshot {item.snapshot_sequence}{" "}
                        · section {item.segment_ordinal}
                      </small>
                      <div className="source-actions">
                        {item.status === "active" ? (
                          <>
                            <button
                              className="danger"
                              onClick={() =>
                                transition(
                                  "evidence",
                                  item.id,
                                  "withdrawn",
                                  true,
                                )
                              }
                            >
                              Withdraw
                            </button>
                            <button
                              className="secondary"
                              onClick={() =>
                                transition(
                                  "evidence",
                                  item.id,
                                  "superseded",
                                  true,
                                )
                              }
                            >
                              Mark superseded
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              transition("evidence", item.id, "active")
                            }
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {tab === "analysis" && (
          <section>
            <h2>Analysis setup</h2>
            <p>
              Choose what you want to learn. Rules produce reproducible measurements; AI options remain visibly unavailable until an AI provider is configured.
            </p>
            {capabilities?.aiAnalysis.available&&<div className="notice">AI analysis sends the extracted evidence required for your selected analyses to the configured provider. Source files remain in Research'Ed; requests are not stored by the provider API configuration.</div>}
            {!active || !analysis ? (
              <div className="empty">Select a study to analyse.</div>
            ) : (
              <>
                {analysisTemplates.length>0&&<div className="template-strip"><div><b>Start from a reusable template</b><small>Templates choose the analysis—not the study or its sources.</small></div>{analysisTemplates.map(template=><div key={template.id}><button type="button" className="secondary" onClick={()=>applyAnalysisTemplate(template)}>{template.name}</button><button type="button" className="icon-button danger" aria-label={`Remove ${template.name}`} onClick={()=>deleteAnalysisTemplate(template)}>×</button></div>)}</div>}
                <form onSubmit={createAnalysisPlan} className="analysis-wizard">
                  <ol className="wizard-steps">{["Purpose and sources","Analysis methods","Questions and fields","Review"].map((label,index)=><li key={label} className={analysisStep===index+1?"active":analysisStep>index+1?"done":""}><span>{index+1}</span>{label}</li>)}</ol>
                  {analysisStep===1&&<div className="wizard-panel"><h3>What are you analysing?</h3><Field label="Analysis name" hint="Use a name that will still make sense in the run history."><input value={analysisDraft.name} onChange={event=>updateAnalysisDraft("name",event.target.value)} required placeholder="Programme information review" /></Field><fieldset><legend>Sources</legend><div className="choice-row"><label><input type="radio" checked={analysisDraft.sourceMode==="all"} onChange={()=>updateAnalysisDraft("sourceMode","all")}/> All included sources</label><label><input type="radio" checked={analysisDraft.sourceMode==="selected"} onChange={()=>updateAnalysisDraft("sourceMode","selected")}/> Choose sources</label></div>{analysisDraft.sourceMode==="selected"&&<div className="source-picker">{sources.filter(source=>source.corpus_status==="included").map(source=><label key={source.id}><input type="checkbox" checked={analysisDraft.sourceIds.includes(source.id)} onChange={()=>toggleDraftItem("sourceIds",source.id)}/><span><b>{source.label}</b><small>{source.source_type} · {source.completeness}</small></span></label>)}</div>}</fieldset></div>}
                  {analysisStep===2&&<div className="wizard-panel"><h3>What do you want to learn?</h3><p>Select only analyses that help answer your research question. Corpus methods compare all chosen sources together.</p><div className="analysis-options">{analysisTypes.map(type=><label key={type.id}><input type="checkbox" checked={analysisDraft.analysisTypes.includes(type.id)} onChange={()=>toggleDraftItem("analysisTypes",type.id)}/><span><b>{type.name}</b><small>{type.description}</small><em>{type.method} · {type.scope==="corpus"?"compares the corpus":"per source"} · validated</em></span></label>)}</div></div>}
                  {analysisStep===3&&<div className="wizard-panel"><h3>Guide the analysis</h3><p>These instructions constrain the output. Leave them blank unless the selected method or your research question needs them.</p><div className="row"><Field label="Questions for the material" hint="One precise question per line. Required when Custom questions is selected."><textarea value={analysisDraft.customQuestions} onChange={event=>updateAnalysisDraft("customQuestions",event.target.value)} /></Field><Field label="Information expected" hint="One field or topic per line. Required for Custom fields."><textarea value={analysisDraft.expectedFields} onChange={event=>updateAnalysisDraft("expectedFields",event.target.value)} /></Field></div></div>}
                  {analysisStep===4&&<div className="wizard-panel"><h3>Review before saving</h3><div className="review-grid"><div><small>Name</small><b>{analysisDraft.name}</b></div><div><small>Sources</small><b>{analysisDraft.sourceMode==="all"?`All ${sources.filter(source=>source.corpus_status==="included").length} included sources`:`${analysisDraft.sourceIds.length} selected`}</b></div><div><small>Analysis methods</small><b>{analysisDraft.analysisTypes.map(type=>analysisTypes.find(item=>item.id===type)?.name||type).join(", ")}</b></div><div><small>Provider</small><b>{analysisDraft.analysisTypes.every(type=>analysisTypes.find(item=>item.id===type)?.method==="rules")?"Rules only":capabilities?.aiAnalysis.available?`${capabilities.aiAnalysis.provider} · ${capabilities.aiAnalysis.model}`:"AI is not connected; interpretive tasks will be reported clearly"}</b></div></div>{analysisDraftIssues().length>0&&<div className="notice">Before saving: {analysisDraftIssues().join(". ")}</div>}</div>}
                  <div className="wizard-actions">{analysisStep>1&&<button type="button" className="secondary" onClick={()=>setAnalysisStep(step=>step-1)}>Back</button>}{analysisStep<4?<button type="button" onClick={advanceAnalysisStep}>Continue</button>:<><button type="submit">Save analysis plan</button><button type="button" className="secondary" onClick={saveAnalysisTemplate}>Save as reusable template</button></>}</div>
                </form>
                <h3>Saved plans</h3><div className="captured-list">{analysisPlans.map(plan=><article key={plan.id}><b>{plan.name}</b><small>{plan.analysis_types.join(", ")}</small><button onClick={()=>runAnalysisPlan(plan.id)}>Run analysis</button></article>)}{!analysisPlans.length&&<div className="empty">No analysis plans yet.</div>}</div>
                <h3>Analysis runs</h3><div className="captured-list">{analysisRuns.map(run=><article key={run.id}><span>{run.status}</span><b>{run.progress_completed} of {run.progress_total} analysis tasks finished</b><progress max={Math.max(1,run.progress_total)} value={run.progress_completed}/>{run.error_summary&&<small>{run.error_summary}</small>}<div className="source-actions"><button onClick={()=>openAnalysisRun(run.id)}>View results</button>{["queued","running"].includes(run.status)&&<button className="secondary" onClick={()=>controlAnalysisRun(run,"pause")}>Pause</button>}{run.status==="paused"&&<button onClick={()=>controlAnalysisRun(run,"resume")}>Resume</button>}{["queued","running","paused"].includes(run.status)&&<button className="danger" onClick={()=>controlAnalysisRun(run,"cancel")}>Cancel</button>}{["failed","partial"].includes(run.status)&&<button onClick={()=>controlAnalysisRun(run,"retry")}>Retry failed tasks</button>}</div></article>)}{!analysisRuns.length&&<div className="empty">No analysis has been run.</div>}</div>
                {runResults&&<><h3>Generated results</h3><p>{["queued","running","paused"].includes(runResults.status)?`Background progress: ${runResults.progress_completed} of ${runResults.progress_total}. Results appear here as they complete.`:"Every result remains reviewable. Accepting or rejecting it records your reason in the audit trail."}</p><div className="source-actions export-actions"><button type="button" className="secondary" onClick={()=>exportAnalysisRun("markdown")}>Readable report</button><button type="button" className="secondary" onClick={()=>exportAnalysisRun("csv")}>Spreadsheet</button><button type="button" className="secondary" onClick={()=>exportAnalysisRun("json")}>Complete data file</button></div>{runResults.items?.some(item=>item.last_error)&&<div className="notice">Some tasks need attention: {[...new Set(runResults.items.filter(item=>item.last_error).map(item=>String(item.last_error).replaceAll("_"," ")))].join("; ")}</div>}<div className="captured-list result-cards">{runResults.results?.map(result=><article key={result.id}><span>{labelize(result.analysis_type)} · {result.source_id?"single source":"all selected sources"} · {labelize(result.method)} · {labelize(result.status)}</span><ResultView result={result}/><small>{result.evidence_segment_ids?.length??0} cited source section{result.evidence_segment_ids?.length===1?"":"s"}</small>{result.status==="generated"&&<div className="source-actions"><button onClick={()=>reviewAnalysisResult(result,"accepted")}>Accept</button><button className="danger" onClick={()=>reviewAnalysisResult(result,"rejected")}>Reject</button></div>}</article>)}{!runResults.results?.length&&<div className="empty">No results have completed yet.</div>}</div></>}
                <h2>Cross-source evidence</h2>
                <div className="cards analysis-cards">
                  <article>
                    <strong>{analysis.coverage.includedSources}</strong>
                    <span>Included sources</span>
                  </article>
                  <article>
                    <strong>{analysis.coverage.extractedSources}</strong>
                    <span>Included sources extracted</span>
                  </article>
                  <article>
                    <strong>{analysis.coverage.evidencedSources}</strong>
                    <span>Included sources cited</span>
                  </article>
                  <article>
                    <strong>{analysis.uncodedEvidence}</strong>
                    <span>Evidence items without a code</span>
                  </article>
                </div>
                <h3>Evidence by code</h3>
                <div className="analysis-table">
                  <div className="table-heading">
                    <span>Code</span>
                    <span>Evidence</span>
                    <span>Sources</span>
                    <span>Counterevidence</span>
                  </div>
                  {analysis.codes.map((code) => (
                    <div key={code.id}>
                      <b style={{ color: code.colour }}>{code.label}</b>
                      <span>{code.evidence_count}</span>
                      <span>{code.source_count}</span>
                      <span
                        className={code.counterevidence_count ? "tension" : ""}
                      >
                        {code.counterevidence_count}
                      </span>
                    </div>
                  ))}
                </div>
                <h3>Source coverage</h3>
                <div className="analysis-table coverage-table">
                  <div className="table-heading">
                    <span>Source</span>
                    <span>Corpus</span>
                    <span>Extraction</span>
                    <span>Evidence</span>
                  </div>
                  {analysis.coverage.sources.map((source) => (
                    <div key={source.id}>
                      <b>{source.label}</b>
                      <span>{source.corpus_status}</span>
                      <span>{source.extraction_status || "not extracted"}</span>
                      <span
                        className={
                          source.corpus_status === "included" &&
                          !source.evidence_count
                            ? "tension"
                            : ""
                        }
                      >
                        {source.evidence_count}
                      </span>
                    </div>
                  ))}
                </div>
                <h3>Author a finding</h3>
                {!evidence.length ? (
                  <div className="empty">
                    Capture evidence before authoring a finding.
                  </div>
                ) : (
                  <form onSubmit={createFinding}>
                    <Field label="Finding title">
                      <input name="title" required />
                    </Field>
                    <Field label="Conclusion">
                      <textarea name="conclusion" required />
                    </Field>
                    <div className="row">
                      <Field label="Confidence">
                        <select name="confidence" defaultValue="unassessed">
                          <option value="unassessed">Not assessed</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </Field>
                      <Field label="Limitations">
                        <textarea name="limitations" />
                      </Field>
                    </div>
                    <fieldset>
                      <legend>Cited evidence — select at least one</legend>
                      <div className="finding-evidence-options">
                        {evidence.map((item) => (
                          <label key={item.id}>
                            <input
                              type="checkbox"
                              name={`evidence-${item.id}`}
                            />
                            <span>
                              <b>{item.interpretation}</b>
                              <small>{item.source_label}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button>Save draft finding</button>
                  </form>
                )}
                <h3>Findings ({findings.length})</h3>
                <div className="captured-list">
                  {findings.map((finding) => (
                    <article key={finding.id}>
                      <span>
                        {finding.status} · {finding.confidence} confidence ·{" "}
                        {finding.evidence.length} citations
                      </span>
                      <b>{finding.title}</b>
                      <p>{finding.conclusion}</p>
                      {finding.limitations && (
                        <small>Limitations: {finding.limitations}</small>
                      )}
                      <div className="source-actions">
                        {finding.status === "draft" && (
                          <button
                            onClick={() =>
                              transition("findings", finding.id, "confirmed")
                            }
                          >
                            Confirm finding
                          </button>
                        )}
                        {finding.status === "confirmed" && (
                          <button
                            className="secondary"
                            onClick={() =>
                              transition("findings", finding.id, "draft")
                            }
                          >
                            Return to draft
                          </button>
                        )}
                        {finding.status !== "withdrawn" ? (
                          <button
                            className="danger"
                            onClick={() =>
                              transition(
                                "findings",
                                finding.id,
                                "withdrawn",
                                true,
                              )
                            }
                          >
                            Withdraw
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              transition("findings", finding.id, "draft")
                            }
                          >
                            Reinstate as draft
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {tab === "reports" && (
          <section>
            <h2>Reports and Exports</h2>
            <p>
              Create a permanent report from the study as it currently stands.
              Later edits will not change a report you have already created.
            </p>
            {!active ? (
              <div className="empty">Select a study first.</div>
            ) : (
              <>
                <form onSubmit={createReport}>
                  <Field label="Report title">
                    <input name="title" required />
                  </Field>
                  <fieldset>
                    <legend>Report sections</legend>
                    <div className="code-options">
                      <label>
                        <input
                          type="checkbox"
                          name="includeMethodology"
                          defaultChecked
                        />
                        <span>Methodology</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="includeCorpus"
                          defaultChecked
                        />
                        <span>Corpus appendix</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="includeEvidenceTable"
                          defaultChecked
                        />
                        <span>Evidence appendix</span>
                      </label>
                    </div>
                  </fieldset>
                  {!!findings.length && (
                    <fieldset>
                      <legend>Findings — select none to include all</legend>
                      <div className="finding-evidence-options">
                        {findings.map((finding) => (
                          <label key={finding.id}>
                            <input
                              type="checkbox"
                              name={`finding-${finding.id}`}
                            />
                            <span>
                              <b>{finding.title}</b>
                              <small>
                                {finding.evidence.length} supporting evidence
                                items
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  <button>Generate fixed report</button>
                </form>
                <h3>Generated reports ({reports.length})</h3>
                <div className="captured-list">
                  {reports.map((report) => (
                    <article key={report.id}>
                      <span>
                        {new Date(report.generated_at).toLocaleString()}
                      </span>
                      <b>{report.title}</b>
                      <small title={report.content_hash}>
                        Fingerprint: {report.content_hash.slice(0, 20)}…
                      </small>
                      <div className="report-actions">
                        <a
                          className="button-link"
                          href={`/api/reports/${report.id}/export?format=html`}
                        >
                          Download readable report
                        </a>
                        <a
                          className="button-link secondary"
                          href={`/api/reports/${report.id}/export?format=json`}
                        >
                          Download audit data
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
