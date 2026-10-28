import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { InputPanel } from "./InputPanel.jsx";
import { PreviewPanel } from "./PreviewPanel.jsx";
import { Records } from "./Records.jsx";

function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="status-banner status-error" role="alert">
      <strong>
        {error.status ? `HTTP ${error.status} · ` : ""}
        {error.code}
      </strong>
      <span>{error.message}</span>
      {error.details?.length > 0 && (
        <ul>
          {error.details.slice(0, 6).map((d, i) => (
            <li key={i}>
              <code>{d.path || "(root)"}</code> {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Workspace({ feature, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([api.list("profiles", { limit: 50 }), api.list(feature.key, { limit: 20 })]);
      setProfiles(p.items);
      setRecords(r.items);
    } catch (e) {
      setError(e);
    }
  }, [feature.key]);

  useEffect(() => {
    setPreview(null);
    setSaved(null);
    setError(null);
    refresh();
  }, [refresh]);

  async function extract(input) {
    setBusy(true);
    setError(null);
    setSaved(null);
    setPreview(null);
    try {
      setPreview(await api.extract(feature.key, input));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function save({ data, update }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.confirm(feature.key, { draft_id: preview.draft_id, data, ...(update ? { mode: "update", target_id: update } : {}) });
      setSaved(res);
      setPreview(null);
      refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await api.remove(feature.key, id);
      refresh();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="workspace" style={{ "--volume": feature.color }}>
      <header className="workspace-head">
        <div>
          <p className="eyebrow">Volume {feature.roman} · {feature.label}</p>
          <h2>{feature.title}</h2>
          <p className="deck">{feature.note}</p>
        </div>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Return to shelf">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
      </header>

      <div className="workspace-grid">
        <div className="col">
          <InputPanel feature={feature} profiles={profiles} busy={busy} onSubmit={extract} />
          <Records feature={feature} items={records} onDelete={remove} />
        </div>
        <div className="col">
          <ErrorBox error={error} />
          {saved && (
            <section className="panel saved-panel" aria-live="polite">
              <p className="eyebrow">Step 3 · Database updated</p>
              <div className="status-banner status-valid">
                <strong>Record {saved.operation}</strong>
                <span>
                  Table <code>{saved.table}</code> · id <code>{saved.record.id.slice(0, 8)}…</code> · version {saved.record.version}
                  {saved.record.ai?.edited_by_user ? " · includes your edits" : ""}
                </span>
              </div>
            </section>
          )}
          {preview ? (
            <PreviewPanel result={preview} busy={busy} onSave={save} />
          ) : (
            !saved && !error && (
              <section className="panel empty">
                <p className="eyebrow">Step 2 · Preview</p>
                <p className="hint">{busy ? "The AI is reading your input and checking it against the schema…" : "The structured, validated result appears here before anything is saved."}</p>
              </section>
            )
          )}
        </div>
      </div>
    </div>
  );
}
