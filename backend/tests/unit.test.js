import { test } from "node:test";
import assert from "node:assert/strict";
import { redactPII, maskEmail } from "../src/services/pii.js";
import { normalizeSkill, compareProfileToJob } from "../src/services/matching.js";
import { normalizeAiOutput } from "../src/schemas/common.js";

test("redactPII removes email, phone and profile links", () => {
  const { redacted, contacts } = redactPII("Mail a.b@x.io, call +1 (555) 123-4567, see github.com/ab");
  assert.equal(contacts.emails[0], "a.b@x.io");
  assert.ok(!redacted.includes("a.b@x.io"));
  assert.ok(!redacted.includes("555"));
  assert.ok(redacted.includes("[REDACTED_LINK]"));
  assert.equal(maskEmail("john@x.com"), "jo**@x.com");
});

test("redactPII leaves years and short numbers alone", () => {
  const { redacted } = redactPII("Worked 2019 - 2023 on 3 projects");
  assert.equal(redacted, "Worked 2019 - 2023 on 3 projects");
});

test("normalizeSkill handles aliases and punctuation", () => {
  assert.equal(normalizeSkill("Node.js"), "nodejs");
  assert.equal(normalizeSkill("node"), "nodejs");
  assert.equal(normalizeSkill("React.js"), "react");
  assert.equal(normalizeSkill("JS"), "javascript");
});

test("compareProfileToJob does not match java to javascript", () => {
  const r = compareProfileToJob({ skills: [{ name: "JavaScript" }], total_experience_years: null }, { required_skills: ["Java"], preferred_skills: [] });
  assert.deepEqual(r.missing_required, ["Java"]);
  assert.equal(r.match_score, 0);
});

test("compareProfileToJob returns null score with no requirements instead of guessing", () => {
  const r = compareProfileToJob({ skills: [] }, { required_skills: [], preferred_skills: [] });
  assert.equal(r.match_score, null);
  assert.equal(r.verdict, "insufficient_data");
});

test("normalizeAiOutput maps placeholders to null and normalises enums", () => {
  const out = normalizeAiOutput({ name: " N/A ", priority: "High", importance: "Nice to have", list: ["a", "n/a"], current_level: "None" });
  assert.deepEqual(out, { name: null, priority: "high", importance: "nice_to_have", list: ["a"], current_level: "none" });
});
