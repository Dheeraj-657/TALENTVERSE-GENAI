import { useState } from "react";
import { DataView } from "./DataView.jsx";

const META = new Set(["id", "profile", "contact", "source", "validation", "ai", "version", "created_at", "updated_at", "comparison", "goal_text", "interests_text", "total_weeks"]);
const content = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !META.has(k)));

export function Records({ feature, items, onDelete }) {
  const [open, setOpen] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  return (
    <section className="panel records">
      <p className="eyebrow">Saved in database · {items.length}</p>
      {!items.length && <p className="hint">Nothing saved yet for this volume.</p>}
      <ul className="record-list">
        {items.map((r) => (
          <li key={r.id}>
            <div className="record-row">
              <button type="button" className="record-title" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                {feature.titleOf(r) || "(untitled)"}
              </button>
              <span className="record-meta">
                v{r.version} · {new Date(r.updated_at).toLocaleString()} · {r.validation?.status?.replace(/_/g, " ")}
              </span>
              <button type="button" className="link-btn danger" onClick={() => setPendingDelete(r)}>
                Delete
              </button>
            </div>
            {open === r.id && (
              <div className="record-body">
                {r.contact?.email_masked && <p className="hint">Contact (masked): {r.contact.email_masked}{r.contact.phone_masked ? ` · ${r.contact.phone_masked}` : ""}</p>}
                <DataView data={content(r)} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Irreversible action</p>
            <h3 id="del-title">Delete “{feature.titleOf(pendingDelete)}”?</h3>
            <p className="hint">This permanently removes the record from the database.</p>
            <div className="dialog-actions">
              <button type="button" className="text-btn" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="primary-btn danger" onClick={() => { onDelete(pendingDelete.id); setPendingDelete(null); }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
