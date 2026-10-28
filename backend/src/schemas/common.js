import { z } from "zod";

// Shared building blocks. Unknown values must be null (never guessed), so most scalars are nullable.
export const nstr = (desc) => z.string().min(1).nullable().describe(desc);
export const str = (desc) => z.string().min(1).describe(desc);
export const nint = (desc, min = 0, max = 1000) => z.number().int().min(min).max(max).nullable().describe(desc);
export const strList = (desc) => z.array(z.string().min(1)).describe(desc);

export const PROFICIENCY = ["beginner", "intermediate", "advanced", "expert"];
export const LEVEL = ["none", ...PROFICIENCY];
export const PRIORITY = ["high", "medium", "low"];

export const missingFields = z
  .array(z.string())
  .describe("Names of fields that could not be found in the input and were therefore set to null or left empty.");

// Keys whose values are enums: lower-cased / snake_cased before validation so "Advanced" or "Must Have" still validate.
export const ENUM_KEYS = new Set([
  "category",
  "proficiency",
  "required_proficiency",
  "current_level",
  "target_level",
  "importance",
  "priority",
  "difficulty",
  "seniority",
  "employment_type",
  "interview_type",
  "overall_readiness",
]);

// Placeholder strings models emit instead of null. Treat them as "not found" rather than real data.
const PLACEHOLDERS = new Set(["", "n/a", "na", "none", "null", "unknown", "not specified", "not mentioned", "not provided", "-"]);

export function normalizeAiOutput(value, key) {
  if (Array.isArray(value)) {
    return value
      .map((v) => normalizeAiOutput(v))
      .filter((v) => v !== null && v !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeAiOutput(v, k)]));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // "none" is a real level value, so keep it for level enums.
    if (PLACEHOLDERS.has(trimmed.toLowerCase()) && !(key && ENUM_KEYS.has(key) && trimmed.toLowerCase() === "none")) {
      return null;
    }
    if (key && ENUM_KEYS.has(key)) return trimmed.toLowerCase().replace(/[\s-]+/g, "_");
    return trimmed;
  }
  return value;
}

// Read a dotted path such as "skills" or "job.title" from an object.
export function getPath(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

export function isEmptyValue(v) {
  return v === null || v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
}
