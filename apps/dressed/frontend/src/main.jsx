import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  AppShell,
  Button,
  ConfirmationDialog,
  EmptyState,
  Metric,
  PageHeader,
  Panel,
  StatusBadge,
  Toolbar,
  useDraft,
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
        consequence="This creates wear-history evidence and affects utilisation insights."
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
            <p className="eyebrow">DETERMINISTIC WARDROBE INSIGHTS</p>
            <h2>What your evidence says</h2>
            <p className="muted">
              Every insight below is calculated from your catalogue, saved
              outfits, wear events, and care records.
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
                      Resolve completed cases to return them to ensemble
                      generation.
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
const blank = {
  categoryId: "",
  name: "",
  brand: "",
  productName: "",
  sku: "",
  notes: "",
  formality: "",
  fit: "",
  size: "",
  materials: "",
  seasons: [],
  restrictions: "",
  condition: "",
  purchaseDate: "",
  purchasePrice: "",
  currency: "",
  source: "",
  isGift: false,
};
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
        value.error ||
        "The request could not be completed.",
    );
  return value;
}
function data(form) {
  return {
    categoryId: form.categoryId,
    name: form.name,
    brand: form.brand || null,
    productName: form.productName || null,
    sku: form.sku || null,
    notes: form.notes || null,
    formality: form.formality === "" ? null : Number(form.formality),
    fit: form.fit || null,
    size: form.size || null,
    tailoringNotes: null,
    materials: form.materials
      .split(",")
      .map((material) => material.trim())
      .filter(Boolean)
      .map((material) => ({ material, percentage: null })),
    seasons: form.seasons,
    restrictions: form.restrictions
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    acquisition: {
      condition: form.condition || null,
      purchaseDate: form.purchaseDate || null,
      purchasePriceMinor:
        form.purchasePrice === ""
          ? null
          : Math.round(Number(form.purchasePrice) * 100),
      currency: form.currency.trim().toUpperCase() || null,
      originalRetailPriceMinor: null,
      source: form.source || null,
      isGift: form.isGift,
      notes: null,
    },
  };
}
function from(item) {
  return {
    categoryId: item.categoryId,
    name: item.name,
    brand: item.brand || "",
    productName: item.productName || "",
    sku: item.sku || "",
    notes: item.notes || "",
    formality: item.formality ?? "",
    fit: item.fit || "",
    size: item.size || "",
    materials: item.materials.map((entry) => entry.material).join(", "),
    seasons: item.seasons,
    restrictions: item.restrictions.join("\n"),
    condition: item.acquisition.condition || "",
    purchaseDate: item.acquisition.purchaseDate?.slice(0, 10) || "",
    purchasePrice:
      item.acquisition.purchasePriceMinor == null
        ? ""
        : String(item.acquisition.purchasePriceMinor / 100),
    currency: item.acquisition.currency || "",
    source: item.acquisition.source || "",
    isGift: item.acquisition.isGift,
  };
}
function GarmentForm({ categories, editing, suggestion, close, saved }) {
  const selectable = categories.filter(
    (entry) =>
      entry.parentCategoryId ||
      !categories.some((child) => child.parentCategoryId === entry.id),
  );
  const draft = useDraft(
    `dressed:garment:${editing?.id || "new"}`,
    editing
      ? { ...from(editing), ...(suggestion?.values || {}) }
      : { ...blank, categoryId: selectable[0]?.id || "" },
  );
  const form = draft.value;
  const setForm = draft.setValue;
  const [error, setError] = useState("");
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    try {
      const payload = data(form);
      const result = editing
        ? await api(`/api/garments/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify({ ...payload, version: editing.version }),
          })
        : await api("/api/garments", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      if (suggestion) {
        const fields = ["category", "formality", "seasons"];
        const accepted = fields.filter((field) =>
          field === "category"
            ? result.categoryId === suggestion.values.categoryId
            : field === "formality"
              ? result.formality === suggestion.values.formality
              : JSON.stringify([...result.seasons].sort()) ===
                JSON.stringify([...(suggestion.values.seasons || [])].sort()),
        );
        await api(`/api/fingerprints/${suggestion.fingerprintId}/decision`, {
          method: "POST",
          body: JSON.stringify({
            accepted,
            rejected: fields.filter((field) => !accepted.includes(field)),
          }),
        });
      }
      draft.clear();
      saved(result);
    } catch (cause) {
      setError(cause.message);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <p className="eyebrow">GARMENT RECORD</p>
            <h2>{editing ? "Edit garment" : "Add garment"}</h2>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Category
              <select
                required
                value={form.categoryId}
                onChange={(e) => change("categoryId", e.target.value)}
              >
                <option value="">Select…</option>
                {selectable.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label>
              Brand
              <input
                value={form.brand}
                onChange={(e) => change("brand", e.target.value)}
              />
            </label>
            <label>
              Product/model
              <input
                value={form.productName}
                onChange={(e) => change("productName", e.target.value)}
              />
            </label>
            <label>
              SKU/reference
              <input
                value={form.sku}
                onChange={(e) => change("sku", e.target.value)}
              />
            </label>
            <label>
              Formality
              <select
                value={form.formality}
                onChange={(e) => change("formality", e.target.value)}
              >
                <option value="">Unspecified</option>
                {[1, 2, 3, 4, 5].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Fit
              <input
                value={form.fit}
                onChange={(e) => change("fit", e.target.value)}
              />
            </label>
            <label>
              Size
              <input
                value={form.size}
                onChange={(e) => change("size", e.target.value)}
              />
            </label>
            <label className="wide">
              Materials <small>comma separated</small>
              <input
                value={form.materials}
                onChange={(e) => change("materials", e.target.value)}
              />
            </label>
            <fieldset className="wide">
              <legend>Season suitability</legend>
              <div className="checks">
                {seasons.map((x) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      checked={form.seasons.includes(x)}
                      onChange={() =>
                        change(
                          "seasons",
                          form.seasons.includes(x)
                            ? form.seasons.filter((v) => v !== x)
                            : [...form.seasons, x],
                        )
                      }
                    />
                    {x}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Condition
              <select
                value={form.condition}
                onChange={(e) => change("condition", e.target.value)}
              >
                <option value="">Unspecified</option>
                <option value="new">New</option>
                <option value="used">Used</option>
              </select>
            </label>
            <label>
              Purchase date
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => change("purchaseDate", e.target.value)}
              />
            </label>
            <label>
              Purchase price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => change("purchasePrice", e.target.value)}
              />
            </label>
            <label>
              Currency
              <input
                maxLength="3"
                value={form.currency}
                onChange={(e) => change("currency", e.target.value)}
              />
            </label>
            <label>
              Source/store
              <input
                value={form.source}
                onChange={(e) => change("source", e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.isGift}
                onChange={(e) => change("isGift", e.target.checked)}
              />
              Gift
            </label>
            <label className="wide">
              Restrictions <small>one per line</small>
              <textarea
                value={form.restrictions}
                onChange={(e) => change("restrictions", e.target.value)}
              />
            </label>
            <label className="wide">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <small className="draft-status">
              {draft.savedAt
                ? `Draft saved ${draft.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : draft.isDirty
                  ? "Saving draft…"
                  : "Draft protection active"}
            </small>
            <button type="button" className="quiet" onClick={close}>
              Cancel
            </button>
            <button className="primary">
              {editing ? "Save changes" : "Add garment"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
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
  const [name, setName] = useState(""),
    [cardType, setCardType] = useState(""),
    [patches, setPatches] = useState(
      "White,96.5,0,0\nNeutral grey,50,0,0\nBlack,5,0,0",
    ),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const values = patches
        .split("\n")
        .map((line) => line.split(",").map((value) => value.trim()))
        .filter((row) => row.some(Boolean))
        .map(([label, l, a, b]) => ({
          label,
          labL: Number(l),
          labA: Number(a),
          labB: Number(b),
        }));
      saved(
        await api("/api/calibration-profiles", {
          method: "POST",
          body: JSON.stringify({
            name,
            cardType,
            notes: null,
            patches: values,
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
          <div>
            <p className="eyebrow">KNOWN REFERENCE VALUES</p>
            <h2>Calibration profile</h2>
          </div>
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
              placeholder="My colour card"
            />
          </label>
          <label>
            Card type
            <input
              required
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              placeholder="Manufacturer/model"
            />
          </label>
          <label>
            Reference patches <small>one per line: label,L*,a*,b*</small>
            <textarea
              required
              rows="7"
              value={patches}
              onChange={(e) => setPatches(e.target.value)}
            />
          </label>
          <p className="muted">
            Enter the published CIE Lab values supplied with your physical card.
            The sample values are placeholders and should be replaced.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary">Save profile</button>
          </div>
        </form>
      </section>
    </div>
  );
}
function PhotoManager({ garment, profiles, categories, close, review }) {
  const [images, setImages] = useState([]),
    [readiness, setReadiness] = useState({
      wholeReady: false,
      detailReady: false,
      readyForAnalysis: false,
    }),
    [fingerprint, setFingerprint] = useState(null),
    [role, setRole] = useState("whole"),
    [profile, setProfile] = useState(profiles[0]?.id || ""),
    [file, setFile] = useState(null),
    [cardVisible, setCardVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const value = await api(`/api/garments/${garment.id}/images`);
      setImages(value.items);
      setReadiness(value.readiness);
      try {
        setFingerprint(await api(`/api/garments/${garment.id}/fingerprint`));
      } catch {
        setFingerprint(null);
      }
    } catch (cause) {
      setError(cause.message);
    }
  }, [garment.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({
        role,
        calibrationProfileId: profile,
        cardVisible: String(cardVisible),
        filename: file.name,
      });
      const response = await fetch(`/api/garments/${garment.id}/images?${q}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Upload failed");
      setFile(null);
      setCardVisible(false);
      e.target.reset();
      await load();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const analyse = async () => {
    setBusy(true);
    setError("");
    try {
      setFingerprint(
        await api(`/api/garments/${garment.id}/fingerprint`, {
          method: "POST",
        }),
      );
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const useSuggestions = () => {
    const byField = Object.fromEntries(
      fingerprint.suggestions.map((x) => [x.field, x]),
    );
    const categorySlug = byField.category?.value?.[0]?.slug;
    const categoryId =
      categories.find((x) => x.slug === categorySlug)?.id ?? garment.categoryId;
    review({
      fingerprintId: fingerprint.id,
      values: {
        categoryId,
        formality: byField.formality?.value ?? garment.formality,
        seasons: byField.seasons?.value ?? garment.seasons,
      },
    });
  };
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header>
          <div>
            <p className="eyebrow">PHOTOGRAPHY & MEASUREMENTS</p>
            <h2>{garment.name}</h2>
            <p className="muted">
              Whole: {readiness.wholeReady ? "ready" : "needed"} · Detail:{" "}
              {readiness.detailReady ? "ready" : "needed"}
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        {!profiles.length ? (
          <div className="empty">
            <h3>Create a calibration profile first.</h3>
            <p>Every photograph must be tied to known reference-card values.</p>
          </div>
        ) : (
          <form onSubmit={upload} className="upload-form">
            <label>
              Image role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="whole">Whole item</option>
                <option value="detail">Close-up/detail</option>
                <option value="additional">Additional</option>
              </select>
            </label>
            <label>
              Calibration profile
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              >
                {profiles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              JPEG or PNG
              <input
                required
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="check">
              <input
                required
                type="checkbox"
                checked={cardVisible}
                onChange={(e) => setCardVisible(e.target.checked)}
              />
              The calibration card is fully visible
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Working…" : "Store and validate"}
            </button>
          </form>
        )}
        {error && <p className="error banner">{error}</p>}
        <div className="photo-grid">
          {images.map((image) => (
            <article
              key={image.id}
              className={
                image.validationStatus === "recapture_required"
                  ? "photo-bad"
                  : ""
              }
            >
              <img
                src={`/api/images/${image.id}/content`}
                alt={`${image.role} photograph of ${garment.name}`}
              />
              <div>
                <strong>{image.role}</strong>
                <span>
                  {image.width} × {image.height}
                </span>
                <span>{image.validationStatus.replaceAll("_", " ")}</span>
                {image.findings.map((finding) => (
                  <small key={finding.code}>{finding.message}</small>
                ))}
              </div>
            </article>
          ))}
        </div>
        {(readiness.wholeReady || readiness.detailReady) && (
          <div className="analysis-actions">
            <button className="primary" disabled={busy} onClick={analyse}>
              {fingerprint ? "Reanalyse photographs" : "Analyse photographs"}
            </button>
            <span>Deterministic local measurements only</span>
          </div>
        )}
        {fingerprint && (
          <section className="suggestions">
            <h3>Measured fingerprint</h3>
            <div className="palette">
              {fingerprint.measurements.combined.palette.map((x) => (
                <span
                  key={`${x.label}-${x.rgb.join("-")}`}
                  style={{ background: `rgb(${x.rgb.join(",")})` }}
                  title={`${x.label} ${Math.round(x.proportion * 100)}%`}
                />
              ))}
            </div>
            <p>
              Complexity{" "}
              {Math.round(
                fingerprint.measurements.combined.visualComplexity * 100,
              )}
              % · solid confidence{" "}
              {Math.round(
                fingerprint.measurements.combined.solidConfidence * 100,
              )}
              % · texture{" "}
              {Math.round(
                fingerprint.measurements.combined.textureStrength * 100,
              )}
              %
            </p>
            <h3>Editable suggestions</h3>
            {fingerprint.suggestions.map((x) => (
              <article key={x.field}>
                <strong>{x.field}</strong>
                <span>
                  {Math.round(Number(x.confidence) * 100)}% confidence
                </span>
                <code>{JSON.stringify(x.value)}</code>
              </article>
            ))}
            <button className="primary" onClick={useSuggestions}>
              Review suggestions in garment form
            </button>
          </section>
        )}
      </section>
    </div>
  );
}
function StylingLab({ garments, close }) {
  const [catalogue, setCatalogue] = useState(null),
    [selected, setSelected] = useState([]),
    [contextId, setContext] = useState(""),
    [season, setSeason] = useState(""),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/api/styling/catalogue")
      .then((value) => {
        setCatalogue(value);
        setContext(value.contexts[0]?.id || "");
      })
      .catch((cause) => setError(cause.message));
  }, []);
  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
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
  const groups = result
    ? [
        { name: "Hard failures", items: result.evaluation.hardFailures },
        { name: "Strengths", items: result.evaluation.strengths },
        { name: "Cautions", items: result.evaluation.cautions },
        { name: "Major penalties", items: result.evaluation.majorPenalties },
      ]
    : [];
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header>
          <div>
            <p className="eyebrow">DETERMINISTIC RULE LABORATORY</p>
            <h2>Evaluate a combination</h2>
            <p className="muted">
              This scores your selection; it does not generate or save an
              outfit.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        <div className="lab-controls">
          <label>
            Context
            <select
              value={contextId}
              onChange={(e) => setContext(e.target.value)}
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
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="">Not specified</option>
              {["spring", "summer", "autumn", "winter"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="lab-garments">
          {garments.map((x) => (
            <label key={x.id}>
              <input
                type="checkbox"
                checked={selected.includes(x.id)}
                onChange={() => toggle(x.id)}
              />
              <span>
                <strong>{x.name}</strong>
                <small>{x.categoryName}</small>
              </span>
            </label>
          ))}
        </div>
        <button
          className="primary"
          disabled={selected.length < 2 || busy}
          onClick={evaluate}
        >
          {busy ? "Evaluating…" : "Evaluate selected garments"}
        </button>
        {error && <p className="error banner">{error}</p>}
        {result && (
          <section className="lab-result">
            <div className="score">
              <strong>{result.evaluation.grade || "—"}</strong>
              <span>{result.evaluation.score}/100</span>
              <small>
                {result.evaluation.eligible ? "Eligible" : "Ineligible"} ·{" "}
                {result.ruleSet.name} v{result.ruleSet.version}
              </small>
            </div>
            {groups.map((group) => (
              <div key={group.name}>
                <h3>{group.name}</h3>
                {group.items.length ? (
                  group.items.map((x) => (
                    <article key={x.ruleId}>
                      <strong>
                        {x.scoreDelta > 0 ? `+${x.scoreDelta}` : x.scoreDelta}
                      </strong>
                      <p>{x.explanation}</p>
                      <code>{x.ruleId}</code>
                    </article>
                  ))
                ) : (
                  <p className="muted">None</p>
                )}
              </div>
            ))}
          </section>
        )}
      </section>
    </div>
  );
}
function OutfitBuilder({ close }) {
  const [catalogue, setCatalogue] = useState(null),
    [anchor, setAnchor] = useState(""),
    [contextId, setContext] = useState(""),
    [season, setSeason] = useState(""),
    [results, setResults] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const value = await api("/api/ensembles/catalogue");
      setCatalogue(value);
      setAnchor((current) => current || value.garments[0]?.id || "");
      setContext((current) => current || value.contexts[0]?.id || "");
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
            selectedGarmentId: anchor,
            contextId,
            season: season || null,
            limitPerGrade: 12,
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
        const name = names || `Outfit ${new Date().toLocaleDateString()}`;
        await api("/api/ensembles/save", {
          method: "POST",
          body: JSON.stringify({
            name,
            garmentIds: candidate.garments.map((x) => x.id),
            contextId,
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
    ? [
        ["A", results.a],
        ["B", results.b],
        ["C", results.c],
      ]
    : [];
  return (
    <div className="modal-backdrop">
      <section className="modal ensemble-modal">
        <header>
          <div>
            <p className="eyebrow">OUTFIT BUILDER</p>
            <h2>Build around one garment</h2>
            <p className="muted">
              Choose an anchor. Dress'Ed proposes and explains; you decide what
              to save, favour, or ban.
            </p>
          </div>
          <button className="quiet" onClick={close}>
            Close
          </button>
        </header>
        <div className="lab-controls">
          <label>
            Anchor garment
            <select value={anchor} onChange={(e) => setAnchor(e.target.value)}>
              {catalogue?.garments.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.slotId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Context
            <select
              value={contextId}
              onChange={(e) => setContext(e.target.value)}
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
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="">Not specified</option>
              {["spring", "summer", "autumn", "winter"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={!anchor || !contextId || busy}
            onClick={generate}
          >
            {busy ? "Building…" : "Generate outfits"}
          </button>
        </div>
        {error && <p className="error banner">{error}</p>}
        {catalogue && !catalogue.garments.length && (
          <div className="empty">
            <h3>No eligible garments yet.</h3>
            <p>
              Garments need a current visual fingerprint before they can enter
              an ensemble.
            </p>
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
              Grade {grade} <span>{items.length}</span>
            </h3>
            {!items.length ? (
              <p className="muted">No eligible outfits at this grade.</p>
            ) : (
              <div className="ensemble-grid">
                {items.map((candidate) => (
                  <article key={candidate.key}>
                    <div className="ensemble-score">
                      <strong>{candidate.evaluation.grade}</strong>
                      <span>{candidate.evaluation.score}/100</span>
                    </div>
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
                    <p>
                      {candidate.evaluation.strengths[0]?.explanation ||
                        candidate.evaluation.cautions[0]?.explanation ||
                        "Eligible under the active styling rules."}
                    </p>
                    <div className="row-actions">
                      <button onClick={() => act(candidate, "save")}>
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
                  {x.userGrade || x.calculatedGrade} · {x.score}/100 ·{" "}
                  {x.contextName}
                </span>
              </article>
            ))}
          </section>
        )}
      </section>
    </div>
  );
}
function Planner({ close }) {
  const [catalogue, setCatalogue] = useState(null),
    [form, setForm] = useState({
      name: "Work rotation",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      contextId: "",
      policyId: "",
      fixedGarmentIds: [],
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
    description: "Categories and calibration",
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
  const [profiles, setProfiles] = useState([]);
  const [catalogue, setCatalogue] = useState({
    items: [],
    total: 0,
    offset: 0,
  });
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        limit: "50",
        offset: String(page * 50),
      });
      if (search) query.set("search", search);
      if (categoryId) query.set("categoryId", categoryId);
      const [
        healthData,
        applicationData,
        categoryData,
        profileData,
        garmentData,
      ] = await Promise.all([
        api("/api/health"),
        api("/api/application"),
        api("/api/categories"),
        api("/api/calibration-profiles"),
        api(`/api/garments?${query}`),
      ]);
      setHealth(healthData);
      setApplication(applicationData);
      setCategories(categoryData.items);
      setProfiles(profileData.items);
      setCatalogue(garmentData);
      setError("");
    } catch (cause) {
      setError(cause.message);
    }
  }, [page, search, categoryId]);
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
  const archive = (item) => setArchiveTarget(item);
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    try {
      await api(`/api/garments/${archiveTarget.id}`, {
        method: "DELETE",
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
  const photoIntake = async () => {
    try {
      const uncategorised = categories.find(
        (item) => item.slug === "uncategorised",
      );
      if (!uncategorised)
        throw new Error("The intake category is unavailable.");
      const item = await api("/api/garments", {
        method: "POST",
        body: JSON.stringify(
          data({
            ...blank,
            categoryId: uncategorised.id,
            name: `New garment ${new Date().toLocaleDateString()}`,
          }),
        ),
      });
      setModal({ type: "photos", item });
      await load();
    } catch (cause) {
      setError(cause.message);
    }
  };
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
      "Find, review and maintain every garment in your catalogue.",
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
      "Use catalogue and wear evidence to understand your wardrobe.",
    ],
    settings: [
      "Settings",
      "Manage the classifications and calibration used by Dress’Ed.",
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.items.map((item, index) => (
                <tr key={item.id}>
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
                        onClick={() => setModal({ type: "photos", item })}
                      >
                        Photos
                      </Button>
                      <Button
                        onClick={() => setModal({ type: "garment", item })}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => archive(item)}>
                        Archive
                      </Button>
                    </div>
                  </td>
                </tr>
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
      onLauncher={() => window.close()}
    >
      <ConfirmationDialog
        open={Boolean(archiveTarget)}
        title="Archive this garment?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” will leave the active wardrobe.`
            : ""
        }
        consequence="Its photographs, wear history and care evidence will be retained."
        confirmLabel="Archive garment"
        destructive
        busy={archiveBusy}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
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
              context="Available in your catalogue"
            />
            <Metric
              label="Categories"
              value={categories.length}
              context="Used to organise garments"
            />
            <Metric
              label="Calibration profiles"
              value={profiles.length}
              context="Used for photo measurement"
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
                <strong>Add from photographs</strong>
                <span>
                  Create the record first, then review suggested details.
                </span>
              </button>
              <button onClick={() => setModal({ type: "ensemble" })}>
                <strong>Build an outfit</strong>
                <span>
                  Start from one garment and review eligible combinations.
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
            description="The first records in the current catalogue view."
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
                description="Add the first garment to begin creating outfits and evidence."
                action={
                  <Button variant="primary" onClick={photoIntake}>
                    Add from photographs
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
                placeholder="Search garments"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            }
            filters={
              <select
                aria-label="Filter by category"
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
            }
            actions={<Button onClick={photoIntake}>Add from photos</Button>}
          />
          {wardrobeTable}
        </>
      )}
      {view === "outfits" && (
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
          description="Review utilisation, versatility, rotation and care evidence. Dress’Ed recommends; you decide."
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
          <Panel
            title="Categories"
            description="Control how garments are organised."
          >
            <Button onClick={() => setModal({ type: "category" })}>
              Add category
            </Button>
          </Panel>
          <Panel
            title="Photo calibration"
            description="Calibration profiles make photographic measurements repeatable."
          >
            <Button onClick={() => setModal({ type: "calibration" })}>
              Manage calibration
            </Button>
          </Panel>
          <Panel
            title="Styling rules"
            description="Inspect how the current rule set evaluates a combination."
          >
            <Button onClick={() => setModal({ type: "styling" })}>
              Open rule laboratory
            </Button>
          </Panel>
          <Panel
            title="Application status"
            description="Administrative identity, version and enabled capabilities reported by the local service."
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
      {modal?.type === "garment" && (
        <GarmentForm
          categories={categories}
          editing={modal.item}
          suggestion={modal.suggestion}
          close={() => setModal(null)}
          saved={async () => {
            setModal(null);
            await load();
          }}
        />
      )}{" "}
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
      {modal?.type === "photos" && (
        <PhotoManager
          garment={modal.item}
          profiles={profiles}
          categories={categories}
          close={() => setModal(null)}
          review={(suggestion) =>
            setModal({ type: "garment", item: modal.item, suggestion })
          }
        />
      )}{" "}
      {modal?.type === "styling" && (
        <StylingLab garments={catalogue.items} close={() => setModal(null)} />
      )}{" "}
      {modal?.type === "ensemble" && (
        <OutfitBuilder close={() => setModal(null)} />
      )}{" "}
      {modal?.type === "planner" && <Planner close={() => setModal(null)} />}{" "}
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
    <ModernApp />
  </React.StrictMode>,
);
