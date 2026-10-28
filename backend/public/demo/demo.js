const API = "/api";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const SAMPLES = {
  profiles: `Arjun Mehta | arjun.m@gmail.com | +91 91234 56789
Final-year B.Tech CSE student at SRM Institute (2026). Backend intern at TechNova (Jun 2025 - Aug 2025): built REST APIs in Express and Node.js with PostgreSQL.
Projects: real-time chat app with React and Socket.io. Skills: Python, JavaScript, SQL, Git, Docker basics. Languages: English, Hindi.`,
  "learning-plans": "I know HTML, CSS and basic JavaScript. I want to become a full-stack MERN developer in 12 weeks so I can apply for internships.",
  "job-matches": "CloudKart (Bengaluru) is hiring a Junior Backend Developer. Required: Node.js, Express, SQL, REST APIs, Git. Nice to have: Docker, AWS. 0-1 years of experience. Responsibilities: build and maintain APIs, write tests, review code.",
  "project-briefs": "I love cricket and data. I know Python, pandas and a bit of React. Suggest a portfolio project that would impress data/analytics recruiters.",
  "interview-feedback": "Mock technical interview for a backend developer role. I explained REST and HTTP status codes clearly and gave a good example from my internship. I struggled with SQL joins and couldn't write a GROUP BY query. I spoke too fast when nervous and didn't ask clarifying questions.",
};

let features = [];
let current = null;
let draft = null;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const body = await res.json().catch(() => ({ ok: false, error: { code: "BAD_RESPONSE", message: `HTTP ${res.status}` } }));
  return { status: res.status, body };
}

function errorHtml(status, err) {
  const details = (err?.details || []).map((d) => `<li><code>${esc(d.path || "(root)")}</code>: ${esc(d.message)}</li>`).join("");
  return `<span class="status error">HTTP ${status} · ${esc(err?.code)}</span><div>${esc(err?.message)}</div>${details ? `<ul>${details}</ul>` : ""}`;
}

async function init() {
  const h = await api("/health");
  $("#health").textContent = h.body.ok ? `API ok · DB ${h.body.db.status} · ${h.body.model}` : "API down";
  features = (await api("/features")).body.features;
  $("#tabs").innerHTML = features.map((f) => `<button type="button" data-key="${f.key}">${esc(f.label)}</button>`).join("");
  $("#tabs").addEventListener("click", (e) => e.target.dataset.key && select(e.target.dataset.key));
  select(features[0].key);
}

async function select(key) {
  current = features.find((f) => f.key === key);
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.key === key)));
  $("#feature-title").textContent = `1 · Input — ${current.label}`;
  $("#preview-card").hidden = true;
  $("#result-card").hidden = true;
  $("#text").value = "";
  $("#file").value = "";
  draft = null;
  $("#profile-row").hidden = current.profile === "none";
  $("#profile-req").textContent = current.profile === "required" ? "(required)" : "(optional — used as context)";
  if (current.profile !== "none") await loadProfiles();
  loadRecords();
}

async function loadProfiles() {
  const { body } = await api("/profiles?limit=50");
  const opts = (body.items || []).map((p) => `<option value="${p.id}">${esc(p.full_name)} — ${esc(p.headline || "")}</option>`).join("");
  $("#profile").innerHTML = (current.profile === "required" ? "" : '<option value="">— none —</option>') + opts;
  if (!opts && current.profile === "required") $("#profile").innerHTML = '<option value="">No profiles yet — create one in the first tab</option>';
}

$("#sample").addEventListener("click", () => ($("#text").value = SAMPLES[current.key] || ""));

$("#extract").addEventListener("click", async () => {
  const btn = $("#extract");
  btn.disabled = true;
  btn.textContent = "Extracting…";
  try {
    const file = $("#file").files[0];
    const profileId = current.profile !== "none" ? $("#profile").value : "";
    let opts;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      if (profileId) fd.append("profile_id", profileId);
      opts = { method: "POST", body: fd };
    } else {
      opts = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: $("#text").value, ...(profileId ? { profile_id: profileId } : {}) }) };
    }
    const { status, body } = await api(`/${current.key}/extract`, opts);
    $("#result-card").hidden = true;
    $("#preview-card").hidden = false;
    if (!body.ok) {
      draft = null;
      $("#validation").innerHTML = errorHtml(status, body.error);
      $("#extras").innerHTML = "";
      $("#preview").value = "";
      $("#confirm").disabled = true;
      return;
    }
    draft = body;
    renderPreview(body);
  } finally {
    btn.disabled = false;
    btn.textContent = "Extract with AI";
  }
});

function renderPreview(d) {
  const v = d.validation;
  const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
  $("#validation").innerHTML = `
    <span class="status ${v.status}">${v.status.replace(/_/g, " ")}</span>
    <dl class="kv">
      <dt>Source</dt><dd>${esc(d.source.type)}${d.source.file_name ? " · " + esc(d.source.file_name) : ""} · ${d.source.chars} chars</dd>
      <dt>AI</dt><dd>${esc(d.ai.model)} · ${d.ai.attempts} attempt(s)</dd>
      <dt>Privacy</dt><dd>${d.privacy.redacted_emails} email(s), ${d.privacy.redacted_phones} phone(s), ${d.privacy.redacted_links} link(s) redacted before AI</dd>
      <dt>Missing required</dt><dd>${v.missing_required.length ? esc(v.missing_required.join(", ")) : "none"}</dd>
      <dt>Missing (all)</dt><dd>${v.missing_fields.length ? esc(v.missing_fields.join(", ")) : "none"}</dd>
    </dl>
    ${v.warnings.length ? `<label>Warnings</label>${list(v.warnings)}` : ""}
    ${d.source.preview_text ? `<label>Transcript (redacted)</label><div class="muted">${esc(d.source.preview_text)}</div>` : ""}`;

  const c = d.extras?.comparison;
  $("#extras").innerHTML = c
    ? `<label>Match (computed in code)</label><dl class="kv">
        <dt>Score</dt><dd><strong>${c.match_score ?? "—"}</strong> · ${esc(c.verdict)}</dd>
        <dt>Required matched</dt><dd>${esc(c.matched_required.join(", ") || "—")}</dd>
        <dt>Required missing</dt><dd>${esc(c.missing_required.join(", ") || "—")}</dd>
        <dt>Preferred matched</dt><dd>${esc(c.matched_preferred.join(", ") || "—")}</dd>
        <dt>Preferred missing</dt><dd>${esc(c.missing_preferred.join(", ") || "—")}</dd></dl>`
    : "";

  $("#preview").value = JSON.stringify(d.preview, null, 2);
  $("#confirm").disabled = false;
  $("#confirm").textContent = v.can_save ? "Confirm & save to database" : "Fill missing fields, then save";
  const m = d.existing_match;
  $("#update-wrap").hidden = !m;
  $("#as-update").checked = Boolean(m);
  $("#update-target").textContent = m ? `(${m.full_name}, v${m.version})` : "";
}

$("#confirm").addEventListener("click", async () => {
  if (!draft) return;
  let data;
  try {
    data = JSON.parse($("#preview").value);
  } catch {
    toast("Preview is not valid JSON — fix it before saving.");
    return;
  }
  const update = $("#as-update").checked && draft.existing_match;
  const msg = update ? `Update existing profile "${draft.existing_match.full_name}"?` : `Save this ${current.label.toLowerCase()} to the database?`;
  if (!confirm(msg)) return;

  const { status, body } = await api(`/${current.key}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft_id: draft.draft_id, data, ...(update ? { mode: "update", target_id: draft.existing_match.id } : {}) }),
  });
  $("#result-card").hidden = false;
  if (!body.ok) {
    $("#result").innerHTML = errorHtml(status, body.error);
    return;
  }
  $("#result").innerHTML = `<span class="status valid">HTTP ${status} · ${body.operation.toUpperCase()}</span>
    <dl class="kv"><dt>Table</dt><dd>${esc(body.table)}</dd><dt>Record id</dt><dd>${esc(body.record.id)}</dd>
    <dt>Version</dt><dd>${body.record.version}</dd><dt>Saved at</dt><dd>${esc(body.record.updated_at)}</dd>
    <dt>Edited by user</dt><dd>${body.record.ai?.edited_by_user ? "yes" : "no"}</dd></dl>`;
  draft = null;
  $("#confirm").disabled = true;
  toast(`Record ${body.operation} in ${body.table}`);
  loadRecords();
});

async function loadRecords() {
  const { body } = await api(`/${current.key}?limit=20`);
  const titleOf = (r) => r.full_name || r.target_role || r.job_title || r.title || r.role || "(untitled)";
  $("#records").innerHTML = body.items?.length
    ? body.items
        .map((r) => `<div class="rec"><span>${esc(titleOf(r))} <span class="muted">· v${r.version} · ${esc(r.validation?.status)}${r.comparison ? " · score " + r.comparison.match_score : ""}</span></span>
          <span><button class="ghost small" data-view="${r.id}">View</button><button class="ghost small" data-del="${r.id}">Delete</button></span></div>`)
        .join("")
    : "No records yet.";
}

$("#refresh").addEventListener("click", loadRecords);
$("#records").addEventListener("click", async (e) => {
  const { view, del } = e.target.dataset;
  if (view) {
    const { body } = await api(`/${current.key}/${view}`);
    $("#result-card").hidden = false;
    $("#result").innerHTML = `<textarea rows="16" class="mono" readonly>${esc(JSON.stringify(body.record, null, 2))}</textarea>`;
  }
  if (del && confirm("Delete this record permanently?")) {
    const { body } = await api(`/${current.key}/${del}?confirm=true`, { method: "DELETE" });
    toast(body.ok ? "Deleted" : body.error.message);
    loadRecords();
  }
});

init().catch((e) => ($("#health").textContent = "API unreachable: " + e.message));
