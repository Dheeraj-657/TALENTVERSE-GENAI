import crypto from "node:crypto";
import { getDB } from "../config/db.js";

const COMMON_JSON = ["source", "validation", "ai"];

// One entry per feature: table name, plain columns, and JSON columns.
export const TABLES = {
  profiles: {
    table: "profiles",
    columns: ["full_name", "headline", "location", "total_experience_years", "summary", "email_masked", "email_hash", "phone_masked", "links_count"],
    json: ["skills", "experience", "education", "certifications", "languages"],
  },
  "learning-plans": {
    table: "learning_plans",
    columns: ["profile_id", "goal_text", "target_role", "timeframe_weeks", "total_weeks"],
    json: ["current_skills", "required_skills", "skill_gaps", "milestones"],
  },
  "job-matches": {
    table: "job_matches",
    columns: ["profile_id", "job_title", "company", "seniority", "employment_type", "location", "min_experience_years", "match_score"],
    json: ["required_skills", "preferred_skills", "responsibilities", "qualifications", "comparison"],
  },
  "project-briefs": {
    table: "project_briefs",
    columns: ["profile_id", "interests_text", "title", "tagline", "problem_statement", "target_users", "difficulty", "estimated_weeks"],
    json: ["tech_stack", "core_features", "stretch_features", "skills_demonstrated", "milestones", "success_criteria"],
  },
  "interview-feedback": {
    table: "interview_feedback",
    columns: ["profile_id", "role", "interview_type", "overall_readiness"],
    json: ["strengths", "improvement_areas", "next_practice_tasks"],
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isValidId = (id) => typeof id === "string" && UUID_RE.test(id);

const now = () => new Date().toISOString();
const toJson = (v) => (v === undefined ? null : JSON.stringify(v));
const fromJson = (v) => (v == null ? null : JSON.parse(v));

// Flat API record -> SQL values. Profile contact is spread into its masked columns.
function toRow(cfg, record) {
  const flat = { ...record };
  if (record.contact) Object.assign(flat, record.contact);
  if (record.profile !== undefined) flat.profile_id = record.profile;
  if (record.comparison) flat.match_score = record.comparison.match_score;
  const row = {};
  for (const c of cfg.columns) if (flat[c] !== undefined) row[c] = flat[c];
  for (const c of [...cfg.json, ...COMMON_JSON]) if (flat[c] !== undefined) row[c] = toJson(flat[c]);
  return row;
}

// SQL row -> API record.
function fromRow(cfg, row) {
  if (!row) return null;
  const out = { id: row.id };
  for (const c of cfg.columns) out[c] = row[c];
  for (const c of [...cfg.json, ...COMMON_JSON]) out[c] = fromJson(row[c]);
  if (cfg.table === "profiles") {
    out.contact = { email_masked: row.email_masked, email_hash: row.email_hash, phone_masked: row.phone_masked, links_count: row.links_count };
    for (const k of ["email_masked", "email_hash", "phone_masked", "links_count"]) delete out[k];
  } else {
    out.profile = row.profile_id;
    delete out.profile_id;
  }
  delete out.match_score;
  Object.assign(out, { version: row.version, created_at: row.created_at, updated_at: row.updated_at });
  return out;
}

export function insertRecord(feature, record) {
  const cfg = TABLES[feature];
  const row = { id: crypto.randomUUID(), ...toRow(cfg, record), version: 1, created_at: now(), updated_at: now() };
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${cfg.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING *`;
  return fromRow(cfg, getDB().prepare(sql).get(...Object.values(row)));
}

// Updates only the given fields and bumps version. Returns null if the id does not exist.
export function updateRecord(feature, id, record) {
  const cfg = TABLES[feature];
  const row = { ...toRow(cfg, record), updated_at: now() };
  const sets = Object.keys(row).map((c) => `${c} = ?`);
  const sql = `UPDATE ${cfg.table} SET ${sets.join(", ")}, version = version + 1 WHERE id = ? RETURNING *`;
  return fromRow(cfg, getDB().prepare(sql).get(...Object.values(row), id));
}

export function findRecord(feature, id) {
  const cfg = TABLES[feature];
  return fromRow(cfg, getDB().prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).get(id));
}

export function listRecords(feature, { profileId, limit = 20 } = {}) {
  const cfg = TABLES[feature];
  const where = profileId && cfg.table !== "profiles" ? "WHERE profile_id = ?" : "";
  const params = where ? [profileId, limit] : [limit];
  return getDB()
    .prepare(`SELECT * FROM ${cfg.table} ${where} ORDER BY updated_at DESC LIMIT ?`)
    .all(...params)
    .map((r) => fromRow(cfg, r));
}

export function deleteRecord(feature, id) {
  const cfg = TABLES[feature];
  return getDB().prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).run(id).changes > 0;
}

export function findProfileByEmailHash(hash) {
  return fromRow(TABLES.profiles, getDB().prepare("SELECT * FROM profiles WHERE email_hash = ? ORDER BY updated_at DESC LIMIT 1").get(hash));
}

export function countRecords(feature) {
  return getDB().prepare(`SELECT COUNT(*) AS n FROM ${TABLES[feature].table}`).get().n;
}

// ---------- drafts ----------
const DRAFT_TTL_MS = 60 * 60 * 1000;
const DRAFT_JSON = ["data", "extras", "source", "contact", "ai"];

export function createDraft(draft) {
  const db = getDB();
  db.prepare("DELETE FROM drafts WHERE expires_at < ?").run(now()); // housekeeping
  const row = {
    id: crypto.randomUUID(),
    feature: draft.feature,
    profile_id: draft.profile ?? null,
    input_excerpt: draft.input_excerpt ?? null,
    ...Object.fromEntries(DRAFT_JSON.map((k) => [k, toJson(draft[k])])),
    created_at: now(),
    expires_at: new Date(Date.now() + DRAFT_TTL_MS).toISOString(),
  };
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO drafts (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...Object.values(row));
  return row.id;
}

export function findDraft(id, feature) {
  const row = getDB().prepare("SELECT * FROM drafts WHERE id = ? AND feature = ? AND expires_at > ?").get(id, feature, now());
  if (!row) return null;
  const out = { id: row.id, feature: row.feature, profile: row.profile_id, input_excerpt: row.input_excerpt };
  for (const k of DRAFT_JSON) out[k] = fromJson(row[k]);
  return out;
}

export function deleteDraft(id) {
  getDB().prepare("DELETE FROM drafts WHERE id = ?").run(id);
}

export const DRAFT_TTL_SECONDS = DRAFT_TTL_MS / 1000;
