import PersonalColouring, {ColouringProvider} from "./personal-colouring.jsx";
import { accessorySlots } from "../../src/domain/garment/visual-style.ts";
import OutfitPreview from './outfit-preview.jsx';
import { evaluationAdvice, explainComparison } from '../../src/domain/outfit/evaluation-advice.ts';
import { withCompanions, companionSlots, companionReasons } from "../../src/domain/outfit/garment-dependencies.ts";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PhotoIntake from "./photo-intake.jsx";
import ReactDOM from "react-dom/client";
import {
  AppShell,
  ActionFeedbackHost,
  Button,
  ConfirmationDialog,
  EmptyState,
  Metric,
  PageHeader,
  Panel,
  StatusBadge,
  Toolbar,
  useDraft,
  reportActionFeedback,
} from "../../../shared-ui/react/index.js";
import "./styles/app.css";
import "../../../shared-ui/styles/timsys-dark.css";
function WearConfirmation({ close }) {
  const [items, setItems] = useState([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems((await api("/api/lifecycle/wearable")).items);
    } catch (cause) {
      setError(cause.message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const worn = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await api(`/api/planner/entries/${pending.id}/worn`, {
        method: "POST",
        body: JSON.stringify({
          wornDate: String(pending.planned_date).slice(0, 10),
          notes: null,
        }),
      });
      setPending(null);
      await load();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <ConfirmationDialog
        open={Boolean(pending)}
        title="Confirm actual wear?"
        description={
          pending
            ? `Record “${pending.outfit_name}” as worn on ${String(pending.planned_date).slice(0, 10)}.`
            : ""
        }
        consequence="This updates the garment’s wear history and the wardrobe summaries based on it."
        confirmLabel="Confirm wear"
        busy={busy}
        onConfirm={worn}
        onCancel={() => setPending(null)}
      />
      <section className="modal compact">
        <header>
          <div>
            <p className="eyebrow">EXPLICIT WEAR CONFIRMATION</p>
            <h2>Planned versus worn</h2>
            <p className="muted">
              Nothing affects wear history until you confirm it here.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        {error && <p className="error banner">{error}</p>}
        {!items.length ? (
          <div className="empty">
            <h3>No planned outfits await confirmation.</h3>
          </div>
        ) : (
          <div className="wear-confirm-list">
            {items.map((item) => (
              <article key={item.id}>
                <time>{String(item.planned_date).slice(0, 10)}</time>
                <strong>{item.outfit_name}</strong>
                <span>{item.items.map((x) => x.name).join(" · ")}</span>
                <button className="primary" onClick={() => setPending(item)}>
                  Mark worn
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
function Insights({ close, onNavigate }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api("/api/insights"));
    } catch (cause) {
      setError(cause.message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const setPref = async (key, value) => {
    try {
      await api("/api/preferences", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      });
      await load();
    } catch (cause) {
      setError(cause.message);
    }
  };
  const underusedDays = Number(data?.preferences.underused_days ?? 90),
    cutoff = Date.now() - underusedDays * 86400000,
    underused =
      data?.utilisation
        .filter(
          (x) =>
            x.wear_count === 0 ||
            !x.last_worn ||
            new Date(x.last_worn).getTime() <= cutoff,
        )
        .slice(0, 10) || [],
    lowVersatility =
      data?.versatility
        .filter(
          (x) =>
            x.outfit_count <
            Number(data.preferences.low_versatility_outfit_count ?? 2),
        )
        .slice(0, 10) || [],
    maximum = Math.max(
      1,
      ...(data?.utilisation.map((x) => x.wear_count) || [1]),
    );
  return (
    <div className="modal-backdrop">
      <section className="modal insights-modal">
        <header>
          <div>
            <p className="eyebrow">WARDROBE INSIGHTS</p>
            <h2>What your wardrobe history shows</h2>
            <p className="muted">
              These insights use your garments, saved outfits, wear history and care records.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        {error && <p className="error banner">{error}</p>}
        {data && (
          <>
            <section className="metric-grid">
              <article>
                <strong>{data.summary.garments}</strong>
                <span>garments</span>
                <small>{data.summary.available} available</small>
              </article>
              <article>
                <strong>{data.summary.wears}</strong>
                <span>confirmed wears</span>
                <small>{data.summary.distinctOutfits} distinct outfits</small>
              </article>
              <article>
                <strong>
                  {data.summary.rotationDiversity == null
                    ? "—"
                    : Math.round(data.summary.rotationDiversity * 100) + "%"}
                </strong>
                <span>rotation diversity</span>
                <small>distinct outfits ÷ wears</small>
              </article>
              <article>
                <strong>{data.care.open_cases}</strong>
                <span>open care cases</span>
                <small>{data.care.overdue} overdue</small>
              </article>
            </section>
            <section className="insight-columns">
              <div>
                <h3>Wear distribution</h3>
                {data.utilisation
                  .slice()
                  .sort((a, b) => b.wear_count - a.wear_count)
                  .slice(0, 15)
                  .map((x) => (
                    <article className="bar-row" key={x.id}>
                      <span>{x.name}</span>
                      <div>
                        <i
                          style={{
                            width: `${(x.wear_count / maximum) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{x.wear_count}</strong>
                    </article>
                  ))}
              </div>
              <div>
                <h3>Decision prompts</h3>
                {underused.length ? (
                  <article className="insight-callout">
                    <strong>
                      {underused.length} items exceed the {underusedDays}-day
                      underused threshold
                    </strong>
                    <p>
                      {underused.map((x) => x.name).join(", ")}. Consider
                      building outfits around them before buying similar pieces.
                    </p>
                    <button className="quiet" onClick={() => onNavigate("wardrobe")}>Review these garments</button>
                  </article>
                ) : (
                  <article className="insight-callout">
                    <strong>No item exceeds your underused threshold.</strong>
                  </article>
                )}
                {lowVersatility.length > 0 && (
                  <article className="insight-callout">
                    <strong>Low saved-outfit versatility</strong>
                    <p>
                      {lowVersatility
                        .map((x) => `${x.name} (${x.outfit_count})`)
                        .join(", ")}
                      .
                    </p>
                    <button className="quiet" onClick={() => onNavigate("outfits")}>Build more outfits</button>
                  </article>
                )}
                {data.care.blockers > 0 && (
                  <article className="insight-callout warning">
                    <strong>
                      {data.care.blockers} garments currently blocked by care
                    </strong>
                    <p>
                      Mark completed care as resolved so these garments can be used in outfits again.
                    </p>
                    <button className="quiet" onClick={() => onNavigate("care")}>Review care cases</button>
                  </article>
                )}
              </div>
            </section>
            <section className="preference-panel">
              <h3>Insight preferences</h3>
              <label>
                Underused threshold (days)
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={underusedDays}
                  onChange={(e) =>
                    setPref("underused_days", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Low versatility threshold
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Number(
                    data.preferences.low_versatility_outfit_count ?? 2,
                  )}
                  onChange={(e) =>
                    setPref(
                      "low_versatility_outfit_count",
                      Number(e.target.value),
                    )
                  }
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(data.preferences.show_internal_scores)}
                  onChange={(e) =>
                    setPref("show_internal_scores", e.target.checked)
                  }
                />
                Show internal scores
              </label>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
const sections = [
  "Wardrobe",
  "Outfit Builder",
  "Recommendations",
  "Planner",
  "Wear History",
  "Garment Care",
  "Insights",
  "Settings",
];
const seasons = ["spring", "summer", "autumn", "winter", "all-season"];
async function api(url, options) {
  let response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: options?.body
        ? { "content-type": "application/json" }
        : undefined,
    });
  } catch {
    throw new Error(
      "Dress’Ed cannot reach its local service. Return to the launcher and restart the app.",
    );
  }
  const raw = await response.text();
  let value = {};
  try {
    value = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      response.ok
        ? "Dress’Ed received an unreadable response."
        : "Dress’Ed’s local service is unavailable.",
    );
  }
  if (!response.ok)
    throw new Error(
      value.issues
        ?.map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ") ||
        value.error?.message ||
        (value.error === "incomplete_outfit" ? `Add ${value.missingSlots.map(slot => ({top:"a shirt or top",bottom:"trousers or bottoms",footwear:"shoes",jacket:"a jacket"}[slot] || slot.replaceAll("_", " "))).join(", ")} before saving this as a complete outfit.` : null) ||
        ({
          calibration_red_not_found: "The red block could not be found clearly. Retake the photograph with the whole card visible in even light.",
          calibration_green_not_found: "The green block could not be found clearly. Retake the photograph with the whole card visible in even light.",
          calibration_blue_not_found: "The blue block could not be found clearly. Retake the photograph with the whole card visible in even light.",
          calibration_photo_too_small: "This photograph is too small to read reliably. Choose a clearer, higher-resolution image.",
          ensemble_not_saveable: "This combination needs changes before it can be saved. Review the evaluation notes.",
          garment_not_available_for_use: "One of these garments is no longer available for this use. Refresh and evaluate again.",
          no_eligible_saved_outfits: "No saved outfit fits these planner settings. Check the context, fixed garments and whether the rotation policy allows this outfit’s rating.",
          selected_garment_not_available_for_use: "That garment is not available for the selected use.",
          version_conflict_or_missing: "This garment changed or was already deleted. Refresh the wardrobe and try again.",
        }[value.error]) ||
        value.error ||
        "The request could not be completed.",
    );
  return value;
}
function CategoryForm({ categories, close, saved }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parent, setParent] = useState("");
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      saved(
        await api("/api/categories", {
          method: "POST",
          body: JSON.stringify({
            name,
            slug,
            parentCategoryId: parent || null,
            sortOrder: 0,
          }),
        }),
      );
    } catch (cause) {
      setError(cause.message);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal compact">
        <header>
          <h2>Add category</h2>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label>
            Parent
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Top level</option>
              {categories
                .filter((x) => !x.parentCategoryId)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary">Add category</button>
          </div>
        </form>
      </section>
    </div>
  );
}
function CalibrationForm({ close, saved }) {
  const [name, setName] = useState("My colour card"),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/calibration-profiles/from-photo?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      const value = await response.json();
      if (!response.ok) {
        const messages = {
          calibration_red_not_found: "The red block could not be found clearly.",
          calibration_green_not_found: "The green block could not be found clearly.",
          calibration_blue_not_found: "The blue block could not be found clearly.",
          calibration_card_geometry_invalid: "The colour blocks were visible, but Dress’Ed could not confirm that they belonged to the calibration card. Keep the whole card flat and visible.",
          calibration_card_glare: "Reflections are obscuring the colour blocks. Remove glossy covering or change the lighting and try again.",
          calibration_photo_too_small: "The photograph is too small to read reliably.",
        };
        throw new Error(messages[value.error] || value.error || "The calibration photograph could not be used.");
      }
      saved(value);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal compact">
        <header>
          <div>
            <p className="eyebrow">SET UP YOUR COLOUR CARD</p>
            <h2>Add a calibration card</h2>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Card name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My colour card"
            />
          </label>
          <p className="muted">
            Use a matte white sheet with eight equal patches in this order: black, red, green, blue, cyan, magenta, yellow and neutral grey. Keep the sheet flat, photograph the whole card in even light without flash, and avoid reflections. A red–green–blue card remains supported, but the eight-patch card gives stronger correction.
          </p>
          <label>
            Photograph of your colour card
            <input required type="file" accept="image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary" disabled={busy}>{busy ? "Reading colours…" : "Use this photograph"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
function CoordinationScore({ evaluation }) {
  return <div className="coordination-rating">
    <div className="ensemble-score"><strong>{evaluation.score.toFixed(1)}<small>/100</small></strong><span>Coordination score</span></div>
    <p className="muted">Confidence: {evaluation.confidence ? `${evaluation.confidence.label} (${evaluation.confidence.score}/100 evidence coverage)` : "Not assessed"}</p>
    {evaluation.confidence && <p className="muted">The confidence reflects how much we know about these garments. Unconfirmed shades, pattern sizes and dressiness make the advice less certain; they do not automatically make the outfit worse.</p>}
    {evaluation.breakdown && <details><summary>Score breakdown</summary>
      <table><thead><tr><th>Area</th><th>Points</th></tr></thead><tbody>{evaluation.breakdown.map(part => <tr key={part.id}><td>{part.label}</td><td>{part.points.toFixed(1)}{part.maximum ? ` / ${part.maximum}` : " adjustment"}</td></tr>)}</tbody></table>
      {evaluation.breakdown.map(part => <details key={part.id}><summary>{part.label}: comparisons</summary><ul>{part.checks.length ? part.checks.map((check,index) => <li key={index}>{explainComparison(check.explanation)} <small>Relationship: {Math.round(check.value*100)}/100; evidence coverage: {Math.round(check.confidence*100)}/100.</small></li>) : <li>No specific relationship to compare in this selection; a neutral baseline is used.</li>}</ul></details>)}
      <p className="muted">The four areas add up to the score. These are styling heuristics, not measurements of how good you will look. Equal scores are legitimate when recorded details are equivalent.</p>
    </details>}
  </div>;
}
function EvaluationNotes({ evaluation, garments }) {
  return <div className="evaluation-notes">{evaluationAdvice(evaluation, garments).map(group =>
    <section className={`evaluation-note-group evaluation-note-group--${group.kind}`} key={group.name}>
      <h3>{group.name}</h3><ul>{group.items.map((text,index) => <li key={index}><p>{text}</p></li>)}</ul>
    </section>)}</div>;
}
function SavedOutfits({ edit, plan, refreshKey }) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[target,setTarget]=useState(null),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setLoading(true);try{setItems((await api('/api/ensembles/saved')).items);setError("");}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load,refreshKey]);
  const remove=async()=>{setBusy(true);try{await api(`/api/ensembles/saved/${target.id}`,{method:'DELETE'});setTarget(null);await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <Panel title="Saved outfits" description="Your completed combinations, ready to view, edit or plan.">
    {error&&<p className="error" role="alert">{error}</p>}
    {loading?<p>Loading saved outfits…</p>:!items.length?<p>No saved outfits yet. Build or evaluate a combination, then save it here.</p>:<div className="ensemble-grid">{items.map(outfit=><article key={outfit.id}>
      <h3>{outfit.name}</h3><p>{outfit.score.toFixed(1)}/100 · {outfit.contextName}</p>
      <ul>{groupOutfitGarments(outfit.items).flatMap(group=>group.items.map(g=><li key={g.id}>{g.name}</li>))}</ul>
      {outfit.notes&&<p>{outfit.notes}</p>}
      <OutfitPreview garments={outfit.items} api={api}/>
      <div className="row-actions"><button onClick={()=>edit(outfit)}>Edit outfit</button><button onClick={()=>plan({name:outfit.name,contextId:outfit.contextId,garmentIds:outfit.items.map(g=>g.id)})}>Open in planner</button><button onClick={()=>setTarget(outfit)}>Delete outfit</button></div>
    </article>)}</div>}
    <ConfirmationDialog open={!!target} title="Delete saved outfit?" description={target?`Remove “${target.name}” from saved outfits?`:""} consequence="This removes it from your saved list and future planning choices. Your garments, existing plans and wear history are kept." confirmLabel="Delete outfit" destructive busy={busy} onConfirm={remove} onCancel={()=>setTarget(null)}/>
  </Panel>;
}
function StylingLab({ garments, close, openPlanner, openSaved, initialOutfit }) {
  const [catalogue, setCatalogue] = useState(null),
    [selected, setSelected] = useState(initialOutfit?.items.map(g => g.id) || []),
    [outfitName, setOutfitName] = useState(initialOutfit?.name || ""),
    [outfitNotes, setOutfitNotes] = useState(initialOutfit?.notes || ""),
    [editingId, setEditingId] = useState(initialOutfit?.id),
    [savedOutfit, setSavedOutfit] = useState(null),
    [useId, setUseId] = useState(initialOutfit?.useId || ""),
    [contextId, setContext] = useState(""),
    [season, setSeason] = useState(initialOutfit?.season || ""),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/api/styling/catalogue"), api("/api/ensembles/catalogue")])
      .then(([value, wardrobe]) => {
        setCatalogue({...value, uses: wardrobe.uses, garments: wardrobe.garments});
        setContext(initialOutfit?.contextId || value.contexts[0]?.id || "");
      })
      .catch((cause) => setError(cause.message));
  }, []);
  const eligibleGarments = (catalogue?.garments || []).filter(g => !useId || g.useIds.includes(useId));
  const missingItems = selected.filter(id => !eligibleGarments.some(g => g.id === id));
  const categoryKey = garment => garment.slotId || garment.categorySlug || garment.id;
  const occupiedCategories = new Set(eligibleGarments.filter(g => selected.includes(g.id)).map(categoryKey));
  const visibleGarments = eligibleGarments.filter(g => selected.includes(g.id) || !occupiedCategories.has(categoryKey(g)));
  const changeUse = (nextUse) => {
    setUseId(nextUse);
    const allowed = new Set((catalogue?.garments || []).filter(g => !nextUse || g.useIds.includes(nextUse)).map(g => g.id));
    setSelected(current => current.filter(id => allowed.has(id)));
    setResult(null);
    setError("");
  };
  const toggle = (id) => {
    const item = eligibleGarments.find(g => g.id === id);
    if (!item) return;
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current.filter(value => {
      const chosen = eligibleGarments.find(g => g.id === value);
      return !chosen || categoryKey(chosen) !== categoryKey(item);
    }), id]);
    setResult(null);
  };
  const evaluate = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(
        await api("/api/styling/evaluate", {
          method: "POST",
          body: JSON.stringify({
            garmentIds: selected,
            contextId,
            season: season || null,
          }),
        }),
      );
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  // Any change invalidates both the evaluation and the saved-selection marker.
  useEffect(() => { setSavedOutfit(null); }, [selected, contextId, season, useId, outfitName, outfitNotes]);
  const selectedGarments = (catalogue?.garments || []).filter(g => selected.includes(g.id));
  const defaultName = selectedGarments.slice(0, 3).map(g => g.name).join(" + ").slice(0, 120);
  const save = async (plan = false) => {
    if (!result?.evaluation.eligible || busy) return;
    setBusy(true); setError("");
    try {
      const saved = savedOutfit || await api("/api/ensembles/save", {
        method: "POST",
        body: JSON.stringify({...(editingId ? {replaceId:editingId} : {}), name: (outfitName.trim() || defaultName), garmentIds: selected, contextId, useId: useId || null, season: season || null, notes: outfitNotes.trim() || null}),
      });
      setSavedOutfit(saved);
      if(initialOutfit) setEditingId(saved.id);
      if (plan) openPlanner({name: saved.name, contextId, garmentIds: [...selected]});
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header>
          <div>
            <p className="eyebrow">OUTFIT CHECK</p>
            <h2>{initialOutfit ? "Edit saved outfit" : "Check how these garments work together"}</h2>
            <p className="muted">
              Choose your garments, see how they work together, then save the outfit or take it to the planner.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        {initialOutfit && <p className="muted">Save changes to replace this outfit for future use. Existing plans and wear records keep the original version.</p>}
        {missingItems.length > 0 && <div className="banner"><p>Some saved garments are unavailable or do not match this use. Change the use filter, or remove and replace them before evaluating.</p>{missingItems.map(id => <button key={id} onClick={() => {setSelected(current => current.filter(x => x !== id));setResult(null);}}>Remove {initialOutfit?.items.find(g => g.id === id)?.name || 'unavailable garment'}</button>)}</div>}
        <div className="lab-controls">
          <label>
            Use
            <select value={useId} disabled={busy} onChange={e => changeUse(e.target.value)}>
              <option value="">All garments (no use filter)</option>
              {catalogue?.uses.map(use => <option key={use.id} value={use.id}>{use.name}</option>)}
            </select>
          </label>
          <label>
            Context
            <select
              value={contextId}
              disabled={busy} onChange={(e) => { setContext(e.target.value); setResult(null); }}
            >
              {catalogue?.contexts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season
            <select value={season} disabled={busy} onChange={(e) => { setSeason(e.target.value); setResult(null); }}>
              <option value="">Not specified</option>
              {["spring", "summer", "autumn", "winter"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">Use filters by the tags saved on your garments; context controls the occasion and formality. Changing use removes selections that do not match.</p>
        <p className="muted">{visibleGarments.length} shown · {selected.length} selected · {eligibleGarments.length - visibleGarments.length} alternatives hidden</p>
        {catalogue && !eligibleGarments.length && <p className="banner">No available reviewed garments match this use. Choose another use, select All garments, or update the garment use tags in Edit.</p>}
        <p className="muted">Selecting an item hides alternatives in its outfit category. Deselect it to show those alternatives again.</p>
        <div className="lab-garments">
          {groupOutfitGarments(visibleGarments).map(group => <React.Fragment key={group.slot}>
            <h3 className="lab-garment-type">{group.label} <small>({group.items.length})</small></h3>
            {group.items.map((x) => (
            <label key={x.id}>
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.includes(x.id)}
                onChange={() => toggle(x.id)}
              />
              <span>
                <strong>{x.name}</strong>
                <small>{garments.find(g => g.id === x.id)?.categoryName || x.categorySlug.replaceAll("-", " ")}</small>
              </span>
            </label>
            ))}
          </React.Fragment>)}
        </div>
        <button
          className="primary"
          disabled={selected.length < 2 || selected.length > 32 || busy || missingItems.length > 0}
          onClick={evaluate}
        >
          {busy ? "Evaluating…" : "Evaluate selected garments"}
        </button>
        {error && <p className="error banner">{error}</p>}
        {result && (
          <section className="lab-result">
            <CoordinationScore evaluation={result.evaluation} />
            <p>{result.evaluation.eligible ? "No incompatible garments found. Review the suggestions below; completeness is checked when you save." : "This selection needs changes before it can be worn together."}</p>
            <OutfitPreview garments={selectedGarments} api={api} />
            <EvaluationNotes evaluation={result.evaluation} garments={selectedGarments} />
            <section className="evaluation-save">
              <h3>Keep this outfit</h3>
              <p className="muted">Saved outfits are your completed combinations. You can use them in the planner; saving does not record them as worn.</p>
              <label>Outfit name<input maxLength={120} value={outfitName} placeholder={defaultName} disabled={busy || !!savedOutfit} onChange={e => setOutfitName(e.target.value)} /></label>
              <label>Notes<textarea maxLength={2000} value={outfitNotes} disabled={busy || !!savedOutfit} onChange={e => setOutfitNotes(e.target.value)} /></label>
              {savedOutfit && <p role="status">Saved as “{savedOutfit.name}”.</p>}
              {!result.evaluation.eligible && <p>Resolve the changes listed above before saving.</p>}
              <div className="row-actions">
                <button disabled={busy || !!savedOutfit || !result.evaluation.eligible} onClick={() => save(false)}>{savedOutfit ? "Outfit saved" : busy ? "Saving…" : initialOutfit ? "Save changes" : "Save outfit"}</button>
                <button disabled={busy || !result.evaluation.eligible} onClick={() => save(true)}>{savedOutfit ? "Open in planner" : "Save and open planner"}</button>
                {savedOutfit && <button onClick={openSaved}>View saved outfits</button>}
              </div>
            </section>
          </section>
        )}
      </section>
    </div>
  );
}
const outfitCategories = [["top","Shirts / tops"],["bottom","Trousers / bottoms"],["footwear","Shoes / boots"],["belt","Belts"],["neckwear","Ties / neckwear"],["pocket_square","Pocket squares"],["outerwear","Jackets / outerwear"],["jacket","Blazers / suit jackets"],["waistcoat","Waistcoats"],["socks","Socks"],["base_layer","Base layers"],["accessory","Other accessories"],...accessorySlots.map(slot=>[slot,({headwear:"Hats / caps",eyewear:"Glasses / sunglasses",tie_clip:"Tie clips",lapel_pin:"Lapel pins"}[slot]||slot.charAt(0).toUpperCase()+slot.slice(1).replaceAll("_"," "))])];
function groupOutfitGarments(garments) {
  const groups = new Map();
  const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;
  for (const garment of garments) {
    const slot = garment.slotId || garment.categorySlug || 'accessory';
    if (!groups.has(slot)) groups.set(slot, { slot, label: outfitCategories.find(([id]) => id === slot)?.[1] || slot.replaceAll('_', ' ').replaceAll('-', ' '), items: [] });
    groups.get(slot).items.push(garment);
  }
  return [...groups.values()].sort((a, b) => compare(a.label, b.label)).map(group => ({ ...group, items: group.items.sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id)) }));
}
function OutfitBuilder({ close }) {
  const [catalogue, setCatalogue] = useState(null),
    [fixedIds, setFixedIds] = useState([]),
    [contextId, setContext] = useState(""),
    [useId, setUseId] = useState(""),
    [season, setSeason] = useState(""),
    [selectedSlots, setSelectedSlots] = useState(["top", "bottom", "footwear"]),
    [results, setResults] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const value = await api("/api/ensembles/catalogue");
      setCatalogue(value);
      setContext((current) => current || value.contexts.find(x => x.slug === "smart-casual")?.id || value.contexts[0]?.id || "");
      // An unassigned use is not a reason to hide reviewed garments.
    } catch (cause) {
      setError(cause.message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      setResults(
        await api("/api/ensembles/generate", {
          method: "POST",
          body: JSON.stringify({
            fixedGarmentIds: fixedIds,
            contextId,
            useId: useId || null,
            season: season || null,
            limitPerGrade: 12,
            selectedSlotIds: requiredSlots,
          }),
        }),
      );
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const act = async (candidate, type) => {
    try {
      if (type === "save") {
        const names = candidate.garments
          .slice(0, 3)
          .map((item) => item.name)
          .join(" + ");
        const name = (names || `Outfit ${new Date().toLocaleDateString()}`).slice(0, 120);
        await api("/api/ensembles/save", {
          method: "POST",
          body: JSON.stringify({
            name,
            garmentIds: candidate.garments.map((x) => x.id),
            contextId,
            useId: useId || null,
            season: season || null,
            notes: null,
          }),
        });
        await load();
      } else {
        await api("/api/ensembles/overrides", {
          method: "POST",
          body: JSON.stringify({
            type,
            scope: "exact_outfit",
            garmentIds: candidate.garments.map((x) => x.id),
            reason: null,
          }),
        });
        await generate();
      }
    } catch (cause) {
      setError(cause.message);
    }
  };
  const tiers = results
    ? [["Ranked suggestions", [...results.a, ...results.b, ...results.c].sort((a,b) => b.evaluation.score-a.evaluation.score)]]
    : [];
  const eligibleGarments = catalogue?.garments.filter((garment) => !useId || garment.useIds.includes(useId)) || [];
  const fixedGarments = (catalogue?.garments || []).filter(g => fixedIds.includes(g.id));
  const fixedSlots = new Set(fixedGarments.map(g => g.slotId));
  const unavailableFixed = fixedGarments.filter(g => !eligibleGarments.some(item => item.id === g.id));
  const requestedSlots = [...new Set([...selectedSlots, ...fixedSlots])];
  const requiredSlots = withCompanions(requestedSlots);
  const companionRequired = new Set(requiredSlots.map(slot => companionSlots[slot]).filter(Boolean));
  const missingSelected = requiredSlots.filter(slot => !eligibleGarments.some(g => g.slotId === slot));

  return (
    <div className="modal-backdrop">
      <section className="modal ensemble-modal">
        <header>
          <div>
            <p className="eyebrow">OUTFIT BUILDER</p>
            <h2>Complete your outfit</h2>
            <p className="muted">
              Keep the garments you have already chosen. Select the categories you want Dress’Ed to add, then compare recommendations.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        <div className="lab-controls">
          <label>
            Add a fixed garment
            <select value="" disabled={busy} onChange={(e) => { if(e.target.value) setFixedIds(current => [...current, e.target.value]); setResults(null); }}>
              <option value="">Choose a garment to keep…</option>
              {groupOutfitGarments(eligibleGarments.filter(g => !fixedSlots.has(g.slotId))).map(group => (
                <optgroup key={group.slot} label={group.label}>
                  {group.items.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Use
            <select value={useId} onChange={(e) => { setUseId(e.target.value); setResults(null); }}>
              <option value="">All garments (no use filter)</option>
              {catalogue?.uses.map((use) => (
                <option key={use.id} value={use.id}>{use.name}</option>
              ))}
            </select>
          </label>
          <label>
            Context
            <select
              value={contextId}
              onChange={(e) => { setContext(e.target.value); setResults(null); }}
            >
              {catalogue?.contexts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season
            <select value={season} onChange={(e) => { setSeason(e.target.value); setResults(null); }}>
              <option value="">Not specified</option>
              {["spring", "summer", "autumn", "winter"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={!fixedIds.length || !contextId || busy || unavailableFixed.length > 0 || missingSelected.length > 0 || requiredSlots.length < 2}
            onClick={generate}
          >
            {busy ? "Building…" : "Generate outfits"}
          </button>
        </div>
        <section className="fixed-outfit-garments" aria-label="Fixed garments">
          <h3>Garments to keep ({fixedGarments.length})</h3>
          <p className="muted">Every recommendation keeps these exact items. Remove an item to choose another from its category.</p>
          {!fixedGarments.length && <p>Choose one or more garments above to start your partial outfit.</p>}
          <ul>{groupOutfitGarments(fixedGarments).flatMap(group => group.items.map(g => <li key={g.id}><span><strong>{g.name}</strong> <small>{group.label}</small></span><button disabled={busy} aria-label={`Remove ${g.name} from fixed garments`} onClick={() => { setFixedIds(current => current.filter(id => id !== g.id)); setResults(null); }}>Remove</button></li>))}</ul>
          {unavailableFixed.length > 0 && <p className="banner">These fixed garments do not match the selected use: {unavailableFixed.map(g => g.name).join(', ')}. Change the use filter or remove them before generating.</p>}
        </section>
        <fieldset className="outfit-category-checks" disabled={busy}>
          <legend>Categories to add or keep</legend>
          <p>Tick the categories you want in the finished combination. Fixed categories are already covered; recommendations fill the others. Required companions are included automatically.</p>
          <div className="outfit-category-options">{outfitCategories.map(([slot, label]) => {
            const count = eligibleGarments.filter(g => g.slotId === slot).length;
            return <label key={slot}><input type="checkbox" checked={requiredSlots.includes(slot)} disabled={fixedSlots.has(slot) || companionRequired.has(slot)} onChange={e => { setSelectedSlots(current => e.target.checked ? [...current, slot] : current.filter(x => x !== slot)); setResults(null); }} />{label} <small>{count} available{fixedSlots.has(slot) ? " · fixed" : companionRequired.has(slot) ? " · required companion" : ""}</small></label>;
          })}</div>
        </fieldset>
        {requiredSlots.filter(slot => companionReasons[slot]).map(slot => <p className="muted" key={slot}>{companionReasons[slot]}</p>)}
        {requiredSlots.length < 2 && <p className="muted">Select at least two categories to build a combination.</p>}
        {missingSelected.length > 0 && <p className="banner">No available items for: {missingSelected.map(slot => outfitCategories.find(x => x[0] === slot)?.[1] || slot).join(", ")}. Untick these categories, change the use filter, or add an item.</p>}
        <p className="muted">Suggestions are ranked by coordination score out of 100. Confidence describes the supporting evidence separately. Equivalent descriptions are grouped, with up to three suggestions per score and two per tie or pocket square unless you fixed that item. Each recommended tie–square pair appears only once; a pair you fixed can accompany different recommendations. Shortlist variety never changes an outfit’s score.</p>
        <p className="muted">Uses are optional filters. Suggestions use your reviewed colour families and patterns; exact shade and pattern scale remain uncertain.</p>
        {results?.missingSlots?.length > 0 && <p className="banner">This combination excludes required outfit categories: {results.missingSlots.map(slot => outfitCategories.find(x => x[0] === slot)?.[1] || slot).join(", ")}. Include these before saving a complete outfit.</p>}
        {error && <p className="error banner">{error}</p>}
        {catalogue && !catalogue.garments.length && (
          <div className="empty">
            <h3>No eligible garments yet.</h3>
            <p>
              Upload a photograph, review the detected details, and confirm the garment before building an outfit. Manual entry is available when detection is uncertain.
            </p>
          </div>
        )}
        {catalogue && useId && !eligibleGarments.length && (
          <div className="empty">
            <h3>No garments marked for this use.</h3>
            <p>Edit garments in Wardrobe and select this use before generating an outfit.</p>
          </div>
        )}
        {results && (
          <p className="muted">
            Examined {results.examined} candidate paths · rejected{" "}
            {results.rejected}
          </p>
        )}
        {tiers.map(([grade, items]) => (
          <section className="ensemble-tier" key={grade}>
            <h3>
              {grade} <span>{items.length}</span>
            </h3>
            {!items.length ? (
              <p className="muted">No eligible outfits for this selection.</p>
            ) : (
              <div className="ensemble-grid">
                {items.map((candidate) => (
                  <article key={candidate.key}>
                    <CoordinationScore evaluation={candidate.evaluation} />
                    <div className="ensemble-items">
                      {candidate.garments.map((x) => (
                        <figure key={x.id}>
                          {x.imageId ? (
                            <img
                              src={`/api/images/${x.imageId}/content`}
                              alt={x.name}
                            />
                          ) : (
                            <div className="image-placeholder">No photo</div>
                          )}
                          <figcaption>
                            {x.name}
                            <small>{x.slotId}</small>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                    <OutfitPreview garments={candidate.garments} api={api} />
                    <details>
                      <summary>Why it works and what to improve</summary>
                      <EvaluationNotes evaluation={candidate.evaluation} garments={candidate.garments} />
                    </details>
                    <div className="row-actions">
                      <button disabled={!results.isComplete} title={!results.isComplete ? "Add missing required items before saving" : undefined} onClick={() => act(candidate, "save")}>
                        Save
                      </button>
                      <button onClick={() => act(candidate, "favourite")}>
                        Favourite
                      </button>
                      <button
                        className="danger"
                        onClick={() => act(candidate, "ban")}
                      >
                        Never show again
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
        {catalogue?.saved?.length > 0 && (
          <section className="saved-strip">
            <h3>Saved outfits</h3>
            {catalogue.saved.map((x) => (
              <article key={x.id}>
                <strong>{x.name}</strong>
                <span>
                  {x.score}/100 ·{" "}
                  {x.contextName}
                </span>
                <OutfitPreview garments={x.items} api={api} />
              </article>
            ))}
          </section>
        )}
      </section>
    </div>
  );
}
function Planner({ close, initialOutfit }) {
  const [catalogue, setCatalogue] = useState(null),
    [form, setForm] = useState({
      name: initialOutfit?.name || "Work rotation",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + (initialOutfit ? 0 : 6 * 86400000)).toISOString().slice(0, 10),
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      contextId: initialOutfit?.contextId || "",
      policyId: "",
      fixedGarmentIds: initialOutfit?.garmentIds || [],
      excludedGarmentIds: [],
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [movingEntryId, setMovingEntryId] = useState(null),
    [moveDates, setMoveDates] = useState({});
  const load = useCallback(async () => {
    try {
      const value = await api("/api/planner/catalogue");
      setCatalogue(value);
      setForm((current) => ({
        ...current,
        contextId: current.contextId || value.contexts[0]?.id || "",
        policyId: current.policyId || value.policies[0]?.id || "",
      }));
    } catch (cause) {
      setError(cause.message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key, id) =>
    change(
      key,
      form[key].includes(id)
        ? form[key].filter((value) => value !== id)
        : [...form[key], id],
    );
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/planner/generate", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await load();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (id, value) => {
    try {
      await api(`/api/planner/entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(value),
      });
      await load();
    } catch (cause) {
      setError(cause.message);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal planner-modal">
        <header>
          <div>
            <p className="eyebrow">CALENDAR & ROTATION</p>
            <h2>Outfit planner</h2>
            <p className="muted">
              Build a transparent rotation from saved outfits. A plan is not a
              wear record.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        {initialOutfit && <p className="banner">“{initialOutfit.name}” is saved. Its garments are fixed below. Choose a date and generate the plan to schedule a saved outfit containing these pieces. Nothing is scheduled until you do.</p>}
        <div className="planner-form">
          <label>
            Plan name
            <input
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label>
            Start
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => change("startDate", e.target.value)}
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => change("endDate", e.target.value)}
            />
          </label>
          <label>
            Context
            <select
              value={form.contextId}
              onChange={(e) => change("contextId", e.target.value)}
            >
              {catalogue?.contexts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rotation policy
            <select
              value={form.policyId}
              onChange={(e) => change("policyId", e.target.value)}
            >
              {catalogue?.policies.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Days</legend>
          <div className="checks">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (name, index) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={form.weekdays.includes(index)}
                    onChange={() => toggle("weekdays", index)}
                  />
                  {name}
                </label>
              ),
            )}
          </div>
        </fieldset>
        <div className="planner-constraints">
          <section>
            <h3>Fixed garments</h3>
            {catalogue?.outfits
              .flatMap((x) => x.garments)
              .filter(
                (x, index, all) =>
                  all.findIndex((item) => item.id === x.id) === index,
              )
              .map((x) => (
                <label key={x.id}>
                  <input
                    type="checkbox"
                    checked={form.fixedGarmentIds.includes(x.id)}
                    onChange={() => toggle("fixedGarmentIds", x.id)}
                  />
                  {x.name}
                </label>
              ))}
          </section>
          <section>
            <h3>Excluded garments</h3>
            {catalogue?.outfits
              .flatMap((x) => x.garments)
              .filter(
                (x, index, all) =>
                  all.findIndex((item) => item.id === x.id) === index,
              )
              .map((x) => (
                <label key={x.id}>
                  <input
                    type="checkbox"
                    checked={form.excludedGarmentIds.includes(x.id)}
                    onChange={() => toggle("excludedGarmentIds", x.id)}
                  />
                  {x.name}
                </label>
              ))}
          </section>
        </div>
        <button
          className="primary"
          disabled={
            busy ||
            !form.name ||
            !form.contextId ||
            !form.policyId ||
            !form.weekdays.length
          }
          onClick={generate}
        >
          {busy ? "Optimising…" : "Generate and save plan"}
        </button>
        {error && <p className="error banner">{error}</p>}
        <section className="plans">
          <h3>Plans</h3>
          {!catalogue?.plans.length ? (
            <p className="muted">
              No plans yet. Save at least one outfit in this context, then
              generate a rotation.
            </p>
          ) : (
            catalogue.plans.map((plan) => (
              <article key={plan.id}>
                <header>
                  <div>
                    <strong>{plan.name}</strong>
                    <small>
                      {plan.startDate} – {plan.endDate} · {plan.contextName}
                    </small>
                  </div>
                  <span>{plan.entryCount} days</span>
                </header>
                <div className="plan-days">
                  {plan.entries.map((entry) => (
                    <div key={entry.id} className={entry.status}>
                      <time>{String(entry.date).slice(0, 10)}</time>
                      <strong>{entry.outfitName}</strong>
                      <span>
                        {entry.grade} · rotation{" "}
                        {Math.round(Number(entry.rotationScore))}
                      </span>
                      <small>{entry.explanations?.[0]}</small>
                      <div className="row-actions">
                        <button
                          onClick={() =>
                            update(entry.id, {
                              status:
                                entry.status === "skipped"
                                  ? "planned"
                                  : "skipped",
                            })
                          }
                        >
                          {entry.status === "skipped" ? "Restore" : "Skip"}
                        </button>
                        {movingEntryId === entry.id ? (
                          <>
                            <input
                              className="plan-move-date"
                              aria-label={`New date for ${entry.outfitName}`}
                              type="date"
                              value={
                                moveDates[entry.id] ??
                                String(entry.date).slice(0, 10)
                              }
                              onChange={(event) =>
                                setMoveDates((current) => ({
                                  ...current,
                                  [entry.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              onClick={() => {
                                const plannedDate =
                                  moveDates[entry.id] ??
                                  String(entry.date).slice(0, 10);
                                void update(entry.id, { plannedDate });
                                setMovingEntryId(null);
                              }}
                            >
                              Save date
                            </button>
                            <button onClick={() => setMovingEntryId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setMoveDates((current) => ({
                                ...current,
                                [entry.id]: String(entry.date).slice(0, 10),
                              }));
                              setMovingEntryId(entry.id);
                            }}
                          >
                            Move
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </div>
  );
}
function Lifecycle({ close }) {
  const [data, setData] = useState(null),
    [form, setForm] = useState({
      garmentId: "",
      type: "cleaning",
      severity: "minor",
      title: "",
      details: "",
      provider: "",
      openedDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      costMinor: null,
      currency: null,
      blocksAvailability: true,
    }),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const value = await api("/api/lifecycle");
      setData(value);
      setForm((current) => ({
        ...current,
        garmentId: current.garmentId || value.garments[0]?.id || "",
      }));
    } catch (cause) {
      setError(cause.message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/lifecycle/cases", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          details: form.details || null,
          provider: form.provider || null,
          dueDate: form.dueDate || null,
        }),
      });
      change("title", "");
      await load();
    } catch (cause) {
      setError(cause.message);
    }
  };
  const resolve = async (id) => {
    try {
      await api(`/api/lifecycle/cases/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolvedDate: new Date().toISOString().slice(0, 10),
        }),
      });
      await load();
    } catch (cause) {
      setError(cause.message);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal lifecycle-modal">
        <header>
          <div>
            <p className="eyebrow">WEAR & GARMENT CARE</p>
            <h2>Lifecycle</h2>
            <p className="muted">
              Wear is reconstructed from immutable events. Open blocking care
              automatically removes a garment from outfit generation.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        {error && <p className="error banner">{error}</p>}
        <section className="lifecycle-stats">
          {data?.garments.map((x) => (
            <article key={x.id}>
              <strong>{x.name}</strong>
              <span>
                {x.wearCount} wear{x.wearCount === 1 ? "" : "s"}
              </span>
              <small>
                {x.costPerWear == null
                  ? "Cost per wear unavailable"
                  : `${x.currency || ""} ${x.costPerWear.toFixed(2)} per wear`}
              </small>
              <em className={x.careBlocked ? "bad" : ""}>
                {x.careBlocked ? "Unavailable · care" : "Available"}
              </em>
            </article>
          ))}
        </section>
        <form className="care-form" onSubmit={submit}>
          <h3>Open a care case</h3>
          <label>
            Garment
            <select
              value={form.garmentId}
              onChange={(e) => change("garmentId", e.target.value)}
            >
              {data?.garments.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select
              value={form.type}
              onChange={(e) => change("type", e.target.value)}
            >
              {["cleaning", "repair", "alteration", "stain"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              value={form.severity}
              onChange={(e) => change("severity", e.target.value)}
            >
              {["minor", "moderate", "severe"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(e) => change("title", e.target.value)}
            />
          </label>
          <label>
            Opened
            <input
              type="date"
              value={form.openedDate}
              onChange={(e) => change("openedDate", e.target.value)}
            />
          </label>
          <label>
            Due
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => change("dueDate", e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.blocksAvailability}
              onChange={(e) => change("blocksAvailability", e.target.checked)}
            />
            Unavailable until resolved
          </label>
          <button className="primary">Open case</button>
        </form>
        <section className="care-cases">
          <h3>Care history</h3>
          {data?.cases.map((x) => (
            <article key={x.id}>
              <div>
                <strong>
                  {x.garment_name} · {x.title}
                </strong>
                <span>
                  {x.type} · {x.severity} · opened{" "}
                  {String(x.opened_date).slice(0, 10)}
                </span>
              </div>
              <em>{x.status}</em>
              {x.status === "open" && (
                <button onClick={() => resolve(x.id)}>Resolve</button>
              )}
            </article>
          ))}
        </section>
        <section className="wear-events">
          <h3>Wear history</h3>
          {data?.events.map((x) => (
            <article key={x.id}>
              <time>{String(x.worn_date).slice(0, 10)}</time>
              <strong>{x.outfit_name || "Recorded outfit"}</strong>
              <span>{x.items.map((item) => item.name).join(" · ")}</span>
            </article>
          ))}
        </section>
      </section>
    </div>
  );
}
const navigation = [
  {
    id: "home",
    label: "Home",
    description: "Overview and next actions",
    icon: "⌂",
  },
  {
    id: "wardrobe",
    label: "Wardrobe",
    description: "Garments and photographs",
    icon: "▦",
  },
  {
    id: "outfits",
    label: "Outfits",
    description: "Build and save combinations",
    icon: "◇",
  },
  {
    id: "planner",
    label: "Planner",
    description: "Plan and confirm wear",
    icon: "□",
  },
  {
    id: "care",
    label: "Care",
    description: "Cleaning, repairs and availability",
    icon: "△",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Evidence from actual use",
    icon: "◌",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Categories and photography",
    icon: "⚙",
  },
];

function ModernApp() {
  const initialView = window.location.hash.replace(/^#\/?/, "");
  const [view, setView] = useState(
    navigation.some((item) => item.id === initialView) ? initialView : "home",
  );
  const [health, setHealth] = useState(null);
  const [application, setApplication] = useState(null);
  const [categories, setCategories] = useState([]);
  const [uses, setUses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [catalogue, setCatalogue] = useState({
    items: [],
    total: 0,
    offset: 0,
  });
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [useId, setUseId] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [duplicateNotice, setDuplicateNotice] = useState("");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [calibrationDeleteTarget, setCalibrationDeleteTarget] = useState(null);
  const [calibrationDeleteBusy, setCalibrationDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        limit: "50",
        offset: String(page * 50),
      });
      if (search) query.set("search", search);
      if (categoryId) query.set("categoryId", categoryId);
      if (useId) query.set("useId", useId);
      const [
        healthData,
        applicationData,
        categoryData,
        useData,
        profileData,
        garmentData,
      ] = await Promise.all([
        api("/api/health"),
        api("/api/application"),
        api("/api/categories"),
        api("/api/garment-uses"),
        api("/api/calibration-profiles"),
        api(`/api/garments?${query}`),
      ]);
      setHealth(healthData);
      setApplication(applicationData);
      setCategories(categoryData.items);
      setUses(useData.items);
      setProfiles(profileData.items);
      setCatalogue(garmentData);
      setError("");
    } catch (cause) {
      setError(cause.message);
    }
  }, [page, search, categoryId, useId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const hash = view === "home" ? "" : `#/${view}`;
    if (window.location.hash !== hash)
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hash}`,
      );
  }, [view]);
  const groups = useMemo(
    () =>
      categories
        .filter((item) => !item.parentCategoryId)
        .map((item) => ({
          ...item,
          children: categories.filter(
            (child) => child.parentCategoryId === item.id,
          ),
        })),
    [categories],
  );
  const duplicate = async (item) => {
    if (duplicatingId) return;
    setDuplicatingId(item.id); setError(""); setDuplicateNotice("");
    try {
      const copy = await api(`/api/garments/${item.id}/duplicate`, {method:"POST",body:JSON.stringify({version:item.version})});
      await load();
      setDuplicateNotice(`Created “${copy.name}” with its own wear history, starting at zero. Photos and saved details were copied; check the name and purchase details for this physical item.`);
      setModal({type:"photos",item:copy});
    } catch(cause) { setError(cause.message); }
    finally { setDuplicatingId(null); }
  };
  const archive = (item) => setArchiveTarget(item);
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    try {
      await api(`/api/garments/${archiveTarget.id}/archive`, {
        method: "POST",
        body: JSON.stringify({ version: archiveTarget.version }),
      });
      setArchiveTarget(null);
      await load();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setArchiveBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api(`/api/garments/${deleteTarget.id}`, { method: "DELETE", body: JSON.stringify({ version: deleteTarget.version }) });
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setDeleteBusy(false);
    }
  };
  const confirmCalibrationDelete = async () => {
    if (!calibrationDeleteTarget) return;
    setCalibrationDeleteBusy(true);
    try {
      const result = await api(`/api/calibration-profiles/${calibrationDeleteTarget.id}`, { method: "DELETE" });
      setCalibrationDeleteTarget(null);
      await load();
      setError("");
      reportActionFeedback({ method: "DELETE", phase: "success", message: result.retainedForExistingPhotos
        ? "Colour card removed from future use. Existing photograph measurements remain reproducible."
        : "Colour card permanently deleted." });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setCalibrationDeleteBusy(false);
    }
  };
  const photoIntake = () => setModal({ type: "garment" });
  const healthy = ["ok", "healthy"].includes(health?.status);
  const status = (
    <StatusBadge tone={error ? "danger" : healthy ? "success" : "warning"}>
      {error ? "Needs attention" : health?.status || "Connecting"}
    </StatusBadge>
  );
  const heading = {
    home: ["Home", "Your wardrobe at a glance and the next useful actions."],
    wardrobe: [
      "Wardrobe",
      "Find, review and update every garment in your wardrobe.",
    ],
    outfits: [
      "Outfits",
      "Create combinations from garments that are available now.",
    ],
    planner: [
      "Planner",
      "Plan what to wear and confirm what was actually worn.",
    ],
    care: ["Care", "Keep cleaning, repairs and garment availability accurate."],
    insights: [
      "Insights",
      "Use your wardrobe and wear history to see what is useful and what needs attention.",
    ],
    settings: [
      "Settings",
      "Manage garment categories and retained photography records.",
    ],
  }[view];
  const wardrobeTable = (
    <Panel className="dressed-catalogue">
      {!catalogue.items.length ? (
        <EmptyState
          title="No garments found"
          description={
            search || categoryId
              ? "Change the search or category filter."
              : "Add a garment manually or begin with its photographs."
          }
          action={
            !search &&
            !categoryId && (
              <Button
                variant="primary"
                onClick={() => setModal({ type: "garment" })}
              >
                Add first garment
              </Button>
            )
          }
        />
      ) : (
        <div className="ts-table-wrap">
          <table className="ts-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Garment</th>
                <th>Category</th>
                <th>Formality</th>
                <th>Season</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.items.map((item, index) => (
                <React.Fragment key={item.id}>
                <tr aria-expanded={modal?.type === "garment" && modal.item?.id === item.id}>
                  <td>{catalogue.offset + index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <small>
                      {[item.brand, item.productName]
                        .filter(Boolean)
                        .join(" · ") || "No brand details"}
                    </small>
                  </td>
                  <td>{item.categoryName}</td>
                  <td>{item.formality ?? "—"}</td>
                  <td>{item.seasons.join(", ") || "—"}</td>
                  <td>{item.uses.map((use) => use.name).join(", ") || "Not assigned"}</td>
                  <td>
                    <StatusBadge
                      tone={item.status === "active" ? "success" : "neutral"}
                    >
                      {item.status}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="row-actions">
<Button
                        disabled={Boolean(modal?.type === "garment" && modal.item)}
                        onClick={() => setModal({ type: "garment", item })}
                      >
                        Edit
                      </Button>
                      <Button disabled={!!duplicatingId || !!modal} onClick={() => duplicate(item)} title="Create a separate identical item with its own wear history">
                        {duplicatingId === item.id ? "Duplicating…" : "Duplicate"}
                      </Button>
                      <Button variant="danger" onClick={() => archive(item)}>
                        Archive
                      </Button>
                      <Button variant="danger" onClick={() => setDeleteTarget(item)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
                {view === "wardrobe" && modal?.type === "garment" && modal.item?.id === item.id && (
                  <tr className="garment-editor-row">
                    <td colSpan={8}>
                      <PhotoIntake inline garment={modal.item} categories={categories} uses={uses} api={api} close={() => { setModal(null); void load(); }} saved={load} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {catalogue.total > 50 && (
        <div className="pagination">
          <Button disabled={!page} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page + 1} of {Math.ceil(catalogue.total / 50)}
          </span>
          <Button
            disabled={(page + 1) * 50 >= catalogue.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Panel>
  );
  const goBack = () => {
    if (view !== "home") setView("home");
    else if (history.length > 1) history.back();
  };
  return (
    <AppShell
      brand="Dress’Ed"
      context="Personal wardrobe"
      navigation={navigation}
      active={view}
      onNavigate={setView}
      onBack={goBack}
      onLauncher={() => window.electronAPI?.returnToLauncher?.() ?? window.close()}
    >
      <ConfirmationDialog
        open={Boolean(archiveTarget)}
        title="Archive this garment?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” will leave the active wardrobe.`
            : ""
        }
        consequence="Its photographs, wear history and care records will be kept."
        confirmLabel="Archive garment"
        destructive
        busy={archiveBusy}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Permanently delete this garment?"
        description={deleteTarget ? `“${deleteTarget.name}” will be removed from Dress’Ed.` : ""}
        consequence="Its photographs and any outfits, plans, wear records or care records that depend on it will also be permanently deleted. This cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <PageHeader
        eyebrow="Personal wardrobe"
        title={heading[0]}
        description={heading[1]}
        status={status}
        actions={
          view === "wardrobe" && (
            <Button
              variant="primary"
              onClick={() => setModal({ type: "garment" })}
            >
              Add garment
            </Button>
          )
        }
      />
      {error && (
        <div className="ts-feedback ts-feedback--error">
          <strong>Dress’Ed could not refresh this view.</strong>
          <div>Your work has not been discarded. {error}</div>
        </div>
      )}
      {view === "home" && (
        <>
          <section className="dressed-metrics">
            <Metric
              label="Active garments"
              value={catalogue.total}
              context="Available in your wardrobe"
            />
            <Metric
              label="Categories"
              value={categories.length}
              context="Used to organise garments"
            />
            <Metric
              label="Photo intake"
              value="Card-free"
              context="Upload, detect and review"
            />
            <Metric
              label="System"
              value={healthy ? "Ready" : "Checking"}
              tone={healthy ? "success" : "warning"}
            />
          </section>
          <Panel
            title="Continue working"
            description="Start with the task you intend to complete."
          >
            <div className="dressed-task-grid">
              <button onClick={photoIntake}>
                <strong>Add garment</strong>
                <span>
                  Add photos and all garment details in one place.
                </span>
              </button>
              <button onClick={() => setModal({ type: "ensemble" })}>
                <strong>Build an outfit</strong>
                <span>
                  Keep your chosen garments and get recommendations to complete the outfit.
                </span>
              </button>
              <button onClick={() => setModal({ type: "planner" })}>
                <strong>Plan what to wear</strong>
                <span>Create a rotation from outfits you have saved.</span>
              </button>
              <button onClick={() => setModal({ type: "wear" })}>
                <strong>Confirm a wear</strong>
                <span>Record what was actually worn, not merely planned.</span>
              </button>
            </div>
          </Panel>
          <Panel
            title="Recently added"
            description="The first garments in the current wardrobe view."
          >
            {catalogue.items.length ? (
              <div className="dressed-recent">
                {catalogue.items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView("wardrobe");
                      setModal({ type: "garment", item });
                    }}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.categoryName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Your wardrobe is empty"
                description="Add the first garment to begin creating outfits and building your wear history."
                action={
                  <Button variant="primary" onClick={photoIntake}>
                    Add garment
                  </Button>
                }
              />
            )}
          </Panel>
        </>
      )}
      {view === "wardrobe" && (
        <>
          <Toolbar
            search={
              <input
                aria-label="Search wardrobe"
                disabled={Boolean(modal?.type === "garment" && modal.item)}
                placeholder="Search garments"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            }
            filters={<>
              <select
                aria-label="Filter by category"
                disabled={Boolean(modal?.type === "garment" && modal.item)}
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All categories</option>
                {groups.map((group) =>
                  group.children.length ? (
                    <optgroup key={group.id} label={group.name}>
                      {group.children.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ),
                )}
              </select>
              <select aria-label="Filter by use" disabled={Boolean(modal?.type === "garment" && modal.item)} value={useId} onChange={(event) => { setUseId(event.target.value); setPage(0); }}>
                <option value="">All uses</option>
                {uses.map((use) => <option key={use.id} value={use.id}>{use.name}</option>)}
              </select>
            </>}
            
          />
          {wardrobeTable}
        </>
      )}
      {view === "outfits" && (
        <>
        <Panel
          title="Outfit workspace"
          description="Dress’Ed proposes combinations; you decide what becomes part of your wardrobe record."
        >
          <div className="dressed-actions">
            <Button
              variant="primary"
              onClick={() => setModal({ type: "ensemble" })}
            >
              Build an outfit
            </Button>
            <Button onClick={() => setModal({ type: "styling" })}>
              Evaluate a combination
            </Button>
          </div>
        </Panel>
        <SavedOutfits refreshKey={modal} edit={initialOutfit=>setModal({type:"styling",initialOutfit})} plan={initialOutfit=>setModal({type:"planner",initialOutfit})}/>
        </>
      )}
      {view === "planner" && (
        <>
          <Panel
            title="Plan a rotation"
            description="Use saved outfits to create a practical plan without changing wear history."
          >
            <Button
              variant="primary"
              onClick={() => setModal({ type: "planner" })}
            >
              Open planner
            </Button>
          </Panel>
          <Panel
            title="Confirm actual wear"
            description="A plan counts as worn only after you confirm it."
          >
            <Button onClick={() => setModal({ type: "wear" })}>
              Review planned outfits
            </Button>
          </Panel>
        </>
      )}
      {view === "care" && (
        <Panel
          title="Garment care and availability"
          description="Open and resolve cleaning, repair, alteration and stain cases."
        >
          <Button
            variant="primary"
            onClick={() => setModal({ type: "lifecycle" })}
          >
            Open care workspace
          </Button>
        </Panel>
      )}
      {view === "insights" && (
        <Panel
          title="Evidence-based wardrobe insights"
          description="See what you wear, what combines well, what is being overlooked and what needs care. Dress’Ed recommends; you decide."
        >
          <Button
            variant="primary"
            onClick={() => setModal({ type: "insights" })}
          >
            Review insights
          </Button>
        </Panel>
      )}
      {view === "settings" && (
        <>
          <PersonalColouring api={api} />
          <Panel
            title="Categories"
            description="Control how garments are organised."
          >
            <Button onClick={() => setModal({ type: "category" })}>
              Add category
            </Button>
          </Panel>
          <Panel
            title="Card-free photography"
            description="Upload an ordinary photograph, adjust the garment area, then review and correct its details. No colour card is required. Older calibration records are retained for historical photographs."
          >
            {profiles.length ? (
              <div className="calibration-summary" role="status">
                <StatusBadge tone="success">Ready</StatusBadge>
                <div className="calibration-profile-list">
                  <strong>{profiles.length === 1 ? "1 colour card is available" : `${profiles.length} colour cards are available`}</strong>
                  {profiles.map((profile) => <article key={profile.id}>
                    <div><b>{profile.name}</b><p>{profile.readyForPhotos ? `${profile.patches?.length || 0} patches retained for historical photographs` : "Needs attention before use"}</p></div>
                    <div className="source-actions">

                      <Button variant="danger" onClick={() => setCalibrationDeleteTarget(profile)}>Delete</Button>
                    </div>
                  </article>)}
                </div>
              </div>
            ) : (
              <div className="calibration-summary calibration-summary--empty">
                <StatusBadge tone="warning">Not set up</StatusBadge>
                <div><strong>No colour card required</strong><p>Start in Wardrobe → Add garment. You can also complete details manually.</p></div>
              </div>
            )}

          </Panel>
          <Panel
            title="Styling rules"
            description="See why garments work well together and where a combination may need attention."
          >
            <Button onClick={() => setModal({ type: "styling" })}>
              Check an outfit
            </Button>
          </Panel>
          <Panel
            title="Application status"
            description="Technical information for checking that Dress’Ed is running correctly."
            actions={
              <StatusBadge tone={healthy ? "success" : "warning"}>
                {health?.status || "Checking"}
              </StatusBadge>
            }
          >
            {application ? (
              <div className="application-status">
                <dl>
                  <div>
                    <dt>Application</dt>
                    <dd>{application.name}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{health?.version || "Not reported"}</dd>
                  </div>
                  <div>
                    <dt>Database</dt>
                    <dd>{health?.database || "Checking"}</dd>
                  </div>
                  <div>
                    <dt>Observed</dt>
                    <dd>
                      {health?.observedAt
                        ? new Date(health.observedAt).toLocaleString()
                        : "Not available"}
                    </dd>
                  </div>
                </dl>
                <details>
                  <summary>
                    {application.operationalFeatures.length} enabled
                    capabilities
                  </summary>
                  <ul>
                    {application.operationalFeatures.map((feature) => (
                      <li key={feature}>{feature.replaceAll("-", " ")}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ) : (
              <EmptyState
                title="Application information unavailable"
                description="Restart Dress’Ed from the launcher and check again."
              />
            )}
          </Panel>
        </>
      )}

      {modal?.type === "category" && (
        <CategoryForm
          categories={categories}
          close={() => setModal(null)}
          saved={async () => {
            setModal(null);
            await load();
          }}
        />
      )}{" "}
      {modal?.type === "calibration" && (
        <CalibrationForm
          close={() => setModal(null)}
          saved={async () => {
            setModal(null);
            await load();
          }}
        />
      )}{" "}
      <ConfirmationDialog
        open={Boolean(calibrationDeleteTarget)}
        title="Delete this colour card?"
        description={calibrationDeleteTarget ? `“${calibrationDeleteTarget.name}” will no longer be available for new garment photographs.` : ""}
        consequence="If existing photographs use this card, its measurements will be retained privately so their colour results remain reproducible. Otherwise it will be permanently deleted."
        confirmLabel="Delete colour card"
        busy={calibrationDeleteBusy}
        onConfirm={confirmCalibrationDelete}
        onCancel={() => setCalibrationDeleteTarget(null)}
      />
      {(modal?.type === "photos" || (modal?.type === "garment" && !(view === "wardrobe" && modal.item))) && (
        <PhotoIntake key={modal.item?.id || "new"} garment={modal.item} categories={categories} uses={uses} api={api} close={() => { setModal(null); void load(); }} saved={load} />
      )}{" "}
      {duplicateNotice && <p className="banner" role="status">{duplicateNotice}</p>}
      {modal?.type === "styling" && (
        <StylingLab key={modal.initialOutfit?.id || "new"} initialOutfit={modal.initialOutfit} garments={catalogue.items} close={() => setModal(null)} openPlanner={initialOutfit => setModal({type:"planner", initialOutfit})} openSaved={() => {setModal(null);setView("outfits");}} />
      )}{" "}
      {modal?.type === "ensemble" && (
        <OutfitBuilder close={() => setModal(null)} />
      )}{" "}
      {modal?.type === "planner" && <Planner close={() => setModal(null)} initialOutfit={modal.initialOutfit} />}{" "}
      {modal?.type === "wear" && (
        <WearConfirmation close={() => setModal(null)} />
      )}{" "}
      {modal?.type === "lifecycle" && (
        <Lifecycle close={() => setModal(null)} />
      )}{" "}
      {modal?.type === "insights" && <Insights close={() => setModal(null)} onNavigate={(target) => { setModal(null); setView(target); window.location.hash = `/${target}`; }} />}
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ActionFeedbackHost />
    <ColouringProvider api={api}><ModernApp /></ColouringProvider>
  </React.StrictMode>,
);
