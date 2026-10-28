import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { AppError } from "../middleware/errors.js";
import { FEATURES, getFeature } from "../services/features.js";
import { extractPreview, confirmDraft, editRecord } from "../services/pipeline.js";
import * as repo from "../db/repository.js";
import { jsonSchemaFor } from "../prompts/index.js";

const router = Router();

// Describes every feature (fields, required fields, JSON Schema) so the frontend and report can render them.
router.get("/features", (req, res) => {
  res.json({
    ok: true,
    features: Object.values(FEATURES).map((f) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      profile: f.profileContext,
      inputs: ["text", "document", "audio"],
      schema: jsonSchemaFor(f.schema),
    })),
  });
});

router.param("feature", (req, res, next, key) => {
  const feature = getFeature(key);
  if (!feature) return next(new AppError(404, "UNKNOWN_FEATURE", `Unknown feature "${key}". Valid: ${Object.keys(FEATURES).join(", ")}`));
  req.feature = feature;
  next();
});

router.param("id", (req, res, next, id) => {
  if (!repo.isValidId(id)) return next(new AppError(400, "INVALID_ID", `Invalid id: ${id}`));
  next();
});

// 1) Process input with AI and return a validated preview (nothing is saved yet).
router.post("/:feature/extract", upload.single("file"), async (req, res) => {
  const result = await extractPreview(req.feature, req);
  res.json({ ok: true, ...result });
});

// 2) User confirmed the preview: create or update the record in the database.
router.post("/:feature/confirm", (req, res) => {
  const result = confirmDraft(req.feature, req.body);
  res.status(result.operation === "created" ? 201 : 200).json({ ok: true, ...result });
});

router.get("/:feature", (req, res) => {
  const { profile_id } = req.query;
  if (profile_id && !repo.isValidId(profile_id)) throw new AppError(400, "INVALID_ID", "profile_id is not a valid id.");
  const items = repo.listRecords(req.feature.key, { profileId: profile_id, limit: Math.min(Number(req.query.limit) || 20, 100) });
  res.json({ ok: true, count: items.length, items });
});

router.get("/:feature/:id", (req, res) => {
  const record = repo.findRecord(req.feature.key, req.params.id);
  if (!record) throw new AppError(404, "RECORD_NOT_FOUND", "Record not found.");
  res.json({ ok: true, record });
});

router.put("/:feature/:id", (req, res) => {
  res.json({ ok: true, ...editRecord(req.feature, req.params.id, req.body) });
});

// Deleting is irreversible, so the client must confirm explicitly.
router.delete("/:feature/:id", (req, res) => {
  if (req.query.confirm !== "true") throw new AppError(400, "CONFIRMATION_REQUIRED", "Add ?confirm=true to delete this record.");
  if (!repo.deleteRecord(req.feature.key, req.params.id)) throw new AppError(404, "RECORD_NOT_FOUND", "Record not found.");
  res.json({ ok: true, operation: "deleted", id: req.params.id });
});

export default router;
