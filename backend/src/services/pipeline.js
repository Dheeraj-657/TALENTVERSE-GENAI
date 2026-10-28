import { AppError } from "../middleware/errors.js";
import * as repo from "../db/repository.js";
import { getPath, isEmptyValue } from "../schemas/common.js";
import { extractStructured } from "./ai.js";
import { resolveInput } from "./input.js";
import { redactPII, buildContact } from "./pii.js";

function assertId(id, label) {
  if (!repo.isValidId(id)) throw new AppError(400, "INVALID_ID", `${label} is not a valid id.`);
}

function loadProfile(feature, profileId) {
  if (!profileId) {
    if (feature.profileContext === "required") throw new AppError(400, "PROFILE_REQUIRED", "Select a saved profile (profile_id) to compare against.");
    return null;
  }
  assertId(profileId, "profile_id");
  const profile = repo.findRecord("profiles", profileId);
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "The selected profile does not exist.");
  return profile;
}

// Only non-identifying profile facts are shared with the AI.
function profileContext(profile) {
  return {
    headline: profile.headline,
    total_experience_years: profile.total_experience_years,
    skills: profile.skills.map((s) => ({ name: s.name, proficiency: s.proficiency })),
  };
}

export function assessValidation(feature, data, warnings = []) {
  const missingRequired = feature.required.filter((f) => isEmptyValue(getPath(data, f)));
  const reported = Array.isArray(data.missing_fields) ? data.missing_fields : [];
  const missing = [...new Set([...missingRequired, ...reported])];
  const status = missingRequired.length ? "incomplete" : warnings.length ? "valid_with_warnings" : "valid";
  return { status, missing_fields: missing, missing_required: missingRequired, warnings, can_save: missingRequired.length === 0 };
}

function runPostProcess(feature, data, ctx) {
  const { warnings = [], extras = {} } = feature.postProcess({ data, ...ctx }) || {};
  return { warnings, extras };
}

// Step 1: input -> AI -> validated preview (saved as a temporary draft, NOT as a record).
export async function extractPreview(feature, req) {
  const profile = loadProfile(feature, req.body?.profile_id);
  const { text, source } = await resolveInput(req);
  const { redacted, contacts } = redactPII(text);

  const context = profile && feature.sendProfileToAi !== false ? profileContext(profile) : undefined;
  const ai = await extractStructured({ promptKey: feature.promptKey, schema: feature.schema, input: redacted, context, client: req.app.locals.aiClient });

  const data = ai.data;
  const { warnings, extras } = runPostProcess(feature, data, { sourceText: redacted, profile });
  const validation = assessValidation(feature, data, warnings);

  const contact = feature.key === "profiles" ? buildContact(contacts) : undefined;
  let existing_match = null;
  if (contact?.email_hash) {
    const existing = repo.findProfileByEmailHash(contact.email_hash);
    if (existing) existing_match = { id: existing.id, full_name: existing.full_name, version: existing.version, updated_at: existing.updated_at };
  }

  const draftId = repo.createDraft({
    feature: feature.key,
    data,
    extras,
    profile: profile?.id ?? null,
    source,
    contact,
    input_excerpt: redacted.slice(0, 2000),
    ai: { model: ai.model, attempts: ai.attempts },
  });

  return {
    feature: feature.key,
    draft_id: draftId,
    expires_in_seconds: repo.DRAFT_TTL_SECONDS,
    preview: data,
    extras,
    validation,
    source: { ...source, preview_text: source.type === "audio" ? redacted.slice(0, 600) : undefined },
    privacy: { redacted_emails: contacts.emails.length, redacted_phones: contacts.phones.length, redacted_links: contacts.links.length, contact },
    existing_match,
    ai: { model: ai.model, attempts: ai.attempts, usage: ai.usage },
  };
}

function toRecord(feature, data, extras, draft) {
  const { missing_fields, ...fields } = data;
  const record = { ...fields };
  if (feature.key === "profiles") record.contact = draft.contact;
  else record.profile = draft.profile;
  if (feature.key === "learning-plans") {
    record.goal_text = draft.input_excerpt;
    record.total_weeks = extras.total_weeks;
  }
  if (feature.key === "project-briefs") record.interests_text = draft.input_excerpt;
  if (feature.key === "job-matches") record.comparison = extras.comparison;
  return record;
}

// Re-validates (possibly user-edited) data exactly like AI output, so edits cannot bypass the schema.
function validateForSave(feature, rawData, { profileId, sourceText }) {
  const parsed = feature.schema.safeParse(rawData);
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_FAILED", "Edited data does not match the schema.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const data = parsed.data;
  const profile = profileId ? repo.findRecord("profiles", profileId) : null;
  if (feature.profileContext === "required" && !profile) throw new AppError(404, "PROFILE_NOT_FOUND", "The linked profile no longer exists.");

  const { warnings, extras } = runPostProcess(feature, data, { sourceText: sourceText ?? "", profile });
  const validation = assessValidation(feature, data, warnings);
  if (!validation.can_save) {
    throw new AppError(422, "REQUIRED_FIELDS_MISSING", `Cannot save: fill in ${validation.missing_required.join(", ")} first.`, validation.missing_required.map((p) => ({ path: p, message: "Required" })));
  }
  return { data, extras, validation };
}

const storedValidation = (v) => ({ status: v.status, missing_fields: v.missing_fields, warnings: v.warnings });

// Step 2: user confirmed the preview -> create a new record or update an existing one.
export function confirmDraft(feature, body) {
  const { draft_id, data: editedData, mode = "create", target_id } = body || {};
  if (!draft_id) throw new AppError(400, "DRAFT_REQUIRED", "draft_id is required. Run extraction first.");
  assertId(draft_id, "draft_id");
  if (!["create", "update"].includes(mode)) throw new AppError(400, "INVALID_MODE", 'mode must be "create" or "update".');
  if (mode === "update") {
    if (!target_id) throw new AppError(400, "TARGET_REQUIRED", "target_id is required when mode is update.");
    assertId(target_id, "target_id");
  }

  const draft = repo.findDraft(draft_id, feature.key);
  if (!draft) throw new AppError(404, "DRAFT_NOT_FOUND", "Preview expired or not found. Run the extraction again.");

  const edited = editedData !== undefined && JSON.stringify(editedData) !== JSON.stringify(draft.data);
  const { data, extras, validation } = validateForSave(feature, editedData ?? draft.data, { profileId: draft.profile, sourceText: draft.input_excerpt });

  const record = {
    ...toRecord(feature, data, extras, draft),
    source: draft.source,
    validation: storedValidation(validation),
    ai: { ...draft.ai, edited_by_user: edited },
  };

  let saved;
  if (mode === "update") {
    saved = repo.updateRecord(feature.key, target_id, record);
    if (!saved) throw new AppError(404, "RECORD_NOT_FOUND", "The record to update does not exist.");
  } else {
    saved = repo.insertRecord(feature.key, record);
  }

  repo.deleteDraft(draft.id);
  return { operation: mode === "update" ? "updated" : "created", table: repo.TABLES[feature.key].table, record: saved };
}

// Direct edit of a saved record (no AI). Same schema + required-field rules apply.
export function editRecord(feature, id, body) {
  assertId(id, "id");
  const existing = repo.findRecord(feature.key, id);
  if (!existing) throw new AppError(404, "RECORD_NOT_FOUND", "Record not found.");

  const merged = { ...existing, ...(body?.data || {}), missing_fields: [] };
  const { data, extras, validation } = validateForSave(feature, pickSchemaFields(feature, merged), {
    profileId: existing.profile,
    sourceText: existing.goal_text ?? existing.interests_text,
  });
  const { missing_fields, ...fields } = data;
  const update = { ...fields, validation: storedValidation(validation), ai: { ...existing.ai, edited_by_user: true } };
  if (feature.key === "job-matches") update.comparison = extras.comparison;
  if (feature.key === "learning-plans") update.total_weeks = extras.total_weeks;

  return { operation: "updated", table: repo.TABLES[feature.key].table, record: repo.updateRecord(feature.key, id, update) };
}

// Keep only the fields the AI schema knows about (drops id, timestamps, metadata).
function pickSchemaFields(feature, obj) {
  const out = {};
  for (const [key, type] of Object.entries(feature.schema.shape)) {
    let value = obj[key] ?? null;
    const itemKeys = type.element?.shape ? Object.keys(type.element.shape) : null;
    if (Array.isArray(value) && itemKeys) value = value.map((item) => Object.fromEntries(itemKeys.map((k) => [k, item?.[k] ?? null])));
    out[key] = value;
  }
  return out;
}
