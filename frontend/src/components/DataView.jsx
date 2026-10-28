// Generic read-only renderer for any extracted record: scalars as a definition list,
// string lists as chips, object lists as compact cards. Missing values are shown, never hidden.

const humanize = (k) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const HIDDEN = new Set(["missing_fields"]);

function Scalar({ value, missing }) {
  if (value === null || value === undefined || value === "") {
    return <span className={`dv-missing${missing ? " is-required" : ""}`}>{missing ? "missing — required" : "not found"}</span>;
  }
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  return <span>{String(value)}</span>;
}

function ObjectCard({ item }) {
  const entries = Object.entries(item);
  const [headKey, head] = entries.find(([, v]) => typeof v === "string" && v) || [];
  return (
    <div className="dv-card">
      {head && <strong className="dv-card-title">{head}</strong>}
      <dl className="dv-card-meta">
        {entries
          .filter(([k]) => k !== headKey)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{humanize(k)}</dt>
              <dd>{Array.isArray(v) ? (v.length ? v.join(" · ") : <span className="dv-missing">none</span>) : <Scalar value={v} />}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

export function DataView({ data, missingRequired = [] }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([k]) => !HIDDEN.has(k));
  const scalars = entries.filter(([, v]) => !Array.isArray(v));
  const lists = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div className="dataview">
      <dl className="dv-scalars">
        {scalars.map(([k, v]) => (
          <div key={k} className={missingRequired.includes(k) ? "is-flagged" : ""}>
            <dt>{humanize(k)}</dt>
            <dd>
              <Scalar value={v} missing={missingRequired.includes(k)} />
            </dd>
          </div>
        ))}
      </dl>

      {lists.map(([k, v]) => (
        <section key={k} className={`dv-list${missingRequired.includes(k) ? " is-flagged" : ""}`}>
          <h4>
            {humanize(k)} <span className="dv-count">{v.length}</span>
          </h4>
          {v.length === 0 ? (
            <Scalar value={null} missing={missingRequired.includes(k)} />
          ) : typeof v[0] === "object" ? (
            <div className="dv-cards">
              {v.map((item, i) => (
                <ObjectCard key={i} item={item} />
              ))}
            </div>
          ) : (
            <ul className="dv-chips">
              {v.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
