import { useEffect, useState } from "react";
import { DataView } from "./DataView.jsx";

const STATUS_TEXT = {
  valid: "Valid — all required fields found",
  valid_with_warnings: "Valid, with warnings to review",
  incomplete: "Incomplete — required fields are missing",
};

function MatchSummary({ c }) {
  if (!c) return null;
  return (
    <div className="match">
      <div className="match-score">
        <strong>{c.match_score ?? "—"}</strong>
        <span>{c.verdict.replace(/_/g, " ")}</span>
      </div>
      <dl className="match-grid">
        <div><dt>Required matched</dt><dd>{c.matched_required.join(", ") || "—"}</dd></div>
        <div><dt>Required missing</dt><dd>{c.missing_required.join(", ") || "—"}</dd></div>
        <div><dt>Preferred matched</dt><dd>{c.matched_preferred.join(", ") || "—"}</dd></div>
        <div><dt>Preferred missing</dt><dd>{c.missing_preferred.join(", ") || "—"}</dd></div>
      </dl>
      <p className="hint">Score is computed by the server from the extracted requirements — not guessed by the AI.</p>
    </div>
  );
}

export function PreviewPanel({ result, busy, onSave }) {
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [asUpdate, setAsUpdate] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setJsonText(JSON.stringify(result.preview, null, 2));
    setEditing(false);
    setJsonError("");
    setAsUpdate(Boolean(result.existing_match));
  }, [result]);

  const v = result.validation;
  let parsed = result.preview;
  if (editing) {
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = null;
    }
  }

  function requestSave() {
    if (!parsed) return setJsonError("The edited JSON is not valid — fix it before saving.");
    setJsonError("");
    setConfirming(true);
  }

  return (
    <section className="panel preview-panel">
      <p className="eyebrow">Step 2 · Preview &amp; validation · not saved yet</p>

      <div className={`status-banner status-${v.status}`}>
        <strong>{STATUS_TEXT[v.status]}</strong>
        {v.missing_required.length > 0 && <span>Fill in: {v.missing_required.join(", ")}</span>}
      </div>

      <dl className="meta-strip">
        <div><dt>Source</dt><dd>{result.source.type}{result.source.file_name ? ` · ${result.source.file_name}` : ""}{result.source.extraction === "ocr" ? " · read with OCR" : ""} · {result.source.chars} chars</dd></div>
        <div><dt>Model</dt><dd>{result.ai.model} · {result.ai.attempts} attempt{result.ai.attempts > 1 ? "s" : ""}</dd></div>
        <div><dt>Privacy</dt><dd>{result.privacy.redacted_emails + result.privacy.redacted_phones + result.privacy.redacted_links} contact detail(s) redacted before AI</dd></div>
        <div><dt>Not found</dt><dd>{v.missing_fields.length ? v.missing_fields.join(", ") : "—"}</dd></div>
      </dl>

      {result.source.extraction === "ocr" && (
        <p className="hint">This file had no selectable text, so it was read with OCR. Check names, numbers and dates before saving.</p>
      )}

      {v.warnings.length > 0 && (
        <ul className="warnings">
          {v.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {result.source.preview_text && (
        <details className="transcript">
          <summary>Audio transcript (redacted)</summary>
          <p>{result.source.preview_text}</p>
        </details>
      )}

      <MatchSummary c={result.extras?.comparison} />

      <div className="view-toggle">
        <button type="button" className={`link-btn${!editing ? " is-active" : ""}`} onClick={() => setEditing(false)}>Structured view</button>
        <button type="button" className={`link-btn${editing ? " is-active" : ""}`} onClick={() => setEditing(true)}>Edit JSON</button>
      </div>

      {editing ? (
        <textarea className="json-editor" rows={18} spellCheck={false} value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
      ) : (
        <DataView data={result.preview} missingRequired={v.missing_required} />
      )}

      {jsonError && <p className="error-line">{jsonError}</p>}

      <div className="save-row">
        {result.existing_match && (
          <label className="check">
            <input type="checkbox" checked={asUpdate} onChange={(e) => setAsUpdate(e.target.checked)} />
            Update existing profile “{result.existing_match.full_name}” (v{result.existing_match.version})
          </label>
        )}
        <button type="button" className="primary-btn" onClick={requestSave} disabled={busy}>
          {asUpdate ? "Review update" : "Review & save"}
        </button>
      </div>

      {confirming && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setConfirming(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Confirm database write</p>
            <h3 id="confirm-title">{asUpdate ? "Update the existing record?" : "Create a new record?"}</h3>
            <ul className="confirm-list">
              <li>Operation: <strong>{asUpdate ? `UPDATE (version ${result.existing_match.version} → ${result.existing_match.version + 1})` : "CREATE"}</strong></li>
              <li>Validation: {v.status.replace(/_/g, " ")}</li>
              <li>{editing && jsonText !== JSON.stringify(result.preview, null, 2) ? "Includes your manual edits (re-validated on save)" : "Data exactly as extracted"}</li>
              <li>Contact details are stored masked only.</li>
            </ul>
            <div className="dialog-actions">
              <button type="button" className="text-btn" onClick={() => setConfirming(false)}>Cancel</button>
              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onSave({ data: parsed, update: asUpdate ? result.existing_match.id : null });
                }}
              >
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
